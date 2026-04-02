import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().min(1).optional(),
  INTEGRATION_CLIENT_ID: z.string().min(1),
  INTEGRATION_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().optional(),
  VERCEL_EXTERNAL_REDIRECT_URI: z.string().min(1).optional(),
  /** Vercel product slug / id for the Appwrite BYOK product (default: appwrite). */
  APPWRITE_PRODUCT_ID: z.string().min(1).optional(),
  /** Appwrite user label applied to the installing Vercel user (default: admin). */
  APPWRITE_ADMIN_LABEL: z.string().min(1).optional(),
  /**
   * URL slug from Integrations Console (not the oac_ id). Used for the “Install on Vercel” link on the home page.
   * @see https://vercel.com/integrations/{slug}/new
   */
  VERCEL_INTEGRATION_SLUG: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error("env validation failed", {
    cause: parsed.error,
  });
}

export const env = parsed.data;
