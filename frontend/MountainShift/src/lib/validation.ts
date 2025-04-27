// src/lib/validation.ts
import { z } from "zod";

export const EnvSchema = z.object({
  DATABASE_URL: z.string().nonempty("DATABASE_URL is required"),
  SSL_ROOT_CERT: z.string().nonempty("SSL_ROOT_CERT is required"),
  ARB_PAYOUT_PRIVATE_KEY: z.string().nonempty("ARB_PAYOUT_PRIVATE_KEY is required"),
});

export function validateEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Environment validation error:", parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}
