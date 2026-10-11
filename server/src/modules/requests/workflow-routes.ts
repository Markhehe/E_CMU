import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import {
  payments,
  requestReviews,
  requestStatusHistory,
  requests,
  roles,
  userRoles,
} from "../../db/schema.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const requestIdSchema = z.object({
  id: z.string().uuid(),
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "needs_information"]),
  comment: z.string().trim().max(2000).optional(),
});

const paymentSchema = z
  .object({
    method: z.enum(["cash", "gcash"]),
    amount: z.coerce.number().finite().positive(),
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
    email: string;
    fullName: string;
    stakeholderType: "student" | "professor" | "other";
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

async function getRequestForUpdate(requestId: string) {
  const [request] = await db
    .select({
      id: requests.id,
      status: requests.status,
      feeAmount: requests.feeAmount,
      feeCurrency: requests.feeCurrency,
      requesterId: requests.requesterId,
    })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);

  return request;
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
  const request = await getRequestForUpdate(requestId);

  if (!request) {
    return { error: "Request not found", statusCode: 404 as const };
  }

  const allowedStatuses =
    stage === "registrar"
      ? ["submitted", "registrar_review", "needs_information"]
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

  const result = await db.transaction(async (tx) => {
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

    return review;
  });

  return { result };
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
    try {
      const { id } = requestIdSchema.parse(req.params);
      const input = paymentSchema.parse(req.body);
      const request = await getRequestForUpdate(id);

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (!["awaiting_payment", "payment_review"].includes(request.status)) {
        return res.status(409).json({
          error: `Payment cannot be recorded while request status is ${request.status}`,
        });
      }

      if (
        request.feeAmount !== null &&
        Number(request.feeAmount) !== input.amount
      ) {
        return res.status(400).json({
          error: "Payment amount must match the approved request fee",
          expectedAmount: request.feeAmount,
          receivedAmount: input.amount,
        });
      }

      if (request.feeCurrency && request.feeCurrency !== input.currency) {
        return res.status(400).json({
          error: "Payment currency must match the request currency",
          expectedCurrency: request.feeCurrency,
          receivedCurrency: input.currency,
        });
      }

      const paymentResult = await db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            requestId: id,
            amount: input.amount.toFixed(2),
            currency: input.currency,
            method: input.method,
            provider: input.method === "gcash" ? "GCash" : null,
            providerReference: input.providerReference ?? null,
            status: input.status,
            confirmedBy: input.status === "succeeded" ? req.user!.id : null,
            notes: input.notes ?? null,
            paidAt: input.status === "succeeded" ? new Date() : null,
          })
          .returning();

        const nextStatus =
          input.status === "succeeded"
            ? "paid"
            : input.status === "pending"
              ? "payment_review"
              : "awaiting_payment";

        await tx
          .update(requests)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(requests.id, id));

        await tx.insert(requestStatusHistory).values({
          requestId: id,
          fromStatus: request.status as any,
          toStatus: nextStatus as any,
          changedBy: req.user!.id,
          comment: input.notes ?? `Finance payment status: ${input.status}`,
        });

        return payment;
      });

      return res.status(201).json({ payment: paymentResult });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/test", (_req, res) => {
  res.json({ message: "Workflow router is working" });
});

export default router;
