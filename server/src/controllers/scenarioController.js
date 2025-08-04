import scenarioService from "../services/scenarioService.js";

const scenarioController = {
  getAllScenarios: async (req, res) => {
    const result = await scenarioService.getAllScenarios();
    res.status(result.status).json(result);
  },

  getScenarioById: async (req, res) => {
    const result = await scenarioService.getScenarioById(req.params);
    res.status(result.status).json(result);
  },

  createScenario: async (req, res) => {
    const result = await scenarioService.createScenario(req.body);
    res.status(result.status).json(result);
  },

  updateScenario: async (req, res) => {
    const result = await scenarioService.updateScenario({
      ...req.params,
      ...req.body,
    });
    res.status(result.status).json(result);
  },

  deleteScenario: async (req, res) => {
    const result = await scenarioService.deleteScenario(req.params);
    res.status(result.status).json(result);
  },
};

export default scenarioController;
