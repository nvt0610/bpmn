import express from "express";
import workflowNodeController from "../controllers/workflowNodeController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const workflowNodeRoutes = (app) => {
  router.get("/all", workflowNodeController.getAllWorkflowNodes);
  router.get("/:workflowId", workflowNodeController.getNodesByWorkflowId);
  router.post("/", workflowNodeController.createNode);
  router.delete("/", workflowNodeController.deleteNode);
  router.put("/", workflowNodeController.updateNode);

  return app.use(`${API_PREFIX}/workflowNode`, router);

};

export default workflowNodeRoutes;
