import { Router } from "express";
import { pool } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { auditLogQuerySchema, buildAuditLogWhereClause } from "./audit-log-filters.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("admin", "administrator")];

router.get("/", ...adminOnly, async (req, res, next) => {
  const parsed = auditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid audit-log filters.",
    });
  }
  const filters = parsed.data;
  if (filters.from && filters.to && filters.from > filters.to) {
    return res.status(400).json({ error: "Start date must not be after end date." });
  }

  const { whereClause, params } = buildAuditLogWhereClause(filters);
  const pageSize = filters.pageSize;

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs AS log
       LEFT JOIN users AS actor ON actor.id = log.actor_id
      LEFT JOIN requests AS related_request
        ON log.entity_type = 'request' AND related_request.id::text = log.entity_id
      ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(filters.page, totalPages);
    const result = await pool.query(
      `SELECT log.id, log.created_at AS "createdAt", log.actor_id AS "actorId",
              actor.full_name AS "actorName", actor.email AS "actorEmail",
              log.action, log.entity_type AS "entityType", log.entity_id AS "entityId",
              COALESCE(related_request.display_code, log.metadata->>'displayCode') AS "displayCode",
              log.metadata
       FROM audit_logs AS log
       LEFT JOIN users AS actor ON actor.id = log.actor_id
       LEFT JOIN requests AS related_request
         ON log.entity_type = 'request' AND related_request.id::text = log.entity_id
       ${whereClause}
       ORDER BY log.created_at DESC, log.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    return res.json({
      entries: result.rows,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
