import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  listDocumentTypes,
  listDocumentRequests,
  deletePendingStudentRequest,
  createDocumentRequest,
} from "./controller.js";

const router = Router();

router.get("/document-types", requireAuth, listDocumentTypes);
router.post("/", requireAuth, createDocumentRequest);
router.delete(
  "/:id",
  requireAuth,
  requireRole("student"),
  deletePendingStudentRequest,
);
router.get("/", requireAuth, listDocumentRequests);

export default router;