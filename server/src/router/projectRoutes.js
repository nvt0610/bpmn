// routes/projectRoutes.js
import projectController from "../controllers/projectController.js";
import { Router } from "express";
const router = Router();

const projectRoutes = (app) => {
    router.get("/", projectController.getAll);
    router.get("/:id", projectController.getById);
    router.post("/", projectController.create);
    router.put("/:id", projectController.update);
    router.delete("/:id", projectController.delete);

    return app.use("/api/v2/project", router);
};

export default projectRoutes