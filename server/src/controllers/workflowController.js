import workflowService from "../services/workflowService.js";

const workflowController = {
  getAllworkflows: async (req, res) => {
    res.json(await workflowService.getAllworkflows(req.query));
  },

  getWorkflowDetail: async (req, res) => {
    res.json(await workflowService.getWorkflowDetail(req.params));
  },

  createWorkflow: async (req, res) => {
    res.json(await workflowService.createWorkflow(req.body)); // full payload
  },

  updateWorkflow: async (req, res) => {
    res.json(await workflowService.updateWorkflow({
      ...req.params, // id
      ...req.body,   // các field khác
    }));
  },

  deleteWorkflow: async (req, res) => {
    res.json(await workflowService.deleteWorkflow(req.params)); // { id }
  },

  getConfigData: async (req, res) => {
    const { workflowId, page, pageSize } = req.query || {};
    res.json(await workflowService.getConfigData({ workflowId, page, pageSize }));
  },

  getTestCases: async (req, res) => {
    res.json(await workflowService.getTestCases(req.query));
  },

  getQcConfig: async (req, res) => {
    console.log("workflowId from query:", req.query.workflowId);
    res.json(await workflowService.getQcConfig({ workflowId: req.query.workflowId }));
  },
  getTestBatch: async (req, res) => {
    const { workflowId, page, pageSize } = req.query || {};
    res.json(await workflowService.getTestBatch({ workflowId, page, pageSize }));
  },

  getResult: async (req, res) => {
    const { workflowId, page, pageSize } = req.query || {};
    res.json(await workflowService.getResult({ workflowId, page, pageSize }));
  },

};

export default workflowController;
