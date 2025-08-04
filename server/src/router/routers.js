import roleRoutes from "./roleRoutes.js"; 
import userRoutes from "./userRoutes.js";
import workflowRoutes from "./workflowRoutes.js";
import configurationDataRoutes from "./configurationDataRoutes.js";
import n8nRoutes from "./n8nRoutes.js";
import workflowNodeRoutes from "./workflowNodeRoutes.js";
import resultRoutes from "./resultRoutes.js";
import scenarioRoutes from "./scenarioRoutes.js";
import testCaseRoutes from "./testCaseRoutes.js";

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
};

export default initWebRouter;

