import { config } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV === "test") {
  config({ path: ".env.test" });
} else {
  config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  DATABASE_URL: z.string().default("./db/app.db"),
  PORT: z.coerce.number().default(3333),
  ADMIN_PASSWORD: z.string().default("admin123")
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables!", _env.error);

  throw new Error("Invalid environment variables!");
}

export const env = _env.data;
