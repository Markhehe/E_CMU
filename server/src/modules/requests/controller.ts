import type { Request, Response, NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
    documentTypes,
    requests,
    requestStatusHistory,
} from "../../db/schema.js";
import { createRequestSchema } from "./validation.js";

export async function createDocumentRequest(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
    
    const parsed = createRequestSchema.safeParse(req.body);
    
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request data",
            details: parsed.error.flatten(),
        });
    }
    
    const { documentTypeId, purpose, additionalDetails } = parsed.data;
    const requesterId = req.user.id;
    
    const createdRequest = await db.transaction(async (tx) => {
    // Read the document type inside the transaction. Only active types may
    // be requested by users.
        const documentTypeResult = await tx
            .select({
                id: documentTypes.id,
                name: documentTypes.name,
                baseFee: documentTypes.baseFee,
                currency: documentTypes.currency,
            })
            .from(documentTypes)
            .where(
                and(
                eq(documentTypes.id, documentTypeId),
                eq(documentTypes.active, true)
                )
            )
            .limit(1);
        
        if (documentTypeResult.length === 0) {
            const error = new Error("Document type is unavailable");
            error.name = "DOCUMENT_TYPE_NOT_FOUND";
            throw error;
        }
       
        const documentType = documentTypeResult[0];
        // At submission time, preserve the current catalog price as a snapshot.
        // Staff may later change the final fee according to institutional rules.
        const insertedRequests = await tx
            .insert(requests)
            .values({
                requesterId,
                documentTypeId: documentType.id,
                status: "submitted",
                purpose: purpose || null,
                additionalDetails,
                feeAmount: documentType.baseFee,
                feeCurrency: documentType.currency,
            })
        .returning({
            id: requests.id,
            requesterId: requests.requesterId,
            documentTypeId: requests.documentTypeId,
            status: requests.status,
            purpose: requests.purpose,
            additionalDetails: requests.additionalDetails,
            feeAmount: requests.feeAmount,
            feeCurrency: requests.feeCurrency,
            submittedAt: requests.submittedAt,
            updatedAt: requests.updatedAt,
        });
        
        const newRequest = insertedRequests[0];
        
        await tx.insert(requestStatusHistory).values({
            requestId: newRequest.id,
            fromStatus: null,
            toStatus: "submitted",
            changedBy: requesterId,
            comment: "Request submitted",
        });
        
        return {
            ...newRequest,
            documentTypeName: documentType.name,
        };
    });

    return res.status(201).json({ request: createdRequest });
} catch (error) {
    if (error instanceof Error && error.name === "DOCUMENT_TYPE_NOT_FOUND") {
        return res.status(400).json({
            error: "The selected document type is unavailable",
        });
    }
    
    next(error);
    }
}

export async function listMyDocumentRequests(
    req: Request,
    res: Response,
    next: NextFunction
) {
    
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const result = await db
            .select({
                id: requests.id,
                status: requests.status,
                purpose: requests.purpose,
                feeAmount: requests.feeAmount,
                feeCurrency: requests.feeCurrency,
                submittedAt: requests.submittedAt,
                updatedAt: requests.updatedAt,
                documentTypeName: documentTypes.name,
            })
            .from(requests)
            .innerJoin(documentTypes, eq(requests.documentTypeId, documentTypes.id))
            .where(eq(requests.requesterId, req.user.id))
            .orderBy(desc(requests.submittedAt));
        
        return res.json({ requests: result });
    } catch (error) {
        next(error);
    }
}