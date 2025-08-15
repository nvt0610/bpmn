import express from "express";
import testBatchController from "../controllers/testBatchController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const testBatchRoutes = (app) => {
  router.get("/", testBatchController.getAllTestBatches);
  router.get("/:id", testBatchController.getTestBatchById);
  router.post("/", testBatchController.createTestBatch);
  router.put("/:id", testBatchController.updateTestBatch);
  router.delete("/:id", testBatchController.deleteTestBatch);
  
  return app.use(`${API_PREFIX}/testbatch`, router);

};

export default testBatchRoutes;
