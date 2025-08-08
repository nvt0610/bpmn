import resultReceiveService from "../services/resultReceiveService.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const resultReceiveController = {
    receiveBatchResult: async (req, res) => {
    const result = await resultReceiveService.receiveBatchResult(req.body);
    res.status(result.status).json(result);
  }
};

export default resultReceiveController;