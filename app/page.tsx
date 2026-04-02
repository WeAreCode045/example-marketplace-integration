import { env } from "@/lib/env";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Appwrite for Vercel",
  description:
    "Connect Appwrite to your Vercel projects. Install the integration from the Vercel Marketplace.",
};

export default function HomePage() {
  const slug = env.VERCEL_INTEGRATION_SLUG?.trim();
  const installHref = slug
    ? `https://vercel.com/integrations/${encodeURIComponent(slug)}/new`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
        <header className="mb-12">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400/90">
            Marketplace integration
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Appwrite on Vercel
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-400">
            Install once, then connect Appwrite to your team or project. Your
            endpoint, project ID, database ID, and API key sync as environment
            variables, and your Vercel account gets an Appwrite user with the
            admin label.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-8 shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-medium text-white">
            Install the integration
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            You will sign in with Vercel, pick a team or scope, and complete
            setup in the dashboard. After install, create an Appwrite resource
            and connect it to a project to receive{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-emerald-200">
              APPWRITE_*
            </code>{" "}
            env vars.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            {installHref ? (
              <a
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                href={installHref}
                rel="noopener noreferrer"
              >
                Install on Vercel
              </a>
            ) : (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
                Set{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                  VERCEL_INTEGRATION_SLUG
                </code>{" "}
                on this deployment to your integration&apos;s{" "}
                <strong>URL slug</strong> from the Vercel Integrations Console
                (not the <code className="text-xs">oac_</code> id). Then
                redeploy to enable the install button.
              </div>
            )}
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/50"
              href="https://vercel.com/docs/integrations/install-an-integration/product-integration"
              rel="noopener noreferrer"
              target="_blank"
            >
              How Vercel installs work
            </Link>
          </div>

          {installHref ? (
            <p className="mt-4 text-xs text-slate-500">
              Opens{" "}
              <span className="break-all font-mono text-slate-400">
                {installHref}
              </span>
            </p>
          ) : null}
        </section>

        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
            <h3 className="font-medium text-white">What you need</h3>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-400">
              <li>
                Appwrite API endpoint (with{" "}
                <code className="text-slate-300">/v1</code>)
              </li>
              <li>Project ID, database ID, server API key</li>
              <li>API key with users read/write for admin bootstrap</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
            <h3 className="font-medium text-white">Provider dashboard</h3>
            <p className="mt-3 text-sm text-slate-400">
              After installing, open your resource from Vercel or use SSO to
              manage installations here.
            </p>
            <Link
              className="mt-4 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
              href="/dashboard"
            >
              Go to dashboard →
            </Link>
          </div>
        </section>

        <footer className="mt-auto pt-16 text-center text-xs text-slate-600">
          See repository{" "}
          <code className="text-slate-500">DOCUMENTATION.md</code> for console
          setup and env vars. Slug for installs:{" "}
          <code className="text-slate-500">{slug ?? "not configured"}</code>
        </footer>
      </div>
    </div>
  );
}
