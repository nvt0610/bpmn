import express from "express";
import scenarioController from "../controllers/scenarioController.js";

const router = express.Router();

const scenarioRoutes = (app) => {
  router.get("/", scenarioController.getAllScenarios);
  router.get("/:id", scenarioController.getScenarioById);
  router.post("/", scenarioController.createScenario);
  router.put("/:id", scenarioController.updateScenario);
  router.delete("/:id", scenarioController.deleteScenario);

  return app.use("/api/v2/scenarios", router);
};

export default scenarioRoutes;
