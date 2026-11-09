import type { Request, Response, NextFunction } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../../db/index.js";
import { documentTypes } from "../../db/schema.js";
import { writeAuditLog } from "../../services/audit-log.js";
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
            await writeAuditLog(client, {
                actorId: requesterId,
                action: "request.created",
                entityType: "request",
                entityId: createdRequest.id,
                metadata: {
                    displayCode: createdRequest.displayCode,
                    source: "student",
                    toStatus: createdRequest.status,
                },
            });

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
                req.assigned_to AS "assignedTo",
                (SELECT assignee.full_name
                 FROM users AS assignee
                 WHERE assignee.id = req.assigned_to) AS "assignedName",
                CASE
                    WHEN req.status IN ('fulfilled', 'rejected') THEN (
                        SELECT actor.full_name
                        FROM request_status_history AS history
                        INNER JOIN users AS actor ON actor.id = history.changed_by
                        WHERE history.request_id = req.id
                          AND history.to_status = req.status::text
                        ORDER BY history.created_at DESC, history.id DESC
                        LIMIT 1
                    )
                    ELSE NULL
                END AS "terminalActionName",
                req.eta_at AS "etaAt",
                req.eta_update_requested_at AS "etaUpdateRequestedAt",
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

export async function listRegistrarDocumentRequests(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20),
        );
        const search = String(req.query.search ?? "").trim().slice(0, 120);
        const view = String(req.query.view ?? "ALL").toUpperCase();
        const sort = String(req.query.sort ?? "DATE_DESC").toUpperCase();
        const statusFilters: Record<string, string> = {
            "PENDING REVIEW": "pending_review",
            "PENDING PAYMENT": "pending_payment",
            PAID: "paid",
            PROCESSING: "processing",
            OVERDUE: "overdue",
            "READY FOR PICKUP": "ready_for_pickup",
            "ON HOLD": "on_hold",
            "CLEARANCE REVIEW": "clearance_review",
            FULFILLED: "fulfilled",
            REJECTED: "rejected",
        };
        if (view !== "ALL" && !statusFilters[view]) {
            return res.status(400).json({ error: "Invalid request status filter" });
        }
        if (!["DATE_DESC", "DATE_ASC", "STATUS_ASC"].includes(sort)) {
            return res.status(400).json({ error: "Invalid request sort order" });
        }

        const conditions: ((parameterOffset: number) => string)[] = [];
        const params: unknown[] = [];
        if (statusFilters[view]) {
            params.push(statusFilters[view]);
            const statusParameterIndex = params.length;
            conditions.push((parameterOffset) => `req.status::text = $${statusParameterIndex + parameterOffset}`);
        } else {
            if (String(req.query.showFulfilled ?? "true") === "false") {
                conditions.push(() => "req.status::text <> 'fulfilled'");
            }
            if (String(req.query.showRejected ?? "true") === "false") {
                conditions.push(() => "req.status::text <> 'rejected'");
            }
        }
        if (search) {
            params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
            const searchParameterIndex = params.length;
            conditions.push((parameterOffset) => {
                const searchParam = `$${searchParameterIndex + parameterOffset}`;
                return `(
                    usr.full_name ILIKE ${searchParam} ESCAPE '\\'
                    OR usr.student_id ILIKE ${searchParam} ESCAPE '\\'
                    OR req.display_code ILIKE ${searchParam} ESCAPE '\\'
                    OR req.id::text ILIKE ${searchParam} ESCAPE '\\'
                    OR doc.name ILIKE ${searchParam} ESCAPE '\\'
                    OR req.purpose ILIKE ${searchParam} ESCAPE '\\'
                )`;
            });
        }
        const createWhereClause = (parameterOffset: number) => (
            conditions.length
                ? `WHERE ${conditions.map((condition) => condition(parameterOffset)).join(" AND ")}`
                : ""
        );
        const whereClause = createWhereClause(0);
        const requestWhereClause = createWhereClause(1);
        const orderClause = sort === "DATE_ASC"
            ? "req.submitted_at ASC, req.id ASC"
            : sort === "STATUS_ASC"
                ? `CASE req.status::text
                    WHEN 'pending_review' THEN 1
                    WHEN 'on_hold' THEN 2
                    WHEN 'pending_payment' THEN 3
                    WHEN 'clearance_review' THEN 4
                    WHEN 'paid' THEN 5
                    WHEN 'overdue' THEN 6
                    WHEN 'processing' THEN 7
                    WHEN 'ready_for_pickup' THEN 8
                    WHEN 'fulfilled' THEN 9
                    WHEN 'rejected' THEN 10
                    ELSE 11
                   END, req.submitted_at ASC, req.id ASC`
                : "req.submitted_at DESC, req.id DESC";
        const requestQuery = `SELECT
                    req.id,
                    req.display_code AS "displayCode",
                    req.requester_id AS "requesterId",
                    usr.full_name AS "requesterName",
                    usr.student_id AS "requesterStudentId",
                    req.status,
                    req.assigned_to AS "assignedTo",
                    (SELECT assignee.full_name
                     FROM users AS assignee
                     WHERE assignee.id = req.assigned_to) AS "assignedName",
                    CASE
                        WHEN req.status IN ('fulfilled', 'rejected') THEN (
                            SELECT actor.full_name
                            FROM request_status_history AS history
                            INNER JOIN users AS actor ON actor.id = history.changed_by
                            WHERE history.request_id = req.id
                              AND history.to_status = req.status::text
                            ORDER BY history.created_at DESC, history.id DESC
                            LIMIT 1
                        )
                        ELSE NULL
                    END AS "terminalActionName",
                    req.eta_at AS "etaAt",
                    req.eta_update_requested_at AS "etaUpdateRequestedAt",
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
                    ) AS "commentCount",
                    EXISTS (
                        SELECT 1
                        FROM request_comments AS comment_row
                        WHERE comment_row.request_id = req.id
                          AND comment_row.author_id <> $1
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
                 ${requestWhereClause}
                 ORDER BY ${orderClause}
                 LIMIT $${params.length + 2} OFFSET $${params.length + 3}`;

        const [countResult, statusCountResult] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM requests AS req
                 INNER JOIN document_types AS doc ON doc.id = req.document_type_id
                 INNER JOIN users AS usr ON usr.id = req.requester_id
                 ${whereClause}`,
                params,
            ),
            pool.query(
                `SELECT req.status::text AS status, COUNT(*)::int AS count
                 FROM requests AS req
                 GROUP BY req.status`,
            ),
        ]);
        const totalRequests = countResult.rows[0]?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));
        const currentPage = Math.min(page, totalPages);
        const offset = (currentPage - 1) * pageSize;
        const requestResult = await pool.query(requestQuery, [
            req.user.id,
            ...params,
            pageSize,
            offset,
        ]);

        return res.json({
            requests: requestResult.rows,
            pagination: {
                page: currentPage,
                pageSize,
                totalRequests,
                totalPages,
            },
            statusCounts: Object.fromEntries(
                statusCountResult.rows.map(({ status, count }) => [status, count]),
            ),
        });
    } catch (error) {
        return next(error);
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
            `SELECT status, display_code
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

        await writeAuditLog(client, {
            actorId: req.user.id,
            action: "request.deleted",
            entityType: "request",
            entityId: parsedId.data,
            metadata: { displayCode: request.rows[0].display_code },
        });
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
