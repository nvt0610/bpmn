import testCaseNodeService from "../services/testCaseNodeService.js";
import { toBool, pickDefined } from "../helpers/helper.js";

const testcaseNodeController = {
  exportInputToN8n: async (req, res) => {
    const result = await testCaseNodeService.exportInputToN8n(req.body);
    res.status(result.status).json(result);
  },

  // GET /api/v1/testcasenoderesults
  async getAllResults(req, res) {
    const { page, pageSize } = req.query;
    const result = await testCaseNodeService.getAllResults({ page, pageSize });
    return res.status(result.status).json(result);
  },

  // GET /api/v1/testcasenoderesults/ids
  async getResultByIds(req, res) {
    const q = req.query || {};
    const filters = pickDefined(q, [
      'testCaseNodeId',
      'testBatchId',
      'scenarioId',
      'testCaseId',
      'workflowId',
      'workflowNodeId',
      'nodeId'
    ]);
    filters.onlyHasResult = toBool(q.onlyHasResult);

    const result = await testCaseNodeService.getResultByIds(filters);
    return res.status(result.status).json(result);
  },
};

export default testcaseNodeController;