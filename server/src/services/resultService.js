import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const resultService = {
  // Lấy tất cả result
  getAllResults: async () => {
    try {
      const results = await prisma.result.findMany();
      return {
        status: 200,
        success: true,
        message: "Results fetched successfully",
        data: results,
      };
    } catch (error) {
      throw new Error("Failed to fetch results: " + error.message);
    }
  },

  // Lấy 1 result theo id
  getResultById: async ({ id }) => {
    try {
      const result = await prisma.result.findUnique({ where: { id } });
      if (!result) {
        return {
          status: 404,
          success: false,
          message: "Result not found",
        };
      }
      return {
        status: 200,
        success: true,
        message: "Result fetched successfully",
        data: result,
      };
    } catch (error) {
      throw new Error("Failed to fetch result: " + error.message);
    }
  },

  // Tạo mới result
  createResult: async ({ result }) => {
    try {
      const created = await prisma.result.create({
        data: { result },
      });
      return {
        status: 201,
        success: true,
        message: "Result created successfully",
        data: created,
      };
    } catch (error) {
      throw new Error("Failed to create result: " + error.message);
    }
  },

  // Cập nhật result theo id
  updateResult: async ({ id, result }) => {
    try {
      const existing = await prisma.result.findUnique({ where: { id } });
      if (!existing) {
        return {
          status: 404,
          success: false,
          message: "Result not found",
        };
      }
      const updated = await prisma.result.update({
        where: { id },
        data: { result },
      });
      return {
        status: 200,
        success: true,
        message: "Result updated successfully",
        data: updated,
      };
    } catch (error) {
      throw new Error("Failed to update result: " + error.message);
    }
  },

  // Xoá result theo id
  deleteResult: async ({ id }) => {
    try {
      const existing = await prisma.result.findUnique({ where: { id } });
      if (!existing) {
        return {
          status: 404,
          success: false,
          message: "Result not found",
        };
      }
      await prisma.result.delete({ where: { id } });
      return {
        status: 200,
        success: true,
        message: "Result deleted successfully",
      };
    } catch (error) {
      throw new Error("Failed to delete result: " + error.message);
    }
  },
};

export default resultService;
