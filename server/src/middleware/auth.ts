import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
<<<<<<< HEAD
import { users } from "../db/schema.js";
=======
import { roles, userRoles, users } from "../db/schema.js";
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26



export type AuthenticatedUser = {
  id: number;
  email: string;
  fullName: string;
  stakeholderType: "student" | "professor" | "other";
<<<<<<< HEAD
=======
  roles: string[];
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
 ) {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwt.JwtPayload;

    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: "Invalid authentication token",
      });
    }

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        stakeholderType: users.stakeholderType,
      })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.active, true)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return res.status(401).json({
        error: "User account not found",
      });
    }

<<<<<<< HEAD
    req.user = result[0];
=======
    const assignedRoles = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    req.user = {
      ...result[0],
      roles: assignedRoles.map(({ name }) => name),
    };
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: "Authentication session expired",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: "Invalid authentication token",
      });
    }

    return next(error);
  }
<<<<<<< HEAD
=======
}

export function requireRole(...allowedRoles: string[]) {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole() needs at least one allowed role");
  }

  const normalizedRoles = allowedRoles.map((role) => role.trim().toLowerCase());

  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles.map((role) => role.toLowerCase()) ?? [];
    if (!normalizedRoles.some((role) => userRoles.includes(role))) {
      return res.status(req.user ? 403 : 401).json({
        error: req.user ? "Insufficient permissions" : "Authentication required",
      });
    }
    return next();
  };
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
}