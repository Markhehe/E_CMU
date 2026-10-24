import type { Request, Response, NextFunction } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import type { PoolClient } from "pg";
import { db, pool } from "../../db/index.js";
import { documentTypes } from "../../db/schema.js";
import { createRequestSchema } from "./validation.js";
import {
    scheduleEmailNotification,
    sendReadyForPickupEmail,
} from "../../services/email.js";

const adminStatusSchema = z.enum([
    "PROCESSING",
    "READY FOR PICKUP",
    "FULFILLED",
    "REJECTED",
]);

const adminStatusValues = {
    PROCESSING: ["processing"],
    "READY FOR PICKUP": ["ready_for_retrieval", "ready"],
    FULFILLED: ["fulfilled"],
    REJECTED: ["rejected"],
} as const;

export async function listDocumentTypes(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await db
            .select({
                id: documentTypes.id,
                name: documentTypes.name,
                description: documentTypes.description,
                baseFee: documentTypes.baseFee,
                currency: documentTypes.currency,
                processingDays: documentTypes.processingDays,
            })
            .from(documentTypes)
            .where(eq(documentTypes.active, true))
            .orderBy(asc(documentTypes.name));

        return res.json({ documentTypes: result });
    } catch (error) {
        return next(error);
    }
}

export async function createDocumentRequest(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

    const parsed = createRequestSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request data",
            details: parsed.error.flatten(),
        });
    }

    const { documentTypeId, purpose, additionalDetails } = parsed.data;
    const quantity = Number(additionalDetails.quantity ?? "1");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return res.status(400).json({ error: "Quantity must be between 1 and 10" });
    }
    const requesterId = req.user.id;

    const clearance = await pool.query(
        `SELECT status
         FROM clearance_submissions
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC
         LIMIT 1`,
        [requesterId],
    );
    if (clearance.rows[0]?.status !== "verified") {
        return res.status(403).json({
            error: "Verified student clearance is required before submitting a document request.",
        });
    }
    const requestDetails = {
        ...additionalDetails,
        paymentMethod: "Pay at the Office",
    };

    const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const inserted = await client.query(
                `INSERT INTO requests (
                    requester_id,
                    document_type_id,
                    status,
                    purpose,
                    additional_details,
                    fee_amount,
                    fee_currency
                )
                SELECT
                    $1,
                    doc.id,
                    'submitted',
                    $2,
                    $3::jsonb,
                    doc.base_fee * $4,
                    doc.currency
                FROM document_types AS doc
                WHERE doc.id = $5 AND doc.active = TRUE
                RETURNING
                    id,
                    display_code AS "displayCode",
                    requester_id AS "requesterId",
                    document_type_id AS "documentTypeId",
                    status,
                    purpose,
                    additional_details AS "additionalDetails",
                    fee_amount AS "feeAmount",
                    fee_currency AS "feeCurrency",
                    submitted_at AS "submittedAt",
                    updated_at AS "updatedAt",
                    (SELECT name FROM document_types WHERE id = $5) AS "documentTypeName"`,
                [
                    requesterId,
                    purpose || null,
                    JSON.stringify(requestDetails),
                    quantity,
                    documentTypeId,
                ],
            );

            if (inserted.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: "The selected document type is unavailable",
                });
            }

            const createdRequest = inserted.rows[0];
            await client.query(
                `INSERT INTO request_status_history
                    (request_id, from_status, to_status, changed_by, comment)
                 VALUES ($1, NULL, 'submitted', $2, 'Request submitted')`,
                [createdRequest.id, requesterId],
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
}

export async function listDocumentRequests(
    req: Request,
    res: Response,
    next: NextFunction
) {

    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const canListAll = req.user.roles.some((role) =>
            ["registrar"].includes(role),
        );
        const result = await pool.query(
            `SELECT
                req.id,
                req.display_code AS "displayCode",
                req.requester_id AS "requesterId",
                usr.full_name AS "requesterName",
                usr.student_id AS "requesterStudentId",
                req.status,
                req.purpose,
                req.additional_details AS "additionalDetails",
                req.fee_amount AS "feeAmount",
                req.fee_currency AS "feeCurrency",
                req.submitted_at AS "submittedAt",
                req.updated_at AS "updatedAt",
                doc.name AS "documentTypeName",
                EXISTS (
                    SELECT 1
                    FROM request_comments AS comment_row
                    WHERE comment_row.request_id = req.id
                      AND comment_row.author_id <> $1
                      AND ($2::boolean OR comment_row.visibility = 'requester')
                      AND NOT EXISTS (
                          SELECT 1
                          FROM request_comment_reads AS comment_read
                          WHERE comment_read.comment_id = comment_row.id
                            AND comment_read.user_id = $1
                      )
                ) AS "hasUnreadComments"
             FROM requests AS req
             INNER JOIN document_types AS doc ON doc.id = req.document_type_id
             INNER JOIN users AS usr ON usr.id = req.requester_id
             ${canListAll ? "" : "WHERE req.requester_id = $1"}
             ORDER BY req.submitted_at DESC`,
            [req.user.id, canListAll],
        );

        return res.json({ requests: result.rows });
    } catch (error) {
        next(error);
    }
}

export async function updateDocumentRequestStatus(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const parsedId = z.string().uuid().safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid request ID" });
    }

    const parsedStatus = adminStatusSchema.safeParse(req.body?.status);
    if (!parsedStatus.success) {
        return res.status(400).json({
            error: "Status must be PROCESSING, READY FOR PICKUP, FULFILLED, or REJECTED",
        });
    }

    let client: PoolClient | undefined;
    try {
        client = await pool.connect();
        const connection = client;
        await connection.query("BEGIN");
        const current = await connection.query(
            `SELECT request.id, request.status, request.display_code, account.email,
                    account.full_name, document.name AS document_name
             FROM requests AS request
             INNER JOIN users AS account ON account.id = request.requester_id
             INNER JOIN document_types AS document ON document.id = request.document_type_id
             WHERE request.id = $1
             FOR UPDATE OF request`,
            [parsedId.data],
        );
        if (current.rowCount === 0) {
            await connection.query("ROLLBACK");
            return res.status(404).json({ error: "Request not found" });
        }

        const statusEnums = await connection.query<{ enumlabel: string }>(
            `SELECT enumlabel
             FROM pg_enum
             WHERE enumtypid = 'public.request_status'::regtype`,
        );
        const availableStatuses = new Set(
            statusEnums.rows.map(({ enumlabel }) => enumlabel),
        );
        const nextStatus = adminStatusValues[parsedStatus.data].find((value) =>
            availableStatuses.has(value),
        );
        if (!nextStatus) {
            throw new Error(
                `Database request_status enum does not support ${parsedStatus.data}`,
            );
        }

        const previousStatus = current.rows[0].status as string;
        const updated = await connection.query(
            `UPDATE requests
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, status, updated_at`,
            [nextStatus, parsedId.data],
        );

        if (previousStatus !== nextStatus) {
            await connection.query(
                `INSERT INTO request_status_history
                   (request_id, from_status, to_status, changed_by, comment)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    parsedId.data,
                    previousStatus,
                    nextStatus,
                    req.user?.id,
                    `Registrar changed status to ${parsedStatus.data}`,
                ],
            );
        }

        await connection.query("COMMIT");
        const emailNotificationQueued =
            previousStatus !== nextStatus &&
            ["ready_for_retrieval", "ready"].includes(nextStatus);
        if (emailNotificationQueued) {
            const request = current.rows[0];
            scheduleEmailNotification("ready-for-pickup", () =>
                sendReadyForPickupEmail({
                    email: request.email,
                    fullName: request.full_name,
                    documentName: request.document_name,
                    requestCode: request.display_code,
                }),
            );
        }
        return res.json({
            request: updated.rows[0],
            ...(emailNotificationQueued ? { emailNotificationQueued: true } : {}),
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK");
        }
        return next(error);
    } finally {
        client?.release();
    }
}
