import n8nService from "../services/n8nService.js";

const n8nController = {
  getTestCaseById: async (req, res) => {
    const result = await n8nService.getTestCaseById(req.params.id); // testCaseId
    res.status(result.status).json(result);
  },

  export: async (req, res) => {
    const result = await n8nService.exportWorkflow(req.params.id); // testCaseId
    res.status(result.status).json(result);
  },

  getWorkflow: async (req, res) => {
    const result = await n8nService.getWorkflow(req.params.workflowId); // workflowId
    res.status(result.status).json(result);
  },
};

export default n8nController;
