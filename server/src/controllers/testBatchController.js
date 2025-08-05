import testBatchService from "../services/testBatchService.js";

const testBatchController = {
  getAllTestBatches: async (req, res) => {
    const result = await testBatchService.getAllTestBatches();
    res.status(result.status).json(result);
  },

  getTestBatchById: async (req, res) => {
    const result = await testBatchService.getTestBatchById(req.params);
    res.status(result.status).json(result);
  },

  createTestBatch: async (req, res) => {
    const result = await testBatchService.createTestBatch(req.body);
    res.status(result.status).json(result);
  },

  updateTestBatch: async (req, res) => {
    const result = await testBatchService.updateTestBatch({
      ...req.params,
      ...req.body,
    });
    res.status(result.status).json(result);
  },

  deleteTestBatch: async (req, res) => {
    const result = await testBatchService.deleteTestBatch(req.params);
    res.status(result.status).json(result);
  },
};

export default testBatchController;
