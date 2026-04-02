import { fetchVercelApi } from "./api";

export async function putInstallationResourceSecrets(
  installationId: string,
  resourceId: string,
  secrets: { name: string; value: string }[],
): Promise<void> {
  await fetchVercelApi(
    `/v1/installations/${installationId}/resources/${resourceId}/secrets`,
    {
      installationId,
      method: "PUT",
      data: { secrets },
    },
  );
}
