import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const roleService = {
  getAllRoles: async () => {
    try {
      const roles = await prisma.role.findMany();
      return {
        status: 200,
        success: true,
        message: "Roles fetched successfully",
        data: roles,
      };
    } catch (error) {
      throw new Error("Failed to fetch roles: " + error.message);
    }
  },

  getRoleById: async ({ id }) => {
    try {
      const role = await prisma.role.findUnique({
        where: { id },
      });

      if (!role) {
        return {
          status: 404,
          success: false,
          message: "Role not found",
        };
      }

      return {
        status: 200,
        success: true,
        message: "Role fetched successfully",
        data: role,
      };
    } catch (error) {
      throw new Error("Failed to fetch role: " + error.message);
    }
  },

  createRole: async ({ name }) => {
    try {
      const existing = await prisma.role.findUnique({ where: { name } });
      if (existing) {
        return {
          status: 409,
          success: false,
          message: "Role already exists",
        };
      }

      const role = await prisma.role.create({
        data: { name },
      });

      return {
        status: 201,
        success: true,
        message: "Role created successfully",
        data: role,
      };
    } catch (error) {
      throw new Error("Failed to create role: " + error.message);
    }
  },

  updateRole: async ({ id, name }) => {
    try {
      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) {
        return {
          status: 404,
          success: false,
          message: "Role not found",
        };
      }

      const updated = await prisma.role.update({
        where: { id },
        data: { name },
      });

      return {
        status: 200,
        success: true,
        message: "Role updated successfully",
        data: updated,
      };
    } catch (error) {
      throw new Error("Failed to update role: " + error.message);
    }
  },

  deleteRole: async ({ id }) => {
    try {
      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) {
        return {
          status: 404,
          success: false,
          message: "Role not found",
        };
      }

      await prisma.role.delete({
        where: { id },
      });

      return {
        status: 200,
        success: true,
        message: "Role deleted successfully",
      };
    } catch (error) {
      throw new Error("Failed to delete role: " + error.message);
    }
  },
};

export default roleService;
