import { env } from "@/lib/env";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to the Appwrite integration provider dashboard via Vercel.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const returnToRaw = firstParam(searchParams.returnTo);
  const returnTo =
    returnToRaw?.startsWith("/") && !returnToRaw.startsWith("//")
      ? returnToRaw
      : "/dashboard";

  const slug = env.VERCEL_INTEGRATION_SLUG?.trim();
  const installHref = slug
    ? `https://vercel.com/integrations/${encodeURIComponent(slug)}/new`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400/90">
          Session required
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Sign in through Vercel
        </h1>
        <p className="mt-4 text-slate-400">
          The provider dashboard uses Vercel Marketplace SSO. Your session
          starts when you open this app from the Vercel dashboard (for example{" "}
          <strong>Open in [provider]</strong> on your integration or resource).
        </p>
        <p className="mt-4 text-sm text-slate-500">
          After you complete SSO, you will land on{" "}
          <code className="text-slate-400">/callback</code> and then can open{" "}
          <code className="text-slate-400">{returnTo}</code>.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100"
            href="/"
          >
            Back to home
          </Link>
          {installHref ? (
            <a
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/50"
              href={installHref}
              rel="noopener noreferrer"
            >
              Install on Vercel
            </a>
          ) : null}
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/50"
            href="https://vercel.com/docs/integrations/create-integration/marketplace-api#vercel-initiated-sso"
            rel="noopener noreferrer"
            target="_blank"
          >
            SSO docs
          </Link>
        </div>
      </div>
    </div>
  );
}
