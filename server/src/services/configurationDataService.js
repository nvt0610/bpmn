import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const unwrapData = (record) => {
    if (!record?.data || typeof record.data !== "object") return record;
    const { data, ...rest } = record;
    return { ...rest, ...data };
};

const configurationDataService = {

    getN8nNode: async ({ id }) => {
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
            return { status: 404, success: false, message: "Not found", data: null };
        }

        // 2. Lấy workflow.name và nodeId
        const workflowName = configurationData.workflowNode?.workflow?.name || "";
        const nodeId = configurationData.workflowNode?.nodeId || "";

        // 3. Lấy apis từ configurationData.data
        const data = configurationData.data || {};
        const apis = data.apis;
        if (!apis || !Array.isArray(apis) || apis.length === 0) {
            return { status: 400, success: false, message: "No API data", nodes: [] };
        }

        // 4. Mapping node như cũ, chỉ sửa id và name
        const mapKeyValue = (obj) =>
            obj && typeof obj === "object"
                ? Object.entries(obj).map(([name, value]) => ({ name, value }))
                : [];

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

        // 5. Trả về đúng format mẫu
        return {
            status: 200,
            name: workflowName,
            nodes
        };
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
            throw new Error("Failed to fetch configuration data: " + error.message);
        }
    },

    getConfigurationData: async ({ id, workflowId, nodeId, userId, roleId, roles, dataType, hasField }) => {
        if (id) {
            const record = await prisma.configurationData.findUnique({ where: { id } });
            if (!record) return { status: 404, success: false, message: "configurationData not found by ID" };
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
                    ...(userId && !isQC ? { userId } : {}),
                    ...(roleId && { roleId }),
                },
                include: roleId ? { user: true } : undefined,
            });
        }

        records = records.filter(
            (r) =>
                (!dataType || (r.data && r.data[dataType])) &&
                (!hasField || (r.data && r.data.hasOwnProperty(hasField)))
        );

        if (records.length === 0) {
            return {
                status: 404,
                success: false,
                message: "No configurationData found for given criteria",
            };
        }

        return {
            status: 200,
            success: true,
            message: "ConfigurationData fetched successfully",
            data: records.map(unwrapData),
        };
    },

    createConfigurationData: async ({ workflowId, userId, data }) => {
        try {
            // Query song song cho nhanh
            const [existingWorkflow, user] = await Promise.all([
                prisma.workflow.findFirst({ where: { id: workflowId } }),
                prisma.user.findUnique({ where: { id: userId }, select: { roleId: true } }),
            ]);

            const errors = [];
            if (!existingWorkflow) errors.push("Workflow not found");
            if (!user) errors.push("User not found");

            if (errors.length > 0) {
                return {
                    status: 400,
                    success: false,
                    message: errors.join(" & "),
                    errors,
                };
            }

            const roleId = user.roleId;
            const nodeIds = data.nodeIds || [];
            const results = [];

            for (const item of nodeIds) {
                const nodeid = item.nodeid;
                const workflowNode = await prisma.workflowNode.findUnique({
                    where: { workflowId_nodeId: { workflowId, nodeId: nodeid } }
                });
                if (!workflowNode) continue;

                // Lưu toàn bộ object item (trừ nodeid)
                const { nodeid: _, ...nodeData } = item;

                const existed = await prisma.configurationData.findUnique({
                    where: { workflowNodeId_userId_roleId: { workflowNodeId: workflowNode.id, userId, roleId } }
                });

                const record = await prisma.configurationData.upsert({
                    where: { workflowNodeId_userId_roleId: { workflowNodeId: workflowNode.id, userId, roleId } },
                    update: { data: nodeData },
                    create: { workflowNodeId: workflowNode.id, userId, roleId, data: nodeData }
                });

                results.push({
                    status: 200,
                    success: true,
                    message: existed ? "Updated" : "Created new",
                    nodeId: nodeid,
                    data: unwrapData(record)
                });
            }

            return {
                status: 207,
                success: true,
                message: "Processed all nodeIds",
                data: results
            };
        } catch (error) {
            return {
                status: 500,
                message: "Error creating configuration data: " + error.message,
            };
        }
    },

    updateConfigurationData: async ({ id, workflowId, nodeId, userId, roleId, data, description, attachments }) => {
        const existing = await prisma.configurationData.findUnique({ where: { id } });
        if (!existing) return { status: 404, success: false, message: "ConfigurationData not found" };

        let workflowNodeId = existing.workflowNodeId;
        if (workflowId && nodeId) {
            const node = await prisma.workflowNode.findUnique({
                where: {
                    workflowId_nodeId: {
                        workflowId,
                        nodeId,
                    },
                },
            });
            if (!node) return { status: 404, success: false, message: "WorkflowNode not found" };
            workflowNodeId = node.id;
        }

        const newData = {
            workflowNodeId,
            userId: userId ?? existing.userId,
            roleId: roleId ?? existing.roleId,
            data: data ?? existing.data,
            description: description ?? existing.description,
            attachments: attachments ?? existing.attachments,
        };

        const isKeyChanged =
            newData.workflowNodeId !== existing.workflowNodeId ||
            newData.userId !== existing.userId ||
            newData.roleId !== existing.roleId;

        if (isKeyChanged) {
            const duplicate = await prisma.configurationData.findFirst({
                where: {
                    workflowNodeId: newData.workflowNodeId,
                    userId: newData.userId,
                    roleId: newData.roleId,
                    NOT: { id },
                },
            });
            if (duplicate) {
                return {
                    status: 409,
                    success: false,
                    message: "Another configurationData with same key already exists",
                };
            }
        }

        const updated = await prisma.configurationData.update({
            where: { id },
            data: newData,
        });

        return {
            status: 200,
            success: true,
            message: "ConfigurationData fully updated",
            data: unwrapData(updated),
        };
    },

    deleteConfigurationData: async ({ id }) => {
        await prisma.configurationData.delete({ where: { id } });
        return {
            status: 200,
            success: true,
            message: "ConfigurationData deleted successfully",
        };
    },
};

export default configurationDataService;
