import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
import requestRoutes from "./modules/requests/routes.js";
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

app.use("/api/requests", requestRoutes);
app.use("/api/requests", workflowRoutes);
console.log("Request and workflow routes mounted at /api/requests");

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 5000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}` );
});
