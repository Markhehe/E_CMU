import { Router } from "express";
import bcrypt from "bcrypt";
import { Buffer } from "node:buffer";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createAccessToken, setAuthCookie } from "../../utils/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import { sendConfirmationEmail } from "../../services/email.js";

const router = Router();
const credentials = z.object({
    email: z.string().email().refine(
        (email) => email.toLowerCase().endsWith("@cityofmalabonuniversity.edu.ph"),
        { message: "Use your @cityofmalabonuniversity.edu.ph email address" }
    ),
    password: z.string().min(8),
});

router.post("/register", async (req, res, next) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues[0]?.message || "Invalid registration details",
        });
    }

    let client;
    try {
        const data = parsed.data;
        const normalizedEmail = data.email.toLowerCase();
        const studentId = normalizedEmail.split("@")[0];
        const passwordHash = await bcrypt.hash(data.password, 12);
        const code = String(randomInt(100000, 1000000));
        const codeHash = createHash("sha256").update(code).digest("hex");
        client = await pool.connect();
        await client.query("BEGIN");

        const directoryResult = await client.query(
            `SELECT student_id, first_name, middle_name, last_name
             FROM student_directory
             WHERE lower(student_id) = $1`,
            [studentId],
        );
        if (directoryResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(422).json({
                error: "Your university email does not match a student record. Contact the Registrar to verify your student ID.",
            });
        }

        const student = directoryResult.rows[0];
        const fullName = [
            student.first_name,
            student.middle_name,
            student.last_name,
        ].filter(Boolean).join(" ");

        const result = await client.query(
            `INSERT INTO users
                (email, password_hash, full_name, stakeholder_type, student_id, email_verified)
            VALUES ($1, $2, $3, 'student', $4, FALSE)
            ON CONFLICT (email) DO UPDATE
            SET password_hash = EXCLUDED.password_hash,
                full_name = EXCLUDED.full_name,
                student_id = EXCLUDED.student_id,
                updated_at = NOW()
            WHERE users.email_verified = FALSE
            RETURNING id, email, full_name, stakeholder_type`,
            [normalizedEmail, passwordHash, fullName, student.student_id]
        );

        if (result.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Email is already registered" });
        }

        const user = result.rows[0];
        const role = await client.query("SELECT id FROM roles WHERE name = 'student'");
        if (role.rowCount === 0) {
            throw new Error("Student role is not configured");
        }
        await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [user.id, role.rows[0].id]
        );
        await client.query(
            `INSERT INTO email_verification_tokens (user_id, code_hash, expires_at, attempts)
             VALUES ($1, $2, NOW() + INTERVAL '120 seconds', 0)
             ON CONFLICT (user_id) DO UPDATE
             SET code_hash = EXCLUDED.code_hash,
                 expires_at = EXCLUDED.expires_at,
                 attempts = 0`,
            [user.id, codeHash]
        );

        await client.query("COMMIT");
        client.release();
        client = undefined;

        try {
            await sendConfirmationEmail({
                email: user.email,
                fullName: user.full_name,
                code,
            });
        } catch (emailError) {
            console.error("Failed to send account confirmation email:", emailError);
            return res.status(503).json({
                error: "Your account was created, but the confirmation email could not be sent. Use the resend confirmation option to try again.",
            });
        }

        res.status(201).json({
            message: "Account created. Check your email to confirm your account before signing in.",
            email: user.email,
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(409).json({ error: "Email is already registered" });
        }
        next(error);
    } finally {
        client?.release();
    }
});

router.post("/verify-email", async (req, res, next) => {
    const parsed = z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter your email address and the six-digit verification code" });
    }

    const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const verification = await client.query(
            `SELECT token.user_id, token.code_hash, token.expires_at, token.attempts,
                    token.expires_at > NOW() AS code_is_valid
             FROM email_verification_tokens AS token
             JOIN users AS account ON account.id = token.user_id
             WHERE account.email = $1 AND account.email_verified = FALSE
             FOR UPDATE OF token`,
            [parsed.data.email.toLowerCase()]
        );
        if (verification.rowCount === 0 || !verification.rows[0].code_is_valid) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "This verification code is invalid or expired. Request a new code and try again." });
        }

        const record = verification.rows[0];
        if (record.attempts >= 5) {
            await client.query("COMMIT");
            return res.status(429).json({ error: "Too many incorrect codes. Request a new verification code." });
        }

        const suppliedHash = Buffer.from(codeHash, "hex");
        const storedHash = Buffer.from(record.code_hash.trim(), "hex");
        if (!timingSafeEqual(suppliedHash, storedHash)) {
            await client.query(
                "UPDATE email_verification_tokens SET attempts = attempts + 1 WHERE user_id = $1",
                [record.user_id]
            );
            await client.query("COMMIT");
            return res.status(record.attempts + 1 >= 5 ? 429 : 400).json({
                error: record.attempts + 1 >= 5
                    ? "Too many incorrect codes. Request a new verification code."
                    : "The verification code is incorrect.",
            });
        }

        await client.query(
            "UPDATE users SET email_verified = TRUE WHERE id = $1",
            [record.user_id]
        );
        await client.query(
            "DELETE FROM email_verification_tokens WHERE user_id = $1",
            [record.user_id]
        );
        const userResult = await client.query(
            `SELECT account.id, account.email, account.full_name, account.student_id,
                    account.contact_phone, account.contact_address,
                    account.stakeholder_type, directory.birthdate,
                    COALESCE(array_agg(role.name) FILTER (WHERE role.name IS NOT NULL), '{}') AS roles
             FROM users AS account
             LEFT JOIN student_directory AS directory
               ON directory.student_id = account.student_id
             LEFT JOIN user_roles AS assignment ON assignment.user_id = account.id
             LEFT JOIN roles AS role ON role.id = assignment.role_id
             WHERE account.id = $1 AND account.active = TRUE
             GROUP BY account.id, directory.birthdate`,
            [record.user_id]
        );
        const user = userResult.rows[0];
        if (!user) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "This account is not active." });
        }
        await client.query("COMMIT");
        setAuthCookie(res, createAccessToken(user));
        return res.json({
            message: "Email confirmed and signed in successfully.",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                studentId: user.student_id,
                birthdate: user.birthdate,
                contactPhone: user.contact_phone,
                contactAddress: user.contact_address,
                stakeholderType: user.stakeholder_type,
                roles: user.roles,
            },
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        return next(error);
    } finally {
        client?.release();
    }
});

router.post("/resend-confirmation", async (req, res, next) => {
    const parsed = z.object({
        email: z.string().email().refine(
            (email) => email.toLowerCase().endsWith("@cityofmalabonuniversity.edu.ph"),
            { message: "Use your @cityofmalabonuniversity.edu.ph email address" }
        ),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues[0]?.message || "Invalid email address",
        });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT id, email, full_name
             FROM users
             WHERE email = $1 AND email_verified = FALSE`,
            [parsed.data.email.toLowerCase()]
        );
        if (result.rowCount === 0) {
            await client.query("COMMIT");
            return res.json({ message: "If the account needs confirmation, a new email has been sent." });
        }

        const user = result.rows[0];
        const code = String(randomInt(100000, 1000000));
        const codeHash = createHash("sha256").update(code).digest("hex");
        await client.query(
            `INSERT INTO email_verification_tokens (user_id, code_hash, expires_at, attempts)
             VALUES ($1, $2, NOW() + INTERVAL '120 seconds', 0)
             ON CONFLICT (user_id) DO UPDATE
             SET code_hash = EXCLUDED.code_hash,
                 expires_at = EXCLUDED.expires_at,
                 attempts = 0`,
            [user.id, codeHash]
        );
        await client.query("COMMIT");
        client.release();
        client = undefined;

        try {
            await sendConfirmationEmail({ email: user.email, fullName: user.full_name, code });
        } catch (emailError) {
            console.error("Failed to resend account confirmation email:", emailError);
            return res.status(503).json({
                error: "The confirmation email could not be sent. Please try again later.",
            });
        }
        return res.json({ message: "If the account needs confirmation, a new email has been sent." });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        return next(error);
    } finally {
        client?.release();
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const data = z.object({
            email: z.string().email(),
            password: z.string(),
        }).parse(req.body);
        const result = await pool.query(
            `SELECT u.*,
                directory.birthdate,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
             FROM users u
             LEFT JOIN student_directory AS directory
               ON directory.student_id = u.student_id
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.email = $1 AND u.active = TRUE
             GROUP BY u.id, directory.birthdate`,
            [data.email.toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const user = result.rows[0];
        const valid = await bcrypt.compare(data.password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });
        if (!user.email_verified) {
            return res.status(403).json({ error: "Confirm your email address before signing in." });
        }

        setAuthCookie(res, createAccessToken(user));
        res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                studentId: user.student_id,
                birthdate: user.birthdate,
                contactPhone: user.contact_phone,
                contactAddress: user.contact_address,
                stakeholderType: user.stakeholder_type,
                roles: user.roles,
            },
        });
    } catch (error) {
        next(error);
    }
});

router.post("/logout", (_req, res) => {
 res.clearCookie("access_token");
 res.status(204).end();
});

router.patch("/profile", requireAuth, async (req, res, next) => {
    const parsed = z.object({
        contactPhone: z.string().trim().max(40).nullable().optional(),
        contactAddress: z.string().trim().max(500).nullable().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues[0]?.message || "Enter valid contact details",
        });
    }
    if (parsed.data.contactPhone === undefined && parsed.data.contactAddress === undefined) {
        return res.status(400).json({ error: "Provide at least one contact detail to update" });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET contact_phone = CASE WHEN $1::boolean THEN $2 ELSE contact_phone END,
                 contact_address = CASE WHEN $3::boolean THEN $4 ELSE contact_address END,
                 updated_at = NOW()
             WHERE id = $5 AND active = TRUE
             RETURNING id, email, full_name, stakeholder_type, student_id,
                       contact_phone, contact_address`,
            [
                parsed.data.contactPhone !== undefined,
                parsed.data.contactPhone ?? null,
                parsed.data.contactAddress !== undefined,
                parsed.data.contactAddress ?? null,
                req.user.id,
            ],
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User account not found" });
        }

        const user = result.rows[0];
        return res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                studentId: user.student_id,
                contactPhone: user.contact_phone,
                contactAddress: user.contact_address,
                stakeholderType: user.stakeholder_type,
                roles: req.user.roles,
            },
        });
    } catch (error) {
        return next(error);
    }
});

router.get("/me", requireAuth, (req, res) => {
     res.json({ user: req.user });
});

export default router;
