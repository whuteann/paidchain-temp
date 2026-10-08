/* Bumipay — app shell: sidebar + topbar */
import { useEffect, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { Icon } from "./icons";
import { logout, setDevMode } from "@/store/authSlice";
import { setNavCounts } from "@/store/navCountsSlice";
import type { AppDispatch, RootState } from "@/store";
import { canAccessPath } from "@/lib/permissions";
import { api } from "@/lib/api";

export type Route = "dashboard" | "customers" | "customer-detail" | "merchants" | "merchant-detail" | "referrals" | "referral-detail" | "terminals" | "terminal-detail" | "simcards" | "simcard-detail" | "jobs" | "job-detail" | "rentals" | "rental-detail" | "paper-rolls" | "paper-roll-billing" | "profit-shares" | "profit-share-detail" | "referral-bonus-batches" | "referral-bonus-batch-detail" | "mdr" | "rental-plans" | "settings" | "users" | "audit-logs" | "payouts" | "payout-detail" | "change-password";
export type NavFn = (to: Route, param?: string) => void;

const NAV = [
  { group: "", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  ]},
  { group: "Operations", items: [
    { id: "customers",   label: "Customers", icon: "building" },
    { id: "merchants",   label: "Merchants", icon: "merchants", badge: true },
    { id: "referrals",   label: "Referrals", icon: "link" },
    { id: "jobs",        label: "Jobs",      icon: "jobs",      badge: true },
  ]},
  { group: "Inventory", items: [
    { id: "terminals",   label: "Terminals",   icon: "terminal", badge: true },
    { id: "simcards",    label: "SIM Cards",   icon: "phone" },
    { id: "paper-rolls", label: "Paper Rolls", icon: "receipt" },
  ]},
  { group: "Finance", items: [
    { id: "rentals",              label: "Rentals",             icon: "calendar" },
    { id: "profit-shares",     label: "Profit Shares",       icon: "cash" },
    { id: "referral-bonus-batches", label: "Referral Bonuses", icon: "cash" },
    { id: "paper-roll-billing",  label: "PR Billing",          icon: "receipt" },
    { id: "mdr",                 label: "MDR Rates",           icon: "percent" },
    { id: "rental-plans",       label: "Rental Plans",        icon: "tag" },
  ]},
  { group: "Configuration", items: [
    { id: "settings",    label: "Settings",     icon: "tag" },
    { id: "users",       label: "Users & Roles", icon: "users" },
    { id: "audit-logs",  label: "Audit Logs",   icon: "activity" },
  ]},
];

const NAV_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  customers: "/customers",
  merchants: "/merchants",
  referrals: "/referrals",
  terminals: "/terminals",
  simcards: "/simcards",
  jobs: "/jobs",
  rentals: "/rentals",
  "paper-rolls": "/paper-rolls",
  "paper-roll-billing": "/paper-roll-billing",
  "profit-shares": "/profit-shares",
  "referral-bonus-batches": "/referral-bonus-batches",
  mdr: "/mdr",
  "rental-plans": "/rental-plans",
  settings: "/settings",
  users: "/users",
  "audit-logs": "/audit-logs",
  "change-password": "/change-password",
};

function getActiveFromPath(pathname: string): string {
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/merchants")) return "merchants";
  if (pathname.startsWith("/referrals")) return "referrals";
  if (pathname.startsWith("/terminals")) return "terminals";
  if (pathname.startsWith("/simcards")) return "simcards";
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/rentals")) return "rentals";
  if (pathname === "/paper-rolls") return "paper-rolls";
  if (pathname === "/paper-roll-billing") return "paper-roll-billing";
  if (pathname.startsWith("/profit-shares")) return "profit-shares";
  if (pathname.startsWith("/referral-bonus-batches")) return "referral-bonus-batches";
  if (pathname === "/mdr") return "mdr";
  if (pathname === "/rental-plans") return "rental-plans";
  if (pathname === "/settings") return "settings";
  if (pathname === "/users") return "users";
  if (pathname === "/audit-logs") return "audit-logs";
  return "dashboard";
}

type Crumb = { label: string; href?: string };

function getCrumbsFromPath(pathname: string): Crumb[] {
  if (pathname === "/dashboard") return [{ label: "Dashboard" }];
  // Operations
  if (pathname === "/customers")           return [{ label: "Operations" }, { label: "Customers" }];
  if (pathname.startsWith("/customers/"))  return [{ label: "Operations" }, { label: "Customers", href: "/customers" }, { label: "Detail" }];
  if (pathname === "/merchants")           return [{ label: "Operations" }, { label: "Merchants" }];
  if (pathname.startsWith("/merchants/"))  return [{ label: "Operations" }, { label: "Merchants", href: "/merchants" }, { label: "Detail" }];
  if (pathname === "/referrals")           return [{ label: "Operations" }, { label: "Referrals" }];
  if (pathname.startsWith("/referrals/"))  return [{ label: "Operations" }, { label: "Referrals", href: "/referrals" }, { label: "Detail" }];
  if (pathname === "/jobs")                return [{ label: "Operations" }, { label: "Jobs" }];
  if (pathname.startsWith("/jobs/"))       return [{ label: "Operations" }, { label: "Jobs", href: "/jobs" }, { label: "Detail" }];
  // Inventory
  if (pathname === "/terminals")           return [{ label: "Inventory" }, { label: "Terminals" }];
  if (pathname.startsWith("/terminals/"))  return [{ label: "Inventory" }, { label: "Terminals", href: "/terminals" }, { label: "Detail" }];
  if (pathname === "/simcards")            return [{ label: "Inventory" }, { label: "SIM Cards" }];
  if (pathname.startsWith("/simcards/"))   return [{ label: "Inventory" }, { label: "SIM Cards", href: "/simcards" }, { label: "Detail" }];
  if (pathname === "/paper-rolls")         return [{ label: "Inventory" }, { label: "Paper Rolls" }];
  // Finance
  if (pathname === "/rentals")             return [{ label: "Finance" }, { label: "Rentals" }];
  if (pathname.startsWith("/rentals/"))    return [{ label: "Finance" }, { label: "Rentals", href: "/rentals" }, { label: "Detail" }];
  if (pathname === "/profit-shares")       return [{ label: "Finance" }, { label: "Profit Shares" }];
  if (pathname.startsWith("/profit-shares/")) return [{ label: "Finance" }, { label: "Profit Shares", href: "/profit-shares" }, { label: "Detail" }];
  if (pathname === "/referral-bonus-batches")          return [{ label: "Finance" }, { label: "Referral Bonuses" }];
  if (pathname.startsWith("/referral-bonus-batches/")) return [{ label: "Finance" }, { label: "Referral Bonuses", href: "/referral-bonus-batches" }, { label: "Detail" }];
  if (pathname === "/paper-roll-billing")  return [{ label: "Finance" }, { label: "PR Billing" }];
  if (pathname === "/mdr")                 return [{ label: "Finance" }, { label: "MDR Rates" }];
  if (pathname === "/rental-plans")        return [{ label: "Finance" }, { label: "Rental Plans" }];
  // Configuration
  if (pathname === "/settings")            return [{ label: "Configuration" }, { label: "Settings" }];
  if (pathname === "/users")               return [{ label: "Configuration" }, { label: "Users & Roles" }];
  if (pathname === "/audit-logs")          return [{ label: "Configuration" }, { label: "Audit Logs" }];
  return [{ label: "Dashboard" }];
}

export function useNav(): NavFn {
  const router = useRouter();
  return (to: Route, param?: string) => {
    const p = param !== undefined ? encodeURIComponent(param) : param;
    if (to === "customer-detail") { router.push(`/customers/${p}`); return; }
    if (to === "merchant-detail") { router.push(`/merchants/${p}`); return; }
    if (to === "referral-detail") { router.push(`/referrals/${p}`); return; }
    if (to === "terminal-detail") { router.push(`/terminals/${p}`); return; }
    if (to === "simcard-detail")  { router.push(`/simcards/${p}`); return; }
    if (to === "job-detail")      { router.push(`/jobs/${p}`); return; }
    if (to === "rental-detail")   { router.push(`/rentals/${p}`); return; }
    if (to === "profit-share-detail") { router.push(`/profit-shares/${p}`); return; }
    if (to === "referral-bonus-batch-detail") { router.push(`/referral-bonus-batches/${p}`); return; }
    router.push(NAV_PATHS[to] || "/dashboard");
  };
}

interface ShellProps { children?: ReactNode }

export function Shell({ children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((s: RootState) => s.auth.user);
  const permissions = useSelector((s: RootState) => s.auth.permissions ?? []);
  const devMode = useSelector((s: RootState) => s.auth.devMode);
  const navCounts = useSelector((s: RootState) => s.navCounts);
  const activeParent = getActiveFromPath(router.pathname);
  const crumbs = getCrumbsFromPath(router.pathname);
  const mobileTitle = crumbs[crumbs.length - 1]?.label || "Bumipay";

  const visibleNav = useMemo(
    () => NAV
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => {
          const path = NAV_PATHS[it.id];
          return path ? canAccessPath(path, permissions, devMode) : true;
        }),
      }))
      .filter((sec) => sec.items.length > 0),
    [devMode, permissions]
  );

  useEffect(() => {
    const closeDrawer = () => setMobileDrawerOpen(false);
    router.events.on("routeChangeStart", closeDrawer);
    return () => router.events.off("routeChangeStart", closeDrawer);
  }, [router.events]);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    const fetchCounts = () => {
      api.dashboard.get()
        .then((data) => {
          if (cancelled) return;
          const terminals = Object.values(data.terminal_status_breakdown).reduce((a, b) => a + b, 0);
          dispatch(setNavCounts({
            merchants: data.total_merchants,
            jobs: data.total_jobs,
            terminals,
          }));
        })
        .catch(console.error);
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [authUser, dispatch]);

  function handleMenuToggle() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      setMobileDrawerOpen((open) => !open);
      return;
    }
    setCollapsed((isCollapsed) => !isCollapsed);
  }

  function handleLogout() {
    dispatch(logout());
    dispatch(setDevMode(false));
    router.replace("/login");
  }

  return (
    <div className={"app" + (collapsed ? " collapsed" : "") + (mobileDrawerOpen ? " mobile-drawer-open" : "")}>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close navigation"
        onClick={() => setMobileDrawerOpen(false)}
      />
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sb-brand" onClick={() => router.push("/dashboard")} style={{ cursor: "pointer" }}>
          <Image className="sb-wordmark" src="/branding/bumipay-wordmark.png" alt="Bumipay" width={1200} height={400} priority />
          <Image className="sb-mark" src="/branding/bumipay-mark.png" alt="Bumipay" width={512} height={512} priority />
          <button
            type="button"
            className="sb-drawer-close"
            aria-label="Close navigation"
            onClick={(e) => {
              e.stopPropagation();
              setMobileDrawerOpen(false);
            }}
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="sb-scroll">
          {visibleNav.map((sec) => (
            <div key={sec.group || "_top"}>
              {sec.group && <div className="sb-section-label">{sec.group}</div>}
              {sec.items.map((it) => (
                <div
                  key={it.id}
                  className={"sb-item" + (activeParent === it.id ? " active" : "")}
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    router.push(NAV_PATHS[it.id]);
                  }}
                  title={it.label}
                >
                  <Icon name={it.icon} size={18} stroke={1.9} />
                  <span className="sb-item-label">{it.label}</span>
                  {it.badge && navCounts[it.id as keyof typeof navCounts] != null && (
                    <span className="sb-badge">{navCounts[it.id as keyof typeof navCounts]}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-footer">
          <div className="sb-mobile-user">
            <div className="avatar">{authUser ? authUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?"}</div>
            <div>
              <div className="u-name">{authUser?.name ?? "—"}</div>
              <div className="u-role">{authUser?.role ?? "—"}</div>
            </div>
          </div>
          <button type="button" className="sb-logout" onClick={handleLogout} title="Log out">
            <Icon name="logout" size={18} />
            <span className="sb-logout-label">Log out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="topbar-toggle" onClick={handleMenuToggle} title="Toggle sidebar" aria-label="Toggle navigation">
            <Icon name="menu" size={17} />
          </button>
          <div className="mobile-page-title">{mobileTitle}</div>
          <nav className="crumbs">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {i > 0 && <Icon name="chevRight" size={13} style={{ opacity: .5 }} />}
                {c.href
                  ? <span className="crumb-link" style={{ cursor: "pointer" }} onClick={() => router.push(c.href!)}>{c.label}</span>
                  : <span className={i === crumbs.length - 1 ? "crumb-cur" : ""}>{c.label}</span>
                }
              </span>
            ))}
          </nav>
          <div className="topbar-search">
            {/* <Icon name="search" size={16} />
            <input placeholder="Search merchants, terminals, jobs…" /> */}
          </div>
          <div className="topbar-icons">
            <button className="topbar-icon" title="Activity"><Icon name="activity" size={17} /></button>
            <button className="topbar-icon" title="Notifications">
              <Icon name="bell" size={17} />
              <span className="dot" />
            </button>
          </div>
          <div
            className="topbar-user"
            style={{ position: "relative", cursor: "pointer" }}
            tabIndex={0}
            onClick={() => setShowUserMenu((open) => !open)}
            onBlur={() => setTimeout(() => setShowUserMenu(false), 150)}
          >
            <div className="avatar">{authUser ? authUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?"}</div>
            <div>
              <div className="u-name">{authUser?.name ?? "—"}</div>
              <div className="u-role">{authUser?.role ?? "—"}</div>
            </div>
            <Icon name="chevDown" size={14} style={{ color: "var(--ink-3)" }} />
            {showUserMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 190, zIndex: 1000,
                background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--sh-sm)",
                overflow: "hidden",
              }}>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", borderRadius: 0, fontSize: 13.5, justifyContent: "flex-start" }}
                  onMouseDown={() => router.push(NAV_PATHS["change-password"])}
                >
                  <Icon name="shield" size={15} />
                  Change Password
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="page">
          <div className="page-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
