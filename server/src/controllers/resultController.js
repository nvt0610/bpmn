import resultService from "../services/resultService.js";

const resultController = {
  getAllResults: async (req, res) => {
    const result = await resultService.getAllResults();
    res.status(result.status).json(result);
  },

  getResultById: async (req, res) => {
    const result = await resultService.getResultById(req.params);
    res.status(result.status).json(result);
  },

  createResult: async (req, res) => {
    const result = await resultService.createResult(req.body);
    res.status(result.status).json(result);
  },

  updateResult: async (req, res) => {
    const result = await resultService.updateResult({
      ...req.params,
      ...req.body,
    });
    res.status(result.status).json(result);
  },

  deleteResult: async (req, res) => {
    const result = await resultService.deleteResult(req.params);
    res.status(result.status).json(result);
  },
};

export default resultController;
