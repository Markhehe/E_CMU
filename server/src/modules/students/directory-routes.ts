import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { writeAuditLog } from "../../services/audit-log.js";

const router = Router();
const registrarRoles = ["registrar", "registrar_staff", "admin", "administrator"];
const MAX_STUDENTS_PER_IMPORT = 500;

const dateSchema = z.string().trim().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Birthdate must use YYYY-MM-DD format.",
).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Birthdate must be a valid calendar date.");

export const studentDirectoryRecordSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required.").max(64),
  firstName: z.string().trim().min(1, "First name is required.").max(120),
  middleName: z.string().trim().max(120).optional().transform((value) => value || null),
  lastName: z.string().trim().min(1, "Last name is required.").max(120),
  birthdate: dateSchema,
});

const importSchema = z.object({
  records: z.array(studentDirectoryRecordSchema).min(1).max(MAX_STUDENTS_PER_IMPORT),
});
const directoryQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().positive().max(100_000).optional().default(1),
});
const studentIdParamSchema = z.string().trim().min(1).max(64);
const accountActiveSchema = z.object({ active: z.boolean() });
export const studentIdPrefixSchema = z.string().regex(/^\d{4}$/, "Enter exactly four digits.");
const existingIdsSchema = z.object({
  studentIds: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_STUDENTS_PER_IMPORT),
});

router.get(
  "/",
  requireAuth,
  requireRole("admin", "administrator"),
  async (req, res, next) => {
    const parsed = directoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid directory query.",
      });
    }

    const pageSize = 50;
    const offset = (parsed.data.page - 1) * pageSize;
    const search = parsed.data.search;
    try {
      const [records, count] = await Promise.all([
        pool.query(
          `SELECT directory.student_id AS "studentId",
                  directory.first_name AS "firstName",
                  directory.middle_name AS "middleName",
                  directory.last_name AS "lastName",
                  directory.birthdate,
                  account.active AS "accountActive",
                  account.email_verified AS "emailVerified",
                  account.id IS NOT NULL AS "hasAccount"
           FROM student_directory AS directory
           LEFT JOIN users AS account
             ON account.student_id = directory.student_id
            AND EXISTS (
              SELECT 1
              FROM user_roles AS assignment
              INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
              WHERE assignment.user_id = account.id
                AND account_role.name = 'student'
            )
           WHERE $1 = ''
              OR directory.student_id ILIKE '%' || $1 || '%'
              OR concat_ws(' ', directory.first_name, directory.middle_name, directory.last_name) ILIKE '%' || $1 || '%'
           ORDER BY directory.student_id
           LIMIT $2 OFFSET $3`,
          [search, pageSize, offset],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM student_directory
           WHERE $1 = ''
              OR student_id ILIKE '%' || $1 || '%'
              OR concat_ws(' ', first_name, middle_name, last_name) ILIKE '%' || $1 || '%'`,
          [search],
        ),
      ]);
      return res.json({
        records: records.rows,
        total: count.rows[0].total,
        page: parsed.data.page,
        pageSize,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  "/:studentId/account",
  requireAuth,
  requireRole("admin", "administrator"),
  async (req, res, next) => {
    const parsedStudentId = studentIdParamSchema.safeParse(req.params.studentId);
    const parsedActive = accountActiveSchema.safeParse(req.body);
    if (!parsedStudentId.success || !parsedActive.success) {
      return res.status(400).json({ error: "Invalid student account update." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE users AS account
         SET active = $1, updated_at = NOW()
         WHERE account.student_id = $2
           AND account.email_verified = TRUE
           AND EXISTS (
             SELECT 1
             FROM user_roles AS assignment
             INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
             WHERE assignment.user_id = account.id
               AND account_role.name = 'student'
           )
         RETURNING account.student_id AS "studentId",
                   account.active AS "accountActive",
                   account.email_verified AS "emailVerified",
                   TRUE AS "hasAccount"`,
        [parsedActive.data.active, parsedStudentId.data],
      );
      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        const existing = await pool.query(
          `SELECT account.email_verified AS "emailVerified"
           FROM users AS account
           INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
           INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
           WHERE account.student_id = $1
             AND account_role.name = 'student'
           LIMIT 1`,
          [parsedStudentId.data],
        );
        if (existing.rowCount > 0 && !existing.rows[0].emailVerified) {
          return res.status(409).json({
            error: "A student account must verify its email before it can be restored.",
          });
        }
        return res.status(404).json({ error: "Student account not found." });
      }
      await writeAuditLog(client, {
        actorId: req.user!.id,
        action: parsedActive.data.active ? "student_account.restored" : "student_account.suspended",
        entityType: "student_account",
        entityId: parsedStudentId.data,
        metadata: { active: parsedActive.data.active },
      });
      await client.query("COMMIT");
      return res.json({ account: result.rows[0] });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      return next(error);
    } finally {
      client?.release();
    }
  },
);

router.post(
  "/suspend-prefix",
  requireAuth,
  requireRole("admin", "administrator"),
  async (req, res, next) => {
    const parsedPrefix = studentIdPrefixSchema.safeParse(req.body?.prefix);
    if (!parsedPrefix.success) {
      return res.status(400).json({
        error: parsedPrefix.error.issues[0]?.message || "Invalid student ID prefix.",
      });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE users AS account
         SET active = FALSE, updated_at = NOW()
         WHERE account.active = TRUE
           AND account.email_verified = TRUE
           AND LEFT(account.student_id, 4) = $1
           AND EXISTS (
             SELECT 1
             FROM user_roles AS assignment
             INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
             WHERE assignment.user_id = account.id
               AND account_role.name = 'student'
           )
         RETURNING account.student_id`,
        [parsedPrefix.data],
      );
      await writeAuditLog(client, {
        actorId: req.user!.id,
        action: "student_accounts.bulk_suspended",
        entityType: "student_account",
        entityId: parsedPrefix.data,
        metadata: { count: result.rowCount ?? 0 },
      });
      await client.query("COMMIT");
      return res.json({
        prefix: parsedPrefix.data,
        suspended: result.rowCount ?? 0,
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      return next(error);
    } finally {
      client?.release();
    }
  },
);

router.post(
  "/check",
  requireAuth,
  requireRole(...registrarRoles),
  async (req, res, next) => {
    const parsed = existingIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid student IDs.",
      });
    }

    try {
      const result = await pool.query(
        `SELECT student_id
         FROM student_directory
         WHERE student_id = ANY($1::varchar[])`,
        [parsed.data.studentIds],
      );
      return res.json({ studentIds: result.rows.map((row) => row.student_id) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/",
  requireAuth,
  requireRole("admin", "administrator"),
  async (req, res, next) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const row = typeof issue?.path[1] === "number" ? issue.path[1] + 1 : null;
      return res.status(400).json({
        error: row
          ? `Row ${row}: ${issue.message}`
          : issue?.message || "Invalid student records.",
      });
    }

    const records = parsed.data.records;
    const seenStudentIds = new Set<string>();
    for (const record of records) {
      if (seenStudentIds.has(record.studentId)) {
        return res.status(400).json({
          error: `Student ID ${record.studentId} appears more than once in this import.`,
        });
      }
      seenStudentIds.add(record.studentId);
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      let inserted = 0;
      for (const record of records) {
        const result = await client.query(
          `INSERT INTO student_directory
             (student_id, first_name, middle_name, last_name, birthdate)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (student_id) DO NOTHING`,
          [
            record.studentId,
            record.firstName,
            record.middleName ?? null,
            record.lastName,
            record.birthdate,
          ],
        );
        inserted += result.rowCount ?? 0;
      }
      await writeAuditLog(client, {
        actorId: req.user!.id,
        action: "student_directory.imported",
        entityType: "student_directory",
        entityId: "bulk-import",
        metadata: { inserted, skipped: records.length - inserted },
      });
      await client.query("COMMIT");
      return res.status(201).json({
        inserted,
        skipped: records.length - inserted,
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return res.status(409).json({
          error: "One or more student IDs already exist. No records were imported.",
        });
      }
      return next(error);
    } finally {
      client?.release();
    }
  },
);

export default router;
