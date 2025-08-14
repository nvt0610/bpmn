import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const scenarioService = {
    getAllScenarios: async () => {
        try {
            const scenarios = await prisma.scenario.findMany({
                include: {
                    testBatch: true,
                    testCases: true,
                },
            });
            return {
                status: 200,
                success: true,
                message: "Scenarios fetched successfully",
                data: scenarios,
            };
        } catch (error) {
            throw new Error("Failed to fetch scenarios: " + error.message);
        }
    },

    getScenarioById: async ({ id }) => {
        try {
            const scenario = await prisma.scenario.findUnique({
                where: { id },
                include: {
                    testBatch: true,
                    testCases: true,
                },
            });

            if (!scenario) {
                return {
                    status: 404,
                    success: false,
                    message: "Scenario not found",
                };
            }

            return {
                status: 200,
                success: true,
                message: "Scenario fetched successfully",
                data: scenario,
            };
        } catch (error) {
            throw new Error("Failed to fetch scenario: " + error.message);
        }
    },

    createScenario: async ({ name, scenarioId, testBatchId, testCaseIds = [] }) => {
        try {
            const result = await prisma.$transaction(async (tx) => {
                let scenario;

                if (scenarioId) {
                    // 🔹 Update scenario có sẵn
                    scenario = await tx.scenario.update({
                        where: { id: scenarioId },
                        data: {
                            ...(name && { name }),
                            ...(testBatchId && { testBatchId })
                        },
                    });
                } else {
                    // 🔹 Tạo mới scenario
                    scenario = await tx.scenario.create({
                        data: {
                            name,
                            testBatchId: testBatchId ?? null,
                        },
                    });
                }

                // 🔹 Gán testCaseIds cho scenario
                if (Array.isArray(testCaseIds) && testCaseIds.length > 0) {
                    await tx.testCase.updateMany({
                        where: { id: { in: testCaseIds } },
                        data: { scenarioId: scenario.id },
                    });
                }

                return scenario;
            });

            return {
                status: scenarioId ? 200 : 201,
                success: true,
                message: scenarioId
                    ? "Scenario updated successfully"
                    : "Scenario created successfully",
                data: result,
            };
        } catch (error) {
            throw new Error("Failed to create/update scenario: " + error.message);
        }
    },

    updateScenario: async ({ id, name, testBatchId, testCaseIds }) => {
        try {
            const scenario = await prisma.scenario.findUnique({ where: { id } });
            if (!scenario) {
                return {
                    status: 404,
                    success: false,
                    message: "Scenario not found",
                };
            }

            const result = await prisma.$transaction(async (tx) => {
                // 1. Update scenario info
                const updatedScenario = await tx.scenario.update({
                    where: { id },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(testBatchId !== undefined && { testBatchId }),
                    },
                });

                // 2. Nếu gửi testCaseIds => update link test cases
                if (Array.isArray(testCaseIds)) {
                    // Gỡ link test case cũ
                    await tx.testCase.updateMany({
                        where: { scenarioId: id },
                        data: { scenarioId: null },
                    });

                    // Link test case mới
                    if (testCaseIds.length > 0) {
                        await tx.testCase.updateMany({
                            where: { id: { in: testCaseIds } },
                            data: { scenarioId: id },
                        });
                    }
                }

                return updatedScenario;
            });

            return {
                status: 200,
                success: true,
                message: "Scenario updated successfully",
                data: result,
            };
        } catch (error) {
            throw new Error("Failed to update scenario: " + error.message);
        }
    },

    deleteScenario: async ({ id }) => {
        try {
            const scenario = await prisma.scenario.findUnique({ where: { id } });
            if (!scenario) {
                return {
                    status: 404,
                    success: false,
                    message: "Scenario not found",
                };
            }

            await prisma.scenario.delete({ where: { id } });

            return {
                status: 200,
                success: true,
                message: "Scenario deleted successfully",
            };
        } catch (error) {
            throw new Error("Failed to delete scenario: " + error.message);
        }
    },
};

export default scenarioService;
