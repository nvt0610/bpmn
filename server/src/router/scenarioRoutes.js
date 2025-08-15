import express from "express";
import scenarioController from "../controllers/scenarioController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const scenarioRoutes = (app) => {
  router.get("/", scenarioController.getAllScenarios);
  router.get("/:id", scenarioController.getScenarioById);
  router.post("/", scenarioController.createScenario);
  router.put("/:id", scenarioController.updateScenario);
  router.delete("/:id", scenarioController.deleteScenario);
  
  return app.use(`${API_PREFIX}/scenarios`, router);

};

export default scenarioRoutes;
