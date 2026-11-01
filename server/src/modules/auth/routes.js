import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { createAccessToken, setAuthCookie } from "../../utils/tokens.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();
const credentials = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    stakeholderType: z.enum(["student", "professor", "other"]),
});

router.post("/register", async (req, res, next) => {
    try {
        const data = credentials.parse(req.body);
        const passwordHash = await bcrypt.hash(data.password, 12);
        
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, stakeholder_type)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, full_name, stakeholder_type`,
            [data.email.toLowerCase(), passwordHash, data.fullName, data.stakeholderType]
        );
        
        const user = result.rows[0];
        const role = await pool.query("SELECT id FROM roles WHERE name = 'requester'");
        await pool.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
            [user.id, role.rows[0].id]
        );
        
        setAuthCookie(res, createAccessToken(user));
        res.status(201).json({ user });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Email is already registered" });
        }
        next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const data = z.object({
            email: z.string().email(),
            password: z.string(),
        }).parse(req.body);
        
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND active = TRUE",
            [data.email.toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
    
        const user = result.rows[0];
        const valid = await bcrypt.compare(data.password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    
        setAuthCookie(res, createAccessToken(user));
        res.json({ user: { id: user.id, email: user.email, fullName: user.full_name } });
    } catch (error) {
        next(error);
    }
});

router.post("/logout", (_req, res) => {
 res.clearCookie("access_token");
 res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
     res.json({ user: req.user });
});

export default router;
