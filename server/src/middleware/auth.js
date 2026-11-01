import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload?.sub !== "string" ||
      !/^[1-9]\d*$/.test(payload.sub)
    ) {
      return res.status(401).json({
        error: "Invalid session payload",
      });
    }

    const userId = Number(payload?.sub);

    if (!Number.isSafeInteger(userId)) {
      return res.status(401).json({
        error: "Invalid session user",
      });
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.stakeholder_type,
<<<<<<< HEAD
=======
        u.student_id,
        u.contact_phone,
        u.contact_address,
        directory.birthdate,
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
        COALESCE(
          array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),
          '{}'
        ) AS roles
      FROM users u
<<<<<<< HEAD
=======
      LEFT JOIN student_directory directory ON directory.student_id = u.student_id
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
        AND u.active = TRUE
<<<<<<< HEAD
      GROUP BY u.id, u.email, u.full_name, u.stakeholder_type
=======
      GROUP BY u.id, u.email, u.full_name, u.stakeholder_type,
               u.student_id, u.contact_phone, u.contact_address, directory.birthdate
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "User not found",
      });
    }

    req.user = result.rows[0];

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const hasRole = req.user?.roles?.some((role) => allowedRoles.includes(role));
        if (!hasRole) return res.status(403).json({ error: "Insufficient permissions" });
        next();
    };
}
