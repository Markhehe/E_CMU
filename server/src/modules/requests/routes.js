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
const requestStatusSchema = z.enum([
  "PROCESSING",
  "READY FOR PICKUP",
  "COMPLETED",
  "REJECTED",
]);

const statusValues = {
  PROCESSING: ["processing"],
  "READY FOR PICKUP": ["ready_for_retrieval", "ready"],
  COMPLETED: ["fulfilled"],
  REJECTED: ["rejected"],
};

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

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const quantity = Number(data.additionalDetails.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: "Quantity must be between 1 and 10" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO requests
           (requester_id, document_type_id, purpose, additional_details, fee_amount, fee_currency)
         SELECT $1, id, $2, $3, base_fee * $5, currency
         FROM document_types
         WHERE id = $4 AND active = TRUE
         RETURNING *`,
        [req.user.id, data.purpose ?? null, data.additionalDetails, data.documentTypeId, quantity],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Document type is unavailable" });
      }

      const createdRequest = result.rows[0];
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, NULL, 'submitted', $2, 'Request submitted')`,
        [createdRequest.id, req.user.id],
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

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("registrar", "administrator", "finance"), // <--- ADDED "finance" HERE
  async (req, res, next) => {
    const parsedId = requestIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    const parsedStatus = requestStatusSchema.safeParse(req.body?.status);
    if (!parsedStatus.success) {
      return res.status(400).json({
        error: "Status must be PROCESSING, READY FOR PICKUP, COMPLETED, or REJECTED",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT id, status FROM requests WHERE id = $1 FOR UPDATE",
        [parsedId.data],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }

      const statusEnums = await client.query(
        `SELECT enumlabel
         FROM pg_enum
         WHERE enumtypid = 'public.request_status'::regtype`,
      );
      const availableStatuses = new Set(
        statusEnums.rows.map(({ enumlabel }) => enumlabel),
      );
      const nextStatus = statusValues[parsedStatus.data].find((value) =>
        availableStatuses.has(value),
      );
      if (!nextStatus) {
        throw new Error(
          `Database request_status enum does not support ${parsedStatus.data}`,
        );
      }

      const previousStatus = current.rows[0].status;
      const updated = await client.query(
        `UPDATE requests
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status, updated_at`,
        [nextStatus, parsedId.data],
      );

      if (previousStatus !== nextStatus) {
        await client.query(
          `INSERT INTO request_status_history
             (request_id, from_status, to_status, changed_by, comment)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            parsedId.data,
            previousStatus,
            nextStatus,
            req.user.id,
            `Status updated to ${parsedStatus.data}`,
          ],
        );
      }

      await client.query("COMMIT");
      return res.json({ request: updated.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const isStaff = req.user.roles.some((role) =>
      ["registrar", "saso", "finance", "administrator"].includes(role),
    );
    const values = isStaff ? [] : [req.user.id];
    const result = await pool.query(
      `SELECT req.*, doc.name AS document_type_name,
              usr.full_name AS requester_name
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