import workflowService from "../services/workflowService.js";

const workflowController = {
  getAllworkflows: async (req, res) => {
    const { page, pageSize } = req.query;
    const result = await workflowService.getAllworkflows({ page, pageSize });
    res.status(result.status).json(result);
  },

  getWorkflowById: async (req, res) => {
    const result = await workflowService.getWorkflowById(req.params); // { id }
    res.status(result.status).json(result);
  },

  createWorkflow: async (req, res) => {
    const result = await workflowService.createWorkflow(req.body); // full payload
    res.status(result.status).json(result);
  },

  updateWorkflow: async (req, res) => {
    const result = await workflowService.updateWorkflow({
      ...req.params, // id
      ...req.body,   // các field khác
    });
    res.status(result.status).json(result);
  },

  deleteWorkflow: async (req, res) => {
    const result = await workflowService.deleteWorkflow(req.params); // { id }
    res.status(result.status).json(result);
  },
};

export default workflowController;
