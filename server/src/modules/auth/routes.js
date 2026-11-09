import { Router } from "express";
import bcrypt from "bcrypt";
import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createAccessToken, setAuthCookie } from "../../utils/tokens.js";
import { requireAuth } from "../../middleware/auth.js";
import { requiresStudentLoginVerification } from "./login-policy.js";
import {
    scheduleEmailNotification,
    sendPasswordResetCodeEmail,
    sendStudentLoginCodeEmail,
    sendStudentRegistrationCodeEmail,
} from "../../services/email.js";

const router = Router();
const credentials = z.object({
    email: z.string().email().refine(
        (email) => email.toLowerCase().endsWith("@cityofmalabonuniversity.edu.ph"),
        { message: "Use your @cityofmalabonuniversity.edu.ph email address" }
    ),
    password: z.string().min(8),
});
const loginVerificationSchema = z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/),
});

async function issueStudentLoginCode(user) {
    const code = String(randomInt(100000, 1000000));
    const codeHash = createHash("sha256").update(code).digest("hex");
    const result = await pool.query(
        `INSERT INTO student_login_verification_tokens
            (user_id, code_hash, expires_at, attempts, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET code_hash = EXCLUDED.code_hash,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             created_at = NOW()
         WHERE student_login_verification_tokens.created_at <= NOW() - INTERVAL '1 minute'
         RETURNING user_id`,
        [user.id, codeHash],
    );
    if (result.rowCount === 0) return false;

    try {
        await sendStudentLoginCodeEmail({
            email: user.email,
            fullName: user.full_name,
            code,
        });
    } catch (error) {
        try {
            await pool.query(
                `DELETE FROM student_login_verification_tokens
                 WHERE user_id = $1 AND code_hash = $2`,
                [user.id, codeHash],
            );
        } catch (cleanupError) {
            console.error("Failed to clear an unsent student login code:", cleanupError);
        }
        throw error;
    }
    return true;
}

function formatAuthenticatedUser(user) {
    return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        studentId: user.student_id,
        birthdate: user.birthdate,
        contactPhone: user.contact_phone,
        contactAddress: user.contact_address,
        stakeholderType: user.stakeholder_type,
        roles: user.roles,
    };
}

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

        const existing = await client.query(
            `SELECT id, active, email_verified, stakeholder_type
             FROM users
             WHERE lower(email) = $1
             FOR UPDATE`,
            [normalizedEmail],
        );
        let user;
        if (existing.rowCount > 0) {
            const account = existing.rows[0];
            if (
                account.active
                || account.email_verified
                || account.stakeholder_type !== "student"
            ) {
                await client.query("ROLLBACK");
                return res.status(409).json({ error: "Email is already registered" });
            }
            const updated = await client.query(
                `UPDATE users
                 SET password_hash = $1, full_name = $2, student_id = $3, updated_at = NOW()
                 WHERE id = $4
                 RETURNING id, email, full_name, stakeholder_type`,
                [passwordHash, fullName, student.student_id, account.id],
            );
            user = updated.rows[0];
        } else {
            const created = await client.query(
                `INSERT INTO users
                    (email, password_hash, full_name, stakeholder_type, student_id, email_verified, active)
                 VALUES ($1, $2, $3, 'student', $4, FALSE, FALSE)
                 RETURNING id, email, full_name, stakeholder_type`,
                [normalizedEmail, passwordHash, fullName, student.student_id],
            );
            user = created.rows[0];
        }

        const role = await client.query("SELECT id FROM roles WHERE name = 'student'");
        if (role.rowCount === 0) {
            throw new Error("Student role is not configured");
        }
        await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [user.id, role.rows[0].id]
        );

        const code = String(randomInt(100000, 1000000));
        const codeHash = createHash("sha256").update(code).digest("hex");
        const verification = await client.query(
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
        if (verification.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(429).json({
                error: "A verification code was recently sent. Check your email or wait before requesting another.",
            });
        }

        await client.query("COMMIT");
        client.release();
        client = undefined;

        try {
            await sendStudentRegistrationCodeEmail({
                email: user.email,
                fullName: user.full_name,
                code,
            });
        } catch (emailError) {
            console.error("Failed to send student registration verification email:", emailError);
            return res.status(503).json({
                error: "Your registration is saved but the verification email could not be sent. Please try again shortly.",
            });
        }

        return res.status(201).json({
            message: "A verification code has been sent to your university email.",
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

const registrationVerificationSchema = z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/),
});

router.post("/register/resend-code", async (req, res, next) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter a valid university email address." });
    }

    const email = parsed.data.email.toLowerCase();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const pending = await client.query(
            `SELECT id, email, full_name
             FROM users
             WHERE lower(email) = $1
               AND stakeholder_type = 'student'
               AND active = FALSE
               AND email_verified = FALSE
             FOR UPDATE`,
            [email],
        );
        if (pending.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.json({
                message: "If student registration is pending for this email, a verification code will be sent.",
            });
        }

        const code = String(randomInt(100000, 1000000));
        const codeHash = createHash("sha256").update(code).digest("hex");
        const verification = await client.query(
            `INSERT INTO email_verification_tokens
                (user_id, code_hash, expires_at, attempts)
             VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0)
             ON CONFLICT (user_id) DO UPDATE
             SET code_hash = EXCLUDED.code_hash,
                 expires_at = EXCLUDED.expires_at,
                 attempts = 0
             WHERE email_verification_tokens.expires_at < NOW() + INTERVAL '9 minutes'
             RETURNING user_id`,
            [pending.rows[0].id, codeHash],
        );
        if (verification.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(429).json({
                error: "A verification code was recently sent. Wait before requesting another.",
            });
        }

        await client.query("COMMIT");
        try {
            await sendStudentRegistrationCodeEmail({
                email: pending.rows[0].email,
                fullName: pending.rows[0].full_name,
                code,
            });
        } catch (emailError) {
            console.error("Failed to resend student registration verification email:", emailError);
            return res.status(503).json({
                error: "The verification email could not be sent. Please try again shortly.",
            });
        }
        return res.json({ message: "A new verification code has been sent." });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Failed to roll back registration code resend:", rollbackError);
        }
        return next(error);
    } finally {
        client.release();
    }
});

router.post("/register/verify-code", async (req, res, next) => {
    const parsed = registrationVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter your email address and six-digit verification code." });
    }

    const email = parsed.data.email.toLowerCase();
    const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT account.id, token.code_hash, token.attempts,
                    token.expires_at > NOW() AS code_is_valid
             FROM email_verification_tokens AS token
             INNER JOIN users AS account ON account.id = token.user_id
             WHERE lower(account.email) = $1
               AND account.stakeholder_type = 'student'
               AND account.active = FALSE
               AND account.email_verified = FALSE
             FOR UPDATE OF token, account`,
            [email],
        );
        if (result.rowCount === 0 || !result.rows[0].code_is_valid) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "The verification code is invalid or expired. Request a new code and try again.",
            });
        }

        const record = result.rows[0];
        if (record.attempts >= 5) {
            await client.query("COMMIT");
            return res.status(429).json({
                error: "Too many incorrect codes. Request a new verification code.",
            });
        }

        const suppliedHash = Buffer.from(codeHash, "hex");
        const storedHash = Buffer.from(record.code_hash.trim(), "hex");
        if (!timingSafeEqual(suppliedHash, storedHash)) {
            await client.query(
                "UPDATE email_verification_tokens SET attempts = attempts + 1 WHERE user_id = $1",
                [record.id],
            );
            await client.query("COMMIT");
            return res.status(record.attempts + 1 >= 5 ? 429 : 400).json({
                error: record.attempts + 1 >= 5
                    ? "Too many incorrect codes. Request a new verification code."
                    : "The verification code is incorrect.",
            });
        }

        await client.query(
            `UPDATE users
             SET active = TRUE, email_verified = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [record.id],
        );
        await client.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [record.id]);
        await client.query("COMMIT");
        return res.json({ message: "Email verified. Your student account is ready to sign in." });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Failed to roll back registration code verification:", rollbackError);
        }
        return next(error);
    } finally {
        client.release();
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

function activeLoginUserQuery(predicate) {
    return `
        SELECT account.*,
            directory.birthdate,
            COALESCE(array_agg(account_role.name) FILTER (WHERE account_role.name IS NOT NULL), '{}') AS roles
        FROM users AS account
        LEFT JOIN student_directory AS directory
          ON directory.student_id = account.student_id
        LEFT JOIN user_roles AS assignment ON assignment.user_id = account.id
        LEFT JOIN roles AS account_role ON account_role.id = assignment.role_id
        WHERE account.active = TRUE AND ${predicate}
        GROUP BY account.id, directory.birthdate`;
}

router.post("/login", async (req, res, next) => {
    try {
        const data = z.object({
            email: z.string().email(),
            password: z.string(),
        }).parse(req.body);
        const result = await pool.query(
            activeLoginUserQuery("lower(account.email) = $1"),
            [data.email.toLowerCase()],
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const user = result.rows[0];
        const valid = await bcrypt.compare(data.password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        if (requiresStudentLoginVerification(user.roles)) {
            if (!user.email_verified) {
                return res.status(403).json({
                    error: "Verify your student registration email before signing in.",
                });
            }
            try {
                const sent = await issueStudentLoginCode(user);
                return res.json({
                    verificationRequired: true,
                    email: user.email,
                    message: sent
                        ? "A sign-in verification code has been sent to your university email."
                        : "A sign-in code was recently sent. Check your email before requesting another.",
                });
            } catch (emailError) {
                console.error("Failed to send student login verification email:", emailError);
                return res.status(503).json({
                    error: "The sign-in verification email could not be sent. Please try again shortly.",
                });
            }
        }

        setAuthCookie(res, createAccessToken(user));
        return res.json({ user: formatAuthenticatedUser(user) });
    } catch (error) {
        return next(error);
    }
});

router.post("/login/resend-code", async (req, res, next) => {
    const parsed = z.object({
        email: z.string().email(),
        password: z.string(),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter your email and password to request a sign-in code." });
    }

    try {
        const result = await pool.query(
            activeLoginUserQuery("lower(account.email) = $1"),
            [parsed.data.email.toLowerCase()],
        );
        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const user = result.rows[0];
        if (!(await bcrypt.compare(parsed.data.password, user.password_hash))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        if (!requiresStudentLoginVerification(user.roles)) {
            return res.status(400).json({ error: "Email verification is not required for this account." });
        }
        if (!user.email_verified) {
            return res.status(403).json({
                error: "Verify your student registration email before signing in.",
            });
        }

        try {
            const sent = await issueStudentLoginCode(user);
            if (!sent) {
                return res.status(429).json({
                    error: "A sign-in code was recently sent. Wait one minute before requesting another.",
                });
            }
        } catch (emailError) {
            console.error("Failed to resend student login verification email:", emailError);
            return res.status(503).json({
                error: "The sign-in verification email could not be sent. Please try again shortly.",
            });
        }
        return res.json({ message: "A new sign-in verification code has been sent." });
    } catch (error) {
        return next(error);
    }
});

router.post("/login/verify-code", async (req, res, next) => {
    const parsed = loginVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Enter your email address and six-digit sign-in code." });
    }

    const client = await pool.connect();
    const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
    try {
        await client.query("BEGIN");
        const tokenResult = await client.query(
            `SELECT account.id, token.code_hash, token.attempts,
                    token.expires_at > NOW() AS code_is_valid
             FROM student_login_verification_tokens AS token
             INNER JOIN users AS account ON account.id = token.user_id
             WHERE lower(account.email) = $1
               AND account.active = TRUE
               AND account.email_verified = TRUE
               AND EXISTS (
                 SELECT 1
                 FROM user_roles AS assignment
                 INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
                 WHERE assignment.user_id = account.id
                   AND account_role.name = 'student'
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM user_roles AS assignment
                 INNER JOIN roles AS account_role ON account_role.id = assignment.role_id
                 WHERE assignment.user_id = account.id
                   AND lower(account_role.name) IN ('admin', 'administrator', 'registrar', 'registrar_staff')
               )
             FOR UPDATE OF token, account`,
            [parsed.data.email.toLowerCase()],
        );
        if (tokenResult.rowCount === 0 || !tokenResult.rows[0].code_is_valid) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                error: "The sign-in code is invalid or expired. Sign in again to request a new code.",
            });
        }

        const token = tokenResult.rows[0];
        if (token.attempts >= 5) {
            await client.query("COMMIT");
            return res.status(429).json({
                error: "Too many incorrect codes. Sign in again after one minute to request a new code.",
            });
        }

        const suppliedHash = Buffer.from(codeHash, "hex");
        const storedHash = Buffer.from(token.code_hash.trim(), "hex");
        if (!timingSafeEqual(suppliedHash, storedHash)) {
            await client.query(
                `UPDATE student_login_verification_tokens
                 SET attempts = attempts + 1
                 WHERE user_id = $1`,
                [token.id],
            );
            await client.query("COMMIT");
            return res.status(token.attempts + 1 >= 5 ? 429 : 400).json({
                error: token.attempts + 1 >= 5
                    ? "Too many incorrect codes. Sign in again after one minute to request a new code."
                    : "The sign-in code is incorrect.",
            });
        }

        const userResult = await client.query(
            activeLoginUserQuery("account.id = $1"),
            [token.id],
        );
        if (userResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({ error: "Invalid credentials" });
        }
        await client.query(
            "DELETE FROM student_login_verification_tokens WHERE user_id = $1",
            [token.id],
        );
        await client.query("COMMIT");

        const user = userResult.rows[0];
        setAuthCookie(res, createAccessToken(user));
        return res.json({ user: formatAuthenticatedUser(user) });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Failed to roll back student login verification:", rollbackError);
        }
        return next(error);
    } finally {
        client.release();
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
