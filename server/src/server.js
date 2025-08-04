import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";

import initWebRouter from "./router/routers.js";
import { PrismaClient } from "@prisma/client";

dotenv.config(); // Load .env đầu tiên

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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
