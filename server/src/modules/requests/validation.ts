import { z } from "zod";

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