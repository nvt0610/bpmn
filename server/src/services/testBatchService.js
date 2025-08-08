import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const testBatchService = {
    getAllTestBatches: async () => {
        try {
            const testBatches = await prisma.testBatch.findMany({
                include: { scenarios: true },
            });
            return {
                status: 200,
                success: true,
                message: "TestBatches fetched successfully",
                data: testBatches,
            };
        } catch (error) {
            throw new Error("Failed to fetch test batches: " + error.message);
        }
    },

    getTestBatchById: async ({ id }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({
                where: { id },
                include: { scenarios: true },
            });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }
            return {
                status: 200,
                success: true,
                message: "TestBatch fetched successfully",
                data: testBatch,
            };
        } catch (error) {
            throw new Error("Failed to fetch test batch: " + error.message);
        }
    },

    createTestBatch: async ({ scenarios = [] }) => {
        try {
            // Gom tất cả id và name từ FE gửi lên
            const ids = scenarios.filter(item => item.id).map(item => item.id);
            const names = scenarios.filter(item => !item.id && item.scenarioName).map(item => item.scenarioName);

            // Lấy tất cả scenario theo id và theo name
            let foundScenarios = [];
            if (ids.length > 0) {
                const byId = await prisma.scenario.findMany({ where: { id: { in: ids } } });
                foundScenarios = foundScenarios.concat(byId);
            }
            if (names.length > 0) {
                const byName = await prisma.scenario.findMany({ where: { name: { in: names } } });
                foundScenarios = foundScenarios.concat(byName);
            }

            // So sánh xem có thiếu scenario nào không
            const foundIds = foundScenarios.map(s => s.id);
            const foundNames = foundScenarios.map(s => s.name);

            const missingIds = ids.filter(id => !foundIds.includes(id));
            const missingNames = names.filter(name => !foundNames.includes(name));

            if (missingIds.length > 0 || missingNames.length > 0) {
                return {
                    status: 400,
                    success: false,
                    message: "Scenario(s) not found: " +
                        [...missingIds, ...missingNames].join(", "),
                };
            }

            // Tạo testBatch và connect các scenario đã có
            const testBatch = await prisma.testBatch.create({
                data: {
                    scenarios: {
                        connect: foundScenarios.map(s => ({ id: s.id })),
                    },
                },
                include: { scenarios: true },
            });

            return {
                status: 201,
                success: true,
                message: "TestBatch created successfully",
                data: testBatch,
            };
        } catch (error) {
            throw new Error("Failed to create test batch: " + error.message);
        }
    },

    updateTestBatch: async ({ id, scenarios = [] }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({ where: { id } });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }

            // Lấy danh sách scenarioId từ body
            const scenarioIds = scenarios.map(item => item.scenarioId);

            // Lấy tất cả scenario có name thuộc danh sách truyền lên
            const foundScenarios = await prisma.scenario.findMany({
                where: { id: { in: scenarioIds } },
            });

            // Nếu thiếu thì trả lỗi
            const foundIds = foundScenarios.map(s => s.id);
            const missing = scenarioIds.filter(n => !foundIds.includes(n));
            if (missing.length > 0) {
                return {
                    status: 400,
                    success: false,
                    message: "Scenario(s) not found: " + missing.join(", "),
                };
            }

            // Update batch: set lại tất cả scenario id mới
            const updated = await prisma.testBatch.update({
                where: { id },
                data: {
                    scenarios: {
                        set: foundScenarios.map(s => ({ id: s.id })),
                    },
                },
                include: { scenarios: true },
            });

            return {
                status: 200,
                success: true,
                message: "TestBatch updated successfully",
                data: updated,
            };
        } catch (error) {
            throw new Error("Failed to update test batch: " + error.message);
        }
    },

    deleteTestBatch: async ({ id }) => {
        try {
            const testBatch = await prisma.testBatch.findUnique({ where: { id } });
            if (!testBatch) {
                return {
                    status: 404,
                    success: false,
                    message: "TestBatch not found",
                };
            }
            await prisma.testBatch.delete({ where: { id } });
            return {
                status: 200,
                success: true,
                message: "TestBatch deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete test batch: " + error.message);
        }
    },
};

export default testBatchService;
