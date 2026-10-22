import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../../db/index.js";
import {
  requestReviews,
  requestStatusHistory,
  requests,
  roles,
  userRoles,
} from "../../db/schema.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  scheduleEmailNotification,
  sendPaymentReceivedEmail,
  sendReadyForPickupEmail,
  sendRequestCommentEmail,
} from "../../services/email.js";

const router = Router();

const requestIdSchema = z.object({
  id: z.string().uuid(),
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_information"]),
  comment: z.string().trim().max(2000).optional(),
});

const requestCommentSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
  visibility: z.enum(["requester", "staff"]),
});
const commentIdSchema = z.coerce.number().int().positive().safe();

const staffRoles = ["registrar"];

const paymentSchema = z
  .object({
    method: z.literal("cash"),
    amount: z.coerce.number().finite().nonnegative(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    status: z.enum(["pending", "succeeded", "failed"]),
    providerReference: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
  });

const paymentProofSchema = z.object({
  receiptDataUrl: z
    .string()
    .max(3_600_000)
    .regex(
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Upload a PNG, JPEG, or WebP receipt image",
    ),
  requestCopyDataUrl: z
    .string()
    .max(3_600_000)
    .regex(
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Upload a PNG, JPEG, or WebP copy of the printed request",
    ),
  trackingCode: z.string().trim().regex(/^[A-Fa-f0-9]{6}$/),
  paymentReference: z.string().trim().max(255).optional(),
});

const paymentMethodSchema = z.object({
  paymentMethod: z.literal("Pay at the Office"),
});
const clearanceUploadSchema = z.object({
  fileData: z.string().max(7_000_000).regex(
    /^data:(?:application\/pdf|image\/(?:png|jpeg|webp));base64,[A-Za-z0-9+/]+={0,2}$/,
    "Upload a PDF, PNG, JPEG, or WebP clearance file",
  ),
  originalName: z.string().trim().min(1).max(255),
});
const clearanceReviewSchema = z.object({
  decision: z.enum(["verified", "needs_update"]),
  comment: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.decision === "needs_update" && !value.comment?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["comment"],
      message: "Explain what the student needs to correct",
    });
  }
});
const clearanceInvalidationSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});
const walkInRequestSchema = z.object({
  studentId: z.string().trim().min(1).max(64),
  documentTypeId: z.coerce.number().int().positive().safe(),
  purpose: z.string().trim().min(1).max(2000),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

type WorkflowRequest = Request;

function requireRole(...allowedRoles: string[]) {
  return async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const assignedRoles = await db
        .select({ roleName: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(userRoles.userId, req.user.id),
            inArray(roles.name, allowedRoles),
          ),
        );

      if (assignedRoles.length === 0) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

const registrarStatusByDecision = {
  approved: "registrar_approved",
  rejected: "registrar_rejected",
  needs_information: "needs_information",
} as const;

const registrarReviewStatuses = ["submitted", "registrar_review", "needs_information"] as const;

const registrarInterventionStatuses = [
  ...registrarReviewStatuses,
  "registrar_approved",
  "saso_review",
  "saso_cleared",
  "awaiting_payment",
  "payment_review",
  "paid",
  "processing",
  "ready_for_retrieval",
  "ready",
] as const;

async function insertStatusChange(
  tx: any,
  requestId: string,
  fromStatus: string,
  toStatus: string,
  changedBy: number,
  comment?: string,
) {
  await tx
    .update(requests)
    .set({ status: toStatus, updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  await tx.insert(requestStatusHistory).values({
    requestId,
    fromStatus: fromStatus as any,
    toStatus: toStatus as any,
    changedBy,
    comment: comment ?? null,
  });
}

async function createReview(
  requestId: string,
  stage: "registrar",
  decision: "approved" | "rejected" | "needs_information",
  comment: string | undefined,
  reviewerId: number,
) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({ id: requests.id, status: requests.status })
      .from(requests)
      .where(eq(requests.id, requestId))
      .for("update")
      .limit(1);

    if (!request) {
      return { error: "Request not found", statusCode: 404 as const };
    }

    const allowedStatuses: readonly string[] =
      decision === "approved" ? registrarReviewStatuses : registrarInterventionStatuses;

    if (!allowedStatuses.includes(request.status)) {
      return {
        error: `Request cannot receive a ${stage} decision while its status is ${request.status}`,
        statusCode: 409 as const,
      };
    }

    const finalStatus =
      decision === "approved" ? "awaiting_payment" : registrarStatusByDecision[decision];

    const [review] = await tx
      .insert(requestReviews)
      .values({
        requestId,
        stage,
        decision,
        reviewerId,
        comment: comment ?? null,
      })
      .returning();

    await tx
      .update(requests)
      .set({ status: finalStatus as any, updatedAt: new Date() })
      .where(eq(requests.id, requestId));

    await tx.insert(requestStatusHistory).values({
      requestId,
      fromStatus: request.status as any,
      toStatus: finalStatus as any,
      changedBy: reviewerId,
      comment: comment ?? `${stage} decision: ${decision}`,
    });

    return { result: review };
  });
}

router.post(
  "/:id/registrar-review",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = reviewSchema.parse(req.body);
      const result = await createReview(
        id,
        "registrar",
        input.decision,
        input.comment,
        req.user!.id,
      );

      if ("error" in result) {
        return res.status(result.statusCode ?? 500).json({ error: result.error });
      }

      return res.status(201).json({ review: result.result });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id/comments",
  requireAuth,
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsedId = requestIdSchema.safeParse(req.params);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    try {
      const isStaff = req.user!.roles?.some((role) => staffRoles.includes(role)) ?? false;
      const result = await pool.query(
        `SELECT comment_row.id, comment_row.author_id, comment_row.comment, comment_row.visibility,
                comment_row.created_at, author.full_name AS author_name
         FROM request_comments AS comment_row
         INNER JOIN users AS author ON author.id = comment_row.author_id
         INNER JOIN requests AS request_row ON request_row.id = comment_row.request_id
         WHERE comment_row.request_id = $1
           AND ($2::boolean OR request_row.requester_id = $3)
           AND ($2::boolean OR comment_row.visibility = 'requester')
         ORDER BY comment_row.created_at ASC, comment_row.id ASC`,
        [parsedId.data.id, isStaff, req.user!.id],
      );
      return res.json({ comments: result.rows });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  requireRole(...staffRoles),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsedRequestId = requestIdSchema.safeParse(req.params);
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
        [parsedRequestId.data.id, parsedCommentId.data, req.user!.id],
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

router.post(
  "/:id/comments",
  requireAuth,
  requireRole(...staffRoles),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsedId = requestIdSchema.safeParse(req.params);
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
          parsedId.data.id,
          req.user!.id,
          parsedComment.data.visibility,
          parsedComment.data.comment,
        ],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (parsedComment.data.visibility === "requester") {
        scheduleEmailNotification("request comment", async () => {
          const requestDetails = await pool.query(
            `SELECT requester.email, requester.full_name, document.name AS document_name,
                    request_row.display_code
             FROM requests AS request_row
             INNER JOIN users AS requester ON requester.id = request_row.requester_id
             INNER JOIN document_types AS document ON document.id = request_row.document_type_id
             WHERE request_row.id = $1`,
            [parsedId.data.id],
          );
          const request = requestDetails.rows[0];
          if (!request) {
            throw new Error("Request details were not found for the comment notification");
          }
          await sendRequestCommentEmail({
            email: request.email,
            fullName: request.full_name,
            documentName: request.document_name,
            requestCode: request.display_code,
          });
        });
      }

      return res.status(201).json({
        comment: { ...result.rows[0], author_name: req.user!.fullName },
        ...(parsedComment.data.visibility === "requester"
          ? { emailNotificationQueued: true }
          : {}),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/comments/read",
  requireAuth,
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsedId = requestIdSchema.safeParse(req.params);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid request ID" });
    }

    try {
      const isStaff = req.user!.roles.some((role) => staffRoles.includes(role));
      const request = await pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM requests
           WHERE id = $1
             AND ($2::boolean OR requester_id = $3)
         ) AS can_access`,
        [parsedId.data.id, isStaff, req.user!.id],
      );
      if (!request.rows[0].can_access) {
        return res.status(404).json({ error: "Request not found" });
      }

      await pool.query(
        `INSERT INTO request_comment_reads (comment_id, user_id)
         SELECT comment_row.id, $2
         FROM request_comments AS comment_row
         WHERE comment_row.request_id = $1
           AND comment_row.author_id <> $2
           AND ($3::boolean OR comment_row.visibility = 'requester')
         ON CONFLICT (comment_id, user_id)
         DO UPDATE SET read_at = NOW()`,
        [parsedId.data.id, req.user!.id, isStaff],
      );
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/:id/start-processing",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT status FROM requests WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }
      if (current.rows[0].status !== "paid") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Only paid requests can enter processing." });
      }
      await client.query(
        `UPDATE requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [id],
      );
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, 'paid', 'processing', $2, 'Document processing started')`,
        [id, req.user!.id],
      );
      await client.query("COMMIT");
      return res.json({ status: "processing" });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.post(
  "/:id/ready-for-pickup",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    let requestForEmail:
      | { email: string; full_name: string; document_name: string; display_code: string }
      | undefined;

    try {
      const { id } = requestIdSchema.parse(req.params);
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT request.status, request.display_code, account.email,
                account.full_name, document.name AS document_name
         FROM requests AS request
         INNER JOIN users AS account ON account.id = request.requester_id
         INNER JOIN document_types AS document ON document.id = request.document_type_id
         WHERE request.id = $1
         FOR UPDATE OF request`,
        [id],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }

      const request = current.rows[0];
      if (!["paid", "processing", "ready_for_retrieval", "ready"].includes(request.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "A request must have verified clearance and confirmed payment before it can be marked ready for pickup.",
        });
      }

      if (["paid", "processing"].includes(request.status)) {
        await client.query(
          `UPDATE requests
           SET status = 'ready_for_retrieval', updated_at = NOW()
           WHERE id = $1`,
          [id],
        );
        await client.query(
          `INSERT INTO request_status_history
             (request_id, from_status, to_status, changed_by, comment)
              VALUES ($1, $2, 'ready_for_retrieval', $3, 'Ready for pickup')`,
             [id, request.status, req.user!.id],
        );
      }
      await client.query("COMMIT");
      requestForEmail = request;
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }

    scheduleEmailNotification("ready-for-pickup", () =>
      sendReadyForPickupEmail({
        email: requestForEmail!.email,
        fullName: requestForEmail!.full_name,
        documentName: requestForEmail!.document_name,
        requestCode: requestForEmail!.display_code,
      }),
    );
    return res.json({
      message: "Request marked ready for pickup. The email notification is being sent in the background.",
      status: "ready_for_retrieval",
      emailNotificationQueued: true,
    });
  },
);

router.post(
  "/:id/pickup",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT status FROM requests WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (current.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }
      const previousStatus = current.rows[0].status as string;
      if (!["ready_for_retrieval", "ready"].includes(previousStatus)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Only a request ready for pickup can be marked as collected.",
        });
      }

      const result = await client.query(
        `UPDATE requests
         SET status = 'fulfilled', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, completed_at`,
        [id],
      );
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, $2, 'fulfilled', $3, 'Document picked up')`,
        [id, previousStatus, req.user!.id],
      );
      await client.query("COMMIT");
      return res.json({ request: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.get(
  "/clearance/me",
  requireAuth,
  requireRole("student"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, file_data, original_name, status, comment, submitted_at, reviewed_at
         FROM clearance_submissions
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`,
        [req.user!.id],
      );
      return res.json({ clearance: result.rows[0] ?? null });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/clearance",
  requireAuth,
  requireRole("student"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsed = clearanceUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid clearance upload",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const latest = await client.query(
        `SELECT status
         FROM clearance_submissions
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [req.user!.id],
      );
      if (["submitted", "verified"].includes(latest.rows[0]?.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: latest.rows[0].status === "verified"
            ? "Your clearance is already verified."
            : "Your clearance is awaiting Registrar verification.",
        });
      }

      const result = await client.query(
        `INSERT INTO clearance_submissions (user_id, file_data, original_name)
         VALUES ($1, $2, $3)
         RETURNING id, file_data, original_name, status, comment, submitted_at, reviewed_at`,
        [req.user!.id, parsed.data.fileData, parsed.data.originalName],
      );
      await client.query("COMMIT");
      return res.status(201).json({ clearance: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.delete(
  "/clearance/:id",
  requireAuth,
  requireRole("student"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const id = z.coerce.number().int().positive().safe().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ error: "Invalid clearance submission ID" });
    }

    try {
      const deleted = await pool.query(
        `DELETE FROM clearance_submissions
         WHERE id = $1 AND user_id = $2 AND status = 'submitted'
         RETURNING id`,
        [id.data, req.user!.id],
      );
      if (deleted.rowCount > 0) {
        return res.json({ success: true });
      }

      const existing = await pool.query(
        `SELECT status
         FROM clearance_submissions
         WHERE id = $1 AND user_id = $2`,
        [id.data, req.user!.id],
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: "Clearance submission not found" });
      }
      return res.status(409).json({
        error: "Only a clearance awaiting verification can be deleted.",
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/clearances",
  requireAuth,
  requireRole("registrar"),
  async (_req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT latest.id, latest.file_data, latest.original_name, latest.status,
                latest.comment, latest.submitted_at, latest.reviewed_at,
                account.full_name, account.email, account.student_id
         FROM (
           SELECT DISTINCT ON (user_id) *
           FROM clearance_submissions
           ORDER BY user_id, submitted_at DESC, id DESC
         ) AS latest
         INNER JOIN users AS account ON account.id = latest.user_id
         WHERE latest.status = 'submitted'
         ORDER BY latest.submitted_at ASC`,
      );
      return res.json({ clearances: result.rows });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/clearances/archive",
  requireAuth,
  requireRole("registrar"),
  async (_req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT clearance.id, clearance.file_data, clearance.original_name,
                clearance.status, clearance.comment, clearance.submitted_at,
                clearance.reviewed_at, clearance.user_id,
                account.full_name, account.email, account.student_id,
                NOT EXISTS (
                  SELECT 1
                  FROM clearance_submissions AS newer
                  WHERE newer.user_id = clearance.user_id
                    AND (newer.submitted_at, newer.id) >
                        (clearance.submitted_at, clearance.id)
                ) AS is_current
         FROM clearance_submissions AS clearance
         INNER JOIN users AS account ON account.id = clearance.user_id
         WHERE clearance.status = 'verified'
         ORDER BY clearance.reviewed_at DESC NULLS LAST,
                  clearance.submitted_at DESC`,
      );
      return res.json({ clearances: result.rows });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/students/search",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const query = z.string().trim().max(100).optional().safeParse(req.query.q);
    if (!query.success) {
      return res.status(400).json({ error: "Search must be 100 characters or fewer." });
    }
    const searchTerm = query.data || null;
    if (searchTerm !== null && searchTerm.length < 2) {
      return res.status(400).json({ error: "Enter at least 2 characters to search." });
    }

    try {
      const result = await pool.query(
        `SELECT account.id,
                COALESCE(
                  NULLIF(CONCAT_WS(' ', directory.first_name, directory.middle_name, directory.last_name), ''),
                  account.full_name
                ) AS full_name,
                account.email, account.active,
                account.email_verified,
                account.student_id, account.contact_phone, account.contact_address,
                directory.first_name, directory.middle_name, directory.last_name,
                directory.birthdate, account.created_at
         FROM users AS account
         INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
         INNER JOIN roles AS account_role
           ON account_role.id = assignment.role_id AND account_role.name = 'student'
         LEFT JOIN student_directory AS directory
           ON directory.student_id = account.student_id
         WHERE account.active = TRUE
           AND (
             $1::text IS NULL
             OR account.full_name ILIKE $1
             OR CONCAT_WS(' ', directory.first_name, directory.middle_name, directory.last_name) ILIKE $1
             OR COALESCE(account.student_id, '') ILIKE $1
             OR account.email ILIKE $1
           )
         ORDER BY full_name ASC, account.student_id ASC NULLS LAST, account.id ASC
         LIMIT 25`,
        [searchTerm === null ? null : `%${searchTerm}%`],
      );
      return res.json({ students: result.rows });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/students/:studentId",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const studentId = z.string().trim().min(1).max(64).safeParse(req.params.studentId);
    if (!studentId.success) {
      return res.status(400).json({ error: "Invalid student ID." });
    }

    try {
      const studentResult = await pool.query(
        `SELECT account.id, account.full_name, account.email, account.active,
                account.email_verified,
                account.student_id, account.contact_phone, account.contact_address,
                account.created_at, directory.first_name, directory.middle_name,
                directory.last_name, directory.birthdate
         FROM users AS account
         INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
         INNER JOIN roles AS account_role
           ON account_role.id = assignment.role_id AND account_role.name = 'student'
         LEFT JOIN student_directory AS directory
           ON directory.student_id = account.student_id
         WHERE account.student_id = $1
            OR lower(account.email) = lower($1)
         LIMIT 1`,
        [studentId.data],
      );
      if (studentResult.rowCount === 0) {
        return res.status(404).json({ error: "Student not found." });
      }

      const student = studentResult.rows[0];
      const [clearanceResult, requestResult] = await Promise.all([
        pool.query(
          `SELECT clearance.id, clearance.file_data, clearance.original_name,
                  clearance.status, clearance.comment, clearance.submitted_at,
                  clearance.reviewed_at, reviewer.full_name AS reviewer_name,
                  NOT EXISTS (
                    SELECT 1
                    FROM clearance_submissions AS newer
                    WHERE newer.user_id = clearance.user_id
                      AND (newer.submitted_at, newer.id) >
                          (clearance.submitted_at, clearance.id)
                  ) AS is_current
           FROM clearance_submissions AS clearance
           LEFT JOIN users AS reviewer ON reviewer.id = clearance.reviewed_by
           WHERE clearance.user_id = $1
           ORDER BY clearance.submitted_at DESC, clearance.id DESC`,
          [student.id],
        ),
        pool.query(
          `SELECT request.id, request.display_code, request.status,
                  request.purpose, request.fee_amount, request.fee_currency,
                  request.submitted_at, request.updated_at, request.completed_at,
                  document.name AS document_name
           FROM requests AS request
           INNER JOIN document_types AS document
             ON document.id = request.document_type_id
           WHERE request.requester_id = $1
           ORDER BY request.submitted_at DESC`,
          [student.id],
        ),
      ]);

      return res.json({
        student,
        clearances: clearanceResult.rows,
        requests: requestResult.rows,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/clearances/:id/invalidate",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const id = z.coerce.number().int().positive().safe().safeParse(req.params.id);
    const parsed = clearanceInvalidationSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      return res.status(400).json({
        error: parsed.success
          ? "Invalid clearance submission ID"
          : parsed.error.issues[0]?.message || "Invalid clearance invalidation",
      });
    }

    try {
      const result = await pool.query(
        `UPDATE clearance_submissions
         SET status = 'needs_update', comment = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3
           AND status = 'verified'
           AND NOT EXISTS (
             SELECT 1
             FROM clearance_submissions AS newer
             WHERE newer.user_id = clearance_submissions.user_id
               AND (newer.submitted_at, newer.id) >
                   (clearance_submissions.submitted_at, clearance_submissions.id)
           )
         RETURNING id, status, comment, reviewed_at`,
        [parsed.data.comment, req.user!.id, id.data],
      );
      if (result.rowCount === 0) {
        return res.status(409).json({
          error: "Only a verified clearance can be invalidated.",
        });
      }
      return res.json({ clearance: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/clearances/:id/review",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const id = z.coerce.number().int().positive().safe().safeParse(req.params.id);
    const parsed = clearanceReviewSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      return res.status(400).json({ error: "Invalid clearance review" });
    }

    try {
      const result = await pool.query(
        `UPDATE clearance_submissions
         SET status = $1, comment = $2, reviewed_by = $3, reviewed_at = NOW()
         WHERE id = $4 AND status = 'submitted'
         RETURNING id, status, comment, reviewed_at`,
        [
          parsed.data.decision,
          parsed.data.comment || null,
          req.user!.id,
          id.data,
        ],
      );
      if (result.rowCount === 0) {
        return res.status(409).json({
          error: "This clearance was already reviewed or is no longer available.",
        });
      }
      return res.json({ clearance: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/walk-in",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const parsed = walkInRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid walk-in request",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const student = await client.query(
        `SELECT account.id
         FROM users AS account
         INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
         INNER JOIN roles AS account_role
           ON account_role.id = assignment.role_id AND account_role.name = 'student'
         WHERE account.student_id = $1 AND account.active = TRUE
         LIMIT 1`,
        [parsed.data.studentId],
      );
      if (student.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Student ID was not found." });
      }

      const clearance = await client.query(
        `SELECT status
         FROM clearance_submissions
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`,
        [student.rows[0].id],
      );
      if (clearance.rows[0]?.status !== "verified") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "The student must have verified clearance before a request can be entered.",
        });
      }

      const inserted = await client.query(
        `INSERT INTO requests
           (requester_id, document_type_id, status, purpose, additional_details,
            fee_amount, fee_currency)
         SELECT $1, document.id, 'submitted', $2, $3::jsonb,
                document.base_fee * $4, document.currency
         FROM document_types AS document
         WHERE document.id = $5 AND document.active = TRUE
         RETURNING id, display_code, status, fee_amount, fee_currency`,
        [
          student.rows[0].id,
          parsed.data.purpose,
          JSON.stringify({
            quantity: parsed.data.quantity,
            collectionMethod: "Pick-up",
            paymentMethod: "Pay at the Office",
            requestSource: "walk_in",
          }),
          parsed.data.quantity,
          parsed.data.documentTypeId,
        ],
      );
      if (inserted.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "The selected document is unavailable." });
      }
      const request = inserted.rows[0];
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, NULL, 'submitted', $2, 'Walk-in request entered by Registrar')`,
        [request.id, req.user!.id],
      );
      await client.query("COMMIT");
      return res.status(201).json({ request });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.post(
  "/:id/payment-method",
  requireAuth,
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = paymentMethodSchema.parse(req.body);

      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, status
         FROM requests
         WHERE id = $1 AND requester_id = $2
         FOR UPDATE`,
        [id, req.user!.id],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Request not found" });
        return;
      }

      if (result.rows[0].status !== "awaiting_payment") {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "Payment method can only be changed before payment proof is submitted",
        });
        return;
      }

      await client.query(
        `UPDATE requests
         SET additional_details = COALESCE(additional_details, '{}'::jsonb) || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ paymentMethod: input.paymentMethod }), id],
      );

      await client.query("COMMIT");
      res.json({ paymentMethod: input.paymentMethod });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back payment method update:", rollbackError);
      }
      next(error);
    } finally {
      client.release();
    }
  },
);

router.post(
  "/:id/payment-proof",
  requireAuth,
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = paymentProofSchema.parse(req.body);

      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, display_code, status, additional_details
         FROM requests
         WHERE id = $1 AND requester_id = $2
         FOR UPDATE`,
        [id, req.user!.id],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Request not found" });
        return;
      }

      const request = result.rows[0];
      if (!["awaiting_payment", "payment_review"].includes(request.status)) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `Payment proof cannot be submitted while request status is ${request.status}`,
        });
        return;
      }

      const paymentMethod = String(
        request.additional_details?.paymentMethod ??
          request.additional_details?.payment_method ??
          "",
      );
      if (/online|gcash/i.test(paymentMethod)) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Online payments are no longer accepted. Pay cash at the Finance Office.",
        });
        return;
      }
      if (input.trackingCode.toUpperCase() !== request.display_code) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Tracking code does not match this request." });
        return;
      }

      const uploadedAt = new Date().toISOString();
      const nextStatus = "payment_review";
      await client.query(
        `UPDATE requests
         SET status = $1,
             additional_details = COALESCE(additional_details, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $3`,
        [
          nextStatus,
          JSON.stringify({
            receiptUrl: input.receiptDataUrl,
            requestCopyUrl: input.requestCopyDataUrl,
            paymentReference: input.paymentReference || null,
            paymentSentAt: uploadedAt,
          }),
          id,
        ],
      );

      if (request.status !== nextStatus) {
        await client.query(
          `INSERT INTO request_status_history
             (request_id, from_status, to_status, changed_by, comment)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, request.status, nextStatus, req.user!.id, "Student submitted cash payment receipt and request copy"],
        );
      }

      await client.query("COMMIT");
      res.status(201).json({
        receiptUrl: input.receiptDataUrl,
        requestCopyUrl: input.requestCopyDataUrl,
        paymentReference: input.paymentReference || null,
        paymentSentAt: uploadedAt,
        status: nextStatus,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  },
);

router.post(
  "/:id/payments",
  requireAuth,
  requireRole("registrar"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = paymentSchema.parse(req.body);
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT request_row.id, request_row.status, request_row.fee_amount,
                request_row.fee_currency, request_row.display_code,
                request_row.additional_details, requester.full_name AS requester_name,
                requester.email AS requester_email, document_type.name AS document_name
         FROM requests AS request_row
         INNER JOIN users AS requester ON requester.id = request_row.requester_id
         INNER JOIN document_types AS document_type
           ON document_type.id = request_row.document_type_id
         WHERE request_row.id = $1
         FOR UPDATE OF request_row`,
        [id],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Request not found" });
        return;
      }

      const request = result.rows[0];
      if (!["awaiting_payment", "payment_review"].includes(request.status)) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `Payment cannot be recorded while request status is ${request.status}`,
        });
        return;
      }

      const requestedPaymentMethod = String(
        request.additional_details?.paymentMethod ??
          request.additional_details?.payment_method ??
          "",
      );
      const isOnlinePayment = /online|gcash/i.test(requestedPaymentMethod);
      if (input.method !== "cash" || isOnlinePayment) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Only cash payments at the Finance Office are accepted.",
        });
        return;
      }
      const receiptUrl =
        request.additional_details?.receiptUrl ??
        request.additional_details?.receipt_url ??
        request.additional_details?.proof_of_payment;
      if (
        request.fee_amount !== null &&
        Number(request.fee_amount) !== input.amount
      ) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Payment amount must match the approved request fee",
          expectedAmount: request.fee_amount,
          receivedAmount: input.amount,
        });
        return;
      }

      if (request.fee_currency && request.fee_currency !== input.currency) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Payment currency must match the request currency",
          expectedCurrency: request.fee_currency,
          receivedCurrency: input.currency,
        });
        return;
      }

      const nextStatus =
        input.status === "succeeded"
          ? "paid"
          : input.status === "pending"
            ? "payment_review"
            : "awaiting_payment";
      const emailNotification =
        input.status === "succeeded"
          ? {
              deliveryState: "queued",
              to: request.requester_email,
              subject: `Payment received for request ${request.display_code}`,
              queuedAt: new Date().toISOString(),
              requestCode: request.display_code,
              documentName: request.document_name,
              amount: input.amount,
              currency: input.currency,
              method: input.method === "gcash" ? "GCash" : "Cash",
              reference:
                input.providerReference ??
                request.additional_details?.paymentReference ??
                request.additional_details?.payment_reference ??
                null,
            }
          : null;
      const payment = await client.query(
        `INSERT INTO payments
           (request_id, amount, currency, method, provider, provider_reference,
            status, confirmed_by, notes, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id,
          input.amount.toFixed(2),
          input.currency,
          input.method,
          input.method === "gcash" ? "GCash" : "Cash",
          input.providerReference ?? null,
          input.status,
          input.status === "succeeded" ? req.user!.id : null,
          input.notes ?? null,
          input.status === "succeeded" ? new Date() : null,
        ],
      );
      await client.query(
        `UPDATE requests
         SET status = $1,
             additional_details = CASE
               WHEN $3::jsonb IS NULL THEN additional_details
               ELSE COALESCE(additional_details, '{}'::jsonb) || $3::jsonb
             END,
             updated_at = NOW()
         WHERE id = $2`,
        [
          nextStatus,
          id,
          emailNotification
            ? JSON.stringify({ paymentConfirmationEmail: emailNotification })
            : null,
        ],
      );
      await client.query(
        `INSERT INTO request_status_history
           (request_id, from_status, to_status, changed_by, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          request.status,
          nextStatus,
          req.user!.id,
          input.notes ?? `Registrar cash payment status: ${input.status}`,
        ],
      );
      await client.query("COMMIT");
      if (emailNotification) {
        const receiptDataUrl =
          request.additional_details?.receiptUrl ??
          request.additional_details?.receipt_url ??
          request.additional_details?.proof_of_payment;
        scheduleEmailNotification("payment-received", () =>
          sendPaymentReceivedEmail({
            email: request.requester_email,
            fullName: request.requester_name,
            documentName: request.document_name,
            requestCode: request.display_code,
            amount: input.amount,
            currency: input.currency,
            method: emailNotification.method,
            reference: emailNotification.reference,
            paidAt: emailNotification.queuedAt,
            receiptDataUrl,
          }),
        );
      }
      res.status(201).json({
        payment: payment.rows[0],
        ...(emailNotification ? { emailNotification } : {}),
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back payment confirmation:", rollbackError);
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505" &&
        "constraint" in error &&
        typeof error.constraint === "string" &&
        error.constraint.includes("provider_reference")
      ) {
        res.status(409).json({
          error: "This payment reference has already been recorded.",
        });
        return;
      }

      next(error);
    } finally {
      client.release();
    }
  },
);

router.get("/test", (_req, res) => {
  res.json({ message: "Workflow router is working" });
});

export default router;
