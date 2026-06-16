/* PaidChain — Settings: Job SLA, MDR, Users & Roles */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Chip, Modal, Field, Entity } from "./components";
import { mdr, users as initialUsers, ROLES, PERMISSION_MODULES, ROLE_PERMISSIONS } from "./data";
import type { User } from "./data";
import { useJobSla } from "./job-sla-context";

/* =================== SETTINGS (SLA only) =================== */
export function TerminalSettings() {
  return (
    <div>
      <PageHead
        title="Settings"
        sub="Configure job SLA thresholds by workflow and stage transition"
      />
      <JobSlaSettings />
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
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [editRole, setEditRole] = useState<string | null>(null);

  function switchTab(t: "users" | "roles") {
    setTab(t);
    setEditRole(null);
  }

  return (
    <div>
      <PageHead title="Users & Roles" sub="Manage team members and configure role permissions" />

      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--line)" }}>
        {(["users", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            style={{
              padding: "10px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 14,
              borderBottom: `2px solid ${tab === t ? "var(--ink)" : "transparent"}`,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--ink)" : "var(--ink-3)",
              marginBottom: -1, transition: "color 0.15s",
            }}
          >
            {t === "users" ? "Users" : "Roles & Permissions"}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTabContent />}
      {tab === "roles" && !editRole && <RolesTab onEdit={setEditRole} />}
      {tab === "roles" && editRole && <RoleDetail roleName={editRole} onBack={() => setEditRole(null)} />}
    </div>
  );
}

function UsersTabContent() {
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
          <Btn variant="primary" icon="plus" onClick={() => setShow(true)}>Invite User</Btn>
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

/* =================== ROLES TAB =================== */
function RolesTab({ onEdit }: { onEdit: (role: string) => void }) {
  const userCounts: Record<string, number> = {};
  initialUsers.forEach((u) => { userCounts[u.role] = (userCounts[u.role] || 0) + 1; });
  const totalPerms = PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(ROLES).map(([role, meta]) => {
        const granted = (ROLE_PERMISSIONS[role] || []).length;
        return (
          <div key={role} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <Chip cls={meta.chip}>{role}</Chip>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{role}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{meta.desc}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "right", minWidth: 70 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{userCounts[role] || 0}</div>
              <div>{(userCounts[role] || 0) === 1 ? "user" : "users"}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "right", minWidth: 100 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{granted}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>/{totalPerms}</span></div>
              <div>permissions</div>
            </div>
            <Btn variant="ghost" sm icon="edit" onClick={() => onEdit(role)}>Edit Permissions</Btn>
          </div>
        );
      })}
    </div>
  );
}

/* =================== ROLE DETAIL =================== */
function RoleDetail({ roleName, onBack }: { roleName: string; onBack: () => void }) {
  const roleMeta = ROLES[roleName];
  const [name, setName] = useState(roleName);
  const [desc, setDesc] = useState(roleMeta?.desc || "");
  const [perms, setPerms] = useState<Set<string>>(() => new Set(ROLE_PERMISSIONS[roleName] || []));
  const [toast, setToast] = useState<string | null>(null);

  const totalCount = PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0);

  function toggle(key: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function save() {
    setToast("Permissions updated for " + name);
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Btn variant="ghost" sm icon="chevLeft" onClick={onBack}>All Roles</Btn>
        <span style={{ color: "var(--ink-3)", fontSize: 13 }}>/</span>
        <Chip cls={roleMeta?.chip}>{roleName}</Chip>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--ink-3)", marginRight: 8 }}>{perms.size} of {totalCount} permissions granted</span>
        <Btn variant="primary" onClick={save}>Save Changes</Btn>
      </div>

      {/* Role info */}
      <div style={{ marginBottom: 16 }}>
        <Card>
          <div className="card-pad" style={{ paddingTop: 16 }}>
            <div className="field-row">
              <Field label="Role name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description">
                <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>
      </div>

      {/* Permission grid */}
      <Card title="Permissions">
        <div className="card-pad" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 22 }}>
          {PERMISSION_MODULES.map(({ module, actions }) => {
            const grantedCount = actions.filter((a) => perms.has(`${module}.${a}`)).length;
            return (
              <div key={module}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color: "var(--ink-2)" }}>
                    {module}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {grantedCount}/{actions.length}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 6 }}>
                  {actions.map((action) => {
                    const key = `${module}.${action}`;
                    const checked = perms.has(key);
                    return (
                      <label
                        key={key}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                          border: `1.5px solid ${checked ? "var(--indigo)" : "var(--line)"}`,
                          background: checked ? "var(--bg-2)" : "var(--bg)",
                          transition: "border-color 0.1s, background 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(key)}
                          style={{ accentColor: "var(--indigo)", width: 14, height: 14, flexShrink: 0, cursor: "pointer" }}
                        />
                        <span style={{
                          fontSize: 12.5, userSelect: "none",
                          fontWeight: checked ? 600 : 400,
                          color: checked ? "var(--ink)" : "var(--ink-3)",
                        }}>
                          {action}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
