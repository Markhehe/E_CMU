import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  createDocumentRequest,
  listMyDocumentRequests,
} from "./controller.js";

const router = Router();

router.post("/", requireAuth, createDocumentRequest);
router.get("/", requireAuth, listMyDocumentRequests);

export default router;