import { PrismaClient } from "@prisma/client";
import { Log } from "../helpers/logReceive.js"; // ghi log vào DB, KHÔNG đổi response
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

    createTestBatch: async ({ name, description, userId, testCaseIds = [], scenarioIds = [] }) => {
        await Log.info("Create TestBatch request received", { name, description, testCaseIds, scenarioIds });

        if (!userId) {
            return { status: 400, success: false, message: "userId is required" };
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return { status: 404, success: false, message: "User not found" };
        }

        let finalScenarioIds = [...new Set(scenarioIds)];

        // Nếu có testCaseIds thì lấy ra scenarioId từ test case
        if (testCaseIds.length > 0) {
            const testCases = await prisma.testCase.findMany({
                where: { id: { in: testCaseIds } },
                select: { scenarioId: true },
            });

            if (testCases.length !== testCaseIds.length) {
                const foundIds = testCases.map(tc => tc.id);
                const missing = testCaseIds.filter(id => !foundIds.includes(id));
                return {
                    status: 400,
                    success: false,
                    message: `Some testCaseIds are invalid: ${missing.join(", ")}`,
                };
            }

            const extractedScenarioIds = testCases.map(tc => tc.scenarioId).filter(Boolean);
            finalScenarioIds = [...new Set([...finalScenarioIds, ...extractedScenarioIds])];
        }

        // Validate có ít nhất 1 scenarioId
        if (finalScenarioIds.length === 0) {
            return {
                status: 400,
                success: false,
                message: "No valid scenarioIds provided",
            };
        }

        // Tạo TestBatch
        const testBatch = await prisma.testBatch.create({
            data: {
                name: name || `Batch for ${finalScenarioIds.length} scenario(s)`,
                description: description || `Auto batch for ${finalScenarioIds.length} scenario(s)`,
                userId,
                scenarios: { connect: finalScenarioIds.map(id => ({ id })) },
            },
            include: { scenarios: true },
        });

        await Log.info("TestBatch created", { testBatchId: testBatch.id });

        return {
            status: 201,
            success: true,
            message: "TestBatch created successfully",
            data: testBatch,
        };
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
