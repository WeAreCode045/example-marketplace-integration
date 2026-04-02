import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Signed in",
  description: "Vercel Marketplace SSO callback completed.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default function CallbackCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const error = firstParam(searchParams.error);
  const nextRaw = firstParam(searchParams.next);

  if (error === "missing_code") {
    return (
      <CallbackShell variant="error" title="Missing authorization code">
        <p>
          This page is opened by Vercel after you sign in. Open it from the
          Vercel dashboard (&quot;Open in provider&quot;) or your integration
          install flow.
        </p>
        <FooterLink href="/">Back to home</FooterLink>
      </CallbackShell>
    );
  }

  if (error === "sso_failed") {
    return (
      <CallbackShell variant="error" title="Sign-in could not be completed">
        <p>
          The SSO token exchange failed. Try again from Vercel, or confirm{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
            INTEGRATION_CLIENT_ID
          </code>{" "}
          and{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
            INTEGRATION_CLIENT_SECRET
          </code>{" "}
          match your Integrations Console.
        </p>
        <FooterLink href="/">Back to home</FooterLink>
      </CallbackShell>
    );
  }

  const nextPath = nextRaw?.startsWith("/") ? nextRaw : "/dashboard";

  return (
    <CallbackShell variant="success" title="You’re signed in">
      <p className="text-slate-400">
        Your session is active. Continue to the provider dashboard or return
        home.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          href={nextPath}
        >
          Continue to dashboard
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/50"
          href="/"
        >
          Home
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-600">
        Destination:{" "}
        <code className="break-all text-slate-500">{nextPath}</code>
      </p>
    </CallbackShell>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function CallbackShell({
  variant,
  title,
  children,
}: {
  variant: "success" | "error";
  title: string;
  children: ReactNode;
}) {
  const accent =
    variant === "success"
      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
      : "border-amber-500/40 bg-amber-950/20 text-amber-200";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <div
          className={`rounded-xl border px-4 py-2 text-center text-xs font-medium uppercase tracking-wider ${accent}`}
        >
          {variant === "success" ? "SSO complete" : "Something went wrong"}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-400">
          {children}
        </div>
      </div>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="mt-6 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
      href={href}
    >
      {children}
    </Link>
  );
}
