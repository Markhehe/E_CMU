import nodemailer from "nodemailer";
import process from "node:process";

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    })[character]);
}

export async function sendConfirmationEmail({ email, fullName, code }) {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
        throw new Error("SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured to send email");
    }
    if (Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)) {
        throw new Error("SMTP_USER and SMTP_PASSWORD must both be configured, or both be omitted");
    }

    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === "true",
        ...(SMTP_USER && SMTP_PASSWORD
            ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } }
            : {}),
    });

    const safeName = escapeHtml(fullName);

    await transport.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: "Your E-CMU Portal verification code",
        text: `Hello ${fullName},\n\nYour E-CMU Portal verification code is ${code}.\nEnter this code in the registration screen within 120 seconds to confirm your email address.\n\nIf you did not create this account, you can ignore this email.`,
        html: `<p>Hello ${safeName},</p><p>Your E-CMU Portal verification code is:</p><p style="font-size:2rem;font-weight:bold;letter-spacing:0.3rem">${code}</p><p>Enter this code in the registration screen within 120 seconds to confirm your email address.</p><p>If you did not create this account, you can ignore this email.</p>`,
    });
}
