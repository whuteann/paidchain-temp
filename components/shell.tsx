/* PaidChain — app shell: sidebar + topbar */
import { useState, ReactNode } from "react";
import { useRouter } from "next/router";
import { Icon } from "./icons";

export type Route = "dashboard" | "customers" | "customer-detail" | "merchants" | "merchant-detail" | "terminals" | "terminal-detail" | "simcards" | "simcard-detail" | "jobs" | "job-detail" | "rentals" | "rental-detail" | "paper-rolls" | "payouts" | "payout-detail" | "mdr" | "settings" | "users";
export type NavFn = (to: Route, param?: string) => void;

const NAV = [
  { group: "Operations", items: [
    { id: "dashboard", label: "Dashboard",  icon: "dashboard" },
    { id: "customers", label: "Customers",  icon: "building" },
    { id: "merchants", label: "Merchants",  icon: "merchants", badge: "18" },
    { id: "terminals", label: "Terminals", icon: "terminal", badge: "24" },
    { id: "simcards",  label: "SIM Cards", icon: "phone" },
    { id: "jobs",      label: "Jobs",      icon: "jobs",     badge: "16" },
    { id: "rentals",     label: "Rentals",     icon: "calendar" },
    { id: "paper-rolls", label: "Paper Rolls", icon: "receipt" },
  ]},
  { group: "Finance", items: [
    { id: "payouts", label: "Payouts",   icon: "payouts" },
    { id: "mdr",     label: "MDR Rates", icon: "percent" },
  ]},
  { group: "Configuration", items: [
    { id: "settings", label: "Settings", icon: "tag" },
    { id: "users",    label: "Users & Roles",     icon: "users" },
  ]},
];

const NAV_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  customers: "/customers",
  merchants: "/merchants",
  terminals: "/terminals",
  simcards: "/simcards",
  jobs: "/jobs",
  rentals: "/rentals",
  "paper-rolls": "/paper-rolls",
  payouts: "/payouts",
  mdr: "/mdr",
  settings: "/settings",
  users: "/users",
};

function getActiveFromPath(pathname: string): string {
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/merchants")) return "merchants";
  if (pathname.startsWith("/terminals")) return "terminals";
  if (pathname.startsWith("/simcards")) return "simcards";
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/rentals")) return "rentals";
  if (pathname === "/paper-rolls") return "paper-rolls";
  if (pathname.startsWith("/payouts")) return "payouts";
  if (pathname === "/mdr") return "mdr";
  if (pathname === "/settings") return "settings";
  if (pathname === "/users") return "users";
  return "dashboard";
}

function getCrumbsFromPath(pathname: string): string[] {
  if (pathname === "/dashboard") return ["Dashboard"];
  if (pathname === "/customers") return ["Operations", "Customers"];
  if (pathname === "/customers/[id]") return ["Operations", "Customers", "Detail"];
  if (pathname === "/merchants") return ["Operations", "Merchants"];
  if (pathname.startsWith("/merchants/")) return ["Operations", "Merchants", "Detail"];
  if (pathname === "/terminals") return ["Operations", "Terminals"];
  if (pathname.startsWith("/terminals/")) return ["Operations", "Terminals", "Detail"];
  if (pathname === "/simcards") return ["Operations", "SIM Cards"];
  if (pathname === "/simcards/[id]") return ["Operations", "SIM Cards", "Detail"];
  if (pathname === "/jobs") return ["Operations", "Jobs"];
  if (pathname.startsWith("/jobs/")) return ["Operations", "Jobs", "Detail"];
  if (pathname === "/rentals") return ["Operations", "Rentals"];
  if (pathname === "/paper-rolls") return ["Operations", "Paper Rolls"];
  if (pathname === "/rentals/[id]") return ["Operations", "Rentals", "Detail"];
  if (pathname === "/payouts") return ["Finance", "Payouts"];
  if (pathname === "/payouts/[id]") return ["Finance", "Payouts", "Detail"];
  if (pathname === "/mdr") return ["Finance", "MDR Rates"];
  if (pathname === "/settings") return ["Configuration", "Settings"];
  if (pathname === "/users") return ["Configuration", "Users & Roles"];
  return ["Dashboard"];
}

export function useNav(): NavFn {
  const router = useRouter();
  return (to: Route, param?: string) => {
    if (to === "customer-detail") { router.push(`/customers/${param}`); return; }
    if (to === "merchant-detail") { router.push(`/merchants/${param}`); return; }
    if (to === "terminal-detail") { router.push(`/terminals/${param}`); return; }
    if (to === "simcard-detail")  { router.push(`/simcards/${param}`); return; }
    if (to === "job-detail")      { router.push(`/jobs/${param}`); return; }
    if (to === "rental-detail")   { router.push(`/rentals/${param}`); return; }
    if (to === "payout-detail")   { router.push(`/payouts/${param}`); return; }
    router.push(NAV_PATHS[to] || "/dashboard");
  };
}

interface ShellProps { children?: ReactNode }

export function Shell({ children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const activeParent = getActiveFromPath(router.pathname);
  const crumbs = getCrumbsFromPath(router.pathname);

  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
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
        </div>
        <div className="sb-scroll">
          {NAV.map((sec) => (
            <div key={sec.group}>
              <div className="sb-section-label">{sec.group}</div>
              {sec.items.map((it) => (
                <div
                  key={it.id}
                  className={"sb-item" + (activeParent === it.id ? " active" : "")}
                  onClick={() => router.push(NAV_PATHS[it.id])}
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
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
            <Icon name="menu" size={17} />
          </button>
          <nav className="crumbs">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {i > 0 && <Icon name="chevRight" size={13} style={{ opacity: .5 }} />}
                <span className={i === crumbs.length - 1 ? "crumb-cur" : ""}>{c}</span>
              </span>
            ))}
          </nav>
          <div className="topbar-search">
            <Icon name="search" size={16} />
            <input placeholder="Search merchants, terminals, jobs…" />
          </div>
          <div className="topbar-icons">
            <button className="topbar-icon" title="Activity"><Icon name="activity" size={17} /></button>
            <button className="topbar-icon" title="Notifications">
              <Icon name="bell" size={17} />
              <span className="dot" />
            </button>
          </div>
          <div className="topbar-user">
            <div className="avatar">AR</div>
            <div>
              <div className="u-name">Arif Rahman</div>
              <div className="u-role">Administrator</div>
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
