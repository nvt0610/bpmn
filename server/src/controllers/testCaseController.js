import testCaseService from "../services/testCaseService.js";

const testCaseController = {
  getAllTestCases: async (req, res) => {
    const result = await testCaseService.getAllTestCases();
    res.status(result.status).json(result);
  },

  getTestCaseById: async (req, res) => {
    const result = await testCaseService.getTestCaseById(req.params);
    res.status(result.status).json(result);
  },

  createTestCaseWithNodes: async (req, res) => {
    const result = await testCaseService.createTestCaseWithNodes(req.body);
    res.status(result.status).json(result);
  },

  createTestCase: async (req, res) => {
    const result = await testCaseService.createTestCase(req.body);
    res.status(result.status).json(result);
  },

  receiveResultTestCase: async (req, res) => {
    const result = await testCaseService.receiveResultTestCase(req.body);
    res.status(result.status).json(result);
  },

  updateTestCase: async (req, res) => {
    const result = await testCaseService.updateTestCase({
      ...req.params,
      ...req.body,
    });
    res.status(result.status).json(result);
  },

  deleteTestCase: async (req, res) => {
    const result = await testCaseService.deleteTestCase(req.params);
    res.status(result.status).json(result);
  },
};

export default testCaseController;
