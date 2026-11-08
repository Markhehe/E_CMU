import { Router } from "express";
import bcrypt from "bcrypt";
import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createAccessToken, setAuthCookie } from "../../utils/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import {
    scheduleEmailNotification,
    sendPasswordResetCodeEmail,
} from "../../services/email.js";

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
            VALUES ($1, $2, $3, 'student', $4, TRUE)
            ON CONFLICT (email) DO NOTHING
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

        await client.query("COMMIT");
        client.release();
        client = undefined;

        res.status(201).json({
            message: "Account created. You can now sign in.",
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

const passwordResetRequestMessage =
    "If an active account matches this email, a password reset code will be sent.";

router.post("/password-reset/request", async (req, res, next) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter a valid email address." });
    }

    try {
        const accountResult = await pool.query(
            `SELECT id, email, full_name
             FROM users
             WHERE lower(email) = $1 AND active = TRUE`,
            [parsed.data.email.toLowerCase()],
        );
        const user = accountResult.rows[0];
        if (user) {
            const code = String(randomInt(100000, 1000000));
            const codeHash = createHash("sha256").update(code).digest("hex");
            const tokenResult = await pool.query(
                `INSERT INTO email_verification_tokens
                    (user_id, code_hash, expires_at, attempts)
                 VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0)
                 ON CONFLICT (user_id) DO UPDATE
                 SET code_hash = EXCLUDED.code_hash,
                     expires_at = EXCLUDED.expires_at,
                     attempts = 0
                 WHERE email_verification_tokens.expires_at < NOW() + INTERVAL '9 minutes'
                 RETURNING user_id`,
                [user.id, codeHash],
            );
            if (tokenResult.rowCount > 0) {
                scheduleEmailNotification("password-reset", () =>
                    sendPasswordResetCodeEmail({
                        email: user.email,
                        fullName: user.full_name,
                        code,
                    }),
                );
            }
        }

        return res.json({ message: passwordResetRequestMessage });
    } catch (error) {
        return next(error);
    }
});

router.post("/password-reset/verify", async (req, res, next) => {
    const parsed = z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter your email address and six-digit reset code." });
    }

    const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT token.user_id, token.code_hash, token.expires_at, token.attempts,
                    token.expires_at > NOW() AS code_is_valid
             FROM email_verification_tokens AS token
             JOIN users AS account ON account.id = token.user_id
             WHERE account.email = $1
               AND account.active = TRUE
             FOR UPDATE OF token`,
            [parsed.data.email.toLowerCase()],
        );
        if (result.rowCount === 0 || !result.rows[0].code_is_valid) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "The reset code is invalid or expired. Request a new code and try again." });
        }

        const record = result.rows[0];
        if (record.attempts >= 5) {
            await client.query("COMMIT");
            return res.status(429).json({ error: "Too many incorrect codes. Request a new reset code." });
        }

        const suppliedHash = Buffer.from(codeHash, "hex");
        const storedHash = Buffer.from(record.code_hash.trim(), "hex");
        if (!timingSafeEqual(suppliedHash, storedHash)) {
            await client.query(
                "UPDATE email_verification_tokens SET attempts = attempts + 1 WHERE user_id = $1",
                [record.user_id],
            );
            await client.query("COMMIT");
            return res.status(record.attempts + 1 >= 5 ? 429 : 400).json({
                error: record.attempts + 1 >= 5
                    ? "Too many incorrect codes. Request a new reset code."
                    : "The reset code is incorrect.",
            });
        }

        const resetToken = randomBytes(32).toString("hex");
        const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");
        await client.query(
            `UPDATE email_verification_tokens
             SET code_hash = $2,
                 expires_at = NOW() + INTERVAL '10 minutes',
                 attempts = 0
             WHERE user_id = $1`,
            [record.user_id, resetTokenHash],
        );
        await client.query("COMMIT");
        return res.json({ resetToken });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        return next(error);
    } finally {
        client?.release();
    }
});

router.post("/password-reset/complete", async (req, res, next) => {
    const parsed = z.object({
        resetToken: z.string().regex(/^[a-f0-9]{64}$/i),
        newPassword: z.string().min(8).max(72),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.issues[0]?.message || "Enter a valid reset token and a password between 8 and 72 characters.",
        });
    }

    const resetTokenHash = createHash("sha256")
        .update(parsed.data.resetToken)
        .digest("hex");
    try {
        const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const result = await client.query(
                `SELECT token.user_id
                 FROM email_verification_tokens AS token
                 JOIN users AS account ON account.id = token.user_id
                 WHERE token.code_hash = $1
                   AND token.expires_at > NOW()
                   AND account.active = TRUE
                 FOR UPDATE OF token`,
                [resetTokenHash],
            );
            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "The password reset session is invalid or expired. Request a new code." });
            }

            const userId = result.rows[0].user_id;
            await client.query(
                "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
                [passwordHash, userId],
            );
            await client.query(
                "DELETE FROM email_verification_tokens WHERE user_id = $1",
                [userId],
            );
            await client.query("COMMIT");
            return res.json({ message: "Your password has been reset. Sign in with your new password." });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        return next(error);
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
