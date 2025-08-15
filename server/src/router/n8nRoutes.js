import express from "express";
import N8nController from "../controllers/n8nController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const n8nRoutes = (app) => {
  router.get("/testcase/:id", N8nController.getTestCaseById);
  router.post("/testcase/:id/export-workflow", N8nController.export);
  router.post("/token", N8nController.getToken);

  return app.use(`${API_PREFIX}/n8n`, router);
};

export default n8nRoutes;
