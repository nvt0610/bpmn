import express from "express";
import testCaseController from "../controllers/testCaseController.js";

const router = express.Router();

const testCaseRoutes = (app) => {
  router.get("/", testCaseController.getAllTestCases);
  router.post("/receive", testCaseController.receiveResultTestCase);
  router.get("/:id", testCaseController.getTestCaseById);
  router.post("/", testCaseController.createTestCase);
  router.put("/:id", testCaseController.updateTestCase);
  router.delete("/:id", testCaseController.deleteTestCase);

  return app.use("/api/testcases", router);
};

export default testCaseRoutes;
