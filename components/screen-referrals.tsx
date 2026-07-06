/* PaidChain - Referral lead management + bonus batches */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Btn, Card, Chip, Empty, Entity, Field, Modal, PageHead, Pagination, SearchBox, Toolbar, useToast, MobileListItem, ResponsiveTable } from "./components";
import { api, ApiError } from "@/lib/api";
import type {
  MerchantOut,
  ReferralBonusBatchOut,
  ReferralBonusLineOut,
  ReferralOut,
  ReferralUpdate,
  UserOut,
} from "@/lib/api";
import { NavFn } from "./shell";
import { useCan } from "@/lib/use-permissions";

const REFERRALS_PAGE_SIZE = 20;
const BATCHES_PAGE_SIZE = 20;

const LEAD_STATUSES = [
  "All",
  "New",
  "Duplicate Check",
  "Valid Lead",
  "In Progress",
  "Submitted to Bank",
  "Pending Onboarding",
  "Terminal Activated",
  "First Transaction Completed",
  "Commission Eligible",
  "Rejected / Not Eligible",
  "Reversed / Deducted",
  "Closed",
];

const REFERRAL_STATUSES = ["All", "Pending", "Linked", "Confirmed", "Batched", "Paid", "Reversed", "Cancelled"];
const COMMISSION_STATUSES = ["All", "Not Eligible Yet", "Eligible", "Pending Approval", "Approved", "Paid", "On Hold", "Reversed", "Deducted", "Rejected"];
const BATCH_STATUSES = ["All", "Draft", "Paid"];
const QUARTERS = [1, 2, 3, 4];

const money = (n?: number | null) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-MY", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-MY", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pageShown<T>(items: T[], total: number) {
  return total > 0 ? items.length : 0;
}

function statusChip(status: string, kind: "lead" | "record" | "commission" | "batch") {
  const value = status || "-";
  let cls = "chip-neutral";
  if (["Valid Lead", "Terminal Activated", "Commission Eligible", "Confirmed", "Paid", "Eligible", "Approved"].includes(value)) cls = "chip-ok";
  if (["In Progress", "Submitted to Bank", "Pending Onboarding", "Pending Approval", "Draft", "Linked", "Batched"].includes(value)) cls = "chip-info";
  if (["New", "Duplicate Check", "Not Eligible Yet", "On Hold", "Pending"].includes(value)) cls = "chip-warn";
  if (["Rejected / Not Eligible", "Reversed / Deducted", "Reversed", "Deducted", "Rejected", "Cancelled", "Closed"].includes(value)) cls = "chip-bad";
  if (kind === "commission" && value === "Paid") cls = "chip-ok";
  return <Chip cls={cls} dot>{value}</Chip>;
}

function userLabel(u?: { name?: string | null; id?: string | null; email?: string | null } | null) {
  if (!u) return "-";
  return u.name || u.email || u.id || "-";
}

function fieldValue(v?: string | number | boolean | null) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return v === null || v === undefined || v === "" ? "-" : String(v);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function evidenceUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

function EntitySearchSelect<T extends { id: string }>({
  label,
  hint,
  placeholder,
  value,
  onSelect,
  fetchResults,
  renderOption,
  getLabel,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: T | null;
  onSelect: (item: T | null) => void;
  fetchResults: (query: string) => Promise<T[]>;
  renderOption: (item: T) => ReactNode;
  getLabel: (item: T) => string;
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
    timer.current = setTimeout(() => runSearch(v), 250);
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
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
        {open && !value && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "var(--sh-sm)", maxHeight: 220, overflowY: "auto",
          }}>
            {loading ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>Searching...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No matches</div>
            ) : (
              results.map((item) => (
                <div key={item.id} className="search-opt" onMouseDown={() => { onSelect(item); setQuery(""); setOpen(false); }}>
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

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 10 }}>{message}</div>;
}

function CreateReferralModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: ReferralOut) => void }) {
  const [f, setF] = useState({
    lead_type: "Merchant",
    merchant_name: "",
    business_reg_no: "",
    merchant_bank: "",
    referral_source_bank: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.merchant_name.trim();

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const referral = await api.referrals.create({
        lead_type: f.lead_type,
        merchant_name: f.merchant_name.trim(),
        business_reg_no: f.business_reg_no.trim() || null,
        merchant_bank: f.merchant_bank.trim() || null,
        referral_source_bank: f.referral_source_bank.trim() || null,
        contact_name: f.contact_name.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        address: f.address.trim() || null,
        notes: f.notes.trim() || null,
      });
      onCreate(referral);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create referral");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Referral"
      sub="Create a referral lead before merchant onboarding"
      icon="link"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>{saving ? "Creating..." : "Create Referral"}</Btn>
      </>}
    >
      <Field label="Lead type">
        <select className="input" value={f.lead_type} onChange={(e) => set("lead_type", e.target.value)}>
          <option>Merchant</option>
        </select>
      </Field>
      <div className="field-row">
        <Field label="Merchant name" hint="required">
          <input className="input" value={f.merchant_name} onChange={(e) => set("merchant_name", e.target.value)} />
        </Field>
        <Field label="Business registration no.">
          <input className="input" value={f.business_reg_no} onChange={(e) => set("business_reg_no", e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Merchant bank">
          <input className="input" value={f.merchant_bank} onChange={(e) => set("merchant_bank", e.target.value)} />
        </Field>
        <Field label="Referral source bank">
          <input className="input" value={f.referral_source_bank} onChange={(e) => set("referral_source_bank", e.target.value)} />
        </Field>
      </div>
      <Field label="Contact name">
        <input className="input" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Phone">
          <input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Address">
        <input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function AssignProcessorModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [processor, setProcessor] = useState<UserOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!processor) return;
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.assignProcessor(referral.id, processor.id);
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to assign processor");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Assign Processor"
      sub={referral.merchant_name}
      icon="users"
      onClose={onClose}
      size="overflow-visible"
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!processor || saving} onClick={submit}>{saving ? "Assigning..." : "Assign"}</Btn>
      </>}
    >
      <EntitySearchSelect<UserOut>
        label="Processor"
        hint="required"
        placeholder="Search users..."
        value={processor}
        onSelect={setProcessor}
        fetchResults={(query) => api.users.list({ query, per_page: 8, status: "Active" }).then((p) => p.items)}
        getLabel={(u) => `${u.name} · ${u.email}`}
        renderOption={(u) => (
          <div className="cell-2">
            <span className="td-strong">{u.name}</span>
            <span className="c2-sub">{u.email} · {u.role}</span>
          </div>
        )}
      />
      <ErrorText message={err} />
    </Modal>
  );
}

function ValidateReferralModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [leadStatus, setLeadStatus] = useState(referral.lead_status || "Valid Lead");
  const [bankReferred, setBankReferred] = useState(!!referral.is_bank_referred);
  const [existingMerchant, setExistingMerchant] = useState(!!referral.is_existing_or_former_merchant);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.update(referral.id, {
        lead_status: leadStatus,
        is_bank_referred: bankReferred,
        is_existing_or_former_merchant: existingMerchant,
      });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update referral");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Review Lead"
      sub={referral.merchant_name}
      icon="shield"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>{saving ? "Saving..." : "Save Review"}</Btn>
      </>}
    >
      <Field label="Lead progress">
        <select className="input" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
          {LEAD_STATUSES.filter((s) => s !== "All").map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={bankReferred} onChange={(e) => setBankReferred(e.target.checked)} />
          Bank-referred lead
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={existingMerchant} onChange={(e) => setExistingMerchant(e.target.checked)} />
          Existing or former merchant
        </label>
      </div>
      <ErrorText message={err} />
    </Modal>
  );
}

function ProcessingModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [f, setF] = useState({
    lead_status: referral.lead_status || "In Progress",
    processing_status: referral.processing_status || "",
    document_submission_date: referral.document_submission_date || "",
    bank_submission_reference: referral.bank_submission_reference || "",
    next_follow_up_date: referral.next_follow_up_date || "",
    notes: referral.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.updateProcessing(referral.id, {
        lead_status: f.lead_status,
        processing_status: f.processing_status.trim(),
        document_submission_date: f.document_submission_date || null,
        bank_submission_reference: f.bank_submission_reference.trim() || null,
        next_follow_up_date: f.next_follow_up_date || null,
        notes: f.notes.trim() || null,
      });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update processing");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Update Processing"
      sub={referral.merchant_name}
      icon="edit"
      onClose={onClose}
      size="overflow-visible"
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>{saving ? "Saving..." : "Save Progress"}</Btn>
      </>}
    >
      <Field label="Lead progress">
        <select className="input" value={f.lead_status} onChange={(e) => set("lead_status", e.target.value)}>
          {LEAD_STATUSES.filter((s) => s !== "All").map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Processing status">
        <input className="input" value={f.processing_status} onChange={(e) => set("processing_status", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Document submission date">
          <input className="input" type="date" value={f.document_submission_date} onChange={(e) => set("document_submission_date", e.target.value)} />
        </Field>
        <Field label="Next follow-up date">
          <input className="input" type="date" value={f.next_follow_up_date} onChange={(e) => set("next_follow_up_date", e.target.value)} />
        </Field>
      </div>
      <Field label="Bank submission reference">
        <input className="input" value={f.bank_submission_reference} onChange={(e) => set("bank_submission_reference", e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function LinkMerchantModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [merchant, setMerchant] = useState<MerchantOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!merchant) return;
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.linkMerchant(referral.id, merchant.id);
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to link merchant");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Link Merchant"
      sub={referral.merchant_name}
      icon="link"
      onClose={onClose}
      size="overflow-visible"
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!merchant || saving} onClick={submit}>{saving ? "Linking..." : "Link Merchant"}</Btn>
      </>}
    >
      <EntitySearchSelect<MerchantOut>
        label="Merchant"
        hint="required"
        placeholder="Search merchant, MID, bank..."
        value={merchant}
        onSelect={setMerchant}
        fetchResults={(query) => api.merchants.list({ query, per_page: 8 }).then((p) => p.items)}
        getLabel={(m) => `${m.name} · ${m.mid}`}
        renderOption={(m) => (
          <div className="cell-2">
            <span className="td-strong">{m.name}</span>
            <span className="c2-sub">{m.id} · {m.mid} · {m.bank}</span>
          </div>
        )}
      />
      <ErrorText message={err} />
    </Modal>
  );
}

function ConfirmReferralModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [date, setDate] = useState(referral.first_transaction_date || "");
  const [reference, setReference] = useState(referral.first_transaction_reference || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!date) return;
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.confirm(referral.id, {
        first_transaction_date: date,
        first_transaction_reference: reference.trim() || null,
      });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to confirm transaction");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Confirm First Transaction"
      sub={referral.merchant_name}
      icon="checkCircle"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!date || saving} onClick={submit}>{saving ? "Confirming..." : "Confirm"}</Btn>
      </>}
    >
      <Field label="First transaction date" hint="required">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Transaction reference">
        <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function CancelReferralModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const reasons = ["Merchant not interested", "Duplicate merchant", "Existing merchant", "Bank-referred merchant", "Failed document submission", "Rejected by bank", "Unable to contact merchant", "Wrong contact details", "Other"];
  const [reason, setReason] = useState(reasons[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.cancel(referral.id, reason);
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to cancel referral");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Close Referral"
      sub={referral.merchant_name}
      icon="x"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="x" disabled={saving} onClick={submit}>{saving ? "Closing..." : "Close Referral"}</Btn>
      </>}
    >
      <Field label="Reason">
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function EditLeadInfoModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [f, setF] = useState<ReferralUpdate>({
    merchant_name: referral.merchant_name,
    business_reg_no: referral.business_reg_no ?? "",
    merchant_bank: referral.merchant_bank ?? "",
    referral_source_bank: referral.referral_source_bank ?? "",
    contact_name: referral.contact_name,
    phone: referral.phone,
    email: referral.email,
    address: referral.address,
    notes: referral.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof ReferralUpdate, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = String(f.merchant_name ?? "").trim() && String(f.contact_name ?? "").trim();

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.update(referral.id, {
        merchant_name: String(f.merchant_name ?? "").trim(),
        business_reg_no: String(f.business_reg_no ?? "").trim() || null,
        merchant_bank: String(f.merchant_bank ?? "").trim() || null,
        referral_source_bank: String(f.referral_source_bank ?? "").trim() || null,
        contact_name: String(f.contact_name ?? "").trim(),
        phone: String(f.phone ?? "").trim(),
        email: String(f.email ?? "").trim(),
        address: String(f.address ?? "").trim(),
        notes: String(f.notes ?? "").trim() || null,
      });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update lead info");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Lead Information"
      sub={referral.merchant_name}
      icon="building"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>{saving ? "Saving..." : "Save"}</Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Merchant name" hint="required">
          <input className="input" value={String(f.merchant_name ?? "")} onChange={(e) => set("merchant_name", e.target.value)} />
        </Field>
        <Field label="Business reg no.">
          <input className="input" value={String(f.business_reg_no ?? "")} onChange={(e) => set("business_reg_no", e.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Merchant bank">
          <input className="input" value={String(f.merchant_bank ?? "")} onChange={(e) => set("merchant_bank", e.target.value)} />
        </Field>
        <Field label="Referral source bank">
          <input className="input" value={String(f.referral_source_bank ?? "")} onChange={(e) => set("referral_source_bank", e.target.value)} />
        </Field>
      </div>
      <Field label="Contact name" hint="required">
        <input className="input" value={String(f.contact_name ?? "")} onChange={(e) => set("contact_name", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Phone">
          <input className="input" value={String(f.phone ?? "")} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={String(f.email ?? "")} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Address">
        <input className="input" value={String(f.address ?? "")} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className="textarea" value={String(f.notes ?? "")} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function EditLeadProgressModal({ referral, onClose, onSaved }: { referral: ReferralOut; onClose: () => void; onSaved: (r: ReferralOut) => void }) {
  const [leadStatus, setLeadStatus] = useState(referral.lead_status || "New");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const next = await api.referrals.update(referral.id, { lead_status: leadStatus });
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update lead progress");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Lead Progress"
      sub={referral.merchant_name}
      icon="activity"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>{saving ? "Saving..." : "Save"}</Btn>
      </>}
    >
      <Field label="Lead progress">
        <select className="input" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
          {LEAD_STATUSES.filter((s) => s !== "All").map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <ErrorText message={err} />
    </Modal>
  );
}

function UploadAttachmentModal({ referral, onClose, onUploaded }: { referral: ReferralOut; onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!file) return;
    setSaving(true); setErr(null);
    try {
      await api.referrals.uploadAttachment(referral.id, file);
      onUploaded();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to upload attachment");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Upload Attachment"
      sub={referral.merchant_name}
      icon="upload"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="upload" disabled={!file || saving} onClick={submit}>{saving ? "Uploading..." : "Upload"}</Btn>
      </>}
    >
      <div
        className={"dropzone" + (file ? " has" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
      >
        <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
        <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>Merchant documents, bank proof or internal notes</div>
        <input ref={inputRef} type="file" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
      </div>
      {file && (
        <div className="dz-files">
          <div className="dz-file">
            <Icon name="fileCheck" size={16} className="dzf-ico" />
            <span className="dzf-name">{file.name}</span>
            <span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      )}
      <ErrorText message={err} />
    </Modal>
  );
}

function GenerateBatchModal({ onClose, onCreate }: { onClose: () => void; onCreate: (b: ReferralBonusBatchOut) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const batch = await api.referralBonusBatches.create({ year, quarter });
      onCreate(batch);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to generate batch");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Generate Bonus Batch"
      sub="Create quarterly referral commission lines"
      icon="cash"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>{saving ? "Generating..." : "Generate"}</Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Year">
          <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
        <Field label="Quarter">
          <select className="input" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </Field>
      </div>
      <ErrorText message={err} />
    </Modal>
  );
}

function MarkPaidModal({ batch, onClose, onSaved }: { batch: ReferralBonusBatchOut; onClose: () => void; onSaved: (b: ReferralBonusBatchOut) => void }) {
  const [paidDate, setPaidDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!paidDate || !file) return;
    setSaving(true); setErr(null);
    try {
      const next = await api.referralBonusBatches.markPaid(batch.id, paidDate, file);
      onSaved(next);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to mark batch paid");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Mark Batch Paid"
      sub={`${batch.year} Q${batch.quarter} · ${batch.id}`}
      icon="checkCircle"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!paidDate || !file || saving} onClick={submit}>{saving ? "Saving..." : "Mark Paid"}</Btn>
      </>}
    >
      <Field label="Paid date" hint="required">
        <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
      </Field>
      <Field label="Payment proof" hint="required">
        <div
          className={"dropzone" + (file ? " has" : "")}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
        >
          <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>PDF, image or payment confirmation file</div>
          <input ref={inputRef} type="file" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        </div>
      </Field>
      {file && <div className="dz-files"><div className="dz-file"><Icon name="fileCheck" size={16} className="dzf-ico" /><span className="dzf-name">{file.name}</span><span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span></div></div>}
      <ErrorText message={err} />
    </Modal>
  );
}

export function Referrals({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [rows, setRows] = useState<ReferralOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [leadStatus, setLeadStatus] = useState("All");
  const [recordStatus, setRecordStatus] = useState("All");
  const [commissionStatus, setCommissionStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.referrals.list({
      page,
      per_page: REFERRALS_PAGE_SIZE,
      query: q || undefined,
      lead_status: leadStatus === "All" ? undefined : leadStatus,
      status: recordStatus === "All" ? undefined : recordStatus,
      commission_status: commissionStatus === "All" ? undefined : commissionStatus,
    }).then((p) => {
      setRows(p.items);
      setTotal(p.total);
      setPages(p.pages || 1);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, q, leadStatus, recordStatus, commissionStatus]);

  function resetPage(v: string, setter: (value: string) => void) {
    setter(v);
    setPage(1);
  }

  return (
    <div>
      <PageHead
        title="Referrals"
        sub={`${total} referral leads · merchant referrals and commission eligibility`}
        actions={can("Referral Bonuses.Create") ? <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add Referral</Btn> : undefined}
      />
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={(v) => resetPage(v, setQ)} placeholder="Search referral, merchant, contact..." />
          <select className="select" value={leadStatus} onChange={(e) => resetPage(e.target.value, setLeadStatus)}>
            {LEAD_STATUSES.map((s) => <option key={s}>{s === "All" ? "All Lead Progress" : s}</option>)}
          </select>
          <select className="select" value={recordStatus} onChange={(e) => resetPage(e.target.value, setRecordStatus)}>
            {REFERRAL_STATUSES.map((s) => <option key={s}>{s === "All" ? "All Record Status" : s}</option>)}
          </select>
          <select className="select" value={commissionStatus} onChange={(e) => resetPage(e.target.value, setCommissionStatus)}>
            {COMMISSION_STATUSES.map((s) => <option key={s}>{s === "All" ? "All Commission Status" : s}</option>)}
          </select>
          <span className="tb-meta">{rows.length} shown</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading...</div>
        ) : rows.length === 0 ? (
          <Empty icon="link" title="No referrals match" sub="Try a different search or filter" />
        ) : (
          <ResponsiveTable
            rows={rows}
            getKey={(r) => r.id}
            onRowClick={(r) => nav("referral-detail", r.id)}
            columns={[
              { key: "referral", header: "Referral", render: (r) => <span className="td-mono td-strong">{r.id}</span> },
              { key: "merchant", header: "Merchant", render: (r) => <Entity name={r.merchant_name} sub={r.contact_name || r.business_reg_no || r.lead_type} /> },
              { key: "referrer", header: "Referrer", render: (r) => userLabel(r.referrer) },
              { key: "processor", header: "Processor", render: (r) => r.processor ? userLabel(r.processor) : <span className="td-mut">Unassigned</span> },
              { key: "lead", header: "Lead Progress", render: (r) => statusChip(r.lead_status, "lead") },
              { key: "record", header: "Record Status", render: (r) => statusChip(r.status, "record") },
              { key: "commission", header: "Commission", render: (r) => statusChip(r.commission_status, "commission") },
              { key: "linked", header: "Linked", render: (r) => r.merchant_id || r.merchant ? <Chip cls="chip-ok">Linked</Chip> : <Chip cls="chip-neutral">No</Chip> },
              { key: "reversal", header: "Reversal", render: (r) => r.reversal_required ? <Chip cls="chip-bad">Required</Chip> : <span className="td-mut">-</span> },
            ]}
            renderMobile={(r) => (
              <MobileListItem
                title={r.merchant_name}
                sub={<span className="td-mono">{r.id}</span>}
                status={statusChip(r.lead_status, "lead")}
                meta={[
                  { label: "Referrer", value: userLabel(r.referrer) },
                  { label: "Processor", value: r.processor ? userLabel(r.processor) : "Unassigned" },
                  { label: "Record", value: statusChip(r.status, "record") },
                  { label: "Commission", value: statusChip(r.commission_status, "commission") },
                  { label: "Linked", value: r.merchant_id || r.merchant ? <Chip cls="chip-ok">Linked</Chip> : <Chip cls="chip-neutral">No</Chip> },
                ]}
                onClick={() => nav("referral-detail", r.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={total} shown={pageShown(rows, total)} page={page} pages={pages} onPageChange={setPage} />
      </Card>
      {showCreate && can("Referral Bonuses.Create") && <CreateReferralModal onClose={() => setShowCreate(false)} onCreate={(r) => nav("referral-detail", r.id)} />}
    </div>
  );
}

export function ReferralDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const [referral, setReferral] = useState<ReferralOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState<null | "review" | "assign" | "processing" | "link" | "confirm" | "cancel" | "upload" | "edit-lead" | "edit-progress">(null);
  const [toast, flash] = useToast();

  const load = useCallback(() => {
    return api.referrals.get(id)
      .then(setReferral)
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); else console.error(e); })
      .finally(() => setLoading(false));
  }, [id]);
  

  useEffect(() => { load(); }, [load]);

  function update(next: ReferralOut) {
    setReferral(next);
    flash("Referral updated");
  }

  if (loading) return (
    <div>
      <PageHead title="Referral" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("referrals")}>Back</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading...</div>
    </div>
  );

  if (notFound || !referral) return (
    <div>
      <PageHead title="Referral not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("referrals")}>Back</Btn>} />
      <Empty icon="link" title="Referral not found" sub={"No referral with ID " + id} />
    </div>
  );

  const merchantId = referral.merchant?.id || referral.merchant_id;

  return (
    <div>
      {toast}
      <div className="back-link" onClick={() => nav("referrals")}><Icon name="arrowLeft" size={16} /> Back to Referrals</div>
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">{referral.merchant_name}</h1>
            {statusChip(referral.status, "record")}
          </div>
          <p className="page-sub">{referral.id} · {referral.lead_type} · submitted {fmtDate(referral.submitted_at)}</p>
        </div>
        <div className="page-head-actions">
          {/* <Btn variant="ghost" icon="shield" onClick={() => setModal("review")}>Review</Btn> */}
          {can("Referral Bonuses.Edit") && <Btn variant="ghost" icon="users" onClick={() => setModal("assign")}>Assign Processor</Btn>}
          {/* <Btn variant="ghost" icon="edit" onClick={() => setModal("processing")}>Progress</Btn> */}
          {can("Referral Bonuses.Edit") && <Btn variant="ghost" icon="upload" onClick={() => setModal("upload")}>Attachment</Btn>}
          {can("Referral Bonuses.Confirm") && <Btn variant="primary" icon="checkCircle" onClick={() => setModal("confirm")}>Confirm</Btn>}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { l: "Lead Progress", v: referral.lead_status, ico: "activity", c: "var(--info)" },
          { l: "Commission", v: referral.commission_status, ico: "cash", c: "var(--green-700)" },
          { l: "Processor", v: referral.processor ? userLabel(referral.processor) : "Unassigned", ico: "users", c: "var(--warn)" },
          { l: "Merchant Link", v: merchantId ? merchantId : "Not linked", ico: "link", c: merchantId ? "var(--ok)" : "var(--neutral)" },
        ].map((s) => (
          <div key={s.l} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: "var(--bg)", color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: 18 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Lead Information" icon="building" actions={can("Referral Bonuses.Edit") ? <Btn sm variant="ghost" icon="edit" onClick={() => setModal("edit-lead")}>Edit</Btn> : undefined}>
            <div className="card-pad">
              <dl className="kv">
                <dt>Merchant name</dt><dd>{referral.merchant_name}</dd>
                <dt>Business reg no.</dt><dd>{fieldValue(referral.business_reg_no)}</dd>
                <dt>Merchant bank</dt><dd>{fieldValue(referral.merchant_bank)}</dd>
                <dt>Referral source bank</dt><dd>{fieldValue(referral.referral_source_bank)}</dd>
                <dt>Contact</dt><dd>{referral.contact_name}</dd>
                <dt>Phone</dt><dd>{referral.phone}</dd>
                <dt>Email</dt><dd>{fieldValue(referral.email)}</dd>
                <dt>Address</dt><dd style={{ fontWeight: 400 }}>{fieldValue(referral.address)}</dd>
                <dt>Notes</dt><dd style={{ fontWeight: 400 }}>{fieldValue(referral.notes)}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Processing Progress" icon="activity" actions={can("Referral Bonuses.Edit") ? <Btn sm variant="ghost" icon="edit" onClick={() => setModal("edit-progress")}>Edit</Btn> : undefined}>
            <div className="card-pad">
              <dl className="kv">
                <dt>Lead progress</dt><dd>{statusChip(referral.lead_status, "lead")}</dd>
                <dt>Processing status</dt><dd>{fieldValue(referral.processing_status)}</dd>
                <dt>Document submitted</dt><dd>{fmtDate(referral.document_submission_date)}</dd>
                <dt>Bank reference</dt><dd className="mono">{fieldValue(referral.bank_submission_reference)}</dd>
                <dt>Next follow-up</dt><dd>{fmtDate(referral.next_follow_up_date)}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Merchant Link & Activation" icon="link" actions={can("Referral Bonuses.Edit") ? <Btn sm variant="ghost" icon="link" onClick={() => setModal("link")}>Link</Btn> : undefined}>
            <div className="card-pad">
              <dl className="kv">
                <dt>Linked merchant</dt><dd>{merchantId ? <span className="mono">{merchantId}</span> : "-"}</dd>
                <dt>Merchant name</dt><dd>{fieldValue(referral.merchant?.name)}</dd>
                <dt>Activation date</dt><dd>{fmtDate(referral.activation_date)}</dd>
                <dt>Terminal serial</dt><dd className="mono">{fieldValue(referral.terminal_serial)}</dd>
                <dt>Terminal TID</dt><dd className="mono">{fieldValue(referral.terminal_tid)}</dd>
              </dl>
            </div>
          </Card>

          <Card title="First Transaction & Commission" icon="cash">
            <div className="card-pad">
              <dl className="kv">
                <dt>First transaction</dt><dd>{fmtDate(referral.first_transaction_date)}</dd>
                <dt>Transaction ref.</dt><dd className="mono">{fieldValue(referral.first_transaction_reference)}</dd>
                <dt>Eligibility date</dt><dd>{fmtDate(referral.eligibility_date)}</dd>
                <dt>Commission status</dt><dd>{statusChip(referral.commission_status, "commission")}</dd>
              </dl>
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="People" icon="users">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "98px 1fr" }}>
                <dt>Referrer</dt><dd>{userLabel(referral.referrer)}</dd>
                <dt>Processor</dt><dd>{referral.processor ? userLabel(referral.processor) : "-"}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Review Flags" icon="shield">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "150px 1fr" }}>
                <dt>Bank-referred</dt><dd>{fieldValue(referral.is_bank_referred)}</dd>
                <dt>Existing/former</dt><dd>{fieldValue(referral.is_existing_or_former_merchant)}</dd>
                <dt>Record status</dt><dd>{statusChip(referral.status, "record")}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Reversal" icon="alert">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "130px 1fr" }}>
                <dt>Required</dt><dd>{fieldValue(referral.reversal_required)}</dd>
                <dt>Reason</dt><dd>{fieldValue(referral.reversal_reason)}</dd>
                <dt>Reversed at</dt><dd>{fmtDateTime(referral.reversed_at)}</dd>
                <dt>Line created</dt><dd>{fieldValue(referral.reversal_line_created)}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Attachments" icon="file" actions={can("Referral Bonuses.Edit") ? <Btn sm variant="ghost" icon="upload" onClick={() => setModal("upload")}>Upload</Btn> : undefined}>
            <div className="card-pad">
              {!referral.attachments?.length ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No attachments</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {referral.attachments.map((file) => {
                    const href = file.path ? evidenceUrl(file.path) : file.url ? evidenceUrl(file.url) : null;
                    return (
                      <div key={file.id} className="dz-file">
                        <Icon name="fileCheck" size={16} className="dzf-ico" />
                        <span className="dzf-name">{file.filename}</span>
                        <span className="dzf-size">{fmtDate(file.uploaded_at)}</span>
                        {href ? (
                          <span style={{ display: "flex", gap: 6, marginLeft: 6 }}>
                            <a className="icon-btn" href={href} target="_blank" rel="noreferrer" title="View attachment">
                              <Icon name="eye" size={14} />
                            </a>
                            <a className="icon-btn" href={href} download={file.filename} title="Download attachment">
                              <Icon name="download" size={14} />
                            </a>
                          </span>
                        ) : (
                          <span style={{ display: "flex", gap: 6, marginLeft: 6 }}>
                            <button className="icon-btn" disabled title="No attachment path available"><Icon name="eye" size={14} /></button>
                            <button className="icon-btn" disabled title="No attachment path available"><Icon name="download" size={14} /></button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {merchantId && <Btn variant="ghost" icon="merchants" onClick={() => nav("merchant-detail", merchantId)}>Open Merchant</Btn>}
              {can("Referral Bonuses.Edit") && <Btn variant="ghost" icon="link" onClick={() => setModal("link")}>Link Existing Merchant</Btn>}
              {can("Merchants.Create") && <Btn variant="ghost" icon="merchants" onClick={() => nav("merchants")}>Create Merchant</Btn>}
              {can("Referral Bonuses.Edit") && <Btn variant="danger" icon="x" onClick={() => setModal("cancel")}>Close Referral</Btn>}
            </div>
          </Card>
        </div>
      </div>

      {modal === "edit-lead" && can("Referral Bonuses.Edit") && <EditLeadInfoModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "edit-progress" && can("Referral Bonuses.Edit") && <EditLeadProgressModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "review" && can("Referral Bonuses.Edit") && <ValidateReferralModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "assign" && can("Referral Bonuses.Edit") && <AssignProcessorModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "processing" && can("Referral Bonuses.Edit") && <ProcessingModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "link" && can("Referral Bonuses.Edit") && <LinkMerchantModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "confirm" && can("Referral Bonuses.Confirm") && <ConfirmReferralModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "cancel" && can("Referral Bonuses.Edit") && <CancelReferralModal referral={referral} onClose={() => setModal(null)} onSaved={update} />}
      {modal === "upload" && can("Referral Bonuses.Edit") && <UploadAttachmentModal referral={referral} onClose={() => setModal(null)} onUploaded={() => load().then(() => flash("Attachment uploaded"))} />}
    </div>
  );
}

export function ReferralBonusBatches({ nav }: { nav: NavFn }) {
  const can = useCan();
  const now = new Date();
  const [rows, setRows] = useState<ReferralBonusBatchOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [quarter, setQuarter] = useState("All");
  const [status, setStatus] = useState("All");
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    api.referralBonusBatches.list({
      page,
      per_page: BATCHES_PAGE_SIZE,
      year: year ? Number(year) : undefined,
      quarter: quarter === "All" ? undefined : Number(quarter),
      status: status === "All" ? undefined : status,
    }).then((p) => {
      setRows(p.items);
      setTotal(p.total);
      setPages(p.pages || 1);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, year, quarter, status]);

  function resetPage(v: string, setter: (value: string) => void) {
    setter(v);
    setPage(1);
  }

  return (
    <div>
      <PageHead
        title="Referral Bonuses"
        sub={`${total} quarterly batches · RM50 lead generator and RM50 processor lines`}
        actions={can("Referral Bonuses.Create") ? <Btn variant="primary" icon="plus" onClick={() => setShowGenerate(true)}>Generate Batch</Btn> : undefined}
      />
      <Card>
        <Toolbar>
          <input className="input" style={{ maxWidth: 120 }} type="number" value={year} onChange={(e) => resetPage(e.target.value, setYear)} />
          <select className="select" value={quarter} onChange={(e) => resetPage(e.target.value, setQuarter)}>
            <option>All</option>
            {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => resetPage(e.target.value, setStatus)}>
            {BATCH_STATUSES.map((s) => <option key={s}>{s === "All" ? "All Statuses" : s}</option>)}
          </select>
          <span className="tb-meta">{rows.length} shown</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading...</div>
        ) : rows.length === 0 ? (
          <Empty icon="cash" title="No batches match" sub="Try a different year, quarter or status" />
        ) : (
          <ResponsiveTable
            rows={rows}
            getKey={(b) => b.id}
            onRowClick={(b) => nav("referral-bonus-batch-detail", b.id)}
            columns={[
              { key: "batch", header: "Batch", render: (b) => <span className="td-mono td-strong">{b.id}</span> },
              { key: "quarter", header: "Quarter", render: (b) => <>{b.year} Q{b.quarter}</> },
              { key: "status", header: "Status", render: (b) => statusChip(b.status, "batch") },
              { key: "lines", header: "Lines", render: (b) => b.line_count ?? b.lines?.length ?? 0 },
              { key: "total", header: "Total", render: (b) => <span className="td-strong">{money(b.total_amount)}</span> },
              { key: "generated", header: "Generated", render: (b) => <span className="td-mut">{fmtDate(b.generated_at)}</span> },
              { key: "paid", header: "Paid Date", render: (b) => <span className="td-mut">{fmtDate(b.paid_date)}</span> },
            ]}
            renderMobile={(b) => (
              <MobileListItem
                title={`${b.year} Q${b.quarter}`}
                sub={<span className="td-mono">{b.id}</span>}
                status={statusChip(b.status, "batch")}
                meta={[
                  { label: "Lines", value: b.line_count ?? b.lines?.length ?? 0 },
                  { label: "Total", value: <span className="td-strong">{money(b.total_amount)}</span> },
                  { label: "Generated", value: fmtDate(b.generated_at) },
                  { label: "Paid Date", value: fmtDate(b.paid_date) },
                ]}
                onClick={() => nav("referral-bonus-batch-detail", b.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={total} shown={pageShown(rows, total)} page={page} pages={pages} onPageChange={setPage} />
      </Card>
      {showGenerate && can("Referral Bonuses.Create") && <GenerateBatchModal onClose={() => setShowGenerate(false)} onCreate={(b) => nav("referral-bonus-batch-detail", b.id)} />}
    </div>
  );
}

function BatchLinesTable({ lines }: { lines: ReferralBonusLineOut[] }) {
  if (!lines.length) return <Empty icon="cash" title="No commission lines" sub="This batch has no lines" />;
  return (
    <ResponsiveTable
      rows={lines}
      getKey={(line, index) => line.id || line.line_id || index}
      columns={[
        { key: "line", header: "Line", render: (line) => <span className="td-mono td-strong">{line.line_id || line.id}</span> },
        { key: "role", header: "Role", render: (line) => line.commission_role },
        { key: "staff", header: "Staff", render: (line) => <Entity name={line.staff_name} sub={line.staff_email || line.staff_user_id} slate /> },
        { key: "merchant", header: "Merchant", render: (line) => <div className="cell-2"><span className="td-strong">{line.merchant_name}</span><span className="c2-sub">{line.merchant_id || "-"}</span></div> },
        { key: "referral", header: "Referral", render: (line) => <span className="td-mono">{line.referral_id}</span> },
        { key: "amount", header: "Amount", render: (line) => <span className="td-strong" style={{ color: Number(line.amount) < 0 ? "var(--bad)" : undefined }}>{money(line.amount)}</span> },
        { key: "reason", header: "Reason", render: (line) => <span className="td-mut">{fieldValue(line.reason)}</span> },
      ]}
      renderMobile={(line) => (
        <MobileListItem
          title={line.merchant_name}
          sub={<span className="td-mono">{line.line_id || line.id}</span>}
          status={<span className="td-strong" style={{ color: Number(line.amount) < 0 ? "var(--bad)" : undefined }}>{money(line.amount)}</span>}
          meta={[
            { label: "Role", value: line.commission_role },
            { label: "Staff", value: line.staff_name },
            { label: "Referral", value: <span className="td-mono">{line.referral_id}</span> },
            { label: "Reason", value: fieldValue(line.reason) },
          ]}
        />
      )}
    />
  );
}

export function ReferralBonusBatchDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const [batch, setBatch] = useState<ReferralBonusBatchOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [toast, flash] = useToast();

  const load = useCallback(() => {
    return api.referralBonusBatches.get(id)
      .then(setBatch)
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); else console.error(e); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    if (!batch) return;
    if (!can("Referral Bonuses.Export")) return;
    setExporting(true);
    try {
      const blob = await api.referralBonusBatches.export(batch.id);
      downloadBlob(blob, `referral-bonus-${batch.year}-q${batch.quarter}-${batch.id}.csv`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div>
      <PageHead title="Referral Bonus Batch" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("referral-bonus-batches")}>Back</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading...</div>
    </div>
  );

  if (notFound || !batch) return (
    <div>
      <PageHead title="Batch not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("referral-bonus-batches")}>Back</Btn>} />
      <Empty icon="cash" title="Batch not found" sub={"No referral bonus batch with ID " + id} />
    </div>
  );

  const lines = batch.lines || [];
  const totalAmount = batch.total_amount ?? lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  return (
    <div>
      {toast}
      <div className="back-link" onClick={() => nav("referral-bonus-batches")}><Icon name="arrowLeft" size={16} /> Back to Referral Bonuses</div>
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">{batch.year} Q{batch.quarter} Referral Bonus</h1>
            {statusChip(batch.status, "batch")}
          </div>
          <p className="page-sub">{batch.id} · generated {fmtDate(batch.generated_at)}</p>
        </div>
        <div className="page-head-actions">
          {can("Referral Bonuses.Export") && <Btn variant="ghost" icon="download" disabled={exporting} onClick={exportCsv}>{exporting ? "Exporting..." : "Export CSV"}</Btn>}
          {can("Referral Bonuses.Process") && <Btn variant="primary" icon="checkCircle" disabled={batch.status === "Paid"} onClick={() => setShowPaid(true)}>Mark Paid</Btn>}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { l: "Batch Status", v: batch.status, ico: "activity", c: batch.status === "Paid" ? "var(--ok)" : "var(--info)" },
          { l: "Commission Lines", v: String(batch.line_count ?? lines.length), ico: "file", c: "var(--indigo)" },
          { l: "Total Amount", v: money(totalAmount), ico: "cash", c: "var(--green-700)" },
          { l: "Paid Date", v: fmtDate(batch.paid_date), ico: "calendar", c: "var(--warn)" },
        ].map((s) => (
          <div key={s.l} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: "var(--bg)", color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: 18 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <Card title="Commission Lines" icon="cash">
        <BatchLinesTable lines={lines} />
      </Card>

      {showPaid && can("Referral Bonuses.Process") && (
        <MarkPaidModal
          batch={batch}
          onClose={() => setShowPaid(false)}
          onSaved={(next) => {
            setBatch(next);
            flash("Batch marked paid");
          }}
        />
      )}
    </div>
  );
}
