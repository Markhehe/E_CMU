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

const staffRoles = ["registrar", "saso", "finance", "administrator"];

const paymentSchema = z
  .object({
    method: z.enum(["cash", "gcash"]),
    amount: z.coerce.number().finite().nonnegative(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    status: z.enum(["pending", "succeeded", "failed"]),
    providerReference: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, context) => {
    if (value.method === "gcash" && !value.providerReference) {
      context.addIssue({
        code: "custom",
        path: ["providerReference"],
        message: "A GCash reference number is required",
      });
    }
  });

type WorkflowRequest = Request & {
  user?: {
    id: number;
    full_name: string;
    roles: string[];
  };
};

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

const sasoStatusByDecision = {
  approved: "saso_cleared",
  rejected: "saso_rejected",
  needs_information: "needs_information",
} as const;

const registrarReviewStatuses = [
  "submitted",
  "registrar_review",
  "needs_information",
] as const;

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
  stage: "registrar" | "saso",
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
      stage === "registrar"
        ? decision === "approved"
          ? registrarReviewStatuses
          : registrarInterventionStatuses
        : ["registrar_approved", "saso_review"];

    if (!allowedStatuses.includes(request.status)) {
      return {
        error: `Request cannot receive a ${stage} decision while its status is ${request.status}`,
        statusCode: 409 as const,
      };
    }

    const nextStatus =
      stage === "registrar"
        ? registrarStatusByDecision[decision]
        : sasoStatusByDecision[decision];

    const finalStatus =
      stage === "registrar" && decision === "approved"
        ? "saso_review"
        : stage === "saso" && decision === "approved"
          ? "awaiting_payment"
          : nextStatus;

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
  requireRole("registrar", "administrator"),
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
        comment: { ...result.rows[0], author_name: req.user!.full_name },
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
  "/:id/ready-for-pickup",
  requireAuth,
  requireRole("registrar", "administrator"),
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
      if (!["paid", "ready_for_retrieval", "ready"].includes(request.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "A request must have SASO clearance and confirmed payment before it can be marked ready for pickup.",
        });
      }

      if (request.status === "paid") {
        await client.query(
          `UPDATE requests
           SET status = 'ready_for_retrieval', updated_at = NOW()
           WHERE id = $1`,
          [id],
        );
        await client.query(
          `INSERT INTO request_status_history
             (request_id, from_status, to_status, changed_by, comment)
           VALUES ($1, 'paid', 'ready_for_retrieval', $2, 'Ready for pickup')`,
          [id, req.user!.id],
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
  requireRole("registrar", "administrator"),
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

router.post(
  "/:id/saso-clearance",
  requireAuth,
  requireRole("saso"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = reviewSchema.parse(req.body);
      const result = await createReview(
        id,
        "saso",
        input.decision,
        input.comment,
        req.user!.id,
      );

      if ("error" in result) {
        return res.status(result.statusCode ?? 500).json({ error: result.error });
      }

      return res.status(201).json({ clearance: result.result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/payments",
  requireAuth,
  requireRole("finance"),
  async (req: WorkflowRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = paymentSchema.parse(req.body);
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, status, fee_amount, fee_currency
         FROM requests
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }

      const request = result.rows[0];
      if (!["awaiting_payment", "payment_review"].includes(request.status)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `Payment cannot be recorded while request status is ${request.status}`,
        });
      }

      if (
        request.fee_amount !== null &&
        Number(request.fee_amount) !== input.amount
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Payment amount must match the approved request fee",
          expectedAmount: request.fee_amount,
          receivedAmount: input.amount,
        });
      }

      if (request.fee_currency && request.fee_currency !== input.currency) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Payment currency must match the request currency",
          expectedCurrency: request.fee_currency,
          receivedCurrency: input.currency,
        });
      }

      const nextStatus =
        input.status === "succeeded"
          ? "paid"
          : input.status === "pending"
            ? "payment_review"
            : "awaiting_payment";
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
        `UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2`,
        [nextStatus, id],
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
          input.notes ?? `Finance payment status: ${input.status}`,
        ],
      );
      await client.query("COMMIT");
      return res.status(201).json({ payment: payment.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.get("/test", (_req, res) => {
  res.json({ message: "Workflow router is working" });
});

export default router;
