/** URL map for FindrYU. Later phases add pages at these paths. */
export const routes = {
  home: "/",
  login: "/login",
  authCallback: "/auth/callback",
  authConfirm: "/auth/confirm",
  search: "/search",
  report: "/report",
  reportSuccess: "/report/success",
  my: "/my",
  lostReportNew: "/lost-reports/new",
  staff: "/staff",
  staffIntake: "/staff/intake",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminSettings: "/admin/settings",
  adminLocations: "/admin/locations",
  adminBuildings: "/admin/buildings",
  adminCategories: "/admin/categories",
  adminArchived: "/admin/archived",
  adminAudit: "/admin/audit",
} as const;

export function itemPath(ref: string) {
  return `/items/${ref}`;
}

export function itemClaimPath(ref: string) {
  return `/items/${ref}/claim`;
}

export function lostReportEditPath(id: string) {
  return `/lost-reports/${id}/edit`;
}

export function staffItemPath(id: string) {
  return `/staff/items/${id}`;
}

export function staffClaimPath(id: string) {
  return `/staff/claims/${id}`;
}

export function isAdminPath(pathname: string) {
  return pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);
}

export function isStaffPath(pathname: string) {
  return pathname === routes.staff || pathname.startsWith(`${routes.staff}/`);
}

export function isStaffOrAdminPath(pathname: string) {
  return isStaffPath(pathname) || isAdminPath(pathname);
}

/** Keeps post-login redirects on this site. */
export function safeNextPath(value: string | null | undefined) {
  if (!value) {
    return routes.home;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return routes.home;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\") ||
    decoded.includes("://")
  ) {
    return routes.home;
  }

  return decoded;
}
