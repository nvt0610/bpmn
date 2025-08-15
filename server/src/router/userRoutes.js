import express from "express";
import userController from "../controllers/userController.js";
import { API_PREFIX } from "../config/appConfig.js";

const router = express.Router();

const userRoutes = (app) => {
  router.get("/", userController.getAllUsers);
  router.get("/:id", userController.getUserById);
  router.post("/", userController.createUser);
  router.put("/:id", userController.updateUser);
  router.delete("/:id", userController.deleteUser);
  
  return app.use(`${API_PREFIX}/users`, router);

};

export default userRoutes;
