import { PrismaClient } from "@prisma/client";
import n8nService from "./n8nService.js";
import axios from "axios";
import { Log } from "../helpers/logReceive.js"; // 🔹 Import Log


const prisma = new PrismaClient();

const runTestn8nService = {
    runWorkflow: async ({ testBatchId }) => {
        // 1. Validate bắt buộc
        if (!testBatchId) {
            return { status: 400, success: false, message: "testBatchId is required" };
        }
        await Log.info("Run workflow request received", { testBatchId });
        // 6. Giữ nguyên phần lấy token
        const tokenResponse = await n8nService.getToken();
        const token = tokenResponse?.data?.access_token;
        if (!token) {
            return { status: 500, success: false, message: "Failed to get N8N access token" };
        }

        // 7. Lấy endpoint từ env (n8nService.N8N_ENDPOINT)
        const url = `${n8nService.N8N_ENDPOINT}/test-automation/api/v1/workflows/run`;
        await Log.info("Sending run request to n8n", { url, testBatchId });

        // 8. Giữ nguyên phần push sang n8n
        try {
            const response = await axios.post(url, { testBatchId },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                }
            );
            await Log.info("Run workflow request sent to n8n successfully", { testBatchId });
            return {
                status: 200,
                success: true,
                message: "Run workflow request sent to n8n successfully",
                data: response.data,
            };
        } catch (error) {
            await Log.error("Failed to run workflow via n8n", {
                error: error.response?.data || error.message,
                testBatchId,
            }); return {
                status: error.response?.status || 500,
                success: false,
                message: "Failed to run workflow: " + (error.response?.data?.error || error.message),
                n8nError: error.response?.data,
            };
        }
    },
};

export default runTestn8nService;
