import express from "express";
import roleController from "../controllers/roleController.js";

const router = express.Router();

const roleRoutes = (app) => {
  router.get("/", roleController.getAllRoles);
  router.get("/:id", roleController.getRoleById);
  router.post("/", roleController.createRole);
  router.put("/:id", roleController.updateRole);
  router.delete("/:id", roleController.deleteRole);

  return app.use("/api/roles", router);
};

export default roleRoutes;
