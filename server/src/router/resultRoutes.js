import express from "express";
import resultController from "../controllers/resultController.js";

const router = express.Router();

const resultRoutes = (app) => {
  router.get("/", resultController.getAllResults);
  router.get("/:id", resultController.getResultById);
  router.post("/", resultController.createResult);
  router.put("/:id", resultController.updateResult);
  router.delete("/:id", resultController.deleteResult);

  return app.use("/api/v1/results", router);
};

export default resultRoutes;
