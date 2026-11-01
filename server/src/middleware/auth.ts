import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";



export type AuthenticatedUser = {
  id: number;
  email: string;
  fullName: string;
  stakeholderType: "student" | "professor" | "other";
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

    req.user = result[0];
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
}