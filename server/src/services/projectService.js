import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const projectService = {
  getAllProjects: async () => {
    try {
      const projects = await prisma.project.findMany({
        include: { workflows: true },
      });
      return {
        message: "Projects fetched successfully",
        data: projects,
      };
    } catch (error) {
      throw new Error("Failed to fetch projects: " + error.message);
    }
  },

  getProjectById: async ({ id }) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: { workflows: true },
      });

      if (!project) {
        return { message: "Project not found" };
      }

      return {
        message: "Project fetched successfully",
        data: project,
      };
    } catch (error) {
      throw new Error("Failed to fetch project: " + error.message);
    }
  },

  createProject: async ({ name, description }) => {
    try {
      const existing = await prisma.project.findFirst({
        where: { name },
      });

      if (existing) {
        return { message: "Project name already exists" };
      }

      const project = await prisma.project.create({
        data: { name, description },
      });

      return {
        message: "Project created successfully",
        data: project,
      };
    } catch (error) {
      throw new Error("Failed to create project: " + error.message);
    }
  },

  updateProject: async ({ id, name, description }) => {
    try {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project) {
        return { message: "Project not found" };
      }

      const updated = await prisma.project.update({
        where: { id },
        data: { name, description },
      });

      return {
        message: "Project updated successfully",
        data: updated,
      };
    } catch (error) {
      throw new Error("Failed to update project: " + error.message);
    }
  },

  deleteProject: async ({ id }) => {
    try {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project) {
        return { message: "Project not found" };
      }

      await prisma.project.delete({ where: { id } });

      return { message: "Project deleted successfully" };
    } catch (error) {
      throw new Error("Failed to delete project: " + error.message);
    }
  },
};

export default projectService;
