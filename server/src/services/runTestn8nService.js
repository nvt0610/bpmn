import { PrismaClient } from "@prisma/client";
import n8nService from "./n8nService.js";
import axios from "axios";

const prisma = new PrismaClient();

const runTestn8nService = {
    runWorkflowById: async ({ testBatchId, workflowId }) => {
        // 1. Check bắt buộc
        if (!workflowId) {
            return { status: 400, success: false, message: "workflowId is required" };
        }
        if (!testBatchId) {
            return { status: 400, success: false, message: "testBatchId is required" };
        }

        // 2. Nếu workflowId có thì check DB
        if (workflowId) {
            const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
            if (!workflow) {
                return { status: 404, success: false, message: "Workflow not found" };
            }
        }

        // 3. Check testBatchId tồn tại
        const testBatch = await prisma.testBatch.findUnique({ where: { id: testBatchId } });
        if (!testBatch) {
            return { status: 404, success: false, message: "Test batch not found" };
        }

        // 4. Lấy token đúng cách
        const tokenResponse = await n8nService.getToken();
        const token = tokenResponse?.data?.access_token;
        if (!token) {
            return { status: 500, success: false, message: "Failed to get N8N access token" };
        }

        // 5. Lấy endpoint từ env (n8nService.N8N_ENDPOINT)
        const url = `${n8nService.N8N_ENDPOINT}/test-automation/api/v1/workflows/run`;

        // 6. Gửi request đến n8n
        try {
            const response = await axios.post(
                url,
                { testBatchId },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                }
            );
            return {
                status: 200,
                success: true,
                message: "Run workflow request sent to n8n successfully",
                data: response.data,
            };
        } catch (error) {
            return {
                status: error.response?.status || 500,
                success: false,
                message: "Failed to run workflow: " + (error.response?.data?.error || error.message),
                n8nError: error.response?.data,
            };
        }
    }
};

export default runTestn8nService;
