import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const userService = {
  register: async ({ username, email, password, roleId }) => {
    try {
      // Kiểm tra trùng username/email
      const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });
      if (existing) {
        return { status: 409, success: false, message: "Username or email already exists" };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          roleId,
        },
      });

      return {
        status: 201,
        success: true,
        message: "User registered successfully",
        data: { id: user.id, username: user.username, email: user.email },
      };
    } catch (error) {
      throw new Error("Failed to register: " + error.message);
    }
  },

  login: async ({ username, password }) => {
    try {
      if (!username || !password) {
        return { status: 400, success: false, message: "Username and password are required" };
      }

      // Tìm user theo username
      const user = await prisma.user.findUnique({
        where: { username },
        include: { role: true },
      });

      if (!user) {
        return { status: 404, success: false, message: "User not found" };
      }

      // So sánh password thuần
      if (user.password !== password) {
        return { status: 401, success: false, message: "Invalid credentials" };
      }

      return {
        status: 200,
        success: true,
        message: "Login successful",
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role.name,
        },
      };
    } catch (error) {
      throw new Error("Failed to login: " + error.message);
    }
  },

  getAllUsers: async () => {
    try {
      const users = await prisma.user.findMany({
        include: {
          role: true,
        },
      });
      return {
        status: 200,
        success: true,
        message: "Users fetched successfully",
        data: users,
      };
    } catch (error) {
      throw new Error("Failed to fetch users: " + error.message);
    }
  },

  getUserById: async ({ id }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { role: true },
      });

      if (!user) {
        return {
          status: 404,
          success: false,
          message: "User not found",
        };
      }

      return {
        status: 200,
        success: true,
        message: "User fetched successfully",
        data: user,
      };
    } catch (error) {
      throw new Error("Failed to fetch user: " + error.message);
    }
  },

  createUser: async ({ username, email, password, roleId }) => {
    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
        },
      });

      if (existing) {
        return {
          status: 409,
          success: false,
          message: "Username or email already exists",
        };
      }

      const user = await prisma.user.create({
        data: { username, email, password, roleId },
      });

      return {
        status: 201,
        success: true,
        message: "User created successfully",
        data: user,
      };
    } catch (error) {
      throw new Error("Failed to create user: " + error.message);
    }
  },

  updateUser: async ({ id, username, email, password, roleId }) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return {
          status: 404,
          success: false,
          message: "User not found",
        };
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { username, email, password, roleId },
      });

      return {
        status: 200,
        success: true,
        message: "User updated successfully",
        data: updated,
      };
    } catch (error) {
      throw new Error("Failed to update user: " + error.message);
    }
  },

  deleteUser: async ({ id }) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return {
          status: 404,
          success: false,
          message: "User not found",
        };
      }

      await prisma.user.delete({ where: { id } });

      return {
        status: 200,
        success: true,
        message: "User deleted successfully",
      };
    } catch (error) {
      throw new Error("Failed to delete user: " + error.message);
    }
  },
};

export default userService;
