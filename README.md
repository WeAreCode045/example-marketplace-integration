# Vercel Marketplace integration — Appwrite (BYOK)

Native Marketplace Partner server that connects a customer’s **Appwrite** project to Vercel: collect endpoint, project ID, database ID, and API key; inject **`APPWRITE_*`** environment variables; and create or label an **Appwrite Auth** user for the installing Vercel account with the **`admin`** label (configurable).

Forked from [vercel/example-marketplace-integration](https://github.com/vercel/example-marketplace-integration). See **[DOCUMENTATION.md](./DOCUMENTATION.md)** for Integrations Console setup, metadata schema, JWT `user_email` opt-in, Appwrite scopes, and product snippets.

## Quick setup

1. Deploy this app to Vercel and add **Upstash Redis** so `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set (same as the upstream example).
2. In the [Integrations Console](https://vercel.com/dashboard/integrations/console), create a **native** integration and set **Base URL** and **Redirect Login URL** (`/callback`).
3. Create a product with slug **`appwrite`** (or set env **`APPWRITE_PRODUCT_ID`** to your slug).
4. Paste the metadata schema from [`public/appwrite-metadata-schema.json`](./public/appwrite-metadata-schema.json) into the product’s metadata schema field (adjust to match the console’s expected wrapper if needed).
5. Add a billing plan with id **`appwrite-byok`** (free, no payment method).

Required env vars: `INTEGRATION_CLIENT_ID`, `INTEGRATION_CLIENT_SECRET`, Redis KV variables. Optional: `APPWRITE_PRODUCT_ID`, `APPWRITE_ADMIN_LABEL`, `CRON_SECRET`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)
