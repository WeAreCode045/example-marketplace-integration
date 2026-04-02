# Appwrite native Vercel Marketplace integration

This repository implements the **Vercel Marketplace Partner API** for a bring-your-own-key (BYOK) Appwrite connection. When a customer creates a resource, Vercel sends your server the Appwrite endpoint, project ID, database ID, and API key; your server validates them, ensures an **Appwrite Auth user** exists for the installing Vercel user with an **`admin` label**, and returns **secrets** that become environment variables on the connected Vercel project.

**Deployed integration server (production):** `https://vercel-appwrite.vercel.app` (no trailing slash on **Base URL** in the console).

## Vercel Integrations Console (manual steps)

1. Create a **native** integration and a **product** with product slug **`appwrite`** (or set `APPWRITE_PRODUCT_ID` on this server to match your slug).
2. Set **Base URL** to `https://vercel-appwrite.vercel.app` (or your deployment’s origin; no trailing path).
3. Set **Redirect Login URL** to `https://vercel-appwrite.vercel.app/callback` (see `app/callback/route.ts`). After SSO, users are redirected to **`/callback/complete`** for a short confirmation page, then they can open the dashboard.
4. Add **Webhook URL** if you use installation webhooks (`app/webhook/route.ts`).
5. In the product, set **Metadata schema** to the JSON in [`public/appwrite-metadata-schema.json`](public/appwrite-metadata-schema.json) (or merge those `properties` / `required` into the full schema shape required by the console UI).
6. Define a **billing plan** with id **`appwrite-byok`** (free / no payment method required). The Partner code only exposes this plan.
7. Add **Product snippets** (suggested below) so users install `node-appwrite` in their own repo—Vercel does not modify customer repositories.

### Environment variables (this integration’s Vercel project)

| Variable | Purpose |
| -------- | ------- |
| `INTEGRATION_CLIENT_ID` | From Integrations Console |
| `INTEGRATION_CLIENT_SECRET` | From Integrations Console |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis (installation + resource state) |
| `APPWRITE_PRODUCT_ID` | Optional; default `appwrite` — must match product slug |
| `APPWRITE_ADMIN_LABEL` | Optional; default `admin` — Appwrite user label for installers |
| `VERCEL_INTEGRATION_SLUG` | Optional; **URL slug** from Integrations Console — enables **Install on Vercel** on the deployed home page at `/` (`https://vercel.com/integrations/{slug}/new`) |
| `CRON_SECRET` | Optional; for billing cron routes |

## Installer identity (`user_email` and fallback)

Provisioning uses the Marketplace **user JWT**. If Vercel enables the optional **`user_email`** claim for your integration, email resolution is reliable. Otherwise the server calls Vercel’s **`GET /v1/installations/{installationId}/member/{user_id}`** using the installation access token stored at install time.

If neither yields an email, provisioning returns **400** with a clear message. **Contact Vercel** to opt in to `user_email` on the JWT for the best experience.

## Appwrite API key scopes

Create a **server** API key in Appwrite with at least:

- **Users — Read**
- **Users — Write**

Exact names depend on your Appwrite version; without these, `users.list` / `users.create` / `users.updateLabels` will fail.

## Admin user behavior

- Appwrite does not have a built-in “admin” role on users. This integration applies a **label** (default `admin`). Your application should treat users with that label as administrators (see [Appwrite labels](https://appwrite.io/docs/products/auth/users#labels)).
- If a user with the same email already exists, the integration **adds** the admin label and does not create a duplicate.
- A **random password** is set on user creation. The installer should use **Appwrite password recovery** (forgot password) or your console to sign in the first time. The password is **not** returned to Vercel or stored in Redis.

## Environment variables injected into the customer’s Vercel project

When the resource is connected, these secrets are created:

| Name | Description |
| ---- | ----------- |
| `APPWRITE_ENDPOINT` | API base URL |
| `APPWRITE_PROJECT_ID` | Appwrite project ID |
| `APPWRITE_DATABASE_ID` | Database ID |
| `APPWRITE_API_KEY` | Server API key |

**Redeploy:** Updating secrets does not trigger a new deployment; customers should redeploy after changing credentials.

## Suggested product snippets

**Install**

```bash
npm install node-appwrite
```

**Server client (Node)**

```typescript
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const databases = new Databases(client);
```

**Next.js route handler**

```typescript
import { Client, Databases } from "node-appwrite";
import { NextResponse } from "next/server";

export async function GET() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  const db = new Databases(client);
  // …
  return NextResponse.json({ ok: true });
}
```

Replace snippet placeholders with `process.env.APPWRITE_*` as shown; the Vercel dashboard can mask secrets in snippets when using `{{process.env.VAR}}` patterns per Vercel docs.
