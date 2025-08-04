import configurationDataService from "../services/configurationDataService.js";

const configurationDataController = {
    getAllConfigurationData: async (req, res) => {
        const { page, pageSize } = req.query;
        const result = await configurationDataService.getAllConfigurationData({ page, pageSize });
        res.status(result.status).json(result);
    },

    getConfigurationData: async (req, res) => {
        const result = await configurationDataService.getConfigurationData(req.query);
        res.status(result.status).json(result);
    },

    createConfigurationData: async (req, res) => {
        const result = await configurationDataService.createConfigurationData(req.body); // { testCaseId, nodeId, userId, roleId, data }
        res.status(result.status).json(result);
    },

    updateConfigurationData: async (req, res) => {
        const result = await configurationDataService.updateConfigurationData({
            ...req.params, // id
            ...req.body,   // testCaseId, nodeId, userId, roleId, data
        });
        res.status(result.status).json(result);
    },

    deleteConfigurationData: async (req, res) => {
        const result = await configurationDataService.deleteConfigurationData(req.params); // { testCaseId, nodeId, userId }
        res.status(result.status).json(result);
    },
    // Trong extraDataController.js bạn thêm hàm:
    getN8nNode: async (req, res) => {
        const result = await configurationDataService.getN8nNode(req.params); // truyền { id }
        res.status(result.status).json(result);
    },

};

export default configurationDataController;
