import express from "express";
import resultController from "../controllers/resultController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const resultRoutes = (app) => {
  router.get("/", resultController.getAllResults);
  router.get("/:id", resultController.getResultById);
  router.post("/", resultController.createResult);
  router.put("/:id", resultController.updateResult);
  router.delete("/:id", resultController.deleteResult);

  return app.use(`${API_PREFIX}/results`, router);

};

export default resultRoutes;
