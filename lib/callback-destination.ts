/**
 * Dashboard path after Vercel SSO returns to `/callback` with the same query params.
 */
export function computeDashboardDestination(
  searchParams: URLSearchParams,
): string {
  const resourceId = searchParams.get("resource_id");
  const projectId = searchParams.get("project_id");
  const invoiceId = searchParams.get("invoice_id");
  const checkId = searchParams.get("check_id");

  if (invoiceId) {
    return `/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`;
  }

  if (searchParams.get("support")) {
    return `/dashboard/support${resourceId ? `?resource_id=${encodeURIComponent(resourceId)}` : ""}`;
  }

  if (resourceId) {
    if (projectId) {
      if (checkId) {
        return `/dashboard/resources/${encodeURIComponent(resourceId)}/projects/${encodeURIComponent(projectId)}?checkId=${encodeURIComponent(checkId)}`;
      }
      return `/dashboard/resources/${encodeURIComponent(resourceId)}/projects/${encodeURIComponent(projectId)}`;
    }
    return `/dashboard/resources/${encodeURIComponent(resourceId)}`;
  }

  return "/dashboard";
}
