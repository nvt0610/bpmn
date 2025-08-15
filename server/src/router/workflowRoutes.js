import express from "express";
import workflowController from "../controllers/workflowController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const workflowRoutes = (app) => {
  router.get("/configdata", workflowController.getConfigData);
  router.get("/testcase", workflowController.getTestCases);
  router.get("/qcconfig", workflowController.getQcConfig);
  router.get("/testbatches", workflowController.getTestBatch);
  router.get("/results", workflowController.getResult)
  router.get("/", workflowController.getAllworkflows);
  router.get("/:id", workflowController.getWorkflowDetail);
  router.post("/", workflowController.createWorkflow);
  router.put("/:id", workflowController.updateWorkflow);
  router.delete("/:id", workflowController.deleteWorkflow);

  return app.use(`${API_PREFIX}/workflows`, router);

};

export default workflowRoutes;
