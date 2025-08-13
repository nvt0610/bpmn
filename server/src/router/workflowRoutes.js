import express from "express";
import workflowController from "../controllers/workflowController.js";

const router = express.Router();

const workflowRoutes = (app) => {
  router.get("/configdata", workflowController.getConfigData);
  router.get("/testcase", workflowController.getTestCases);
  router.get("/qcconfig", workflowController.getQcConfig);
  router.get("/testbatches", workflowController.getTestBatch);
  router.get("/testcaselist", workflowController.getListTestCases);
  router.get("/results", workflowController.getResult)
  router.get("/", workflowController.getAllworkflows);
  router.get("/:id", workflowController.getWorkflowDetail);
  router.post("/", workflowController.createWorkflow);
  router.put("/:id", workflowController.updateWorkflow);
  router.delete("/:id", workflowController.deleteWorkflow);

  return app.use("/api/v2/workflows", router);
};

export default workflowRoutes;
