import dotenv from "dotenv";

dotenv.config(); // Load .env 1 lần ở đây

export const API_PREFIX = process.env.API_PREFIX || "/api/v1";
