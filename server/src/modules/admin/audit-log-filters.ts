import { z } from "zod";

const optionalDate = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().date().optional(),
);

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(100_000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  from: optionalDate,
  to: optionalDate,
  actor: z.string().trim().max(120).optional().default(""),
  action: z.string().trim().max(120).optional().default(""),
  entityType: z.string().trim().max(80).optional().default(""),
  entityId: z.string().trim().max(120).optional().default(""),
});

type AuditLogFilters = z.infer<typeof auditLogQuerySchema>;

export function buildAuditLogWhereClause(filters: AuditLogFilters) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const addFilter = (sql: (parameter: string) => string, value: unknown) => {
    params.push(value);
    conditions.push(sql(`$${params.length}`));
  };

  if (filters.from) {
    addFilter((parameter) => `log.created_at >= ${parameter}::date`, filters.from);
  }
  if (filters.to) {
    addFilter((parameter) => `log.created_at < (${parameter}::date + INTERVAL '1 day')`, filters.to);
  }
  if (filters.actor) {
    addFilter(
      (parameter) => `(actor.full_name ILIKE ${parameter} OR actor.email ILIKE ${parameter})`,
      `%${filters.actor}%`,
    );
  }
  if (filters.action) {
    addFilter((parameter) => `log.action ILIKE ${parameter}`, `%${filters.action}%`);
  }
  if (filters.entityType) {
    addFilter((parameter) => `log.entity_type ILIKE ${parameter}`, `%${filters.entityType}%`);
  }
  if (filters.entityId) {
    addFilter(
      (parameter) => `(
        log.entity_id ILIKE ${parameter}
        OR related_request.display_code ILIKE ${parameter}
        OR log.metadata->>'displayCode' ILIKE ${parameter}
      )`,
      `%${filters.entityId}%`,
    );
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}
