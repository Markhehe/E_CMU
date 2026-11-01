import { Router } from "express";
<<<<<<< HEAD
import { requireAuth } from "../../middleware/auth.js";
import {
  createDocumentRequest,
  listMyDocumentRequests,
=======
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  listDocumentTypes,
  listDocumentRequests,
  deletePendingStudentRequest,
} from "./controller.js";
import {
  createDocumentRequest,
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
} from "./controller.js";

const router = Router();

<<<<<<< HEAD
router.post("/", requireAuth, createDocumentRequest);
router.get("/", requireAuth, listMyDocumentRequests);
=======
router.get("/document-types", requireAuth, listDocumentTypes);
router.post("/", requireAuth, createDocumentRequest);
router.delete(
  "/:id",
  requireAuth,
  requireRole("student"),
  deletePendingStudentRequest,
);
router.get("/", requireAuth, listDocumentRequests);
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26

export default router;