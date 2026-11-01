import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
<<<<<<< HEAD
import workflowRoutes from "./modules/requests/workflow-routes.js";
=======
import requestRoutes from "./modules/requests/routes.js";
import workflowRoutes from "./modules/requests/workflow-routes.js";
import { requireAuth } from "./middleware/auth.js";
import { startDataChangeFeed, streamDataChanges } from "./services/data-change-feed.js";
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  } )
);

<<<<<<< HEAD
app.use(express.json());
=======
app.use(express.json({ limit: "8mb" }));
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
app.use(cookieParser());

app.use("/api/auth", authRoutes);

<<<<<<< HEAD
// Mount workflow routes before the error/404 handlers.
app.use("/api/requests", workflowRoutes);
console.log("Workflow routes mounted at /api/requests");
=======
app.use("/api/requests", requestRoutes);
app.use("/api/requests", workflowRoutes);
console.log("Request and workflow routes mounted at /api/requests");

app.get("/api/events", requireAuth, streamDataChanges);
>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 5000);

<<<<<<< HEAD
=======
void startDataChangeFeed();

>>>>>>> 9cda8ed7ba365859a95d9877d9267ee00b592b26
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}` );
});
