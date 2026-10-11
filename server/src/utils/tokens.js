import jwt from "jsonwebtoken";

export function createAccessToken(user ) {
    return jwt.sign(
        {
            sub: String(user.id),
            email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
     );
}

export function setAuthCookie(res, token) {
    res.cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 60 * 1000,
     } );
}
