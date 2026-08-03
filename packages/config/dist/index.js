"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    PORT: zod_1.z.coerce.number().default(5111),
    DB_HOST: zod_1.z.string().default("localhost"),
    DB_PORT: zod_1.z.coerce.number().default(3306),
    DB_USER: zod_1.z.string().default("root"),
    DB_PASSWORD: zod_1.z.string().default(""),
    DB_NAME: zod_1.z.string().default("hr-portal"),
    TYPEORM_SYNCHRONIZE: zod_1.z.string().optional(),
    // Not enforcing a minimum length (unlike ideas-staging-backend's 32-char rule): the current
    // production secret is 20 chars, and raising the bar here would refuse to boot until it's
    // rotated. Rotating it is a separate, deliberate step (it invalidates all live sessions).
    JWT_SECRET: zod_1.z.string().min(1, "JWT_SECRET is required"),
    ADMIN_USER: zod_1.z.string().default("admin@gmail.com"),
    ADMIN_PIN: zod_1.z.string().default("admin@123"),
    FRONTEND_URL: zod_1.z.string().default("http://localhost:3661"),
    ALLOWED_ORIGINS: zod_1.z.string().default(""),
    REDIS_HOST: zod_1.z.string().default("localhost"),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    AWS_REGION: zod_1.z.string().optional(),
    AWS_DEFAULT_REGION: zod_1.z.string().optional(),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    SES_FROM_EMAIL: zod_1.z.string().optional(),
    AWS_SES_FROM_EMAIL: zod_1.z.string().optional(),
    // Not used at runtime yet — reserved for packages/storage (Stage 10's
    // planned migration of admin bulk-upload from local disk to S3).
    AWS_S3_BUCKET: zod_1.z.string().optional(),
    EMAIL_MAX_ATTEMPTS: zod_1.z.coerce.number().default(3),
    EMAIL_RETRY_DELAY_MS: zod_1.z.coerce.number().default(5000),
    EMAIL_SEND_INTERVAL_MS: zod_1.z.coerce.number().default(300),
    RATE_LIMIT_ACCESS_MAX: zod_1.z.coerce.number().default(10),
    RATE_LIMIT_FORGOT_MAX: zod_1.z.coerce.number().default(5),
    RATE_LIMIT_LOGIN_MAX: zod_1.z.coerce.number().default(10),
});
function loadEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error("Invalid environment variables:", result.error.format());
        process.exit(1);
    }
    return result.data;
}
exports.env = loadEnv();
//# sourceMappingURL=index.js.map