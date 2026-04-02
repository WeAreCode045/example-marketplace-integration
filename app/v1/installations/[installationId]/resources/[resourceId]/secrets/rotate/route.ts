import {
  appwriteSecretsFromMetadata,
  parseAppwriteMetadata,
} from "@/lib/appwrite/metadata";
import { env } from "@/lib/env";
import { getResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { updateSecrets } from "@/lib/vercel/marketplace-api";
import {
  RequestSecretsRotationRequestSchema,
  type RequestSecretsRotationResponse,
} from "@/lib/vercel/schemas";
import { waitUntil } from "@vercel/functions";

const APPWRITE_PRODUCT_ID = env.APPWRITE_PRODUCT_ID ?? "appwrite";

interface Params {
  installationId: string;
  resourceId: string;
}

export const POST = withAuth(
  async (_claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      RequestSecretsRotationRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    console.log(
      "Accepting secret rotation request for resourceId:",
      params.installationId,
      params.resourceId,
      "with body:",
      requestBody.data,
    );

    // Toggle sync/async mode for testing (Vercel doesn't send these params)
    // - ?sync=1  → return secrets immediately (200)
    // - ?async=1 → return 202 and rotate in background (default behavior)
    const url = new URL(request.url);
    const forceSync = url.searchParams.get("sync") === "1";
    const forceAsync = url.searchParams.get("async") === "1";

    if (forceSync && !forceAsync) {
      const secrets = await secretsForRotation(
        params.installationId,
        params.resourceId,
      );
      return Response.json(
        {
          sync: true,
          secrets,
          partial: false,
        } satisfies RequestSecretsRotationResponse,
        {
          status: 200,
        },
      );
    }

    // Async: simulate asynchronous secret rotation process.
    waitUntil(rotateSecretsAsync(params.installationId, params.resourceId));

    return Response.json(
      {
        sync: false,
      } satisfies RequestSecretsRotationResponse,
      {
        status: 202,
      },
    );
  },
);

async function rotateSecretsAsync(installationId: string, resourceId: string) {
  const delayMs = 5000 + Math.random() * 5000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  console.log(
    "Asynchronous secret rotation completed for installationId:",
    installationId,
    "resourceId:",
    resourceId,
  );

  const secrets = await secretsForRotation(installationId, resourceId);
  await updateSecrets(installationId, resourceId, secrets);
}

async function secretsForRotation(
  installationId: string,
  resourceId: string,
): Promise<{ name: string; value: string }[]> {
  const resource = await getResource(installationId, resourceId);
  if (resource?.productId === APPWRITE_PRODUCT_ID) {
    const parsed = parseAppwriteMetadata(
      resource.metadata as Record<string, unknown>,
    );
    if (parsed.success) {
      return appwriteSecretsFromMetadata(parsed.data);
    }
  }
  const currentDate = new Date().toISOString();
  return [
    {
      name: "TOP_SECRET",
      value: `updated for rotation (${currentDate})`,
    },
  ];
}
