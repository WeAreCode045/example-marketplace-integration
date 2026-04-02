import {
  ProvisionRejectedError,
  listResources,
  provisionResource,
} from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import {
  type ResourceStatusType,
  provisionResourceRequestSchema,
} from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (claims, request) => {
  const ids = request.nextUrl.searchParams.getAll("ids");
  const resources = await listResources(claims.installation_id, ids);
  return Response.json(resources);
});

export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    provisionResourceRequestSchema,
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  const initialStatus = requestBody.data.metadata?.testing_initial_status as
    | ResourceStatusType
    | undefined;

  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    request.headers.get("Idempotency-Key");

  try {
    const resource = await provisionResource(
      claims.installation_id,
      requestBody.data,
      {
        status: initialStatus,
        installer: claims,
        idempotencyKey,
      },
    );

    return Response.json(resource, {
      status: 201,
    });
  } catch (e) {
    if (e instanceof ProvisionRejectedError) {
      return Response.json({ error: e.payload }, { status: e.httpStatus });
    }
    throw e;
  }
});
