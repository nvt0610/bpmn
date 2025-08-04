import userService from "../services/userService.js";

const userController = {
  getAllUsers: async (req, res) => {
    const result = await userService.getAllUsers();
    res.status(result.status).json(result);
  },

  getUserById: async (req, res) => {
    const result = await userService.getUserById(req.params); // { id }
    res.status(result.status).json(result);
  },

  createUser: async (req, res) => {
    const result = await userService.createUser(req.body); // { username, email, password, roleId }
    res.status(result.status).json(result);
  },

  updateUser: async (req, res) => {
    const result = await userService.updateUser({
      ...req.params, // id
      ...req.body,   // username, email, password, roleId
    });
    res.status(result.status).json(result);
  },

  deleteUser: async (req, res) => {
    const result = await userService.deleteUser(req.params); // { id }
    res.status(result.status).json(result);
  },
};

export default userController;
