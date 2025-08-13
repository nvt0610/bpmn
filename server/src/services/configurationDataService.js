import { PrismaClient } from "@prisma/client";
import { buildFormatDataFromConfigData } from "../helpers/format-mapper.js";
import { normalizeStepsV2 } from "../helpers/format-mapper.js";
import { Log } from "../helpers/logReceive.js";

const prisma = new PrismaClient();

const unwrapData = (record) => {
    if (!record?.data || typeof record.data !== "object") return record;
    const { data, ...rest } = record;
    return { ...rest, ...data };
};

const toInt = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
};

const findWorkflowNodeBy = async (workflowId, nodeId) => {
    return prisma.workflowNode.findUnique({
        where: { workflowId_nodeId: { workflowId, nodeId } },
    });
};

const pickNodeDataFromWrapper = (dataWrapper, currentNodeId) => {
    // Cho phép client gửi { nodeIds: [{ nodeid, ...config }] }
    if (dataWrapper?.nodeIds?.length) {
        const picked =
            dataWrapper.nodeIds.find((x) => x.nodeid === currentNodeId) ||
            dataWrapper.nodeIds[0];
        if (!picked) return null;
        const { nodeid: _omit, ...rest } = picked;
        return rest;
    }
    // Hoặc gửi trực tiếp object config
    return dataWrapper;
};

const mapKeyValue = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input
            .filter((x) => x && x.key !== undefined)
            .map((x) => ({ name: x.key, value: x.value }));
    }
    if (typeof input === "object") {
        return Object.entries(input).map(([name, value]) => ({ name, value }));
    }
    return [];
};

const configurationDataService = {

    getN8nNode: async ({ id }) => {
        try {
            // 1. Lấy configurationData
            const configurationData = await prisma.configurationData.findUnique({
                where: { id },
                include: {
                    workflowNode: {
                        include: { workflow: true }
                    }
                }
            });
            if (!configurationData) {
                await Log.warn("ConfigData not found", { id });
                return { status: 404, success: false, message: "Not found", data: null };
            }

            // 2. Lấy workflow.name và nodeId
            const workflowName = configurationData.workflowNode?.workflow?.name || "";
            const nodeId = configurationData.workflowNode?.nodeId || "";

            // 3. Lấy apis từ configurationData.data
            const data = configurationData.data || {};
            const apis = data.apis;
            if (!apis || !Array.isArray(apis) || apis.length === 0) {
                await Log.warn("ConfigData has no API data", { id, nodeId });
                return { status: 400, success: false, message: "No API data", nodes: [] };
            }

            // 4. Mapping node như cũ, chỉ sửa id và name
            const mapKeyValue = (input) => {
                if (!input) return [];
                if (Array.isArray(input)) {
                    return input
                        .filter(x => x && x.key !== undefined)
                        .map(x => ({ name: x.key, value: x.value }));
                }
                if (typeof input === "object") {
                    return Object.entries(input).map(([name, value]) => ({ name, value }));
                }
                return [];
            };
            // mapping mỗi api thành 1 node
            const nodes = apis.map((api, idx) => ({
                id: data.nodeId || configurationData.workflowNode?.nodeId || `${idx}`, // nếu muốn mỗi node có id riêng
                name: api.name || workflowName,
                parameters: {
                    method: api.method || "GET",
                    options: api.option || {},
                    ...(api.header && Object.keys(api.header).length ? { headerParameters: { parameters: mapKeyValue(api.header) } } : {}),
                    ...(api.queryParams && Object.keys(api.queryParams).length ? { queryParameters: { parameters: mapKeyValue(api.queryParams) } } : {}),
                    ...(api.body && Object.keys(api.body).length ? { bodyParameters: { parameters: mapKeyValue(api.body) } } : {}),
                    sendBody: !!(api.body && Object.keys(api.body || {}).length),
                    sendHeaders: !!(api.header && Object.keys(api.header || {}).length),
                    sendQuery: !!(api.queryParams && Object.keys(api.queryParams || {}).length),
                    url: api.url
                },
                type: "n8n-nodes-base.httpRequest"
            }));

            await Log.info("Built n8n nodes from configurationData", { id, nodeId, count: nodes.length });
            return { status: 200, success: true, name: workflowName, nodes };
        } catch (error) {
            await Log.error("getN8nNode failed", { id, error: error.message });
            throw new Error("Failed to build n8n node: " + error.message);
        }
    },

    getAllConfigurationData: async ({ page, pageSize } = {}) => {
        try {
            let options = {};
            if (page && pageSize) {
                options.skip = (parseInt(page) - 1) * parseInt(pageSize);
                options.take = parseInt(pageSize);
            }

            const [records, total] = await Promise.all([
                prisma.configurationData.findMany(options),
                prisma.configurationData.count(),
            ]);

            await Log.info("Fetched configurationData list", {
                total,
                paged: !!(page && pageSize),
            });

            return {
                status: 200,
                success: true,
                message: "Configuration data fetched successfully",
                data: records.map(unwrapData),
                total,
                page: page ? parseInt(page) : undefined,
                pageSize: pageSize ? parseInt(pageSize) : undefined,
            };
        } catch (error) {
            await Log.error("getAllConfigurationData failed", { error: error.message });
            throw new Error("Failed to fetch configuration data: " + error.message);
        }
    },

    getConfigurationData: async ({
        id,
        workflowId,
        nodeId,
        userId,
        roles,
        dataType,
        hasField,
    }) => {
        if (id) {
            const record = await prisma.configurationData.findUnique({ where: { id } });
            if (!record) {
                await Log.warn("ConfigData not found by id", { id });
                return { status: 404, success: false, message: "configurationData not found by ID" };
            }
            await Log.info("ConfigData fetched by id", { id });
            return { status: 200, success: true, message: "configurationData found by ID", data: unwrapData(record) };
        }
        let workflowNodeIds = [];
        if (workflowId) {
            const nodeFilter = nodeId ? { workflowId, nodeId } : { workflowId };
            const workflowNodes = await prisma.workflowNode.findMany({ where: nodeFilter, select: { id: true } });
            workflowNodeIds = workflowNodes.map((n) => n.id);
        }

        let isQC = false;
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
            if (user?.role?.name === "QC") isQC = true;
        }

        let records = [];
        if (roles) {
            records = await prisma.configurationData.findMany({
                where: {
                    user: { role: { name: { in: roles.split(",") } } },
                    ...(workflowNodeIds.length && { workflowNodeId: { in: workflowNodeIds } }),
                },
                include: { user: true }
            });
        } else {
            records = await prisma.configurationData.findMany({
                where: {
                    ...(workflowNodeIds.length && { workflowNodeId: { in: workflowNodeIds } }),
                    ...(userId && !isQC ? { userId } : {})
                }
            });
        }

        records = records.filter(
            (r) =>
                (!dataType || (r.data && r.data[dataType])) &&
                (!hasField || (r.data && r.data.hasOwnProperty(hasField)))
        );

        if (records.length === 0) {
            await Log.warn("ConfigData empty by criteria", {
                workflowId,
                nodeId,
                userId,
                roles,
                dataType,
                hasField,
            });
            return { status: 404, success: false, message: "No configurationData found for given criteria" };
        }

        await Log.info("ConfigData fetched by criteria", {
            count: records.length,
            workflowId,
            nodeId,
            userId,
            roles,
        });

        return {
            status: 200,
            success: true,
            message: "ConfigurationData fetched successfully",
            data: records.map(unwrapData),
        };
    },

    createConfigurationData: async ({ workflowId, userId, data }) => {
        try {
            const [wf, user] = await Promise.all([
                prisma.workflow.findFirst({ where: { id: workflowId } }),
                prisma.user.findUnique({ where: { id: userId } }), // không lấy roleId nữa
            ]);

            const errors = [];
            if (!wf) errors.push("Workflow not found");
            if (!user) errors.push("User not found");
            if (errors.length) {
                await Log.warn("createConfigurationData validation failed", { workflowId, userId, errors });
                return { status: 400, success: false, message: errors.join(" & "), errors };
            }

            const items = Array.isArray(data?.nodeIds) ? data.nodeIds : [];
            if (!items.length) {
                return { status: 400, success: false, message: "nodeIds is empty" };
            }

            const results = [];
            for (const item of items) {
                const nodeId = item?.nodeid;
                if (!nodeId) {
                    results.push({ status: 400, success: false, message: "Missing nodeid in item" });
                    continue;
                }

                const wfNode = await prisma.workflowNode.findUnique({
                    where: { workflowId_nodeId: { workflowId, nodeId } },
                });
                if (!wfNode) {
                    results.push({ status: 404, success: false, message: "WorkflowNode not found", nodeId });
                    continue;
                }

                // check tồn tại
                const existing = await prisma.configurationData.findFirst({
                    where: { workflowNodeId: wfNode.id, userId },
                });
                if (existing) {
                    results.push({ status: 409, success: false, message: "ConfigurationData already exists", nodeId });
                    continue;
                }

                const { nodeid: _omit, ...nodeData } = item;
                const fmt = buildFormatDataFromConfigData(nodeData) || null;

                const record = await prisma.configurationData.create({
                    data: {
                        workflowNodeId: wfNode.id,
                        userId,
                        data: nodeData,
                        formatData: fmt,
                    },
                });
                results.push({ status: 201, success: true, message: "Created new", nodeId, data: unwrapData(record) });
            }

            return { status: 207, success: true, message: "Processed all nodeIds", data: results };
        } catch (error) {
            await Log.error("createConfigurationData failed", { workflowId, userId, error: error.message });
            return { status: 500, message: "Error creating configuration data: " + error.message };
        }
    },

    updateConfigurationData: async ({
        id,
        workflowId,
        nodeId,
        userId,
        data,
        description,
        attachments,
    }) => {
        try {
            const existing = await prisma.configurationData.findUnique({
                where: { id },
                include: { workflowNode: { select: { nodeId: true } } }
            });
            if (!existing) {
                await Log.warn("updateConfigurationData not found", { id });
                return { status: 404, success: false, message: "ConfigurationData not found" };
            }
            // giữ/đổi workflowNodeId nếu client gửi workflowId+nodeId
            let workflowNodeId = existing.workflowNodeId;
            if (workflowId && nodeId) {
                const node = await findWorkflowNodeBy(workflowId, nodeId);
                if (!node) {
                    await Log.warn("updateConfigurationData workflowNode missing", {
                        id,
                        workflowId,
                        nodeId,
                    });
                    return { status: 404, success: false, message: "WorkflowNode not found" };
                }
                workflowNodeId = node.id;
            }

            const newKey = {
                workflowNodeId,
                userId: userId ?? existing.userId,
            };

            // nếu đổi key → check trùng
            if (
                newKey.workflowNodeId !== existing.workflowNodeId ||
                newKey.userId !== existing.userId
            ) {
                const duplicate = await prisma.configurationData.findFirst({
                    where: { ...newKey, NOT: { id } }, select: { id: true }
                });
                if (duplicate) {
                    await Log.warn("updateConfigurationData duplicate key", { id, newKey });
                    return {
                        status: 409,
                        success: false,
                        message: "Another configurationData with same key already exists",
                    };
                }
            }

            const currentNodeId = nodeId || existing.workflowNode?.nodeId;
            let nodeData = pickNodeDataFromWrapper(data, currentNodeId) ?? existing.data;
            const fmt = buildFormatDataFromConfigData(nodeData) || null;

            const updated = await prisma.configurationData.update({
                where: { id },
                data: {
                    ...newKey,
                    data: nodeData,           // lưu dạng nodeData thống nhất với 'create'
                    formatData: fmt,          // rebuild chắc chắn có data
                    description: description ?? existing.description,
                    attachments: attachments ?? existing.attachments,
                },
            });

            await Log.info("ConfigurationData updated", {
                id,
                workflowNodeId: newKey.workflowNodeId,
                userId: newKey.userId,
                changed: Object.keys({
                    ...(data !== undefined && { data: true }),
                    ...(description !== undefined && { description: true }),
                    ...(attachments !== undefined && { attachments: true }),
                }),
            });

            return {
                status: 200,
                success: true,
                message: "ConfigurationData fully updated",
                data: unwrapData(updated),
            };
        } catch (error) {
            await Log.error("updateConfigurationData failed", { id, error: error.message });
            throw new Error("Failed to update configuration data: " + error.message);
        }
    },

    deleteConfigurationData: async ({ id }) => {
        try {
            await prisma.configurationData.delete({ where: { id } });
            await Log.info("ConfigurationData deleted", { id });
            return { status: 200, success: true, message: "ConfigurationData deleted successfully" };
        } catch (error) {
            await Log.error("deleteConfigurationData failed", { id, error: error.message });
            throw new Error("Failed to delete configuration data: " + error.message);
        }
    },
};

export default configurationDataService;
