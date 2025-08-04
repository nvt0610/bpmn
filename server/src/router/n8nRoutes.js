import express from "express";
import N8nController from "../controllers/n8nController.js";

const router = express.Router();

const n8nRoutes = (app) => {
  router.get("/testcase/:id", N8nController.getTestCaseById);
  router.post("/testcase/:id/export-workflow", N8nController.export);

  return app.use("/api/n8n", router);
};

export default n8nRoutes;
