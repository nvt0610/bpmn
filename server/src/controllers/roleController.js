import roleService from "../services/roleService.js";

const roleController = {
  getAllRoles: async (req, res) => {
    const result = await roleService.getAllRoles();
    res.status(result.status).json(result);
  },

  getRoleById: async (req, res) => {
    const result = await roleService.getRoleById(req.params);
    res.status(result.status).json(result);
  },

  createRole: async (req, res) => {
    const result = await roleService.createRole(req.body);
    res.status(result.status).json(result);
  },

  updateRole: async (req, res) => {
    const result = await roleService.updateRole({
      ...req.params,
      ...req.body,
    });
    res.status(result.status).json(result);
  },

  deleteRole: async (req, res) => {
    const result = await roleService.deleteRole(req.params);
    res.status(result.status).json(result);
  },
};

export default roleController;
