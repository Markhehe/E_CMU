import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { pool } from "../../db/pool.js";

const router = Router();
const adminOnly = [requireAuth, requireRole("admin", "administrator")];
const accountSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});
const activeSchema = z.object({ active: z.boolean() });
const userIdSchema = z.coerce.number().int().positive().safe();

router.get("/", ...adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT account.id, account.full_name, account.email, account.active,
              account.created_at
       FROM users AS account
       INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
       INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
       WHERE account_role.name = 'registrar_staff'
       ORDER BY lower(account.full_name), account.id`,
    );
    return res.json({ staff: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/", ...adminOnly, async (req, res, next) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid registrar staff details",
    });
  }

  let client;
  try {
    const { fullName, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query("BEGIN");

    const role = await client.query(
      "SELECT id FROM roles WHERE name = 'registrar_staff'",
    );
    if (role.rowCount === 0) {
      throw new Error("Registrar staff role is not configured");
    }

    const account = await client.query(
      `INSERT INTO users (email, password_hash, full_name, stakeholder_type, active)
       VALUES ($1, $2, $3, 'other', TRUE)
       RETURNING id, full_name, email, active, created_at`,
      [email, passwordHash, fullName],
    );
    const staff = account.rows[0];
    await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [staff.id, role.rows[0].id],
    );
    await client.query("COMMIT");
    return res.status(201).json({ staff });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return next(error);
  } finally {
    client?.release();
  }
});

router.patch("/:id", ...adminOnly, async (req, res, next) => {
  const id = userIdSchema.safeParse(req.params.id);
  const parsed = activeSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    return res.status(400).json({ error: "Invalid staff account update." });
  }

  try {
    const result = await pool.query(
      `UPDATE users AS account
       SET active = $1, updated_at = NOW()
       WHERE account.id = $2
         AND EXISTS (
           SELECT 1
           FROM user_roles AS assignment
           INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
           WHERE assignment.user_id = account.id
             AND account_role.name = 'registrar_staff'
         )
       RETURNING account.id, account.full_name, account.email, account.active,
                 account.created_at`,
      [parsed.data.active, id.data],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Registrar staff account not found." });
    }
    return res.json({ staff: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", ...adminOnly, async (req, res, next) => {
  const id = userIdSchema.safeParse(req.params.id);
  if (!id.success) {
    return res.status(400).json({ error: "Invalid staff account ID." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const account = await client.query(
      `SELECT account.id
       FROM users AS account
       INNER JOIN user_roles AS assignment ON assignment.user_id = account.id
       INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
       WHERE account.id = $1
         AND account_role.name = 'registrar_staff'
       FOR UPDATE OF account`,
      [id.data],
    );
    if (account.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Registrar staff account not found." });
    }

    await client.query(
      "UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = $1",
      [id.data],
    );
    await client.query(
      `DELETE FROM user_roles
       WHERE user_id = $1
         AND role_id = (SELECT id FROM roles WHERE name = 'registrar_staff')`,
      [id.data],
    );
    await client.query("COMMIT");
    return res.status(204).end();
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return next(error);
  } finally {
    client?.release();
  }
});

export default router;
