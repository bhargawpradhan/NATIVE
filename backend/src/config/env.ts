import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .default('postgresql://miniledger_dev:miniledger_dev_secret@localhost:5432/miniledger_db?schema=public'),
  TEST_DATABASE_URL: z
    .string()
    .default('postgresql://miniledger_dev:miniledger_dev_secret@localhost:5432/miniledger_test?schema=public'),
  JWT_SECRET: z.string().min(16).default('miniledger_local_development_jwt_secret_key_32chars_min'),
  OTP_HASH_SECRET: z.string().min(16).default('miniledger_local_development_otp_hash_secret_32chars_min'),
  OTP_EXPIRES_IN_SECONDS: z.coerce.number().default(300),
  MAX_OTP_ATTEMPTS: z.coerce.number().default(5),
  APP_TIME_ZONE: z.string().default('Asia/Kolkata'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  OTP_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_ISSUANCE_PER_WINDOW: z.coerce.number().default(5),
  OTP_ISSUANCE_WINDOW_SECONDS: z.coerce.number().default(600)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment validation failure');
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
