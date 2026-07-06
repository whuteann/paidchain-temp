export type PermissionRule = string | string[] | null;

const ROUTE_RULES: { match: (pathname: string) => boolean; permission: PermissionRule }[] = [
  { match: (pathname) => pathname === "/" || pathname === "/dashboard", permission: null },
  { match: (pathname) => pathname.startsWith("/customers"), permission: "Customers.View" },
  { match: (pathname) => pathname.startsWith("/merchants"), permission: "Merchants.View" },
  { match: (pathname) => pathname.startsWith("/referrals"), permission: "Referral Bonuses.View" },
  { match: (pathname) => pathname.startsWith("/terminals"), permission: "Terminals.View" },
  { match: (pathname) => pathname.startsWith("/simcards"), permission: "SIM Cards.View" },
  { match: (pathname) => pathname.startsWith("/jobs"), permission: "Jobs.View" },
  { match: (pathname) => pathname.startsWith("/rentals"), permission: "Rentals.View" },
  { match: (pathname) => pathname === "/paper-rolls", permission: "Paper Rolls.View" },
  { match: (pathname) => pathname === "/paper-roll-billing", permission: ["Paper Rolls.View", "Payouts.View"] },
  { match: (pathname) => pathname.startsWith("/payouts"), permission: "Payouts.View" },
  { match: (pathname) => pathname.startsWith("/referral-bonus-batches"), permission: "Referral Bonuses.View" },
  { match: (pathname) => pathname === "/mdr", permission: "Settings.View" },
  { match: (pathname) => pathname === "/rental-plans", permission: "Settings.View" },
  { match: (pathname) => pathname === "/settings", permission: "Settings.View" },
  { match: (pathname) => pathname === "/users", permission: "Users.View" },
  { match: (pathname) => pathname === "/audit-logs", permission: "Audit Logs.View" },
];

export const APP_ENTRY_PATHS = [
  "/dashboard",
  "/customers",
  "/merchants",
  "/referrals",
  "/terminals",
  "/simcards",
  "/jobs",
  "/rentals",
  "/paper-rolls",
  "/paper-roll-billing",
  "/payouts",
  "/referral-bonus-batches",
  "/mdr",
  "/rental-plans",
  "/settings",
  "/users",
  "/audit-logs",
];

export function getRequiredPermission(pathname: string): PermissionRule {
  return ROUTE_RULES.find((rule) => rule.match(pathname))?.permission ?? null;
}

export function hasRequiredPermission(permissions: string[], rule: PermissionRule): boolean {
  if (!rule) return true;
  if (Array.isArray(rule)) return rule.some((permission) => permissions.includes(permission));
  return permissions.includes(rule);
}

export function canAccessPath(pathname: string, permissions: string[], devMode = false): boolean {
  if (devMode) return true;
  return hasRequiredPermission(permissions, getRequiredPermission(pathname));
}

export function getFirstAllowedPath(permissions: string[], devMode = false): string {
  return APP_ENTRY_PATHS.find((path) => canAccessPath(path, permissions, devMode)) ?? "/dashboard";
}
