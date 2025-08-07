import roleRoutes from "./roleRoutes.js";
import userRoutes from "./userRoutes.js";
import workflowRoutes from "./workflowRoutes.js";
import configurationDataRoutes from "./configurationDataRoutes.js";
import n8nRoutes from "./n8nRoutes.js";
import workflowNodeRoutes from "./workflowNodeRoutes.js";
import resultRoutes from "./resultRoutes.js";
import scenarioRoutes from "./scenarioRoutes.js";
import testCaseRoutes from "./testCaseRoutes.js";
import testBatchRoutes from "./testBatchRoutes.js";
import testBatchController from "../controllers/testBatchController.js";
import testCaseController from "../controllers/testCaseController.js";
import runTestn8nController from "../controllers/runTestn8nController.js";

let initWebRouter = (app) => {
  roleRoutes(app);
  userRoutes(app);
  workflowRoutes(app);
  configurationDataRoutes(app);
  n8nRoutes(app);
  workflowNodeRoutes(app);
  resultRoutes(app);
  scenarioRoutes(app);
  testCaseRoutes(app);
  testBatchRoutes(app);

  app.post("/api/v1/testcaseresultreceive", testCaseController.receiveResultTestCase);
  app.post("/api/v1/createwithnodes", testCaseController.createTestCaseWithNodes);
  app.post("/api/v1/batchresultreceive", testBatchController.receiveBatchResult);
  app.post("/api/v1/runworkflow", runTestn8nController.runWorkflow);

};

export default initWebRouter;

