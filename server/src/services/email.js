import nodemailer from "nodemailer";
import process from "node:process";

function createTransport() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !process.env.SMTP_FROM) {
        throw new Error("SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured to send email");
    }
    if (Boolean(SMTP_USER) !== Boolean(SMTP_PASSWORD)) {
        throw new Error("SMTP_USER and SMTP_PASSWORD must both be configured, or both be omitted");
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === "true",
        ...(SMTP_USER && SMTP_PASSWORD
            ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } }
            : {}),
    });
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    })[character]);
}

export function scheduleEmailNotification(name, send) {
    setImmediate(() => {
        void Promise.resolve()
            .then(send)
            .catch((error) => {
                console.error(`Failed to send ${name} email notification:`, error);
            });
    });
}

export async function sendConfirmationEmail({ email, fullName, code }) {
    const transport = createTransport();
    const safeName = escapeHtml(fullName);

    await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Your E-CMU Portal verification code",
        text: `Hello ${fullName},\n\nYour E-CMU Portal verification code is ${code}.\nEnter this code in the registration screen within 120 seconds to confirm your email address.\n\nIf you did not create this account, you can ignore this email.`,
        html: `<p>Hello ${safeName},</p><p>Your E-CMU Portal verification code is:</p><p style="font-size:2rem;font-weight:bold;letter-spacing:0.3rem">${code}</p><p>Enter this code in the registration screen within 120 seconds to confirm your email address.</p><p>If you did not create this account, you can ignore this email.</p>`,
    });
}

export async function sendReadyForPickupEmail({
    email,
    fullName,
    documentName,
    requestCode,
}) {
    const transport = createTransport();
    const safeName = escapeHtml(fullName);
    const safeDocumentName = escapeHtml(documentName);
    const safeRequestCode = escapeHtml(requestCode);

    await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Your E-CMU document is ready for pickup",
        text: `Hello ${fullName},\n\nYour ${documentName} request (${requestCode}) is ready for pickup at the Registrar's Office.\n\nPlease bring your university ID when collecting your document.`,
        html: `<p>Hello ${safeName},</p><p>Your <strong>${safeDocumentName}</strong> request (<strong>${safeRequestCode}</strong>) is ready for pickup at the Registrar's Office.</p><p>Please bring your university ID when collecting your document.</p>`,
    });
}

export async function sendRequestCommentEmail({
    email,
    fullName,
    documentName,
    requestCode,
}) {
    const transport = createTransport();
    const safeName = escapeHtml(fullName);
    const safeDocumentName = escapeHtml(documentName);
    const safeRequestCode = escapeHtml(requestCode);

    await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "New comment on your E-CMU document request",
        text: `Hello ${fullName},\n\nA new comment was added to your ${documentName} request (${requestCode}). Sign in to the E-CMU Portal to read it.\n\nThis email does not include the comment text.`,
        html: `<p>Hello ${safeName},</p><p>A new comment was added to your <strong>${safeDocumentName}</strong> request (<strong>${safeRequestCode}</strong>).</p><p>Sign in to the E-CMU Portal to read it. This email does not include the comment text.</p>`,
    });
}
