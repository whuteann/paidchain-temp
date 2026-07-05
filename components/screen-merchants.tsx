/* PaidChain — Merchant listing + detail */
import { useState, useEffect, useRef } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, MerchantStatus, Readiness, Entity, Pagination, Empty, Chip, TerminalStatus, JobStatus, SlaChip, Modal, Field, MobileListItem, ResponsiveTable } from "./components";
import { BANKS, JOB_TYPES } from "./data";
import { api, ApiError } from "@/lib/api";
import type { MerchantOut, MerchantCreate, MerchantUpdate, MerchantTerminalOut, MerchantJobOut, MdrOut, RentalPlanOut, MerchantCommercialProfileIn, MerchantCommercialProfileOut } from "@/lib/api";
import { NavFn } from "./shell";
import { CreateJobModal } from "./screen-jobs";

function EntitySearchSelect<T extends { id: string }>({
  label, hint, placeholder, value, onSelect, fetchResults, renderOption, getLabel, disabled, disabledHint,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: T | null;
  onSelect: (item: T | null) => void;
  fetchResults: (query: string) => Promise<T[]>;
  renderOption: (item: T) => React.ReactNode;
  getLabel: (item: T) => string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(v: string) {
    setLoading(true);
    fetchResults(v).then(setResults).catch(console.error).finally(() => setLoading(false));
  }

  function handleChange(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 300);
  }

  function handleFocus() {
    setOpen(true);
    if (!loading && results.length === 0) runSearch(query);
  }

  return (
    <Field label={label} hint={hint}>
      <div style={{ position: "relative" }}>
        {value ? (
          <div className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2, #f5f5f5)" }}>
            <span>{getLabel(value)}</span>
            <button type="button" className="icon-btn" onClick={() => { onSelect(null); setQuery(""); setResults([]); }}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ) : (
          <input
            className="input"
            placeholder={disabled ? disabledHint : placeholder}
            value={query}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
        {open && !value && !disabled && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "var(--sh-sm)", maxHeight: 220, overflowY: "auto",
          }}>
            {loading ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No matches</div>
            ) : (
              results.map((item) => (
                <div
                  key={item.id}
                  className="search-opt"
                  onMouseDown={() => { onSelect(item); setQuery(""); setOpen(false); }}
                >
                  {renderOption(item)}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

/* =================== CREATE MERCHANT MODAL =================== */
interface CreateMerchantModalProps {
  onClose: () => void;
  onSave: (m: MerchantOut) => void;
  customerId: string;
  customerName: string;
  existingMerchant?: MerchantOut | null;
}

export function CreateMerchantModal({ onClose, onSave, customerId, customerName, existingMerchant = null }: CreateMerchantModalProps) {
  const MERCHANT_TYPES = ['Retail', 'Normal Retail', 'EV', 'F&B', 'Services', 'Other'];
  const ACCOUNT_TYPES = ["Current", "Savings"];
  const editing = Boolean(existingMerchant);

  const [f, setF] = useState({
    name: existingMerchant?.name ?? "",
    type: existingMerchant?.type ?? MERCHANT_TYPES[0],
    bank: existingMerchant?.bank ?? BANKS[0],
    contact: existingMerchant?.contact ?? "",
    phone: existingMerchant?.phone ?? "",
    email: existingMerchant?.email ?? "",
    address: existingMerchant?.address ?? "",
    bankAccountName: existingMerchant?.bank_account_name ?? "",
    bankAccountNumber: existingMerchant?.bank_account_number ?? "",
    bankAccountType: existingMerchant?.bank_account_type ?? ACCOUNT_TYPES[0],
  });
  const [mid, setMid] = useState(existingMerchant?.mid ?? "");
  const [secondaryMid, setSecondaryMid] = useState(existingMerchant?.secondary_mid ?? "");
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [selectedMdrRate, setSelectedMdrRate] = useState<MdrOut | null>(null);
  const [mdrLoading, setMdrLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.contact.trim();

  // Commercial profile step (create-only)
  const PLAN_PERIODS = ["Monthly", "Quarterly", "Bi-Annual", "Annual"];
  const DISCOUNT_TYPES = ["Percentage", "Fixed Amount"];
  const [step, setStep] = useState<1 | 2>(1);
  const [rentalPlans, setRentalPlans] = useState<RentalPlanOut[]>([]);
  const [rentalPlansLoading, setRentalPlansLoading] = useState(false);
  const [commercial, setCommercial] = useState({
    rental_plan_id: "",
    rental_price: "",
    plan_period: "Monthly",
    trial_start: "",
    trial_end: "",
    discount_type: "",
    discount_value: "",
    effective_date: "",
  });
  const setC = (k: string, v: string) => setCommercial((p) => ({ ...p, [k]: v }));
  const [linkingSaving, setLinkingSaving] = useState(false);

  useEffect(() => {
    api.mdr.list()
      .then((rates) => {
        setMdrRates(rates);
        if (!existingMerchant) return;
        const mdrPlan = existingMerchant.commercial_profile?.mdr_plan;
        const matchedRate = mdrPlan
          ? rates.find((rate) => rate.id === mdrPlan || rate.type === mdrPlan) ?? null
          : null;
        setSelectedMdrRate(matchedRate);
      })
      .catch(console.error)
      .finally(() => setMdrLoading(false));
  }, [existingMerchant]);

  function buildBaseBody(): MerchantCreate {
    return {
      customer_id: customerId,
      name: f.name.trim(),
      type: f.type,
      mid: mid.trim() || null,
      secondary_mid: secondaryMid.trim() || null,
      bank: f.bank,
      contact: f.contact.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      address: f.address.trim(),
      bank_account_name: f.bankAccountName.trim() || f.name.trim(),
      bank_account_number: f.bankAccountNumber.trim(),
      bank_account_type: f.bankAccountType,
    };
  }

  // Edit-only: save changes directly
  async function submit() {
    if (!valid || !existingMerchant) return;
    setSaving(true); setErr(null);
    try {
      const updateBody: MerchantUpdate = {
        name: f.name.trim(), type: f.type, bank: f.bank,
        contact: f.contact.trim(), phone: f.phone.trim(),
        email: f.email.trim(), address: f.address.trim(),
        bank_account_name: f.bankAccountName.trim() || f.name.trim(),
        bank_account_number: f.bankAccountNumber.trim(),
        bank_account_type: f.bankAccountType,
        mid: mid.trim() || null,
        secondary_mid: secondaryMid.trim() || null,
      };
      const m = await api.merchants.update(existingMerchant.id, updateBody);
      onSave(m);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update merchant");
      setSaving(false);
    }
  }

  // Create-only: advance to commercial step without API call
  function goToCommercial() {
    setRentalPlansLoading(true);
    api.rentalPlans.list({ active: true })
      .then(setRentalPlans)
      .catch(console.error)
      .finally(() => setRentalPlansLoading(false));
    setStep(2);
  }

  // Auto-fill rental_price + plan_period when a rental plan is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!commercial.rental_plan_id) return;
    const plan = rentalPlans.find((p) => p.id === commercial.rental_plan_id);
    if (plan) {
      setCommercial((prev) => ({ ...prev, rental_price: String(plan.monthly_rate), plan_period: plan.plan_period }));
    }
  }, [commercial.rental_plan_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCommercial() {
    setLinkingSaving(true); setErr(null);
    try {
      const body: MerchantCreate = {
        ...buildBaseBody(),
        commercial_profile: {
          mdr_plan: selectedMdrRate?.id ?? null,
          rental_plan_id: commercial.rental_plan_id || null,
          rental_price: commercial.rental_price ? parseFloat(commercial.rental_price) : null,
          plan_period: commercial.plan_period || null,
          trial_start: commercial.trial_start || null,
          trial_end: commercial.trial_end || null,
          discount_type: commercial.discount_type || null,
          discount_value: commercial.discount_value ? parseFloat(commercial.discount_value) : null,
          effective_date: commercial.effective_date || null,
        },
      };
      const m = await api.merchants.create(body);
      onSave(m);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create merchant");
      setLinkingSaving(false);
    }
  }

  async function skipCommercial() {
    setLinkingSaving(true); setErr(null);
    try {
      const m = await api.merchants.create(buildBaseBody());
      onSave(m);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create merchant");
      setLinkingSaving(false);
    }
  }

  const stepLabels = ["Merchant", "Commercial"];
  const stepIdx = step - 1;

  return (
    <Modal
      title={step === 2 ? "Commercial Profile" : (editing ? "Edit Merchant" : "Create Merchant")}
      sub={step === 2 ? f.name : (editing ? "Update merchant profile, banking and contact details" : "Add a new merchant under an existing customer")}
      icon="merchants"
      onClose={onClose}
      foot={step === 2 ? (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" disabled={linkingSaving} onClick={skipCommercial}>Skip for now</Btn>
          <Btn variant="primary" icon="check" disabled={linkingSaving} onClick={saveCommercial}>
            {linkingSaving ? "Saving…" : "Save Commercial Profile"}
          </Btn>
        </>
      ) : (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {editing ? (
            <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
              {saving ? "Saving…" : "Save Changes"}
            </Btn>
          ) : (
            <Btn variant="primary" iconRight="chevRight" disabled={!valid} onClick={goToCommercial}>
              Create Merchant
            </Btn>
          )}
        </>
      )}
    >
      {/* Step indicator — create flow only */}
      {!editing && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {stepLabels.map((label, i) => {
            const done = i < stepIdx; const active = i === stepIdx;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", flex: i < stepLabels.length - 1 ? 1 : undefined }}>
                <div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: done ? "pointer" : "default" }}
                  onClick={done ? () => setStep((i + 1) as 1 | 2) : undefined}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: done ? "var(--green-700)" : active ? "var(--slate)" : "var(--bg-2, #f0f0f0)", color: done || active ? "#fff" : "var(--ink-3)", fontSize: 12, fontWeight: 700 }}>
                    {done ? <Icon name="check" size={14} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? "var(--ink-1)" : "var(--ink-3)", whiteSpace: "nowrap" }}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? "var(--green-700)" : "var(--line)", margin: "0 8px", marginBottom: 18 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 1: Merchant details ── */}
      {step === 1 && (
        <>
          <div className="field-row">
            <Field label="Merchant name" hint="required">
              <input className="input" placeholder="e.g. Kopitiam Heritage KL" value={f.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Business type">
              <select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}>
                {MERCHANT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Customer (billing entity)">
            <div className="input" style={{ background: "var(--bg-2, #f5f5f5)", color: "var(--ink-2)", cursor: "not-allowed" }}>
              {customerName}
            </div>
          </Field>

          <div className="field-row">
            <Field label="MID (primary)">
              <input className="input" placeholder="e.g. MID00012345" value={mid} onChange={(e) => setMid(e.target.value)} />
            </Field>
            <Field label="Secondary MID">
              <input className="input" placeholder="Optional" value={secondaryMid} onChange={(e) => setSecondaryMid(e.target.value)} />
            </Field>
          </div>

          <Field label="Bank">
            <select className="input" value={f.bank} onChange={(e) => set("bank", e.target.value)}>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>

          <Field label="Contact person" hint="required">
            <input className="input" placeholder="e.g. Ahmad bin Razak" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="Phone">
              <input className="input" placeholder="+60 1X-XXX XXXX" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" placeholder="ops@merchant.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
          <Field label="Address">
            <input className="input" placeholder="Street, City" value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>

          <div className="field-row">
            <Field label="Bank account name">
              <input className="input" placeholder="Defaults to merchant name" value={f.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} />
            </Field>
            <Field label="Bank account number">
              <input className="input" placeholder="e.g. 1234567890" value={f.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
            </Field>
          </div>
          <Field label="Bank account type">
            <select className="input" value={f.bankAccountType} onChange={(e) => set("bankAccountType", e.target.value)}>
              {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>

          {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
        </>
      )}

      {/* ── Step 2: Commercial profile ── */}
      {step === 2 && (
        <>
          <EntitySearchSelect<MdrOut>
            label="MDR plan"
            hint="required"
            placeholder="Search rate type, network, category…"
            disabled={mdrLoading}
            disabledHint="Loading MDR rates…"
            value={selectedMdrRate}
            onSelect={setSelectedMdrRate}
            fetchResults={(query) => {
              const needle = query.trim().toLowerCase();
              const matches = needle
                ? mdrRates.filter((rate) =>
                    `${rate.type} ${rate.network} ${rate.category} ${rate.rate}`
                      .toLowerCase()
                      .includes(needle))
                : mdrRates;
              return Promise.resolve(matches.slice(0, 8));
            }}
            getLabel={(rate) => `${rate.type} · ${rate.rate}%`}
            renderOption={(rate) => (
              <div className="cell-2">
                <span className="td-strong">{rate.type} · {rate.rate}%</span>
                <span className="c2-sub">{rate.network} · {rate.category}</span>
              </div>
            )}
          />

          <Field label="Rental plan">
            {rentalPlansLoading ? (
              <div className="input" style={{ color: "var(--ink-3)" }}>Loading plans…</div>
            ) : (
              <select className="input" value={commercial.rental_plan_id} onChange={(e) => setC("rental_plan_id", e.target.value)}>
                <option value="">— None —</option>
                {rentalPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · RM {p.monthly_rate.toFixed(2)}/{p.plan_period}</option>
                ))}
              </select>
            )}
          </Field>

          <div className="field-row">
            <Field label="Rental price (RM)">
              <input className="input" type="number" min="0" step="0.01" placeholder="Auto-filled from plan" value={commercial.rental_price} onChange={(e) => setC("rental_price", e.target.value)} />
            </Field>
            <Field label="Billing period">
              <select className="input" value={commercial.plan_period} onChange={(e) => setC("plan_period", e.target.value)}>
                {PLAN_PERIODS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Effective date">
            <input className="input" type="date" value={commercial.effective_date} onChange={(e) => setC("effective_date", e.target.value)} />
          </Field>

          <div className="field-row">
            <Field label="Trial start">
              <input className="input" type="date" value={commercial.trial_start} onChange={(e) => setC("trial_start", e.target.value)} />
            </Field>
            <Field label="Trial end">
              <input className="input" type="date" value={commercial.trial_end} onChange={(e) => setC("trial_end", e.target.value)} />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Discount type">
              <select className="input" value={commercial.discount_type} onChange={(e) => setC("discount_type", e.target.value)}>
                <option value="">— None —</option>
                {DISCOUNT_TYPES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            {commercial.discount_type && (
              <Field label="Discount value">
                <input className="input" type="number" min="0" step="0.01" placeholder={commercial.discount_type === "Percentage" ? "e.g. 10" : "e.g. 50.00"} value={commercial.discount_value} onChange={(e) => setC("discount_value", e.target.value)} />
              </Field>
            )}
          </div>
          {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
        </>
      )}
    </Modal>
  );
}

/* =================== LISTING =================== */
export function Merchants({ nav }: { nav: NavFn }) {
  const [merchantList, setMerchantList] = useState<MerchantOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("All");
  const [status, setStatus] = useState("All");

  console.log("list: ", merchantList);
  useEffect(() => {
    api.merchants.list().then((p) => setMerchantList(p.items)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = merchantList.filter((m) => {
    const hay = (m.name + " " + m.mid + " " + m.bank + " " + m.id).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (bank !== "All" && m.bank !== bank) return false;
    if (status !== "All" && m.status !== status) return false;
    return true;
  });

  return (
    <div>
      <PageHead
        title="Merchants"
        sub={merchantList.length + " merchants · search by name, MID, bank or merchant ID"}
        // actions={<Btn variant="ghost" icon="download">Export</Btn>}
      />
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search merchant, MID, bank…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All","Active","Onboarding","Suspended","Inactive"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={bank} onChange={(e) => setBank(e.target.value)}>
            {["All", ...BANKS].map((s) => <option key={s} value={s}>{s === "All" ? "All Banks" : s}</option>)}
          </select>
          <span className="tb-meta">{filtered.length} results</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : filtered.length === 0 ? <Empty title="No merchants match" sub="Try a different search or filter" /> : (
          <ResponsiveTable
            rows={filtered}
            getKey={(m) => m.id}
            onRowClick={(m) => nav("merchant-detail", m.id)}
            columns={[
              { key: "merchant", header: "Merchant", render: (m) => <Entity name={m.name} sub={m.id + " · " + m.type} /> },
              { key: "mid", header: "MID", render: (m) => <span className="td-mono td-mut">{m.mid}</span> },
              { key: "bank", header: "Bank", render: (m) => <span style={{ display: "flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={15} style={{ color: "var(--ink-3)" }} />{m.bank}</span> },
              { key: "status", header: "Status", render: (m) => <MerchantStatus status={m.status} /> },
              { key: "terminals", header: "Terminals", render: (m) => { const n = m.terminal_count ?? m.terminals; return n === 0 ? <span className="td-mut">—</span> : <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}><Icon name="terminal" size={15} style={{ color: "var(--ink-3)" }} />{n}</span>; } },
              // { key: "finance", header: "Finance Readiness", mobileLabel: "Finance", render: (m) => <Readiness value={m.finance} /> },
              { key: "jobs", header: "Jobs", render: (m) => m.open_jobs > 0 ? <Chip cls="chip-warn">{m.open_jobs} open</Chip> : <span className="td-mut">None</span> },
            ]}
            renderMobile={(m) => (
              <MobileListItem
                title={m.name}
                sub={<>{m.id} · {m.type}</>}
                status={<MerchantStatus status={m.status} />}
                meta={[
                  { label: "MID", value: <span className="td-mono">{m.mid}</span> },
                  { label: "Bank", value: <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={15} style={{ color: "var(--ink-3)" }} />{m.bank}</span> },
                  { label: "Finance", value: <Readiness value={m.finance} /> },
                  { label: "Terminals", value: (() => { const n = m.terminal_count ?? m.terminals; return n === 0 ? "—" : <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="terminal" size={15} style={{ color: "var(--ink-3)" }} />{n}</span>; })() },
                  { label: "Jobs", value: m.open_jobs > 0 ? <Chip cls="chip-warn">{m.open_jobs} open</Chip> : "None" },
                ]}
                onClick={() => nav("merchant-detail", m.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={merchantList.length} shown={filtered.length} />
      </Card>
    </div>
  );
}

/* =================== COMMERCIAL PROFILE MODAL =================== */
function CommercialProfileModal({ merchantId, existing, onClose, onSaved }: {
  merchantId: string;
  existing: MerchantCommercialProfileOut;
  onClose: () => void;
  onSaved: (cp: MerchantCommercialProfileOut) => void;
}) {
  const PLAN_PERIODS = ["Monthly", "Quarterly", "Bi-Annual", "Annual"];
  const DISCOUNT_TYPES = ["Percentage", "Fixed Amount"];

  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [mdrLoading, setMdrLoading] = useState(true);
  const [selectedMdrRate, setSelectedMdrRate] = useState<MdrOut | null>(null);
  const [rentalPlans, setRentalPlans] = useState<RentalPlanOut[]>([]);
  const [rentalPlansLoading, setRentalPlansLoading] = useState(true);
  const [f, setF] = useState({
    rental_plan_id:  existing.rental_plan_id  ?? "",
    rental_price:    existing.rental_price != null ? String(existing.rental_price) : "",
    plan_period:     existing.plan_period    ?? "Monthly",
    effective_date:  existing.effective_date ?? "",
    trial_start:     existing.trial_start    ?? "",
    trial_end:       existing.trial_end      ?? "",
    discount_type:   existing.discount_type  ?? "",
    discount_value:  existing.discount_value != null ? String(existing.discount_value) : "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.mdr.list()
      .then((rates) => {
        setMdrRates(rates);
        const match = rates.find((r) => r.id === existing.mdr_plan || r.type === existing.mdr_plan) ?? null;
        setSelectedMdrRate(match);
      })
      .catch(console.error)
      .finally(() => setMdrLoading(false));
    api.rentalPlans.list({ active: true })
      .then(setRentalPlans)
      .catch(console.error)
      .finally(() => setRentalPlansLoading(false));
  }, []);

  useEffect(() => {
    if (!f.rental_plan_id) return;
    const plan = rentalPlans.find((p) => p.id === f.rental_plan_id);
    if (plan) setF((prev) => ({ ...prev, rental_price: String(plan.monthly_rate), plan_period: plan.plan_period }));
  }, [f.rental_plan_id, rentalPlans]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body: MerchantCommercialProfileIn = {
        mdr_plan:        selectedMdrRate?.id ?? "",
        rental_plan_id:  f.rental_plan_id  || null,
        rental_price:    f.rental_price    ? parseFloat(f.rental_price)    : null,
        plan_period:     f.plan_period     || null,
        effective_date:  f.effective_date  || null,
        trial_start:     f.trial_start     || null,
        trial_end:       f.trial_end       || null,
        discount_type:   f.discount_type   || null,
        discount_value:  f.discount_value  ? parseFloat(f.discount_value)  : null,
      };
      const result = await api.merchants.updateCommercial(merchantId, body);
      onSaved(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save commercial profile");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Commercial Profile"
      sub="Update MDR plan, rental and billing terms"
      icon="percent"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Changes"}
        </Btn>
      </>}
    >
      <EntitySearchSelect<MdrOut>
        label="MDR plan"
        placeholder="Search rate type, network, category…"
        disabled={mdrLoading}
        disabledHint="Loading MDR rates…"
        value={selectedMdrRate}
        onSelect={setSelectedMdrRate}
        fetchResults={(query) => {
          const needle = query.trim().toLowerCase();
          const matches = needle
            ? mdrRates.filter((r) => `${r.type} ${r.network} ${r.category} ${r.rate}`.toLowerCase().includes(needle))
            : mdrRates;
          return Promise.resolve(matches.slice(0, 8));
        }}
        getLabel={(r) => `${r.type} · ${r.rate}%`}
        renderOption={(r) => (
          <div className="cell-2">
            <span className="td-strong">{r.type} · {r.rate}%</span>
            <span className="c2-sub">{r.network} · {r.category}</span>
          </div>
        )}
      />

      <Field label="Rental plan">
        {rentalPlansLoading ? (
          <div className="input" style={{ color: "var(--ink-3)" }}>Loading plans…</div>
        ) : (
          <select className="input" value={f.rental_plan_id} onChange={(e) => set("rental_plan_id", e.target.value)}>
            <option value="">— None —</option>
            {rentalPlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · RM {p.monthly_rate.toFixed(2)}/{p.plan_period}</option>
            ))}
          </select>
        )}
      </Field>

      <div className="field-row">
        <Field label="Rental price (RM)">
          <input className="input" type="number" min="0" step="0.01" placeholder="Auto-filled from plan" value={f.rental_price} onChange={(e) => set("rental_price", e.target.value)} />
        </Field>
        <Field label="Billing period">
          <select className="input" value={f.plan_period} onChange={(e) => set("plan_period", e.target.value)}>
            {PLAN_PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Effective date">
        <input className="input" type="date" value={f.effective_date} onChange={(e) => set("effective_date", e.target.value)} />
      </Field>

      <div className="field-row">
        <Field label="Trial start">
          <input className="input" type="date" value={f.trial_start} onChange={(e) => set("trial_start", e.target.value)} />
        </Field>
        <Field label="Trial end">
          <input className="input" type="date" value={f.trial_end} onChange={(e) => set("trial_end", e.target.value)} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Discount type">
          <select className="input" value={f.discount_type} onChange={(e) => set("discount_type", e.target.value)}>
            <option value="">— None —</option>
            {DISCOUNT_TYPES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        {f.discount_type && (
          <Field label="Discount value">
            <input className="input" type="number" min="0" step="0.01" placeholder={f.discount_type === "Percentage" ? "e.g. 10" : "e.g. 50.00"} value={f.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
          </Field>
        )}
      </div>

      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

/* =================== DETAIL =================== */
export function MerchantDetail({ id, nav }: { id: string; nav: NavFn }) {
  const [merchant, setMerchant] = useState<MerchantOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("overview");
  const [linkedTerminals, setLinkedTerminals] = useState<MerchantTerminalOut[]>([]);
  const [merchantJobs, setMerchantJobs] = useState<MerchantJobOut[]>([]);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showEditMerchant, setShowEditMerchant] = useState(false);
  const [showEditCommercial, setShowEditCommercial] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  console.log("details: ", merchant);
  useEffect(() => {
    api.merchants.get(id)
      .then(setMerchant)
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
    api.merchants.terminals(id).then(setLinkedTerminals).catch(console.error);
    api.merchants.jobs(id).then(setMerchantJobs).catch(console.error);
  }, [id]);

  if (loading) return (
    <div>
      <PageHead title="Merchant" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("merchants")}>Back</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading…</div>
    </div>
  );

  if (notFound || !merchant) return (
    <div>
      <PageHead title="Merchant not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("merchants")}>Back</Btn>} />
      <Empty icon="merchants" title="Merchant not found" sub={"No merchant with ID " + id} />
    </div>
  );

  return (
    <div>
      <div className="back-link" onClick={() => nav("merchants")}>
        <Icon name="arrowLeft" size={16} /> Back to Merchants
      </div>

      <div className="page-head merchant-detail-head">
        <div className="merchant-title-block" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="ent-ava" style={{ width: 52, height: 52, fontSize: 18, borderRadius: 13 }}>
            {merchant.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title">{merchant.name}</h1>
              <MerchantStatus status={merchant.status} />
            </div>
            <p className="page-sub">{merchant.id + " · " + merchant.type}</p>
          </div>
        </div>
        <div className="page-head-actions">
          <Btn variant="ghost" icon="mail">Contact</Btn>
          <Btn variant="ghost" icon="tag" onClick={() => setShowUpdateStatus(true)}>Update Status</Btn>
          <Btn variant="ghost" icon="edit" onClick={() => setShowEditMerchant(true)}>Edit</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreateJob(true)}>New Job</Btn>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { l: "Merchant Terminals", v: linkedTerminals.length,    ico: "terminal", c: "var(--info)" },
          { l: "Open Jobs",          v: merchantJobs.filter((j) => j.stage !== "Completed").length, ico: "jobs", c: "var(--warn)" },
          // { l: "Finance Readiness",  v: merchant.finance,           ico: "shield",   c: merchant.finance === "Ready" ? "var(--ok)" : "var(--warn)", small: true },
          // { l: "MDR Plan",           v: merchant.mdr_plan,          ico: "percent",  c: "var(--indigo)", small: true },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: "var(--bg)", color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: 28 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[["overview","Overview"],["commercial","Commercial Profile"],["terminals","Linked Terminals (" + linkedTerminals.length + ")"],["jobs","Job History (" + merchantJobs.length + ")"]].map(([k,lbl]) => (
          <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        {tab === "overview"    ? <OverviewTab m={merchant} nav={nav} />
          : tab === "commercial" ? <CommercialTab m={merchant} onEdit={() => setShowEditCommercial(true)} />
          : tab === "terminals"  ? <TerminalsTab rows={linkedTerminals} nav={nav} />
          : <JobsTab rows={merchantJobs} nav={nav} />}
      </div>

      {showCreateJob && (
        <CreateJobModal
          onClose={() => setShowCreateJob(false)}
          onCreate={(job) => {
            setShowCreateJob(false);
            nav("job-detail", job.id);
          }}
          nav={nav}
          presetCustomer={{
            id: merchant.customer_id,
            name: merchant.customer_name,
            type: "",
            reg_no: merchant.customer_id,
            tin: null,
            contact: "",
            phone: "",
            email: "",
            address: "",
            status: "",
            onboarded_date: "",
            merchant_count: 0,
          }}
          presetMerchant={merchant}
        />
      )}

      {showEditMerchant && (
        <CreateMerchantModal
          onClose={() => setShowEditMerchant(false)}
          onSave={(next) => {
            setMerchant(next);
            setShowEditMerchant(false);
          }}
          customerId={merchant.customer_id}
          customerName={merchant.customer_name}
          existingMerchant={merchant}
        />
      )}
      {showUpdateStatus && (
        <UpdateMerchantStatusModal
          merchant={merchant}
          onClose={() => setShowUpdateStatus(false)}
          onSaved={(updated) => { setMerchant(updated); setShowUpdateStatus(false); }}
        />
      )}

      {showEditCommercial && merchant.commercial_profile && (
        <CommercialProfileModal
          merchantId={merchant.id}
          existing={merchant.commercial_profile}
          onClose={() => setShowEditCommercial(false)}
          onSaved={(cp) => {
            setMerchant((prev) => prev ? { ...prev, commercial_profile: cp } : prev);
            setShowEditCommercial(false);
          }}
        />
      )}
    </div>
  );
}

function UpdateMerchantStatusModal({ merchant, onClose, onSaved }: { merchant: MerchantOut; onClose: () => void; onSaved: (m: MerchantOut) => void }) {
  const MERCHANT_STATUSES = ["Active", "Onboarding", "Suspended", "Inactive"];
  const [status, setStatus] = useState(merchant.status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const updated = await api.merchants.update(merchant.id, { status });
      onSaved(updated);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update status");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Update Status" sub={merchant.name} icon="merchants"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || status === merchant.status} onClick={submit}>
          {saving ? "Saving…" : "Update Status"}
        </Btn>
      </>}
    >
      <Field label="Status">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {MERCHANT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function OverviewTab({ m, nav }: { m: MerchantOut; nav: NavFn }) {
  return (
      <div className="detail-grid merchant-overview-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Business Details" icon="building">
          <div className="card-pad">
            <dl className="kv">
              <dt>Legal name</dt><dd>{m.name}</dd>
              <dt>Merchant ID</dt><dd className="mono">{m.id}</dd>
              <dt>Category</dt><dd>{m.type}</dd>
              <dt>Bank</dt><dd>{m.bank}</dd>
              <dt>Address</dt><dd style={{ fontWeight: 400 }}>{m.address}</dd>
            </dl>
          </div>
        </Card>
        {/* <Card title="Finance Readiness" icon="shield">
          <div className="card-pad">
            <div style={{ marginBottom: 16 }}><Readiness value={m.finance} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["Business registration (SSM)", true],
                ["Bank account verification",   m.finance !== "Not Ready"],
                ["Director IC / passport",       m.finance === "Ready"],
                ["Signed merchant agreement",    m.finance === "Ready"],
              ] as [string, boolean][]).map(([lbl, ok], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: ok ? "var(--green-050)" : "var(--warn-bg)", color: ok ? "var(--green-700)" : "var(--warn)", flexShrink: 0 }}>
                    <Icon name={ok ? "check" : "clock"} size={13} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{lbl}</span>
                  <span style={{ marginLeft: "auto" }}>{ok ? <Chip cls="chip-ok">Verified</Chip> : <Chip cls="chip-warn">Pending</Chip>}</span>
                </div>
              ))}
            </div>
          </div>
        </Card> */}
        <Card title="Merchant IDs (MIDs)" icon="tag">
          <div className="card-pad">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "var(--bg-2, #f5f5f5)", borderRadius: 6 }}>
                <span className="mono" style={{ flex: 1 }}>{m.mid || "—"}</span>
                <Chip cls="green">Primary</Chip>
              </div>
              {m.secondary_mid && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "var(--bg-2, #f5f5f5)", borderRadius: 6 }}>
                  <span className="mono" style={{ flex: 1 }}>{m.secondary_mid}</span>
                  <Chip cls="chip-neutral">Secondary</Chip>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Billing Customer" icon="building" actions={<Btn variant="ghost" sm icon="chevRight" onClick={() => nav("customer-detail", m.customer_id)}>View</Btn>}>
        <div className="card-pad">
          <dl className="kv">
            <dt>Customer</dt><dd>{m.customer_name}</dd>
            <dt>ID</dt><dd className="mono">{m.customer_id}</dd>
          </dl>
        </div>
      </Card>
      <Card title="Bank Details" icon="bank">
        <div className="card-pad">
          <dl className="kv">
            <dt>Account name</dt><dd>{m.bank_account_name}</dd>
            <dt>Account number</dt><dd className="mono">{m.bank_account_number}</dd>
            <dt>Account type</dt><dd>{m.bank_account_type}</dd>
            <dt>Bank</dt><dd>{m.bank}</dd>
          </dl>
        </div>
      </Card>
      <Card title="Primary Contact" icon="user">
        <div className="card-pad">
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
              {m.contact.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{m.contact}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Authorised signatory</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mail"   size={15} style={{ color: "var(--ink-3)" }} />{m.email}</div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="phone"  size={15} style={{ color: "var(--ink-3)" }} />{m.phone}</div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mapPin" size={15} style={{ color: "var(--ink-3)" }} />{m.address}</div>
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

function CommercialTab({ m, onEdit }: { m: MerchantOut; onEdit: () => void }) {
  if (!m.commercial_profile) {
    return (
      <Card>
        <Empty icon="percent" title="No commercial profile" sub="Set up a commercial profile to configure MDR, rental plan and billing terms" />
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 20 }}>
          <Btn variant="primary" icon="plus" onClick={onEdit}>Set Up Commercial Profile</Btn>
        </div>
      </Card>
    );
  }
  const cp: MerchantCommercialProfileOut = m.commercial_profile;
  return (
    <Card title="Commercial Profile" icon="percent" actions={<Btn variant="ghost" sm icon="edit" onClick={onEdit}>Edit</Btn>}>
      <div className="card-pad">
        <dl className="kv">
          {cp.mdr_plan            && <><dt>MDR Plan</dt><dd>{cp.mdr_plan}</dd></>}
          {cp.rental_plan_id      && <><dt>Rental Plan</dt><dd className="mono">{cp.rental_plan_id}</dd></>}
          {cp.rental_price != null && <><dt>Rental Price</dt><dd>RM {cp.rental_price.toFixed(2)}</dd></>}
          {cp.plan_period         && <><dt>Billing Period</dt><dd>{cp.plan_period}</dd></>}
          {cp.effective_date      && <><dt>Effective Date</dt><dd>{cp.effective_date}</dd></>}
          {cp.trial_start         && <><dt>Trial Start</dt><dd>{cp.trial_start}</dd></>}
          {cp.trial_end           && <><dt>Trial End</dt><dd>{cp.trial_end}</dd></>}
          {cp.discount_type       && <><dt>Discount Type</dt><dd>{cp.discount_type}</dd></>}
          {cp.discount_value != null && <><dt>Discount Value</dt><dd>{cp.discount_value}</dd></>}
        </dl>
      </div>
    </Card>
  );
}

function TerminalsTab({ rows, nav }: { rows: MerchantTerminalOut[]; nav: NavFn }) {
  if (!rows.length) return <Card><Empty icon="terminal" title="No terminals linked" sub="This merchant has no deployed devices yet" /></Card>;
  return (
    <Card>
      <ResponsiveTable
        rows={rows}
        getKey={(t) => t.serial}
        onRowClick={(t) => nav("terminal-detail", t.serial)}
        columns={[
          { key: "serial", header: "Serial", render: (t) => <span className="td-mono td-strong">{t.serial}</span> },
          { key: "device", header: "Device", render: (t) => <div className="cell-2"><span className="td-strong">{t.brand}</span><span className="c2-sub">{t.model}</span></div> },
          { key: "tid", header: "TID", render: (t) => <span className="td-mono td-mut">{t.tid || "—"}</span> },
          { key: "status", header: "Status", render: (t) => <TerminalStatus status={t.status} /> },
          { key: "location", header: "Location", render: (t) => <span className="td-mut">{t.location}</span> },
          { key: "rental", header: "Rental", render: (t) => <>RM {t.rental_rate}/mo</> },
        ]}
        renderMobile={(t) => (
          <MobileListItem
            title={<span className="td-mono">{t.serial}</span>}
            sub={`${t.brand} · ${t.model}`}
            status={<TerminalStatus status={t.status} />}
            meta={[
              { label: "TID", value: <span className="td-mono">{t.tid || "—"}</span> },
              { label: "Location", value: t.location },
              { label: "Rental", value: <>RM {t.rental_rate}/mo</> },
            ]}
            onClick={() => nav("terminal-detail", t.serial)}
            chevron
          />
        )}
      />
    </Card>
  );
}

function JobsTab({ rows, nav }: { rows: MerchantJobOut[]; nav: NavFn }) {
  if (!rows.length) return <Card><Empty icon="jobs" title="No job history" sub="This merchant has no jobs on record yet" /></Card>;
  return (
    <Card>
      <ResponsiveTable
        rows={rows}
        getKey={(j) => j.id}
        onRowClick={(j) => nav("job-detail", j.id)}
        columns={[
          { key: "id", header: "Job ID", render: (j) => <span className="td-mono td-strong">{j.id}</span> },
          { key: "type", header: "Type", render: (j) => <span style={{ display: "flex", gap: 7, alignItems: "center" }}><Icon name={JOB_TYPES[j.type]?.icon ?? "jobs"} size={15} style={{ color: "var(--ink-3)" }} />{j.type}</span> },
          { key: "status", header: "Status", render: (j) => <JobStatus status={j.stage} /> },
          { key: "sla", header: "SLA", render: (j) => <SlaChip sla={j.sla} /> },
          { key: "assignee", header: "Assignee", render: (j) => <span className="td-mut">{j.assignee}</span> },
          { key: "created", header: "Created", render: (j) => <span className="td-mut td-mono">{j.created_at.slice(5, 10)}</span> },
          { key: "due", header: "Due", render: (j) => <span className="td-mut td-mono">{j.due_date.slice(5)}</span> },
        ]}
        renderMobile={(j) => (
          <MobileListItem
            title={<span className="td-mono">{j.id}</span>}
            sub={<span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Icon name={JOB_TYPES[j.type]?.icon ?? "jobs"} size={15} style={{ color: "var(--ink-3)" }} />{j.type}</span>}
            status={<JobStatus status={j.stage} />}
            meta={[
              { label: "SLA", value: <SlaChip sla={j.sla} /> },
              { label: "Assignee", value: j.assignee },
              { label: "Created", value: <span className="td-mono">{j.created_at.slice(5, 10)}</span> },
              { label: "Due", value: <span className="td-mono">{j.due_date.slice(5)}</span> },
            ]}
            onClick={() => nav("job-detail", j.id)}
            chevron
          />
        )}
      />
    </Card>
  );
}
