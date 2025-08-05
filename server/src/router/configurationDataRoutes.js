import express from "express";
import configurationDataController from "../controllers/configurationDataController.js";

const router = express.Router();

const configurationDataRoutes = (app) => {
    router.get("/all", configurationDataController.getAllConfigurationData);
    router.get("/", configurationDataController.getConfigurationData);
    router.post("/", configurationDataController.createConfigurationData);
    router.put("/:id", configurationDataController.updateConfigurationData);      // cần id để update
    router.delete("/:id", configurationDataController.deleteConfigurationData);

    router.get("/:id/n8n-node", configurationDataController.getN8nNode);

    return app.use("/api/v1/configurationdata", router);
};

export default configurationDataRoutes;
