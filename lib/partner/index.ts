import {
  appwriteSecretsFromMetadata,
  parseAppwriteMetadata,
} from "@/lib/appwrite/metadata";
import {
  ensureAppwriteAdminUser,
  formatAppwriteError,
} from "@/lib/appwrite/sync-admin-user";
import { resolveInstallerIdentity } from "@/lib/identity/resolve-installer";
import type { OidcClaims } from "@/lib/vercel/auth";
import { putInstallationResourceSecrets } from "@/lib/vercel/resource-secrets";
import type {
  Balance,
  BillingPlan,
  GetBillingPlansResponse,
  GetResourceResponse,
  InstallIntegrationRequest,
  ListResourcesResponse,
  Notification,
  ProvisionPurchaseRequest,
  ProvisionPurchaseResponse,
  ProvisionResourceRequest,
  ProvisionResourceResponse,
  Resource,
  ResourceStatusType,
  Claim as TransferRequest,
  UnknownWebhookEvent,
  UpdateResourceRequest,
  UpdateResourceResponse,
  WebhookEvent,
} from "@/lib/vercel/schemas";
import { compact } from "lodash";
import { nanoid } from "nanoid";
import { env } from "../env";
import { kv } from "../redis";
import {
  getInvoice,
  importResource as importResourceToVercelApi,
} from "../vercel/marketplace-api";

const APPWRITE_PRODUCT_ID = env.APPWRITE_PRODUCT_ID ?? "appwrite";
const APPWRITE_ADMIN_LABEL = env.APPWRITE_ADMIN_LABEL ?? "admin";

const IDEMPOTENCY_TTL_SEC = 60 * 60 * 24 * 7;

export class ProvisionRejectedError extends Error {
  readonly httpStatus: 400;
  readonly payload: {
    code: string;
    message: string;
    user?: { message: string };
    fields?: { key: string; message: string }[];
  };

  constructor(
    httpStatus: 400,
    payload: {
      code: string;
      message: string;
      user?: { message: string };
      fields?: { key: string; message: string }[];
    },
  ) {
    super(payload.message);
    this.name = "ProvisionRejectedError";
    this.httpStatus = httpStatus;
    this.payload = payload;
  }
}

const billingPlans: BillingPlan[] = [
  {
    id: "appwrite-byok",
    scope: "resource",
    name: "Appwrite (BYOK)",
    cost: "Free",
    description:
      "Connect your Appwrite project. Credentials are synced to your Vercel project as environment variables.",
    type: "subscription",
    paymentMethodRequired: false,
    details: [
      { label: "Billing", value: "Managed in Appwrite / your host" },
      {
        label: "Credentials",
        value: "Stored as Vercel env vars when connected",
      },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
];

const billingPlanMap = new Map(billingPlans.map((plan) => [plan.id, plan]));

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest & { type: "marketplace" | "external" },
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, request);
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.lpush("installations", installationId);
  await pipeline.exec();
}

export async function updateInstallation(
  installationId: string,
  billingPlanId: string,
): Promise<void> {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, { ...installation, billingPlanId });
  await pipeline.exec();
}

export async function uninstallInstallation(
  installationId: string,
): Promise<{ finalized: boolean } | undefined> {
  const installation = await getInstallation(installationId);
  if (!installation || installation.deletedAt) {
    return undefined;
  }
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, {
    ...installation,
    deletedAt: Date.now(),
  });
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.exec();

  // Installation is finalized immediately if it's on a free plan.
  const billingPlan = billingPlanMap.get(installation.billingPlanId);
  return { finalized: billingPlan?.paymentMethodRequired === false };
}

export async function listInstallations(): Promise<string[]> {
  const installationIds = await kv.lrange("installations", 0, -1);
  return installationIds;
}

export async function provisionResource(
  installationId: string,
  request: ProvisionResourceRequest,
  opts?: {
    status?: ResourceStatusType;
    installer?: OidcClaims;
    idempotencyKey?: string | null;
  },
): Promise<ProvisionResourceResponse> {
  if (request.productId !== APPWRITE_PRODUCT_ID) {
    throw new ProvisionRejectedError(400, {
      code: "validation_error",
      message: `Unknown product: ${request.productId}`,
      user: {
        message: `This integration only supports product "${APPWRITE_PRODUCT_ID}". Match the Product URL slug in the Integrations Console.`,
      },
    });
  }

  const billingPlan = billingPlanMap.get(request.billingPlanId);
  if (!billingPlan) {
    throw new ProvisionRejectedError(400, {
      code: "validation_error",
      message: `Unknown billing plan: ${request.billingPlanId}`,
      user: { message: "Select the Appwrite (BYOK) plan." },
    });
  }

  const parsed = parseAppwriteMetadata(
    request.metadata as Record<string, unknown>,
  );
  if (!parsed.success) {
    throw new ProvisionRejectedError(400, {
      code: "validation_error",
      message: "Invalid Appwrite configuration",
      fields: parsed.fieldErrors,
    });
  }

  const idempKey = opts?.idempotencyKey?.trim();
  if (idempKey) {
    const existingId = await kv.get<string>(
      `idemp:${installationId}:${idempKey}`,
    );
    if (existingId) {
      const existing = await getResource(installationId, existingId);
      if (existing) {
        const again = parseAppwriteMetadata(
          existing.metadata as Record<string, unknown>,
        );
        if (again.success) {
          return {
            ...existing,
            secrets: appwriteSecretsFromMetadata(again.data),
          };
        }
      }
    }
  }

  if (opts?.installer) {
    const identity = await resolveInstallerIdentity(
      opts.installer,
      installationId,
    );
    if (!identity) {
      throw new ProvisionRejectedError(400, {
        code: "validation_error",
        message: "Could not resolve installer email",
        user: {
          message:
            "Verified email was not available. Ask Vercel to enable the user_email claim on Marketplace JWTs for this integration, or ensure member lookup works for your installation token.",
        },
      });
    }

    try {
      await ensureAppwriteAdminUser(
        parsed.data,
        identity.email,
        identity.name,
        APPWRITE_ADMIN_LABEL,
      );
    } catch (e) {
      const msg = formatAppwriteError(e);
      throw new ProvisionRejectedError(400, {
        code: "validation_error",
        message: msg,
        user: {
          message: `Appwrite rejected the request. Check endpoint, project ID, API key scopes (users.read, users.write), and that the API key is valid. Details: ${msg}`,
        },
      });
    }
  }

  const resource = {
    id: nanoid(),
    status: opts?.status ?? "ready",
    name: request.name,
    billingPlan,
    metadata: request.metadata,
    productId: request.productId,
  } satisfies Resource;

  await kv.set(
    `${installationId}:resource:${resource.id}`,
    serializeResource(resource),
  );
  await kv.lpush(`${installationId}:resources`, resource.id);
  await updateInstallation(installationId, request.billingPlanId);

  if (idempKey) {
    await kv.set(`idemp:${installationId}:${idempKey}`, resource.id, {
      ex: IDEMPOTENCY_TTL_SEC,
    });
  }

  return {
    ...resource,
    secrets: appwriteSecretsFromMetadata(parsed.data),
  };
}

export async function updateResource(
  installationId: string,
  resourceId: string,
  request: UpdateResourceRequest,
): Promise<UpdateResourceResponse> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const { billingPlanId, metadata: patchMetadata, ...updatedFields } = request;

  const nextResource = {
    ...resource,
    ...updatedFields,
    ...(patchMetadata !== undefined
      ? {
          metadata: {
            ...(resource.metadata as object),
            ...(patchMetadata as object),
          },
        }
      : {}),
    billingPlan: billingPlanId
      ? (billingPlanMap.get(billingPlanId) ?? resource.billingPlan)
      : resource.billingPlan,
  };

  await kv.set(
    `${installationId}:resource:${resourceId}`,
    serializeResource(nextResource),
  );

  if (nextResource.productId === APPWRITE_PRODUCT_ID) {
    const meta = parseAppwriteMetadata(
      nextResource.metadata as Record<string, unknown>,
    );
    if (meta.success) {
      try {
        await putInstallationResourceSecrets(
          installationId,
          resourceId,
          appwriteSecretsFromMetadata(meta.data),
        );
      } catch (e) {
        console.error("putInstallationResourceSecrets after update failed", e);
      }
    }
  }

  return nextResource;
}

export async function transferResource(
  installationId: string,
  resourceId: string,
  targetInstallationId: string,
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await kv.set(
    `${targetInstallationId}:resource:${resourceId}`,
    serializeResource(resource),
  );
  await kv.del(`${installationId}:resource:${resourceId}`);
}

export async function updateResourceNotification(
  installationId: string,
  resourceId: string,
  notification?: Notification,
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await kv.set(
    `${installationId}:resource:${resourceId}`,
    serializeResource({
      ...resource,
      notification,
    }),
  );
}

export async function clearResourceNotification(
  installationId: string,
  resourceId: string,
): Promise<void> {
  await updateResourceNotification(installationId, resourceId);
}

export async function deleteResource(
  installationId: string,
  resourceId: string,
): Promise<void> {
  const pipeline = kv.pipeline();
  pipeline.del(`${installationId}:resource:${resourceId}`);
  pipeline.lrem(`${installationId}:resources`, 0, resourceId);
  await pipeline.exec();
}

export async function listResources(
  installationId: string,
  targetResourceIds?: string[],
): Promise<ListResourcesResponse> {
  const resourceIds = targetResourceIds?.length
    ? targetResourceIds
    : await kv.lrange(`${installationId}:resources`, 0, -1);

  if (resourceIds.length === 0) {
    return { resources: [] };
  }

  const pipeline = kv.pipeline();

  for (const resourceId of resourceIds) {
    pipeline.get(`${installationId}:resource:${resourceId}`);
  }

  const resources = await pipeline.exec<SerializedResource[]>();

  return {
    resources: compact(resources).map(deserializeResource),
  };
}

export async function getResource(
  installationId: string,
  resourceId: string,
): Promise<GetResourceResponse | null> {
  const resource = await kv.get<SerializedResource>(
    `${installationId}:resource:${resourceId}`,
  );

  if (resource) {
    return deserializeResource(resource);
  }

  return null;
}

export async function cloneResource(
  installationId: string,
  resourceId: string,
) {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const newName = `${resource.name}-clone`;

  const clonedResource = await provisionResource(installationId, {
    productId: resource.productId,
    name: newName,
    metadata: resource.metadata,
    billingPlanId: resource.billingPlan?.id || "",
  });
  return clonedResource;
}

export async function importResourceToVercel(
  installationId: string,
  resourceId: string,
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const secrets =
    resource.productId === APPWRITE_PRODUCT_ID
      ? (() => {
          const m = parseAppwriteMetadata(
            resource.metadata as Record<string, unknown>,
          );
          return m.success ? appwriteSecretsFromMetadata(m.data) : [];
        })()
      : [
          {
            name: "TOP_SECRET",
            value: `legacy-import (${new Date().toISOString()})`,
          },
        ];

  await importResourceToVercelApi(installationId, resource.id, {
    name: resource.name,
    productId: resource.productId,
    status: resource.status,
    metadata: resource.metadata,
    billingPlan: resource.billingPlan,
    notification: resource.notification,
    secrets,
  });
}

export async function provisionPurchase(
  installationId: string,
  request: ProvisionPurchaseRequest,
): Promise<ProvisionPurchaseResponse> {
  const invoice = await getInvoice(installationId, request.invoiceId);
  if (invoice.state !== "paid") {
    throw new Error(`Invoice ${request.invoiceId} is not paid`);
  }

  const balances: Record<string, Balance> = {};

  for (const item of invoice.items ?? []) {
    const amountInCents = Math.floor(Number.parseFloat(item.total) * 100);
    if (item.resourceId) {
      const balance = await addResourceBalanceInternal(
        installationId,
        item.resourceId,
        amountInCents,
      );
      balances[item.resourceId] = balance;
    } else {
      const balance = await addInstallationBalanceInternal(
        installationId,
        amountInCents,
      );
      balances[""] = balance;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    balances: Object.values(balances),
  };
}

export async function addInstallationBalanceInternal(
  installationId: string,
  currencyValueInCents: number,
): Promise<Balance> {
  const result = await kv.incrby(
    `${installationId}:balance`,
    currencyValueInCents,
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
  };
}

export async function getInstallationBalance(
  installationId: string,
): Promise<Balance | null> {
  const result = await kv.get<number>(`${installationId}:balance`);
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
  };
}

export async function addResourceBalanceInternal(
  installationId: string,
  resourceId: string,
  currencyValueInCents: number,
): Promise<Balance> {
  const result = await kv.incrby(
    `${installationId}:${resourceId}:balance`,
    currencyValueInCents,
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
    resourceId,
  };
}

export async function getResourceBalance(
  installationId: string,
  resourceId: string,
): Promise<Balance | null> {
  const result = await kv.get<number>(
    `${installationId}:${resourceId}:balance`,
  );
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
    resourceId,
  };
}

type SerializedResource = Omit<Resource, "billingPlan"> & {
  billingPlan: string;
};

function serializeResource(resource: Resource): SerializedResource {
  return { ...resource, billingPlan: resource.billingPlan.id };
}

function deserializeResource(serializedResource: SerializedResource): Resource {
  const billingPlan = billingPlanMap.get(serializedResource.billingPlan) ?? {
    id: serializedResource.billingPlan,
    scope: "resource",
    type: "subscription",
    name: "Unknown",
    description: "Unknown",
    paymentMethodRequired: false,
  };
  return { ...serializedResource, billingPlan };
}

export async function getAllBillingPlans(
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>,
): Promise<GetBillingPlansResponse> {
  return {
    plans: billingPlans,
  };
}

export async function getInstallationBillingPlans(
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>,
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getProductBillingPlans(
  _productId: string,
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>,
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getResourceBillingPlans(
  _installationId: string,
  _resourceId: string,
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getInstallation(installationId: string): Promise<
  InstallIntegrationRequest & {
    type: "marketplace" | "external";
    billingPlanId: string;
    deletedAt?: number;
    notification?: Notification;
  }
> {
  const installation = await kv.get<
    InstallIntegrationRequest & {
      type: "marketplace" | "external";
      billingPlanId: string;
      deletedAt?: number;
      notification?: Notification;
    }
  >(installationId);

  if (!installation) {
    throw new Error(`Installation '${installationId}' not found`);
  }

  return installation;
}

export async function setInstallationNotification(
  installationId: string,
  notification: Notification | undefined | null,
): Promise<void> {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, {
    ...installation,
    notification: notification ?? undefined,
  });
  await pipeline.exec();
}

export async function storeWebhookEvent(
  event: WebhookEvent | UnknownWebhookEvent,
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.lpush("webhook_events", event);
  await pipeline.ltrim("webhook_events", 0, 100);
  await pipeline.exec();
}

export async function getWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
  return (await kv.lrange<WebhookEvent>("webhook_events", 0, limit)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export async function getTransferRequest(
  transferId: string,
): Promise<TransferRequest | null> {
  return await kv.get<TransferRequest>(`transfer-request:${transferId}`);
}

export async function setTransferRequest(
  transferRequest: TransferRequest,
): Promise<"OK" | TransferRequest | null> {
  return kv.set<TransferRequest>(
    `transfer-request:${transferRequest.transferId}`,
    transferRequest,
  );
}

export async function deleteTransferRequest(
  transferRequest: TransferRequest,
): Promise<number> {
  return kv.del(`transfer-request:${transferRequest.transferId}`);
}
