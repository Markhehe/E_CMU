import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  listDocumentTypes,
  listDocumentRequests,
  updateDocumentRequestStatus,
} from "./controller.js";
import {
  createDocumentRequest,
} from "./controller.js";

const router = Router();

router.get("/document-types", requireAuth, listDocumentTypes);
router.post("/", requireAuth, createDocumentRequest);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("registrar", "administrator"),
  updateDocumentRequestStatus,
);
router.get("/", requireAuth, listDocumentRequests);

export default router;