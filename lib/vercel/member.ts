import { fetchVercelApi } from "./api";

export type InstallationMember = {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  createdAt?: string;
};

/**
 * @see https://vercel.com/docs/integrations/create-integration/marketplace-api#working-with-member-information
 */
export async function getInstallationMember(
  installationId: string,
  memberId: string,
): Promise<InstallationMember> {
  return fetchVercelApi(
    `/v1/installations/${installationId}/member/${encodeURIComponent(memberId)}`,
    { installationId, method: "GET" },
  ) as Promise<InstallationMember>;
}
