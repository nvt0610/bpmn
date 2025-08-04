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

    createScenario: async ({ name, testBatchId }) => {
        try {
            // Optional: Kiểm tra trùng tên trong cùng testBatch
            const scenario = await prisma.scenario.create({
                data: {
                    name,
                    testBatchId: typeof testBatchId === "undefined" ? null : testBatchId,
                },

            });

            return {
                status: 201,
                success: true,
                message: "Scenario created successfully",
                data: scenario,
            };
        } catch (error) {
            throw new Error("Failed to create scenario: " + error.message);
        }
    },

    updateScenario: async ({ id, name, testBatchId }) => {
        try {
            const scenario = await prisma.scenario.findUnique({ where: { id } });
            if (!scenario) {
                return {
                    status: 404,
                    success: false,
                    message: "Scenario not found",
                };
            }

            const updated = await prisma.scenario.update({
                where: { id },
                data: { name, testBatchId },
            });

            return {
                status: 200,
                success: true,
                message: "Scenario updated successfully",
                data: updated,
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
