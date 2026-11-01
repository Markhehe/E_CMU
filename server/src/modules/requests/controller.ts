import type { Request, Response, NextFunction } from "express";
<<<<<<< HEAD
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
    documentTypes,
    requests,
    requestStatusHistory,
} from "../../db/schema.js";
import { createRequestSchema } from "./validation.js";

=======
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

>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
export async function createDocumentRequest(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
<<<<<<< HEAD
    
    const parsed = createRequestSchema.safeParse(req.body);
    
=======

    const parsed = createRequestSchema.safeParse(req.body);

>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request data",
            details: parsed.error.flatten(),
        });
    }
<<<<<<< HEAD
    
    const { documentTypeId, purpose, additionalDetails } = parsed.data;
    const requesterId = req.user.id;
    
    const createdRequest = await db.transaction(async (tx) => {
    // Read the document type inside the transaction. Only active types may
    // be requested by users.
        const documentTypeResult = await tx
            .select({
                id: documentTypes.id,
                name: documentTypes.name,
                baseFee: documentTypes.baseFee,
                currency: documentTypes.currency,
            })
            .from(documentTypes)
            .where(
                and(
                eq(documentTypes.id, documentTypeId),
                eq(documentTypes.active, true)
                )
            )
            .limit(1);
        
        if (documentTypeResult.length === 0) {
            const error = new Error("Document type is unavailable");
            error.name = "DOCUMENT_TYPE_NOT_FOUND";
            throw error;
        }
       
        const documentType = documentTypeResult[0];
        // At submission time, preserve the current catalog price as a snapshot.
        // Staff may later change the final fee according to institutional rules.
        const insertedRequests = await tx
            .insert(requests)
            .values({
                requesterId,
                documentTypeId: documentType.id,
                status: "submitted",
                purpose: purpose || null,
                additionalDetails,
                feeAmount: documentType.baseFee,
                feeCurrency: documentType.currency,
            })
        .returning({
            id: requests.id,
            requesterId: requests.requesterId,
            documentTypeId: requests.documentTypeId,
            status: requests.status,
            purpose: requests.purpose,
            additionalDetails: requests.additionalDetails,
            feeAmount: requests.feeAmount,
            feeCurrency: requests.feeCurrency,
            submittedAt: requests.submittedAt,
            updatedAt: requests.updatedAt,
        });
        
        const newRequest = insertedRequests[0];
        
        await tx.insert(requestStatusHistory).values({
            requestId: newRequest.id,
            fromStatus: null,
            toStatus: "submitted",
            changedBy: requesterId,
            comment: "Request submitted",
        });
        
        return {
            ...newRequest,
            documentTypeName: documentType.name,
        };
    });

    return res.status(201).json({ request: createdRequest });
} catch (error) {
    if (error instanceof Error && error.name === "DOCUMENT_TYPE_NOT_FOUND") {
        return res.status(400).json({
            error: "The selected document type is unavailable",
        });
    }
    
    next(error);
    }
}

export async function listMyDocumentRequests(
=======

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
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
    req: Request,
    res: Response,
    next: NextFunction
) {
<<<<<<< HEAD
    
=======

>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
<<<<<<< HEAD
        
        const result = await db
            .select({
                id: requests.id,
                status: requests.status,
                purpose: requests.purpose,
                feeAmount: requests.feeAmount,
                feeCurrency: requests.feeCurrency,
                submittedAt: requests.submittedAt,
                updatedAt: requests.updatedAt,
                documentTypeName: documentTypes.name,
            })
            .from(requests)
            .innerJoin(documentTypes, eq(requests.documentTypeId, documentTypes.id))
            .where(eq(requests.requesterId, req.user.id))
            .orderBy(desc(requests.submittedAt));
        
        return res.json({ requests: result });
    } catch (error) {
        next(error);
    }
}
=======

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
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
