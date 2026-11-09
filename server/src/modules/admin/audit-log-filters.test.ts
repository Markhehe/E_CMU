import { describe, expect, it } from "vitest";
import { auditLogQuerySchema, buildAuditLogWhereClause } from "./audit-log-filters.js";

describe("audit log filters", () => {
  it("applies a from date without requiring an end date", () => {
    const filters = auditLogQuerySchema.parse({
      from: "2026-11-09",
      to: "",
      actor: "",
      action: "",
      entityType: "",
      entityId: "",
    });

    expect(filters.from).toBe("2026-11-09");
    expect(filters.to).toBeUndefined();
    expect(buildAuditLogWhereClause(filters)).toEqual({
      whereClause: "WHERE log.created_at >= $1::date",
      params: ["2026-11-09"],
    });
  });

  it("ignores blank inputs while applying all populated filters", () => {
    const filters = auditLogQuerySchema.parse({
      from: "",
      to: "",
      actor: "  Alex  ",
      action: "",
      entityType: " request ",
      entityId: "",
    });

    const result = buildAuditLogWhereClause(filters);
    expect(result.whereClause).toContain("actor.full_name ILIKE $1");
    expect(result.whereClause).toContain("log.entity_type ILIKE $2");
    expect(result.params).toEqual(["%Alex%", "%request%"]);
  });

  it("searches visible request codes as well as internal record IDs", () => {
    const filters = auditLogQuerySchema.parse({ entityId: "000025" });
    const result = buildAuditLogWhereClause(filters);

    expect(result.whereClause).toContain("log.entity_id ILIKE $1");
    expect(result.whereClause).toContain("related_request.display_code ILIKE $1");
    expect(result.whereClause).toContain("log.metadata->>'displayCode' ILIKE $1");
    expect(result.params).toEqual(["%000025%"]);
  });

  it("leaves the query unrestricted when every filter is blank", () => {
    const filters = auditLogQuerySchema.parse({
      from: "",
      to: "",
      actor: "",
      action: "",
      entityType: "",
      entityId: "",
    });

    expect(buildAuditLogWhereClause(filters)).toEqual({
      whereClause: "",
      params: [],
    });
  });
});
