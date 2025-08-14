// controllers/projectController.js
import projectService from "../services/projectService.js";

const projectController = {
  getAll: async (req, res) => {
    const { status, ...body } = await projectService.getAll();
    res.status(status).json(body);
  },

  getById: async (req, res) => {
    const { id } = req.params;
    const { status, ...body } = await projectService.getById(id);
    res.status(status).json(body);
  },

  create: async (req, res) => {
    const { status, ...body } = await projectService.create(req.body);
    res.status(status).json(body);
  },

  update: async (req, res) => {
    const { id } = req.params;
    const { status, ...body } = await projectService.update(id, req.body);
    res.status(status).json(body);
  },

  delete: async (req, res) => {
    const { id } = req.params;
    const { status, ...body } = await projectService.delete(id);
    res.status(status).json(body);
  },
};

export default projectController;
