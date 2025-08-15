// routes/projectRoutes.js
import projectController from "../controllers/projectController.js";
import { Router } from "express";
const router = Router();
import { API_PREFIX } from "../config/appConfig.js";

const projectRoutes = (app) => {
    router.get("/", projectController.getAll);
    router.get("/:id", projectController.getById);
    router.post("/", projectController.create);
    router.put("/:id", projectController.update);
    router.delete("/:id", projectController.delete);

    return app.use(`${API_PREFIX}/project`, router);
};

export default projectRoutes