import type { OidcClaims } from "@/lib/vercel/auth";
import { getInstallationMember } from "@/lib/vercel/member";

export type InstallerIdentity = {
  email: string;
  name: string;
};

/**
 * Prefer OIDC `user_email` when Vercel has enabled it for your integration.
 * Otherwise fall back to GET /v1/installations/{id}/member/{memberId} using the installation access token.
 */
export async function resolveInstallerIdentity(
  claims: OidcClaims & { user_email?: string },
  installationId: string,
): Promise<InstallerIdentity | null> {
  const emailFromJwt =
    typeof claims.user_email === "string" && claims.user_email.includes("@")
      ? claims.user_email.trim()
      : undefined;

  if (emailFromJwt) {
    return {
      email: emailFromJwt,
      name:
        typeof claims.user_name === "string" && claims.user_name.trim()
          ? claims.user_name.trim()
          : emailFromJwt.split("@")[0]!,
    };
  }

  try {
    const member = await getInstallationMember(installationId, claims.user_id);
    if (member.email?.includes("@")) {
      return {
        email: member.email.trim(),
        name:
          member.name?.trim() || member.email.split("@")[0] || "Vercel user",
      };
    }
  } catch {
    // Member lookup failed (token scope, wrong id format, etc.)
  }

  return null;
}
