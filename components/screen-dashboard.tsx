/* PaidChain — Dashboard */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, MobileListItem } from "./components";
import { TERMINAL_STATUS, TERMINAL_STATUS_ORDER, JOB_TYPES } from "./data";
import { api } from "@/lib/api";
import type { DashboardOut } from "@/lib/api";
import { NavFn } from "./shell";
import type { Route } from "./shell";
import { useCan } from "@/lib/use-permissions";

const money = (n: number) =>
  "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function activityNav(entityType: string, entityId: string, nav: NavFn) {
  const map: Record<string, string> = {
    job: "job-detail", merchant: "merchant-detail", customer: "customer-detail",
    terminal: "terminal-detail", rental: "rental-detail", payout: "payout-detail",
  };
  const screen = map[entityType?.toLowerCase()];
  if (screen) nav(screen as Route, entityId);
}

function Stat({ icon, color, bg, label, value, foot }: {
  icon: string; color: string; bg: string; label: string; value: string | number; foot: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <div className="stat-ico" style={{ background: bg, color }}><Icon name={icon} size={18} /></div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-foot"><span className="delta-mut">{foot}</span></div>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
      <div style={{ width: 150, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: (max > 0 ? (value / max * 100) : 0) + "%", height: "100%", background: color, borderRadius: 5, transition: "width .5s" }} />
      </div>
      <div style={{ width: 30, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{value}</div>
    </div>
  );
}

const JT_COLORS: Record<string, string> = {
  "Installation": "var(--ok)", "Repair/Maintenance": "var(--warn)",
  "Replacement": "var(--orange)", "Paper Roll Request": "var(--info)", "Remote Support": "var(--indigo)",
};

export function Dashboard({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [data, setData] = useState<DashboardOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMonth, setIsMonth] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.dashboard.get(isMonth)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isMonth]);

  const termBreakdown = data?.terminal_status_breakdown ?? {};
  const tMax = Math.max(...Object.values(termBreakdown), 1);

  const jobsByType = data?.open_jobs_by_type ?? {};
  const jtMax = Math.max(...Object.values(jobsByType), 1);

  const faultyCount = termBreakdown["Faulty"] ?? 0;

  return (
    <div>
      <PageHead
        title="Operations Dashboard"
        sub={isMonth ? "Monthly overview" : "Live overview of devices, jobs and payouts"}
        actions={<>
          <Btn variant={isMonth ? "primary" : "ghost"} icon="calendar" onClick={() => setIsMonth((v) => !v)}>
            {isMonth ? "Month View" : "This Month"}
          </Btn>
        </>}
      />

      {loading && !data ? (
        <div style={{ padding: "60px 0", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
      ) : data && <>

        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <Stat icon="merchants" color="var(--green-700)" bg="var(--green-050)"
            label="Active Merchants" value={data.total_active_merchants} foot="currently active" />
          <Stat icon="jobs" color="var(--warn)" bg="var(--warn-bg)"
            label="Open Jobs" value={data.open_jobs_count} foot="across all types" />
          <Stat icon="payouts" color="var(--indigo)" bg="var(--indigo-bg)"
            label="Pending Payouts" value={data.pending_payouts_count}
            foot={"Net " + money(data.pending_payouts_net)} />
          <Stat icon="terminal" color="var(--bad)" bg="var(--bad-bg)"
            label="Faulty Terminals" value={faultyCount} foot="awaiting repair" />
        </div>

        {/* Terminal breakdown + jobs by type */}
        <div className="dashboard-split-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
          <Card title="Terminal Inventory by Status" icon="terminal"
            actions={can("Terminals.View") ? <Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("terminals")}>Inventory</Btn> : undefined}
          >
            <div className="card-pad">
              {TERMINAL_STATUS_ORDER.filter((s) => termBreakdown[s] !== undefined).map((s) => (
                <BarRow key={s} label={TERMINAL_STATUS[s]?.label ?? s} value={termBreakdown[s] ?? 0} max={tMax} color={TERMINAL_STATUS[s]?.dot ?? "var(--ink-3)"} />
              ))}
              {Object.keys(termBreakdown).filter((s) => !TERMINAL_STATUS_ORDER.includes(s)).map((s) => (
                <BarRow key={s} label={s} value={termBreakdown[s]} max={tMax} color="var(--ink-3)" />
              ))}
              {Object.keys(termBreakdown).length === 0 && (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No terminal data.</div>
              )}
            </div>
          </Card>

          <Card title="Open Jobs by Type" icon="jobs"
            actions={can("Jobs.View") ? <Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>All Jobs</Btn> : undefined}
          >
            <div className="card-pad">
              {Object.keys(jobsByType).length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No open jobs.</div>
              ) : Object.entries(jobsByType).map(([type, count]) => (
                <div key={type} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 500, display: "flex", gap: 7, alignItems: "center", whiteSpace: "nowrap" }}>
                      {JOB_TYPES[type] && <Icon name={JOB_TYPES[type].icon} size={15} style={{ color: JT_COLORS[type] ?? "var(--ink-3)" }} />}
                      {type}
                    </span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                  <div className="progress-mini">
                    <span style={{ width: (count / jtMax * 100) + "%", background: JT_COLORS[type] ?? "var(--ink-3)" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Activity + Needs Attention */}
        <div className="dashboard-lower-grid" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <Card title="Recent Activity" icon="clock"
            actions={can("Jobs.View") ? <Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>View all</Btn> : undefined}
          >
            {data.recent_activity.length === 0 ? (
              <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>No recent activity.</div>
            ) : (
              <div>
                {data.recent_activity.map((a) => (
                  <div
                    key={a.id}
                    className="clickable"
                    onClick={() => activityNav(a.entity_type, a.entity_id, nav)}
                    style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 8 }}>
                        <span>{a.user.name}</span>
                        <span>·</span>
                        <span>{a.user.role}</span>
                        {a.entity_id && <><span>·</span><span className="mono">{a.entity_id}</span></>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap", flexShrink: 0 }}>{relativeTime(a.action_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="Needs Attention" icon="alert">
              <div className="attention-list">
                {[
                  { perm: "Jobs.View", ico: "jobs",    c: "var(--warn)",   bg: "var(--warn-bg)",   t: data.open_jobs_count + " open jobs",              s: "Pending across all types",       go: () => nav("jobs") },
                  { perm: "Payouts.View", ico: "payouts", c: "var(--indigo)",  bg: "var(--indigo-bg)", t: data.pending_payouts_count + " pending payouts",   s: money(data.pending_payouts_net) + " net",  go: () => nav("payouts") },
                  { perm: "Terminals.View", ico: "wrench",  c: "var(--bad)",    bg: "var(--bad-bg)",    t: faultyCount + " faulty terminals",                 s: "Awaiting repair routing",        go: () => nav("terminals") },
                ].filter((a) => can(a.perm)).map((a, i) => (
                  <MobileListItem
                    key={i}
                    className="attention-item"
                    title={
                      <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, color: a.c, display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Icon name={a.ico} size={16} />
                        </span>
                        {a.t}
                      </span>
                    }
                    sub={a.s}
                    onClick={a.go}
                    chevron
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </>}
    </div>
  );
}
