import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();
const requestIdSchema = z.string().uuid();
const createRequestSchema = z.object({
  documentTypeId: z.coerce.number().int().positive(),
  purpose: z.string().trim().max(1000).optional(),
  additionalDetails: z.record(z.string(), z.string().max(500)).default({}),
});
const requestCommentSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
  visibility: z.enum(["requester", "staff"]),
});
const commentIdSchema = z.coerce.number().int().positive().safe();
const staffRoles = ["registrar"];

router.delete("/:id", requireAuth, requireRole("student"), async (req, res, next) => {
  const parsedId = requestIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query(
      `SELECT status
       FROM requests
       WHERE id = $1 AND requester_id = $2
       FOR UPDATE`,
      [parsedId.data, req.user.id],
    );
    if (request.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Request not found" });
    }
    if (request.rows[0].status !== "pending_review") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Only requests pending review can be deleted.",
      });
    }

    await client.query(
      "DELETE FROM requests WHERE id = $1 AND requester_id = $2",
      [parsedId.data, req.user.id],
    );
    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to roll back student request deletion:", rollbackError);
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.get("/document-types", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, base_fee, currency, processing_days
       FROM document_types
       WHERE active = TRUE
       ORDER BY name`,
    );
    return res.json({ documentTypes: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireRole("student"), async (req, res, next) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const quantity = Number(data.additionalDetails.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: "Quantity must be between 1 and 10" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT id FROM users WHERE id = $1 FOR UPDATE",
        [req.user.id],
      );
      const concurrentRequests = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM requests
         WHERE requester_id = $1 AND status <> 'fulfilled'`,
        [req.user.id],
      );
      if (concurrentRequests.rows[0].count >= 5) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "You can have up to 5 concurrent requests. Fulfilled requests do not count toward this limit.",
        });
      }

      const clearanceResult = await client.query(
        `SELECT status
         FROM clearance_submissions
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`,
        [req.user.id],
      );
      if (clearanceResult.rows[0]?.status !== "verified") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Verified student clearance is required before submitting a document request.",
        });
      }

      const additionalDetails = {
        ...data.additionalDetails,
        collectionMethod: "Pick-up",
        paymentMethod: "Pay at the Office",
      };
      const result = await client.query(
        `INSERT INTO requests
           (requester_id, document_type_id, purpose, additional_details, fee_amount, fee_currency)
         SELECT $1, id, $2, $3, base_fee * $5, currency
         FROM document_types
         WHERE id = $4 AND active = TRUE
         RETURNING *`,
        [req.user.id, data.purpose ?? null, additionalDetails, data.documentTypeId, quantity],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Document type is unavailable" });
      }

      const createdRequest = result.rows[0];
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, NULL, 'pending_review', $2, 'Request submitted')`,
        [createdRequest.id, req.user.id],
      );
      await client.query(
        `INSERT INTO notifications (user_id, request_id, channel, type, title, message)
         SELECT assignment.user_id, $1, 'in_app', 'registrar_request_submitted',
                'New document request',
                CONCAT('New request from ', student.full_name, ' (', $3::text, ').')
         FROM user_roles AS assignment
         INNER JOIN roles AS account_role
           ON account_role.id = assignment.role_id
         CROSS JOIN users AS student
         WHERE lower(account_role.name) = 'registrar'
           AND student.id = $2`,
        [createdRequest.id, req.user.id, createdRequest.display_code],
      );
      await client.query("COMMIT");
      return res.status(201).json({ request: createdRequest });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/comments", requireAuth, async (req, res, next) => {
  const parsedId = requestIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    const isStaff = req.user.roles.some((role) => staffRoles.includes(role));
    const result = await pool.query(
      `SELECT rc.id, rc.author_id, rc.comment, rc.visibility,
              rc.created_at, author.full_name AS author_name
       FROM request_comments AS rc
       INNER JOIN users AS author ON author.id = rc.author_id
       INNER JOIN requests AS request_row ON request_row.id = rc.request_id
       WHERE rc.request_id = $1
         AND ($2::boolean OR request_row.requester_id = $3)
         AND ($2::boolean OR rc.visibility = 'requester')
       ORDER BY rc.created_at ASC, rc.id ASC`,
      [parsedId.data, isStaff, req.user.id],
    );
    return res.json({ comments: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  requireRole(...staffRoles),
  async (req, res, next) => {
    const parsedRequestId = requestIdSchema.safeParse(req.params.id);
    const parsedCommentId = commentIdSchema.safeParse(req.params.commentId);
    if (!parsedRequestId.success || !parsedCommentId.success) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }

    try {
      const result = await pool.query(
        `DELETE FROM request_comments
         WHERE request_id = $1
           AND id = $2
           AND author_id = $3`,
        [parsedRequestId.data, parsedCommentId.data, req.user.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  },
);

router.post("/:id/comments", requireAuth, requireRole(...staffRoles), async (req, res, next) => {
  const parsedId = requestIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid request ID" });
  }
  const parsedComment = requestCommentSchema.safeParse(req.body);
  if (!parsedComment.success) {
    return res.status(400).json({
      error: parsedComment.error.issues[0]?.message || "Invalid comment",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO request_comments (request_id, author_id, visibility, comment)
       SELECT request_row.id, $2, $3, $4
       FROM requests AS request_row
       WHERE request_row.id = $1
       RETURNING id, comment, visibility, created_at`,
      [
        parsedId.data,
        req.user.id,
        parsedComment.data.visibility,
        parsedComment.data.comment,
      ],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    return res.status(201).json({
      comment: { ...result.rows[0], author_name: req.user.full_name },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const isStaff = req.user.roles.some((role) =>
      ["registrar"].includes(role),
    );
    const values = isStaff ? [] : [req.user.id];
    const result = await pool.query(
      `SELECT req.*, doc.name AS document_type_name,
              usr.full_name AS requester_name,
              usr.email AS requester_email,
              usr.student_id AS requester_student_id
       FROM requests req
       INNER JOIN document_types doc ON doc.id = req.document_type_id
       INNER JOIN users usr ON usr.id = req.requester_id
       ${isStaff ? "" : "WHERE req.requester_id = $1"}
       ORDER BY req.submitted_at DESC`,
      values,
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;