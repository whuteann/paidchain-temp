/* PaidChain — Dashboard */
import { Icon } from "./icons";
import { Card, Btn, JobStatus, SlaChip, PageHead, TerminalStatus } from "./components";
import { terminals, jobs, merchants, payouts, TERMINAL_STATUS_ORDER, TERMINAL_STATUS, JOB_TYPES } from "./data";
import { NavFn } from "./shell";

function Stat({ icon, color, bg, label, value, deltaDir, delta, foot }: {
  icon: string; color: string; bg: string; label: string; value: string | number;
  deltaDir?: string; delta?: string; foot: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <div className="stat-ico" style={{ background: bg, color }}><Icon name={icon} size={18} /></div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-foot">
        {delta && (
          <span className={"delta " + (deltaDir || "up")}>
            <Icon name={deltaDir === "up" ? "arrowUpRight" : "arrowDownRight"} size={13} />
            {delta}
          </span>
        )}
        <span className="delta-mut">{foot}</span>
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
      <div style={{ width: 150, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 22, background: "var(--bg)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: (value / max * 100) + "%", height: "100%", background: color, borderRadius: 5, transition: "width .5s" }} />
      </div>
      <div style={{ width: 30, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{value}</div>
    </div>
  );
}

export function Dashboard({ nav }: { nav: NavFn }) {
  const tCounts: Record<string, number> = {};
  TERMINAL_STATUS_ORDER.forEach((s) => (tCounts[s] = 0));
  terminals.forEach((t) => tCounts[t.status]++);

  const installed = tCounts["Installed"];
  const openJobs = jobs.filter((j) => j.stage !== "Completed" && j.stage !== "Cancelled");
  const breaches = jobs.filter((j) => j.sla === "Breached").length;
  const activeMerch = merchants.filter((m) => m.status === "Active").length;
  const cycleTotal = payouts.reduce((a, p) => a + p.net, 0);
  const exceptions = payouts.filter((p) => p.exceptions.length > 0).length;

  const jobTypeCounts: Record<string, number> = {};
  Object.keys(JOB_TYPES).forEach((t) => (jobTypeCounts[t] = 0));
  jobs.forEach((j) => jobTypeCounts[j.type]++);
  const jtMax = Math.max(...Object.values(jobTypeCounts));
  const jtColors: Record<string, string> = {
    "Installation": "var(--ok)", "Repair/Maintenance": "var(--warn)",
    "Replacement": "var(--orange)", "Paper Roll Request": "var(--info)", "Remote Support": "var(--indigo)",
  };

  const recent = jobs.slice(0, 6);
  const tMax = Math.max(...Object.values(tCounts));

  return (
    <div>
      <PageHead
        title="Operations Dashboard"
        sub="Tuesday, 3 June 2026 · Live overview of devices, jobs and payouts"
        actions={<>
          <Btn variant="ghost" icon="calendar">This Month</Btn>
          <Btn variant="primary" icon="download">Export Report</Btn>
        </>}
      />

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat icon="merchants" color="var(--green-700)" bg="var(--green-050)" label="Active Merchants" value={activeMerch} deltaDir="up" delta="+3" foot="vs last month" />
        <Stat icon="terminal" color="var(--info)" bg="var(--info-bg)" label="Terminals Deployed" value={installed + " / " + terminals.length} deltaDir="up" delta="94%" foot="fleet utilisation" />
        <Stat icon="jobs" color="var(--warn)" bg="var(--warn-bg)" label="Open Jobs" value={openJobs.length} deltaDir="down" delta={breaches + " SLA"} foot="breached" />
        <Stat icon="payouts" color="var(--indigo)" bg="var(--indigo-bg)" label="Net Payouts · Cycle" value={"RM " + (cycleTotal / 1000).toFixed(1) + "k"} deltaDir="up" delta={exceptions + " flags"} foot="need review" />
      </div>

      {/* Terminal breakdown + jobs by type */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="Terminal Inventory by Status" icon="terminal"
          actions={<Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("terminals")}>Inventory</Btn>}
        >
          <div className="card-pad">
            {TERMINAL_STATUS_ORDER.map((s) => (
              <BarRow key={s} label={TERMINAL_STATUS[s].label!} value={tCounts[s]} max={tMax} color={TERMINAL_STATUS[s].dot!} />
            ))}
          </div>
        </Card>
        <Card title="Open Jobs by Type" icon="jobs"
          actions={<Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>All Jobs</Btn>}
        >
          <div className="card-pad">
            {Object.keys(jobTypeCounts).map((t) => (
              <div key={t} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                  <span style={{ fontWeight: 500, display: "flex", gap: 7, alignItems: "center", whiteSpace: "nowrap" }}>
                    <Icon name={JOB_TYPES[t].icon} size={15} style={{ color: jtColors[t] }} />
                    {t}
                  </span>
                  <span style={{ fontWeight: 600 }}>{jobTypeCounts[t]}</span>
                </div>
                <div className="progress-mini">
                  <span style={{ width: (jobTypeCounts[t] / jtMax * 100) + "%", background: jtColors[t] }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent jobs + side column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <Card title="Recent Jobs" icon="clock"
          actions={<Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>View all</Btn>}
        >
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["Job ID","Type","Merchant","Status","SLA","Due"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {recent.map((j) => (
                  <tr key={j.id} className="clickable" onClick={() => nav("job-detail", j.id)}>
                    <td className="td-mono td-strong">{j.id}</td>
                    <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                      <Icon name={JOB_TYPES[j.type].icon} size={15} style={{ color: "var(--ink-3)" }} />
                      {j.type}
                    </span></td>
                    <td className="td-mut">{j.merchant.name}</td>
                    <td><JobStatus status={j.stage} /></td>
                    <td><SlaChip sla={j.sla} /></td>
                    <td className="td-mut td-mono">{j.due.slice(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Needs Attention" icon="alert">
            <div style={{ padding: "6px 8px" }}>
              {[
                { ico: "alert",    c: "var(--bad)",    bg: "var(--bad-bg)",    t: breaches + " jobs breached SLA",                      s: "Review and reassign",        go: () => nav("jobs") },
                { ico: "payouts",  c: "var(--warn)",   bg: "var(--warn-bg)",   t: exceptions + " payouts flagged",                       s: "Exception checks pending",   go: () => nav("payouts") },
                { ico: "wrench",   c: "var(--orange)", bg: "var(--orange-bg)", t: tCounts["Faulty"] + " faulty terminals",               s: "Awaiting repair routing",     go: () => nav("terminals") },
                { ico: "merchants",c: "var(--info)",   bg: "var(--info-bg)",   t: merchants.filter((m) => m.finance !== "Ready").length + " merchants not finance-ready", s: "Documents outstanding", go: () => nav("merchants") },
              ].map((a, i) => (
                <div
                  key={i} onClick={a.go}
                  style={{ display: "flex", gap: 11, alignItems: "center", padding: "10px 8px", borderRadius: 8, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, color: a.c, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name={a.ico} size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.t}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{a.s}</div>
                  </div>
                  <Icon name="chevRight" size={15} style={{ color: "var(--ink-4)" }} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
