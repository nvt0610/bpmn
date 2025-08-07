import runTestn8nService from "../services/runTestn8nService.js";

const runTestn8nController = {
runWorkflow: async (req, res) => {
    const result = await runTestn8nService.runWorkflowById(req.body);
    res.status(result.status).json(result);
  }
};

export default runTestn8nController;