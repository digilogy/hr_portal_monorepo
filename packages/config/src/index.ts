import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5111),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5435),
  DB_USER: z.string().default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().default("hr-portal"),
  TYPEORM_SYNCHRONIZE: z.string().optional(),

  // Not enforcing a minimum length (unlike ideas-staging-backend's 32-char rule): the current
  // production secret is 20 chars, and raising the bar here would refuse to boot until it's
  // rotated. Rotating it is a separate, deliberate step (it invalidates all live sessions).
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

  ADMIN_USER: z.string().default("admin@casagrand.co.in"),
  ADMIN_PIN: z.string().default("1234"),

  FRONTEND_URL: z.string().default("http://localhost:3661"),
  ALLOWED_ORIGINS: z.string().default(""),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  AWS_REGION: z.string().optional(),
  AWS_DEFAULT_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SES_FROM_EMAIL: z.string().optional(),
  AWS_SES_FROM_EMAIL: z.string().optional(),

  // Not used at runtime yet — reserved for packages/storage (Stage 10's
  // planned migration of admin bulk-upload from local disk to S3).
  AWS_S3_BUCKET: z.string().optional(),

  EMAIL_MAX_ATTEMPTS: z.coerce.number().default(3),
  EMAIL_RETRY_DELAY_MS: z.coerce.number().default(5000),
  EMAIL_SEND_INTERVAL_MS: z.coerce.number().default(300),

  RATE_LIMIT_ACCESS_MAX: z.coerce.number().default(10),
  RATE_LIMIT_FORGOT_MAX: z.coerce.number().default(5),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
