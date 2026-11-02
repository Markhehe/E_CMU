import { z } from "zod";
import { Buffer } from "node:buffer";

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_UPLOAD_DATA_URL_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 64;
const imageDataUrlPattern = /^data:(image\/png|image\/jpeg|image\/webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;

export const imageDataUrlSchema = z
    .string()
    .max(MAX_UPLOAD_DATA_URL_LENGTH, "Image uploads must be 3 MB or smaller")
    .superRefine((value, context) => {
        const match = imageDataUrlPattern.exec(value);
        if (!match) {
            context.addIssue({
                code: "custom",
                message: "Upload a PNG, JPEG, or WebP image",
            });
            return;
        }

        const [, mimeType, encodedImage] = match;
        const image = Buffer.from(encodedImage, "base64");
        if (image.length === 0) {
            context.addIssue({ code: "custom", message: "The uploaded image is empty" });
            return;
        }
        if (image.length > MAX_UPLOAD_BYTES) {
            context.addIssue({
                code: "custom",
                message: "Image uploads must be 3 MB or smaller",
            });
            return;
        }

        const hasValidSignature =
            (mimeType === "image/png" && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
            (mimeType === "image/jpeg" && image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff) ||
            (mimeType === "image/webp" && image.length >= 12 && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP");

        if (!hasValidSignature) {
            context.addIssue({
                code: "custom",
                message: "The image content does not match its MIME type",
            });
        }
    });

export const paymentProofImagesSchema = z.object({
    receiptDataUrl: z.string().trim().min(1),
    requestCopyDataUrl: z.string().trim().min(1),
});

export const createRequestSchema = z.object({
    documentTypeId: z.coerce.number().int().positive(),
    purpose: z.string().trim().max(1000).optional(),
    additionalDetails: z
        .record(
            z.string(),
            z.string().trim().max(500)
        )
        .optional()
        .default({}),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;