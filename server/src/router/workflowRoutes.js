import express from "express";
import workflowController from "../controllers/workflowController.js";

const router = express.Router();

const workflowRoutes = (app) => {
  router.get("/", workflowController.getAllworkflows);
  router.get("/:id", workflowController.getWorkflowById);
  router.post("/", workflowController.createWorkflow);
  router.put("/:id", workflowController.updateWorkflow);
  router.delete("/:id", workflowController.deleteWorkflow);

  return app.use("/api/workflows", router);
};

export default workflowRoutes;
