/* PaidChain — Terminal Settings, MDR, Users & Roles */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Chip, Modal, Field, Entity } from "./components";
import { termSettings as initialTermSettings, mdr, users as initialUsers, BRANDS, BANKS, ROLES } from "./data";
import type { TermSetting, User } from "./data";
import { useJobSla } from "./job-sla-context";

/* =================== TERMINAL SETTINGS =================== */
export function TerminalSettings() {
  const [tab, setTab] = useState<"terminal" | "sla">("terminal");
  const [rows, setRows] = useState<TermSetting[]>(initialTermSettings);
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = rows.filter((r) => (r.brand + " " + r.model + " " + r.category).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHead
        title="Settings"
        sub="Admin configuration for terminal inventory and job SLA thresholds"
        actions={tab === "terminal" ? <Btn variant="primary" icon="plus" onClick={() => setShow(true)}>New Terminal Setting</Btn> : undefined}
      />
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[["terminal", "Terminal Settings"], ["sla", "Job SLA Settings"]].map(([id, label]) => (
          <div key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id as "terminal" | "sla")}>{label}</div>
        ))}
      </div>
      {tab === "terminal" ? (
        <>
          <Card>
            <Toolbar>
              <SearchBox value={q} onChange={setQ} placeholder="Search brand or model…" />
              <span className="tb-meta">{filtered.length} rate cards</span>
            </Toolbar>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr>{["Brand / Model","Bank","Category","Monthly Rental","Deposit","Setup Fee","Units","Status",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="ent">
                          <div className="ent-ava slate" style={{ borderRadius: 7 }}><Icon name="terminal" size={15} /></div>
                          <div><div className="ent-name">{r.brand}</div><div className="ent-sub">{r.model}</div></div>
                        </div>
                      </td>
                      <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <Icon name="bank" size={14} style={{ color: "var(--ink-3)" }} />{r.bank}
                      </span></td>
                      <td><Chip cls={r.category === "Portable" ? "chip-info" : "chip-neutral"}>{r.category}</Chip></td>
                      <td className="td-strong">RM {r.monthly}.00 <span className="td-mut" style={{ fontWeight: 400 }}>/mo</span></td>
                      <td className="td-mut">RM {r.deposit}</td>
                      <td className="td-mut">{r.setup ? "RM " + r.setup : "Waived"}</td>
                      <td className="td-mut">{r.units}</td>
                      <td>{r.active ? <Chip cls="chip-ok" dot>Active</Chip> : <Chip cls="chip-neutral" dot>Disabled</Chip>}</td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn"><Icon name="edit" size={14} /></button>
                          <button className="icon-btn"><Icon name="more" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {show && (
            <TerminalSettingModal
              onClose={() => setShow(false)}
              onCreate={(r) => {
                setRows([{ ...r, id: "NEW-" + rows.length }, ...rows]);
                setShow(false);
                setToast("Terminal setting created");
                setTimeout(() => setToast(null), 2400);
              }}
            />
          )}
        </>
      ) : (
        <JobSlaSettings />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

function JobSlaSettings() {
  const { rules, updateRule, resetDefaults } = useJobSla();
  const [toast, setToast] = useState<string | null>(null);

  function change(jobType: string, from: string, to: string, field: "warningDays" | "breachDays", value: string) {
    updateRule(jobType, from, to, { [field]: Math.max(0, Number(value) || 0) });
    setToast("SLA updated for " + jobType + " · " + from + " → " + to);
    setTimeout(() => setToast(null), 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Job SLA Thresholds" icon="clock" actions={<Btn variant="ghost" sm icon="refresh" onClick={resetDefaults}>Reset Defaults</Btn>}>
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            Customize yellow warning and red breach thresholds for each workflow leg. Jobs use these values immediately.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(rules).map(([jobType, items]) => (
              <div key={jobType} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2, #f5f5f5)", fontWeight: 700 }}>{jobType}</div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr>{["Transition", "Warning (days)", "Breach (days)"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {items.map((rule) => (
                        <tr key={rule.from + rule.to}>
                          <td className="td-strong">{rule.from} → {rule.to}</td>
                          <td style={{ maxWidth: 160 }}>
                            <input className="input" type="number" min="0" value={rule.warningDays} onChange={(e) => change(jobType, rule.from, rule.to, "warningDays", e.target.value)} />
                          </td>
                          <td style={{ maxWidth: 160 }}>
                            <input className="input" type="number" min="0" value={rule.breachDays} onChange={(e) => change(jobType, rule.from, rule.to, "breachDays", e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

function TerminalSettingModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: TermSetting) => void }) {
  const brandKeys = Object.keys(BRANDS);
  const [f, setF] = useState({ brand: brandKeys[0], model: "", category: "Countertop", bank: BANKS[0], monthly: "", deposit: "", setup: "", active: true });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.model && f.monthly;

  return (
    <Modal
      title="New Terminal Setting" sub="Define a device model and its rental rate card" icon="tag"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={() => onCreate({
          ...f, id: "", monthly: +f.monthly, deposit: +f.deposit || 0, setup: +f.setup || 0, units: 0,
        })}>Create Setting</Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Brand">
          <select className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)}>
            {brandKeys.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {["Countertop","Portable","Mobile (mPOS)","SoftPOS"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Model name" hint="required">
          <input className="input" placeholder="e.g. A920 Pro" value={f.model} onChange={(e) => set("model", e.target.value)} />
        </Field>
        <Field label="Bank">
          <select className="input" value={f.bank} onChange={(e) => set("bank", e.target.value)}>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Monthly rental (RM)" hint="required">
          <input className="input" type="number" placeholder="0.00" value={f.monthly} onChange={(e) => set("monthly", e.target.value)} />
        </Field>
        <Field label="Deposit (RM)">
          <input className="input" type="number" placeholder="0.00" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </Field>
        <Field label="Setup fee (RM)">
          <input className="input" type="number" placeholder="0.00" value={f.setup} onChange={(e) => set("setup", e.target.value)} />
        </Field>
      </div>
      <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, fontWeight: 500 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
        Active — available for new rentals
      </label>
    </Modal>
  );
}

/* =================== MDR =================== */
export function MDR() {
  const [q, setQ] = useState("");
  const filtered = mdr.filter((m) => (m.type + " " + m.network + " " + m.cat).toLowerCase().includes(q.toLowerCase()));
  const catChip: Record<string, string> = { Debit: "chip-info", Credit: "chip-indigo", QR: "chip-ok" };

  return (
    <div>
      <PageHead
        title="MDR Rates"
        sub="Merchant Discount Rate schedule by payment type"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus">Add Rate</Btn>
        </>}
      />
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search payment type or network…" />
          <span className="tb-meta">{filtered.length} rates</span>
        </Toolbar>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{["Code","Payment Type","Network","Category","MDR (%)",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="td-mono td-mut">{m.id}</td>
                  <td><span style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 600 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg)", display: "grid", placeItems: "center", color: "var(--slate)", flexShrink: 0 }}>
                      <Icon name={m.cat === "QR" ? "grid" : "payouts"} size={14} />
                    </span>{m.type}
                  </span></td>
                  <td className="td-mut">{m.network}</td>
                  <td><Chip cls={catChip[m.cat] || "chip-neutral"}>{m.cat}</Chip></td>
                  <td><span style={{ display: "inline-flex", alignItems: "baseline", gap: 2, fontWeight: 700, fontSize: 15, fontFamily: "var(--mono)" }}>
                    {m.rate.toFixed(2)}<span style={{ fontSize: 11, color: "var(--ink-3)" }}>%</span>
                  </span></td>
                  <td><div className="row-actions"><button className="icon-btn"><Icon name="edit" size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* =================== USERS =================== */
export function Users() {
  const [rows, setRows] = useState<User[]>(initialUsers);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("All");
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = rows.filter((u) => {
    if (q && !(u.name + " " + u.email + " " + u.role).toLowerCase().includes(q.toLowerCase())) return false;
    if (role !== "All" && u.role !== role) return false;
    return true;
  });
  const statusChip: Record<string, string> = { Active: "chip-ok", Invited: "chip-info", Suspended: "chip-warn" };

  return (
    <div>
      <PageHead
        title="Users & Roles"
        sub={rows.length + " team members · manage access and role assignment"}
        actions={<Btn variant="primary" icon="plus" onClick={() => setShow(true)}>Invite User</Btn>}
      />

      {/* Role legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {Object.keys(ROLES).map((r) => (
          <div key={r} className="card" style={{ padding: "10px 13px", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 150 }}>
            <Chip cls={ROLES[r].chip}>{r}</Chip>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{ROLES[r].desc}</span>
          </div>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search name or email…" />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            {["All", ...Object.keys(ROLES)].map((r) => <option key={r}>{r === "All" ? "All Roles" : r}</option>)}
          </select>
          <span className="tb-meta">{filtered.length} users</span>
        </Toolbar>
        {filtered.length === 0 ? <Entity name="No users match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["User","Role","Status","Open Jobs","Last Active",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td><Entity name={u.name} sub={u.email} /></td>
                    <td><Chip cls={ROLES[u.role].chip}>{u.role}</Chip></td>
                    <td><Chip cls={statusChip[u.status]} dot>{u.status}</Chip></td>
                    <td className="td-mut">{u.jobs || "—"}</td>
                    <td className="td-mut">{u.lastActive}</td>
                    <td><div className="row-actions">
                      <button className="icon-btn"><Icon name="edit" size={14} /></button>
                      <button className="icon-btn"><Icon name="more" size={14} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {show && (
        <UserModal
          onClose={() => setShow(false)}
          onCreate={(u) => {
            setRows([{ ...u, id: "U" + (300 + rows.length), status: "Invited", lastActive: "—", jobs: 0 }, ...rows]);
            setShow(false);
            setToast("Invitation sent to " + u.email);
            setTimeout(() => setToast(null), 2600);
          }}
        />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

function UserModal({ onClose, onCreate }: { onClose: () => void; onCreate: (u: Omit<User,"id"|"status"|"lastActive"|"jobs">) => void }) {
  const [f, setF] = useState({ name: "", email: "", role: "Operations" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name && f.email.includes("@");

  const roleIcons: Record<string, string> = { Admin: "shield", Finance: "payouts", Warehouse: "box", Viewer: "eye", Operations: "wrench" };

  return (
    <Modal
      title="Invite User" sub="Add a team member and assign a role" icon="user"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="mail" disabled={!valid} onClick={() => onCreate(f)}>Send Invite</Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Full name" hint="required">
          <input className="input" placeholder="e.g. Mei Ling Tan" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
      </div>
      <Field label="Email address" hint="required">
        <input className="input" type="email" placeholder="name@paidchain.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Role">
        <div className="type-grid">
          {Object.keys(ROLES).map((r) => (
            <div
              key={r}
              className={"type-card" + (f.role === r ? " sel" : "")}
              onClick={() => set("role", r)}
              style={r === "Viewer" ? { gridColumn: "span 2" } : {}}
            >
              <div className="tc-ico"><Icon name={roleIcons[r] || "user"} size={16} /></div>
              <div>
                <div className="tc-title">{r}</div>
                <div className="tc-sub">{ROLES[r].desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Field>
    </Modal>
  );
}
