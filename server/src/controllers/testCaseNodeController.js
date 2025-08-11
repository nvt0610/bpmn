import testCaseNodeService from "../services/testCaseNodeService.js";

const testcaseNodeController = {
  receiveResultTestCaseNode: async (req, res) => {
    const result = await testCaseNodeService.exportInputToN8n(req.body);
    res.status(result.status).json(result);
  },
};

export default testcaseNodeController;