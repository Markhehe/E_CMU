import "dotenv/config";
import process from "node:process";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
import requestRoutes from "./modules/requests/routes.js";
import workflowRoutes from "./modules/requests/workflow-routes.ts";
import { requireAuth } from "./middleware/auth.js";
import { startDataChangeFeed, streamDataChanges } from "./services/data-change-feed.ts";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  } )
);

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/requests", workflowRoutes);

app.get("/api/events", requireAuth, streamDataChanges);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 5000);

void startDataChangeFeed();

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}` );
});
