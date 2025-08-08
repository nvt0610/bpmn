import testCaseNodeService from "./testCaseNodeService.js";

const testcaseNodeController = {
  receiveResultTestCaseNode: async (req, res) => {
    const result = await testCaseController.receiveResultTestCase(req.body);
    res.status(result.status).json(result);
  },
};

export default testcaseNodeController;