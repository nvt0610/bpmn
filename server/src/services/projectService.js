// services/projectService.js
import { PrismaClient } from "@prisma/client";
import { Log } from "../helpers/logReceive.js";

const prisma = new PrismaClient();

// Gom include để tránh lặp
const projectInclude = { workflows: { select: { id: true, name: true } } };

// Helper map ids
const idsToMany = (ids) => (ids || []).map((id) => ({ id }));

// Wrapper gộp try/catch và Log.error, vẫn giữ nguyên message trả ra
const withError = async (failMsg, fn, ctx = {}) => {
  try {
    return await fn();
  } catch (error) {
    await Log.error(failMsg, { ...ctx, error: error.message });
    return { status: 500, message: error.message, data: null };
  }
};

const projectService = {
  getAll: async () =>
    withError("Failed to fetch projects", async () => {
      const projects = await prisma.project.findMany({
        orderBy: { name: "asc" },
        include: projectInclude,
      });
      await Log.info("Fetched all projects successfully", { count: projects.length });
      return { status: 200, message: "Fetched all projects successfully", data: projects };
    }),

  getById: async (id) =>
    withError("Failed to fetch project", async () => {
      const project = await prisma.project.findUnique({
        where: { id },
        include: projectInclude,
      });

      if (!project) {
        await Log.warn("Project not found", { id });
        return { status: 404, message: "Project not found", data: null };
      }

      await Log.info("Fetched project successfully", { id });
      return { status: 200, message: "Fetched project successfully", data: project };
    }, { id }),

  create: async (payload) =>
    withError("Failed to create project", async () => {
      const { name, description, workflowIds = [] } = payload;

      const exists = await prisma.project.findFirst({ where: { name } });
      if (exists) {
        await Log.warn("Project name already exists", { name });
        return { status: 409, message: "Project name already exists", data: null };
      }

      const newProject = await prisma.project.create({
        data: { name, description, workflows: { connect: idsToMany(workflowIds) } },
        include: projectInclude,
      });

      await Log.info("Project created successfully", { id: newProject.id, name });
      return { status: 201, message: "Project created successfully", data: newProject };
    }, { payload }),

  update: async (id, payload) =>
    withError("Failed to update project", async () => {
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
          ...(workflowIds
            ? { workflows: { set: idsToMany(workflowIds) } }
            : {}),
        },
        include: projectInclude,
      });

      await Log.info("Project updated successfully", { id });
      return { status: 200, message: "Project updated successfully", data: updated };
    }, { id, payload }),

  delete: async (id) =>
    withError("Failed to delete project", async () => {
      const exists = await prisma.project.findUnique({ where: { id } });
      if (!exists) {
        await Log.warn("Project not found for delete", { id });
        return { status: 404, message: "Project not found", data: null };
      }

      await prisma.project.delete({ where: { id } });
      await Log.info("Project deleted successfully", { id });
      return { status: 200, message: "Project deleted successfully", data: null };
    }, { id }),
};

export default projectService;
