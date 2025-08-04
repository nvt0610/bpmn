import workflowNodeService from "../services/workflowNodeService.js";

const workflowNodeController = {
    getNodesByWorkflowId: async (req, res) => {
        const { workflowId } = req.params;
        const result = await workflowNodeService.getNodesByWorkflowId(workflowId);
        res.status(result.status).json(result);
    },

    createNode: async (req, res) => {
        const result = await workflowNodeService.createNode(req.body);
        res.status(result.status).json(result);
    },

    updateNode: async (req, res) => {
        const result = await workflowNodeService.updateNode(req.body);
        res.status(result.status).json(result);
    },

    deleteNode: async (req, res) => {
        const result = await workflowNodeService.deleteNode(req.body);
        res.status(result.status).json(result);
    },
    
    getAllWorkflowNodes: async (req, res) => {
        const { workflowId, page, pageSize } = req.query;
        const result = await workflowNodeService.getAllWorkflowNodes({ workflowId, page, pageSize });
        res.status(result.status).json(result);
    },

};

export default workflowNodeController;
