import { z } from "zod";

/** Keys must match Product metadata schema in Vercel Integrations Console. */
export const appwriteMetadataSchema = z.object({
  appwriteEndpoint: z
    .string()
    .min(1, "Appwrite endpoint is required")
    .transform((s) => s.trim())
    .pipe(z.string().url("Must be a valid URL (include https://)")),
  appwriteProjectId: z
    .string()
    .min(1, "Project ID is required")
    .transform((s) => s.trim()),
  appwriteDatabaseId: z
    .string()
    .min(1, "Database ID is required")
    .transform((s) => s.trim()),
  appwriteApiKey: z
    .string()
    .min(1, "API key is required")
    .transform((s) => s.trim()),
});

export type AppwriteMetadata = z.infer<typeof appwriteMetadataSchema>;

export function parseAppwriteMetadata(
  metadata: Record<string, unknown>,
):
  | { success: true; data: AppwriteMetadata }
  | { success: false; fieldErrors: { key: string; message: string }[] } {
  const result = appwriteMetadataSchema.safeParse(metadata);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const fieldErrors = result.error.errors.map((e) => ({
    key: e.path.join(".") || "metadata",
    message: e.message,
  }));
  return { success: false, fieldErrors };
}

export function appwriteSecretsFromMetadata(data: AppwriteMetadata): {
  name: string;
  value: string;
}[] {
  return [
    { name: "APPWRITE_ENDPOINT", value: data.appwriteEndpoint },
    { name: "APPWRITE_PROJECT_ID", value: data.appwriteProjectId },
    { name: "APPWRITE_DATABASE_ID", value: data.appwriteDatabaseId },
    { name: "APPWRITE_API_KEY", value: data.appwriteApiKey },
  ];
}
