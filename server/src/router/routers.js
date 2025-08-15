import roleRoutes from "./roleRoutes.js";
import userRoutes from "./userRoutes.js";
import workflowRoutes from "./workflowRoutes.js";
import configurationDataRoutes from "./configurationDataRoutes.js";
import workflowNodeRoutes from "./workflowNodeRoutes.js";
import resultRoutes from "./resultRoutes.js";
import scenarioRoutes from "./scenarioRoutes.js";
import testCaseRoutes from "./testCaseRoutes.js";
import testBatchRoutes from "./testBatchRoutes.js";
import runTestn8nController from "../controllers/runTestn8nController.js";
import resultReceiveController from "../controllers/resultReceiveController.js";
import projectRoutes from "./projectRoutes.js";
import userController from "../controllers/userController.js";
import { API_PREFIX } from "../config/appConfig.js";

let initWebRouter = (app) => {
  roleRoutes(app);
  userRoutes(app);
  workflowRoutes(app);
  configurationDataRoutes(app);
  workflowNodeRoutes(app);
  resultRoutes(app);
  scenarioRoutes(app);
  testCaseRoutes(app);
  testBatchRoutes(app);
  projectRoutes(app);

  app.post(`${API_PREFIX}/batchresultreceive`, resultReceiveController.receiveBatchResult);
  app.post(`${API_PREFIX}/runworkflow`, runTestn8nController.runWorkflow);
  app.post(`${API_PREFIX}/login`, userController.login);
  app.post(`${API_PREFIX}/register`, userController.register);
};

export default initWebRouter;

