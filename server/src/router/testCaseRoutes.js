import express from "express";
import testCaseController from "../controllers/testCaseController.js";

const router = express.Router();

const testCaseRoutes = (app) => {
  router.get("/", testCaseController.getAllTestCases);
  router.post("/resultreceive", testCaseController.receiveResultTestCase);
  router.get("/:id", testCaseController.getTestCaseById);
  router.post("/", testCaseController.createTestCase);
  router.put("/:id", testCaseController.updateTestCase);
  router.delete("/:id", testCaseController.deleteTestCase);

  return app.use("/api/v1/testcases", router);
};

export default testCaseRoutes;
