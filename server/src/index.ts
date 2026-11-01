import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
import workflowRoutes from "./modules/requests/workflow-routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  } )
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

// Mount workflow routes before the error/404 handlers.
app.use("/api/requests", workflowRoutes);
console.log("Workflow routes mounted at /api/requests");

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 5000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}` );
});
