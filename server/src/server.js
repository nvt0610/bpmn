import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

import initWebRouter from "./router/routers.js";
import { PrismaClient } from "@prisma/client";

import { keycloak, memoryStore } from "./keycloak-init.js";
import session from 'express-session';

dotenv.config(); // Load .env đầu tiên

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET || "dev",
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));
app.use(keycloak.middleware());

// JSON hóa lỗi 403 từ keycloak (tuỳ chọn)
keycloak.accessDenied = (req, res) =>
  res.status(403).json({ success: false, message: "Forbidden" });

// Gắn req.user sau khi keycloak đã mount
import { attachUser } from "./middlewares/auth.js";
app.use(attachUser);

// Init routes
initWebRouter(app);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Hello world" });
});

// Khởi động server
const port = process.env.PORT || 8080;
httpServer.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
