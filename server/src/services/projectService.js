// services/projectService.js
import { PrismaClient } from "@prisma/client";
import { Log } from "../helpers/logReceive.js"; // <-- import log helper
const prisma = new PrismaClient();

const projectService = {
  getAll: async () => {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { name: "asc" },
        include: { workflows: { select: { id: true, name: true } } },
      });

      await Log.info("Fetched all projects successfully", { count: projects.length });
      return { status: 200, message: "Fetched all projects successfully", data: projects };
    } catch (error) {
      await Log.error("Failed to fetch projects", { error: error.message });
      return { status: 500, message: error.message, data: null };
    }
  },

  getById: async (id) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: { workflows: { select: { id: true, name: true } } },
      });

      if (!project) {
        await Log.warn("Project not found", { id });
        return { status: 404, message: "Project not found", data: null };
      }

      await Log.info("Fetched project successfully", { id });
      return { status: 200, message: "Fetched project successfully", data: project };
    } catch (error) {
      await Log.error("Failed to fetch project", { id, error: error.message });
      return { status: 500, message: error.message, data: null };
    }
  },

  create: async (payload) => {
    try {
      const { name, description, workflowIds = [] } = payload;

      const exists = await prisma.project.findFirst({ where: { name } });
      if (exists) {
        await Log.warn("Project name already exists", { name });
        return { status: 409, message: "Project name already exists", data: null };
      }

      const newProject = await prisma.project.create({
        data: {
          name,
          description,
          workflows: { connect: workflowIds.map(id => ({ id })) }
        },
        include: { workflows: { select: { id: true, name: true } } }
      });

      await Log.info("Project created successfully", { id: newProject.id, name });
      return { status: 201, message: "Project created successfully", data: newProject };
    } catch (error) {
      await Log.error("Failed to create project", { payload, error: error.message });
      return { status: 500, message: error.message, data: null };
    }
  },

  update: async (id, payload) => {
    try {
      const { workflowIds, ...rest } = payload;

      const exists = await prisma.project.findUnique({ where: { id } });
      if (!exists) {
        await Log.warn("Project not found for update", { id });
        return { status: 404, message: "Project not found", data: null };
      }

      const updated = await prisma.project.update({
        where: { id },
        data: {
          ...rest,
          ...(workflowIds ? { workflows: { set: workflowIds.map(wid => ({ id: wid })) } } : {})
        },
        include: { workflows: { select: { id: true, name: true } } }
      });

      await Log.info("Project updated successfully", { id });
      return { status: 200, message: "Project updated successfully", data: updated };
    } catch (error) {
      await Log.error("Failed to update project", { id, payload, error: error.message });
      return { status: 500, message: error.message, data: null };
    }
  },

  delete: async (id) => {
    try {
      const exists = await prisma.project.findUnique({ where: { id } });
      if (!exists) {
        await Log.warn("Project not found for delete", { id });
        return { status: 404, message: "Project not found", data: null };
      }

      await prisma.project.delete({ where: { id } });
      await Log.info("Project deleted successfully", { id });
      return { status: 200, message: "Project deleted successfully", data: null };
    } catch (error) {
      await Log.error("Failed to delete project", { id, error: error.message });
      return { status: 500, message: error.message, data: null };
    }
  },
};

export default projectService;
