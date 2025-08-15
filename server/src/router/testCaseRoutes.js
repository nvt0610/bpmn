import express from "express";
import testCaseController from "../controllers/testCaseController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const testCaseRoutes = (app) => {
  router.get("/getlist", testCaseController.getListTestCases);
  router.get("/", testCaseController.getAllTestCases);
  router.get("/:id", testCaseController.getTestCaseById);
  router.post("/", testCaseController.createTestCase);
  router.put("/:id", testCaseController.updateTestCase);
  router.delete("/:id", testCaseController.deleteTestCase);

  return app.use(`${API_PREFIX}/testcases`, router);

};

export default testCaseRoutes;
