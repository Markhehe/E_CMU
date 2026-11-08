import type { Request, Response, NextFunction } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../../db/index.js";
import { documentTypes } from "../../db/schema.js";
import { createRequestSchema } from "./validation.js";

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
        collectionMethod: "Pick-up",
        paymentMethod: "Pay at the Office",
    };

    const client = await pool.connect();
        try {
            await client.query("BEGIN");

            await client.query(
                "SELECT id FROM users WHERE id = $1 FOR UPDATE",
                [requesterId],
            );
            const concurrentRequests = await client.query<{ count: number }>(
                `SELECT COUNT(*)::int AS count
                 FROM requests
                 WHERE requester_id = $1 AND status <> 'fulfilled'`,
                [requesterId],
            );
            if (concurrentRequests.rows[0].count >= 5) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    error: "You can have up to 5 concurrent requests. Fulfilled requests do not count toward this limit.",
                });
            }

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
                    'pending_review',
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
                 VALUES ($1, NULL, 'pending_review', $2, 'Request submitted')`,
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
            ["registrar", "registrar_staff", "admin", "administrator"].includes(
                role.toLowerCase(),
            ),
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
                (
                    SELECT COUNT(*)::int
                    FROM request_comments AS comment_row
                    WHERE comment_row.request_id = req.id
                      AND ($2::boolean OR comment_row.visibility = 'requester')
                ) AS "commentCount",
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

export async function deletePendingStudentRequest(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const parsedId = z.string().uuid().safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(400).json({ error: "Invalid request ID" });
    }
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
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
}
