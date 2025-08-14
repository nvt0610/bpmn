// controllers/workflowController.js
import workflowService from "../services/workflowService.js";

const workflowController = {
  getAllworkflows: async (req, res) => {
    const { status, ...body } = await workflowService.getAllworkflows(req.query);
    res.status(status).json(body);
  },

  getWorkflowDetail: async (req, res) => {
    const { status, ...body } = await workflowService.getWorkflowDetail(req.params);
    res.status(status).json(body);
  },

  createWorkflow: async (req, res) => {
    const { status, ...body } = await workflowService.createWorkflow(req.body);
    res.status(status).json(body);
  },

  updateWorkflow: async (req, res) => {
    const { status, ...body } = await workflowService.updateWorkflow({
      ...req.params, // id
      ...req.body,   // các field khác
    });
    res.status(status).json(body);
  },

  deleteWorkflow: async (req, res) => {
    const { status, ...body } = await workflowService.deleteWorkflow(req.params);
    res.status(status).json(body);
  },

  getConfigData: async (req, res) => {
    const { workflowId, nodeId, userId } = req.query || {};
    const { status, ...body } = await workflowService.getConfigData({ workflowId, nodeId, userId });
    res.status(status).json(body);
  },

  getTestCases: async (req, res) => {
    const { status, ...body } = await workflowService.getTestCases(req.query);
    res.status(status).json(body);
  },

  getQcConfig: async (req, res) => {
    const { status, ...body } = await workflowService.getQcConfig({ workflowId: req.query.workflowId });
    res.status(status).json(body);
  },

  getTestBatch: async (req, res) => {
    const { workflowId, page, pageSize } = req.query || {};
    const { status, ...body } = await workflowService.getTestBatch({ workflowId, page, pageSize });
    res.status(status).json(body);
  },

  getResult: async (req, res) => {
    const { workflowId, page, pageSize } = req.query || {};
    const { status, ...body } = await workflowService.getResult({ workflowId, page, pageSize });
    res.status(status).json(body);
  },

  runWorkflowById: async (req, res) => {
    const { status, ...body } = await workflowService.runWorkflowById({
      workflowId: req.params?.id || req.body?.workflowId || req.query?.workflowId,
      testBatchId: req.body?.testBatchId || req.query?.testBatchId,
    });
    res.status(status).json(body);
  },
};

export default workflowController;
