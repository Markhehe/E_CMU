import "dotenv/config";
<<<<<<< HEAD
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import workflowRoutes from "./modules/requests/workflow-routes.ts";
=======
import process from "node:process";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
import requestRoutes from "./modules/requests/routes.js";
import workflowRoutes from "./modules/requests/workflow-routes.ts";
import { requireAuth } from "./middleware/auth.js";
import { startDataChangeFeed, streamDataChanges } from "./services/data-change-feed.ts";
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
app.use(cookieParser());

app.use("/api/requests", workflowRoutes);

=======
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/requests", workflowRoutes);

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
