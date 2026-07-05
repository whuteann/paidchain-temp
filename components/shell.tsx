/* PaidChain — app shell: sidebar + topbar */
import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { Icon } from "./icons";
import { logout, setDevMode } from "@/store/authSlice";
import type { AppDispatch, RootState } from "@/store";

export type Route = "dashboard" | "customers" | "customer-detail" | "merchants" | "merchant-detail" | "referrals" | "referral-detail" | "terminals" | "terminal-detail" | "simcards" | "simcard-detail" | "jobs" | "job-detail" | "rentals" | "rental-detail" | "paper-rolls" | "paper-roll-billing" | "payouts" | "payout-detail" | "referral-bonus-batches" | "referral-bonus-batch-detail" | "mdr" | "rental-plans" | "settings" | "users" | "audit-logs";
export type NavFn = (to: Route, param?: string) => void;

const NAV = [
  { group: "", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  ]},
  { group: "Operations", items: [
    { id: "customers",   label: "Customers", icon: "building" },
    { id: "merchants",   label: "Merchants", icon: "merchants", badge: "18" },
    { id: "referrals",   label: "Referrals", icon: "link" },
    { id: "jobs",        label: "Jobs",      icon: "jobs",      badge: "16" },
  ]},
  { group: "Inventory", items: [
    { id: "terminals",   label: "Terminals",   icon: "terminal", badge: "24" },
    { id: "simcards",    label: "SIM Cards",   icon: "phone" },
    { id: "paper-rolls", label: "Paper Rolls", icon: "receipt" },
  ]},
  { group: "Finance", items: [
    { id: "rentals",              label: "Rentals",             icon: "calendar" },
    { id: "payouts",           label: "Payouts",             icon: "payouts" },
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
  payouts: "/payouts",
  "referral-bonus-batches": "/referral-bonus-batches",
  mdr: "/mdr",
  "rental-plans": "/rental-plans",
  settings: "/settings",
  users: "/users",
  "audit-logs": "/audit-logs",
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
  if (pathname.startsWith("/payouts")) return "payouts";
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
  if (pathname === "/payouts")             return [{ label: "Finance" }, { label: "Payouts" }];
  if (pathname.startsWith("/payouts/"))    return [{ label: "Finance" }, { label: "Payouts", href: "/payouts" }, { label: "Detail" }];
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
    if (to === "customer-detail") { router.push(`/customers/${param}`); return; }
    if (to === "merchant-detail") { router.push(`/merchants/${param}`); return; }
    if (to === "referral-detail") { router.push(`/referrals/${param}`); return; }
    if (to === "terminal-detail") { router.push(`/terminals/${param}`); return; }
    if (to === "simcard-detail")  { router.push(`/simcards/${param}`); return; }
    if (to === "job-detail")      { router.push(`/jobs/${param}`); return; }
    if (to === "rental-detail")   { router.push(`/rentals/${param}`); return; }
    if (to === "payout-detail")   { router.push(`/payouts/${param}`); return; }
    if (to === "referral-bonus-batch-detail") { router.push(`/referral-bonus-batches/${param}`); return; }
    router.push(NAV_PATHS[to] || "/dashboard");
  };
}

interface ShellProps { children?: ReactNode }

export function Shell({ children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((s: RootState) => s.auth.user);
  const activeParent = getActiveFromPath(router.pathname);
  const crumbs = getCrumbsFromPath(router.pathname);
  const mobileTitle = crumbs[crumbs.length - 1]?.label || "PaidChain";

  useEffect(() => {
    const closeDrawer = () => setMobileDrawerOpen(false);
    router.events.on("routeChangeStart", closeDrawer);
    return () => router.events.off("routeChangeStart", closeDrawer);
  }, [router.events]);

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
          <div className="sb-logo">
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="sb-brand-text">
            <div className="sb-brand-name">PaidChain</div>
            <div className="sb-brand-sub">Operations Console</div>
          </div>
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
          {NAV.map((sec) => (
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
                  {it.badge && <span className="sb-badge">{it.badge}</span>}
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
          <div className="topbar-user">
            <div className="avatar">{authUser ? authUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?"}</div>
            <div>
              <div className="u-name">{authUser?.name ?? "—"}</div>
              <div className="u-role">{authUser?.role ?? "—"}</div>
            </div>
            <Icon name="chevDown" size={14} style={{ color: "var(--ink-3)" }} />
          </div>
        </header>
        <main className="page">
          <div className="page-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
