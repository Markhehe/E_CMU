import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();
router.get("/document-types", requireAuth, async (_req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, base_fee, currency, processing_days
            FROM document_types WHERE active = TRUE ORDER BY name`
        );
        res.json({ documentTypes: result.rows });
    } catch (error) {
        next(error);
 }
});

router.post("/", requireAuth, async (req, res, next) => {
    const schema = z.object({
        documentTypeId: z.coerce.number().int().positive(),
        purpose: z.string().max(1000).optional(),
        additionalDetails: z.record(z.string()).default({}),
    });
     try {
        const data = schema.parse(req.body);
        const client = await pool.connect();
        
        try {
            await client.query("BEGIN");
            const requestResult = await client.query(
                `INSERT INTO requests
                    (requester_id, document_type_id, purpose, additional_details)
                SELECT $1, id, $2, $3
                FROM document_types
                WHERE id = $4 AND active = TRUE
                RETURNING *`,
                [req.user.id, data.purpose ?? null, data.additionalDetails, data.documentTypeId]
            );
 
            if (requestResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Document type is unavailable" });
            }
 
            const request = requestResult.rows[0];
            await client.query(
                `INSERT INTO request_status_history
                    (request_id, from_status, to_status, changed_by, comment)
                VALUES ($1, NULL, 'submitted', $2, 'Request submitted')`,
                [request.id, req.user.id]
             );
 
            await client.query("COMMIT");
            res.status(201).json({ request });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
});

router.get("/", requireAuth, async (req, res, next) => {
    try {
        const isStaff = req.user.roles.some((role) =>
            ["processor", "finance", "administrator"].includes(role)
        );
        
        const query = isStaff
            ? `SELECT req.*, dt.name AS document_name, u.full_name AS requester_name
                FROM requests req
                JOIN document_types dt ON dt.id = req.document_type_id
                JOIN users u ON u.id = req.requester_id
                ORDER BY req.submitted_at DESC`
                : `SELECT req.*, dt.name AS document_name
                FROM requests req
                JOIN document_types dt ON dt.id = req.document_type_id
                WHERE req.requester_id = $1
                ORDER BY req.submitted_at DESC`;
        const result = await pool.query(query, isStaff ? [] : [req.user.id]);
        res.json({ requests: result.rows });
    } catch (error) {
        next(error);
    }
});

const transitions = {
    submitted: ["needs_information", "approved", "rejected"],
    needs_information: ["submitted", "rejected"],
    approved: ["awaiting_payment"],
    awaiting_payment: ["paid", "cancelled"],
    paid: ["processing"],
    processing: ["ready"],
    ready: ["fulfilled"],
};

router.patch(
    "/:id/status",
    requireAuth,
    requireRole("processor", "administrator", "finance"),
    async (req, res, next) => {
        try {
            const data = z.object({
            status: z.string(),
            comment: z.string().max(2000).optional(),
            feeAmount: z.number().nonnegative().optional(),
            feeCurrency: z.string().length(3).optional(),
        }).parse(req.body);
    
        const current = await pool.query(
            "SELECT * FROM requests WHERE id = $1 FOR UPDATE",
            [req.params.id]
        );
    
        if (current.rowCount === 0) return res.status(404).json({ error: "Request not found" });
    
        const request = current.rows[0];
        if (!transitions[request.status]?.includes(data.status)) {
            return res.status(400).json({ error: "Invalid status transition" });
        }
    
        const updated = await pool.query(
        `UPDATE requests
        SET status = $1::request_status,
            fee_amount = COALESCE($2, fee_amount),
            fee_currency = COALESCE($3, fee_currency),
            assigned_to = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *`,
        [data.status, data.feeAmount ?? null, data.feeCurrency ?? null, req.user.id, req.params.id]
    );
    
    await pool.query(
        `INSERT INTO request_status_history
            (request_id, from_status, to_status, changed_by, comment)
        VALUES ($1, $2::request_status, $3::request_status, $4, $5)`,
        [req.params.id, request.status, data.status, req.user.id, data.comment ?? null]
    );
    
        res.json({ request: updated.rows[0] });
    } catch (error) {
        next(error);
    }
    }
);

export default router;