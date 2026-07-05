/* PaidChain — Settings: Job SLA, MDR, Users & Roles */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Chip, Modal, Field, Entity, Pagination } from "./components";
import { ROLES, PERMISSION_MODULES } from "./data";
import { api, ApiError } from "@/lib/api";
import type { UserOut, UserCreate, JobSlaMap, MdrOut, MdrCreate, RoleOut, RoleUpdate, RentalPlanOut, RentalPlanCreate, RentalPlanUpdate, ReferralBonusRuleOut, ReferralBonusRuleUpdate } from "@/lib/api";

/* =================== SETTINGS =================== */
export function TerminalSettings() {
  const [tab, setTab] = useState<"sla" | "referral">("sla");

  return (
    <div>
      <PageHead title="Settings" />
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {([["sla", "clock", "Job SLA"], ["referral", "star", "Referral Bonus"]] as const).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px", fontSize: 13.5, fontWeight: tab === key ? 600 : 400,
              color: tab === key ? "var(--slate)" : "var(--ink-2)",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === key ? "2px solid var(--slate)" : "2px solid transparent",
              marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Icon name={icon} size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === "sla" && <JobSlaSettings />}
      {tab === "referral" && <ReferralBonusSettings />}
    </div>
  );
}

function jobTypeSlug(jobType: string): string {
  return jobType.replace(/[ /]/g, "-");
}

/* =================== REFERRAL BONUS SETTINGS =================== */
function ReferralBonusSettings() {
  const [rule, setRule] = useState<ReferralBonusRuleOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReferralBonusRuleUpdate>({});

  useEffect(() => {
    api.referralBonusRules.getActive()
      .then((r) => { setRule(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ms = 2000) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  function startEdit() {
    if (!rule) return;
    setDraft({
      observation_days: rule.observation_days,
      bonus_amount: rule.bonus_amount,
      lead_generator_amount: rule.lead_generator_amount,
      processor_amount: rule.processor_amount,
      min_txn_count: rule.min_txn_count,
      min_txn_amount: rule.min_txn_amount,
      require_active_rental: rule.require_active_rental,
      require_installed_terminal: rule.require_installed_terminal,
      active: rule.active,
    });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setDraft({}); }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.referralBonusRules.updateActive(draft);
      setRule(updated);
      setEditing(false);
      setDraft({});
      showToast("Referral bonus rules saved");
    } catch {
      showToast("Failed to save — check connection", 2500);
    } finally {
      setSaving(false);
    }
  }

  const setN = (k: keyof ReferralBonusRuleUpdate, v: string) =>
    setDraft((d) => ({ ...d, [k]: Math.max(0, Number(v) || 0) }));
  const setB = (k: keyof ReferralBonusRuleUpdate, v: boolean) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13.5, color: "var(--ink-1)" }}>{label}</span>
        <button
          onClick={() => onChange(!checked)}
          style={{
            width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
            background: checked ? "var(--slate)" : "var(--line)",
            position: "relative", transition: "background 0.15s",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: checked ? 20 : 3,
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            transition: "left 0.15s",
          }} />
        </button>
      </div>
    );
  }

  if (loading) return <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>;
  if (!rule) return <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>No active referral bonus rule found.</div>;

  console.log(rule);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--slate)", color: "#fff", padding: "9px 20px", borderRadius: 8, fontSize: 13, zIndex: 9999, pointerEvents: "none" }}>
          {toast}
        </div>
      )}

      <Card
        title={rule.name || "Active Referral Bonus Rule"}
        icon="star"
        actions={
          editing ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" sm onClick={cancelEdit}>Cancel</Btn>
              <Btn variant="primary" sm icon="check" disabled={saving} onClick={save}>Save</Btn>
            </div>
          ) : (
            <Btn variant="ghost" sm icon="edit" onClick={startEdit}>Edit</Btn>
          )
        }
      >
        <div className="card-pad">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Numeric fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
              <Field label="Observation Window (days)">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.observation_days ?? ""} onChange={(e) => setN("observation_days", e.target.value)} />
                  : <span className="mono">{rule.observation_days}</span>}
              </Field>
              <Field label="Min. Transaction Count">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.min_txn_count ?? ""} onChange={(e) => setN("min_txn_count", e.target.value)} />
                  : <span className="mono">{rule.min_txn_count}</span>}
              </Field>
              <Field label="Min. Transaction Amount (RM)">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.min_txn_amount ?? ""} onChange={(e) => setN("min_txn_amount", e.target.value)} />
                  : <span className="mono">RM {rule.min_txn_amount.toFixed(2)}</span>}
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
              <Field label="Total Bonus Amount (RM)">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.bonus_amount ?? ""} onChange={(e) => setN("bonus_amount", e.target.value)} />
                  : <span className="mono">RM {rule.bonus_amount.toFixed(2)}</span>}
              </Field>
              <Field label="Lead Generator Share (RM)">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.lead_generator_amount ?? ""} onChange={(e) => setN("lead_generator_amount", e.target.value)} />
                  : <span className="mono">RM {rule.lead_generator_amount.toFixed(2)}</span>}
              </Field>
              <Field label="Processor Share (RM)">
                {editing
                  ? <input className="input" type="number" min={0} value={draft.processor_amount ?? ""} onChange={(e) => setN("processor_amount", e.target.value)} />
                  : <span className="mono">RM {rule.processor_amount.toFixed(2)}</span>}
              </Field>
            </div>
            {/* Boolean toggles */}
            <div style={{ paddingTop: 8 }}>
              <Toggle
                label="Require active terminal rental"
                checked={editing ? (draft.require_active_rental ?? false) : rule.require_active_rental}
                onChange={editing ? (v) => setB("require_active_rental", v) : () => {}}
              />
              <Toggle
                label="Require installed terminal"
                checked={editing ? (draft.require_installed_terminal ?? false) : rule.require_installed_terminal}
                onChange={editing ? (v) => setB("require_installed_terminal", v) : () => {}}
              />
              <div style={{ paddingTop: 4 }}>
                <Toggle
                  label="Rule active"
                  checked={editing ? (draft.active ?? false) : rule.active}
                  onChange={editing ? (v) => setB("active", v) : () => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function JobSlaSettings() {
  const [slaMap, setSlaMap] = useState<JobSlaMap>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.jobs.slaList().then(setSlaMap).catch(console.error).finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ms = 2000) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  function handleChange(jobType: string, fromStage: string, toStage: string, field: "warning_days" | "breach_days", value: string) {
    setSlaMap((prev) => ({
      ...prev,
      [jobType]: prev[jobType].map((t) =>
        t.from_stage === fromStage && t.to_stage === toStage ? { ...t, [field]: Math.max(0, Number(value) || 0) } : t
      ),
    }));
    setDirtyKeys((prev) => new Set(prev).add(jobType + "|" + fromStage + "|" + toStage));
  }

  const hasInvalid = Object.values(slaMap).some((arr) => arr.some((t) => t.warning_days > t.breach_days));

  async function saveAll() {
    if (hasInvalid) return;
    setSaving(true);
    const keys = Array.from(dirtyKeys);
    try {
      await Promise.all(keys.map((key) => {
        const [jobType, fromStage, toStage] = key.split("|");
        const t = slaMap[jobType].find((x) => x.from_stage === fromStage && x.to_stage === toStage)!;
        return api.jobs.slaUpdate(jobTypeSlug(jobType), fromStage, toStage, {
          warning_days: t.warning_days,
          breach_days: t.breach_days,
        });
      }));
      setDirtyKeys(new Set());
      showToast(keys.length === 1 ? "SLA change saved" : keys.length + " SLA changes saved");
    } catch {
      showToast("Failed to save — check connection", 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title="Job SLA Thresholds"
        icon="clock"
        actions={dirtyKeys.size > 0 && (
          <Btn variant="primary" sm icon="check" disabled={saving || hasInvalid} onClick={saveAll}>
            {saving ? "Saving…" : "Save Changes"}
          </Btn>
        )}
      >
        <div className="card-pad" style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
            Warning and breach day thresholds applied per job type and stage transition.
          </div>
          {hasInvalid && (
            <div style={{ marginBottom: 14, padding: "9px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 8, fontSize: 12.5, color: "var(--bad)", display: "flex", gap: 7, alignItems: "center" }}>
              <Icon name="alert" size={14} />
              Warning days cannot exceed breach days — fix the highlighted rows before saving.
            </div>
          )}
          {loading ? (
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>{["Job Type", "From Stage", "To Stage", "Warning (days)", "Breach (days)"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {Object.entries(slaMap).map(([jobType, transitions]) =>
                    transitions.map((t, i) => {
                      const invalid = t.warning_days > t.breach_days;
                      return (
                        <tr key={jobType + t.from_stage + t.to_stage}>
                          {i === 0 && (
                            <td className="td-strong" rowSpan={transitions.length}>{jobType}</td>
                          )}
                          <td className="td-mut">{t.from_stage}</td>
                          <td className="td-mut">{t.to_stage}</td>
                          <td style={{ maxWidth: 160 }}>
                            <input
                              className="input" type="number" min="0"
                              style={invalid ? { borderColor: "var(--bad)" } : undefined}
                              value={t.warning_days}
                              onChange={(e) => handleChange(jobType, t.from_stage, t.to_stage, "warning_days", e.target.value)}
                            />
                          </td>
                          <td style={{ maxWidth: 160 }}>
                            <input
                              className="input" type="number" min="0"
                              style={invalid ? { borderColor: "var(--bad)" } : undefined}
                              value={t.breach_days}
                              onChange={(e) => handleChange(jobType, t.from_stage, t.to_stage, "breach_days", e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== MDR =================== */
const CAT_CHIP: Record<string, string> = { Debit: "chip-info", Credit: "chip-indigo", QR: "chip-ok" };
const CATEGORIES = ["Debit", "Credit", "QR"];

function MdrModal({ rate, onClose, onSave }: { rate?: MdrOut; onClose: () => void; onSave: (r: MdrOut) => void }) {
  const editing = !!rate;
  const [f, setF] = useState({ type: rate?.type ?? "", rate: rate ? String(rate.rate) : "", category: rate?.category ?? CATEGORIES[0], network: rate?.network ?? "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.type.trim() && f.network.trim() && parseFloat(f.rate) >= 0;

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const body: MdrCreate = { type: f.type.trim(), rate: parseFloat(f.rate), category: f.category, network: f.network.trim() };
      const result = editing ? await api.mdr.update(rate!.id, body) : await api.mdr.create(body);
      onSave(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Rate" : "Add Rate"} sub="MDR schedule entry" icon="payouts"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add Rate"}
        </Btn>
      </>}
    >
      <Field label="Payment type" hint="required">
        <input className="input" placeholder="e.g. Visa Debit" value={f.type} onChange={(e) => set("type", e.target.value)} />
      </Field>
      <Field label="Network" hint="required">
        <input className="input" placeholder="e.g. Visa" value={f.network} onChange={(e) => set("network", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="MDR rate (%)" hint="required">
          <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 1.80" value={f.rate} onChange={(e) => set("rate", e.target.value)} />
        </Field>
      </div>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

export function MDR() {
  const [rates, setRates] = useState<MdrOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ open: boolean; rate?: MdrOut }>({ open: false });

  useEffect(() => {
    api.mdr.list().then(setRates).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = rates.filter((m) => (m.type + " " + m.network + " " + m.category).toLowerCase().includes(q.toLowerCase()));

  function handleSave(r: MdrOut) {
    setRates((prev) => prev.some((x) => x.id === r.id) ? prev.map((x) => x.id === r.id ? r : x) : [r, ...prev]);
  }

  return (
    <div>
      <PageHead
        title="MDR Rates"
        sub="Merchant Discount Rate schedule by payment type"
        actions={<>
          {/* <Btn variant="ghost" icon="download">Export</Btn> */}
          <Btn variant="primary" icon="plus" onClick={() => setModal({ open: true })}>Add Rate</Btn>
        </>}
      />
      <Card>
        {/* <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search payment type or network…" />
          <span className="tb-meta">{filtered.length} rates</span>
        </Toolbar> */}
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["ID","Payment Type","Network","Category","MDR (%)",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="td-mono td-mut">{m.id}</td>
                    <td><span style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 600 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg)", display: "grid", placeItems: "center", color: "var(--slate)", flexShrink: 0 }}>
                        <Icon name={m.category === "QR" ? "grid" : "payouts"} size={14} />
                      </span>{m.type}
                    </span></td>
                    <td className="td-mut">{m.network}</td>
                    <td><Chip cls={CAT_CHIP[m.category] || "chip-neutral"}>{m.category}</Chip></td>
                    <td><span style={{ display: "inline-flex", alignItems: "baseline", gap: 2, fontWeight: 700, fontSize: 15, fontFamily: "var(--mono)" }}>
                      {m.rate.toFixed(2)}<span style={{ fontSize: 11, color: "var(--ink-3)" }}>%</span>
                    </span></td>
                    <td><div className="row-actions">
                      <button className="icon-btn" onClick={() => setModal({ open: true, rate: m })}>
                        <Icon name="edit" size={14} />
                      </button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {modal.open && <MdrModal rate={modal.rate} onClose={() => setModal({ open: false })} onSave={handleSave} />}
    </div>
  );
}

/* =================== RENTAL PLANS =================== */
const PLAN_PERIODS = ["Monthly", "Quarterly", "Bi-Annual", "Annual"];

function RentalPlanModal({ plan, onClose, onSave }: { plan?: RentalPlanOut; onClose: () => void; onSave: (p: RentalPlanOut) => void }) {
  const editing = !!plan;
  const [f, setF] = useState({
    name: plan?.name ?? "",
    plan_period: plan?.plan_period ?? "Monthly",
    monthly_rate: plan ? String(plan.monthly_rate) : "",
    deposit: plan ? String(plan.deposit) : "0",
    setup_fee: plan ? String(plan.setup_fee) : "0",
    active: plan?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && parseFloat(f.monthly_rate) >= 0;

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const body: RentalPlanCreate | RentalPlanUpdate = {
        name: f.name.trim(),
        plan_period: f.plan_period,
        monthly_rate: parseFloat(f.monthly_rate),
        deposit: parseFloat(f.deposit) || 0,
        setup_fee: parseFloat(f.setup_fee) || 0,
        active: f.active,
      };
      const result = editing
        ? await api.rentalPlans.update(plan!.id, body as RentalPlanUpdate)
        : await api.rentalPlans.create(body as RentalPlanCreate);
      onSave(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Rental Plan" : "New Rental Plan"} sub="Merchant rental pricing plan" icon="calendar"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Create Plan"}
        </Btn>
      </>}
    >
      <Field label="Plan name" hint="required">
        <input className="input" placeholder="e.g. Standard Monthly" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Billing period">
        <select className="input" value={f.plan_period} onChange={(e) => set("plan_period", e.target.value)}>
          {PLAN_PERIODS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <div className="field-row">
        <Field label="Monthly rate (RM)" hint="required">
          <input className="input" type="number" min="0" step="0.01" placeholder="e.g. 80.00" value={f.monthly_rate} onChange={(e) => set("monthly_rate", e.target.value)} />
        </Field>
        <Field label="Deposit (RM)">
          <input className="input" type="number" min="0" step="0.01" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Setup fee (RM)">
          <input className="input" type="number" min="0" step="0.01" value={f.setup_fee} onChange={(e) => set("setup_fee", e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="input" value={f.active ? "Active" : "Inactive"} onChange={(e) => set("active", e.target.value === "Active")}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </Field>
      </div>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

export function RentalPlans() {
  const [plans, setPlans] = useState<RentalPlanOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [modal, setModal] = useState<{ open: boolean; plan?: RentalPlanOut }>({ open: false });
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.rentalPlans.list().then(setPlans).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = plans.filter((p) => {
    if (filter === "active") return p.active;
    if (filter === "inactive") return !p.active;
    return true;
  });

  function handleSave(p: RentalPlanOut) {
    setPlans((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? p : x) : [p, ...prev]);
    showToast(p.name + " saved");
  }

  async function handleDeactivate(p: RentalPlanOut) {
    setDeactivating(p.id);
    try {
      const updated = await api.rentalPlans.deactivate(p.id);
      setPlans((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      showToast(p.name + " deactivated");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Failed to deactivate");
    } finally {
      setDeactivating(null);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const activeCnt = plans.filter((p) => p.active).length;

  return (
    <div>
      <PageHead
        title="Rental Plans"
        sub="Define pricing plans used for merchant terminal rentals"
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal({ open: true })}>New Plan</Btn>}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {[
          { key: "all", label: `All (${plans.length})` },
          { key: "active", label: `Active (${activeCnt})` },
          { key: "inactive", label: `Inactive (${plans.length - activeCnt})` },
        ].map(({ key, label }) => (
          <Btn key={key} variant={filter === key ? "slate" : "ghost"} sm onClick={() => setFilter(key as typeof filter)}>
            {label}
          </Btn>
        ))}
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
            No rental plans found.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Plan Name", "Period", "Monthly Rate", "Deposit", "Setup Fee", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="td-mut">{p.plan_period}</td>
                    <td><span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>RM {p.monthly_rate.toFixed(2)}</span></td>
                    <td className="td-mut">RM {p.deposit.toFixed(2)}</td>
                    <td className="td-mut">RM {p.setup_fee.toFixed(2)}</td>
                    <td><Chip cls={p.active ? "chip-ok" : "chip-neutral"} dot>{p.active ? "Active" : "Inactive"}</Chip></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => setModal({ open: true, plan: p })}>
                          <Icon name="edit" size={14} />
                        </button>
                        {p.active && (
                          <button
                            className="icon-btn"
                            title="Deactivate"
                            disabled={deactivating === p.id}
                            onClick={() => handleDeactivate(p)}
                            style={{ color: "var(--bad)" }}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal.open && (
        <RentalPlanModal plan={modal.plan} onClose={() => setModal({ open: false })} onSave={handleSave} />
      )}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

const USERS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/* =================== USERS =================== */
export function Users() {
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [userList, setUserList] = useState<UserOut[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userPageSize, setUserPageSize] = useState(USERS_PAGE_SIZE_OPTIONS[1]);
  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState("All");
  const [roleList, setRoleList] = useState<RoleOut[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    api.roles.list()
      .then(setRoleList)
      .catch(console.error)
      .finally(() => setRolesLoading(false));
  }, []);

  useEffect(() => {
    setUsersLoading(true);
    api.users.list({
      page: userPage,
      per_page: userPageSize,
      query: userQuery || undefined,
      role: userRole !== "All" ? userRole : undefined,
    })
      .then((p) => {
        setUserList(p.items);
        setUserPages(p.pages);
        setUserTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, [userPage, userPageSize, userQuery, userRole]);

  function switchTab(t: "users" | "roles") { setTab(t); setEditRoleId(null); }

  return (
    <div>
      <PageHead title="Users & Roles" sub="Manage team members and configure role permissions" />

      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--line)" }}>
        {(["users", "roles"] as const).map((t) => (
          <button key={t} onClick={() => switchTab(t)} style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 14,
            borderBottom: `2px solid ${tab === t ? "var(--ink)" : "transparent"}`,
            fontWeight: tab === t ? 700 : 500,
            color: tab === t ? "var(--ink)" : "var(--ink-3)",
            marginBottom: -1, transition: "color 0.15s",
          }}>
            {t === "users" ? "Users" : "Roles & Permissions"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTabContent
          users={userList}
          loading={usersLoading}
          roles={roleList}
          page={userPage}
          pages={userPages}
          total={userTotal}
          pageSize={userPageSize}
          query={userQuery}
          roleFilter={userRole}
          onPageChange={setUserPage}
          onPageSizeChange={(n) => { setUserPageSize(n); setUserPage(1); }}
          onQueryChange={(v) => { setUserQuery(v); setUserPage(1); }}
          onRoleFilterChange={(v) => { setUserRole(v); setUserPage(1); }}
          onAdd={(u) => setUserList((p) => [u, ...p])}
          onUpdate={(u) => setUserList((p) => p.map((x) => x.id === u.id ? u : x))}
        />
      )}
      {tab === "roles" && !editRoleId && (
        <RolesTab roles={roleList} loading={rolesLoading} onEdit={setEditRoleId} />
      )}
      {tab === "roles" && editRoleId && (() => {
        const role = roleList.find((r) => r.id === editRoleId);
        return role ? (
          <RoleDetail
            role={role}
            onBack={() => setEditRoleId(null)}
            onUpdate={(r) => setRoleList((prev) => prev.map((x) => x.id === r.id ? r : x))}
          />
        ) : null;
      })()}
    </div>
  );
}

function UsersTabContent({
  users, loading, roles, page, pages, total, pageSize, query, roleFilter,
  onPageChange, onPageSizeChange, onQueryChange, onRoleFilterChange,
  onAdd, onUpdate,
}: {
  users: UserOut[];
  loading: boolean;
  roles: RoleOut[];
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  query: string;
  roleFilter: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onQueryChange: (q: string) => void;
  onRoleFilterChange: (role: string) => void;
  onAdd: (u: UserOut) => void;
  onUpdate: (u: UserOut) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserOut | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const statusChip: Record<string, string> = { Active: "chip-ok", Invited: "chip-info", Suspended: "chip-warn" };

  function showToast(msg: string, ms = 2500) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  async function handleStatusToggle(u: UserOut) {
    const next = u.status === "Active" ? "Suspended" : "Active";
    try {
      const updated = await api.users.update(u.id, { status: next });
      onUpdate(updated);
      showToast(`${u.name} ${next === "Active" ? "activated" : "suspended"}`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Failed to update status", 3000);
    }
  }

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
          <SearchBox value={query} onChange={onQueryChange} placeholder="Search name or email…" />
          <select className="select" value={roleFilter} onChange={(e) => onRoleFilterChange(e.target.value)}>
            {["All", ...roles.map((r) => r.name)].map((r) => (
              <option key={r} value={r}>{r === "All" ? "All Roles" : r}</option>
            ))}
          </select>
          <select className="select" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {USERS_PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} users`}</span>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Invite User</Btn>
        </Toolbar>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{["User","Role","Status","Open Jobs","Last Active",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {!loading && users.map((u) => (
                <tr key={u.id}>
                  <td><Entity name={u.name} sub={u.email} /></td>
                  <td><Chip cls={ROLES[u.role]?.chip ?? "chip-neutral"}>{u.role}</Chip></td>
                  <td><Chip cls={statusChip[u.status] ?? "chip-neutral"} dot>{u.status}</Chip></td>
                  <td className="td-mut">{u.jobs || "—"}</td>
                  <td className="td-mut">{u.last_active ?? "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Edit" onClick={() => setEditUser(u)}><Icon name="edit" size={14} /></button>
                      <button className="icon-btn" title={u.status === "Active" ? "Suspend" : "Activate"} onClick={() => handleStatusToggle(u)}>
                        <Icon name={u.status === "Active" ? "x" : "check"} size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} shown={users.length} page={page} pages={pages} onPageChange={onPageChange} />
      </Card>

      {showCreate && (
        <UserModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onSave={(u) => { onAdd(u); setShowCreate(false); showToast("User created"); }}
        />
      )}
      {editUser && (
        <UserModal
          roles={roles}
          existing={editUser}
          onClose={() => setEditUser(null)}
          onSave={(u) => { onUpdate(u); setEditUser(null); showToast("User updated"); }}
        />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

function UserModal({ onClose, onSave, existing, roles }: {
  onClose: () => void;
  onSave: (u: UserOut) => void;
  existing?: UserOut;
  roles: RoleOut[];
}) {
  const [f, setF] = useState(() => ({
    name: existing?.name ?? "",
    email: existing?.email ?? "",
    role: existing
      ? roles.find((r) => r.name === existing.role)?.id ?? ""
      : roles.find((r) => r.name === "Operations")?.id ?? roles[0]?.id ?? "",
    password: "",
  }));
  const [resetPw, setResetPw] = useState("");
  const [resetOk, setResetOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = !!(f.name && f.email.includes("@") && (existing || f.password));
  const roleIcons: Record<string, string> = { Admin: "shield", Finance: "payouts", Warehouse: "box", Viewer: "eye", Operations: "wrench" };

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const body: UserCreate = { name: f.name, email: f.email, role_id: f.role, password: f.password || "placeholder" };
      const result = existing
        ? await api.users.update(existing.id, { name: f.name, email: f.email, role_id: f.role })
        : await api.users.create(body);
      onSave(result);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!existing || !resetPw) return;
    setResetting(true); setErr(null);
    try {
      const updated = await api.users.resetPassword(existing.id, resetPw);
      onSave(updated);
      setResetPw(""); setResetOk(true);
      setTimeout(() => setResetOk(false), 3000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit User" : "Invite User"}
      sub={existing ? existing.email : "Add a team member and assign a role"}
      icon="user" onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon={existing ? "check" : "mail"} disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : existing ? "Save Changes" : "Create User"}
        </Btn>
      </>}
    >
      <Field label="Full name" hint="required">
        <input className="input" placeholder="e.g. Mei Ling Tan" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Email address" hint="required">
        <input className="input" type="email" placeholder="name@paidchain.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      {!existing && (
        <Field label="Password" hint="required">
          <input className="input" type="password" placeholder="Temporary password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
      )}
      <Field label="Role">
        <div className="type-grid">
          {roles.map((r, i) => (
            <div key={r.id} className={"type-card" + (f.role === r.id ? " sel" : "")} onClick={() => set("role", r.id)}
              style={i === roles.length - 1 && roles.length % 2 !== 0 ? { gridColumn: "span 2" } : {}}>
              <div className="tc-ico"><Icon name={roleIcons[r.name] || "user"} size={16} /></div>
              <div>
                <div className="tc-title">{r.name}</div>
                <div className="tc-sub">{r.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Field>
      {existing && (
        <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Reset Password</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" type="password" placeholder="New password" value={resetPw}
              onChange={(e) => { setResetPw(e.target.value); setResetOk(false); }} style={{ flex: 1 }} />
            <Btn variant="ghost" icon="refresh" disabled={!resetPw || resetting} onClick={handleResetPassword}>
              {resetting ? "…" : "Reset"}
            </Btn>
          </div>
          {resetOk && <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ok)" }}>Password reset successfully.</div>}
        </div>
      )}
      {err && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
    </Modal>
  );
}

/* =================== ROLES TAB =================== */
function RolesTab({ roles, loading, onEdit }: { roles: RoleOut[]; loading: boolean; onEdit: (id: string) => void }) {
  const totalPerms = PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0);
  console.log("roles: ",  roles);
  
  if (loading) return <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {roles.map((role) => {
        const meta = ROLES[role.name];
        return (
          <div key={role.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <Chip cls={meta?.chip ?? "chip-neutral"}>{role.name}</Chip>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{role.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{role.description}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "right", minWidth: 70 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{role.user_count}</div>
              <div>{role.user_count === 1 ? "user" : "users"}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", textAlign: "right", minWidth: 100 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{role.permissions.length}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-3)" }}>/{totalPerms}</span></div>
              <div>permissions</div>
            </div>
            <Btn variant="ghost" sm icon="edit" onClick={() => onEdit(role.id)}>Edit Permissions</Btn>
          </div>
        );
      })}
    </div>
  );
}

/* =================== ROLE DETAIL =================== */
function RoleDetail({ role, onBack, onUpdate }: { role: RoleOut; onBack: () => void; onUpdate: (r: RoleOut) => void }) {
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description);
  const [perms, setPerms] = useState<Set<string>>(new Set(role.permissions));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const totalCount = PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0);
  const roleMeta = ROLES[role.name];

  function toggle(key: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const body: RoleUpdate = { name, description: desc, permissions: Array.from(perms) };
      const updated = await api.roles.update(role.id, body);
      onUpdate(updated);
      setToast("Permissions updated for " + updated.name);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2600);
    }
  }

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Btn variant="ghost" sm icon="chevLeft" onClick={onBack}>All Roles</Btn>
        <span style={{ color: "var(--ink-3)", fontSize: 13 }}>/</span>
        <Chip cls={roleMeta?.chip}>{role.name}</Chip>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--ink-3)", marginRight: 8 }}>{perms.size} of {totalCount} permissions granted</span>
        <Btn variant="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Changes"}</Btn>
      </div>

      {/* Role info */}
      <div style={{ marginBottom: 16 }}>
        <Card>
          <div className="card-pad" style={{ paddingTop: 16 }}>
            <div className="field-row">
              <Field label="Role name">
                <input disabled className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description">
                <input disabled className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
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
