/* PaidChain — Merchant listing + detail */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, MerchantStatus, Readiness, Entity, Pagination, Empty, Chip, TerminalStatus, JobStatus, SlaChip, Modal, Field, MobileListItem, ResponsiveTable } from "./components";
import { BANKS, JOB_TYPES } from "./data";
import { api, ApiError, merchantDisplayMid, merchantDisplayBank } from "@/lib/api";
import type { AddressIn, BankOut, CustomerOut, MerchantOut, MerchantCreate, MerchantUpdate, MerchantTerminalOut, MerchantJobOut, RentalPlanOut, MerchantCommercialProfileIn, MerchantCommercialProfileOut, MerchantMidOut, MerchantMidCreate, MerchantMidUpdate, MerchantMidAcceptanceOut, MerchantMidAcceptanceCreate, MerchantMidAcceptanceUpdate, MerchantMidHistoryOut, MerchantMidAcceptanceHistoryOut, AcceptanceSettingOut, AcceptanceSettingCreate, AcceptanceSettingUpdate, MdrOut } from "@/lib/api";
import { NavFn } from "./shell";
import { CreateJobModal } from "./screen-jobs";
import { useCan } from "@/lib/use-permissions";

/* =================== CREATE MERCHANT MODAL =================== */
interface CreateMerchantModalProps {
  onClose: () => void;
  onSave: (m: MerchantOut) => void;
  customerId: string;
  customerName: string;
  customer?: CustomerOut | null;
  existingMerchant?: MerchantOut | null;
}

type MerchantAddressForm = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
};

function blankMerchantAddressForm(): MerchantAddressForm {
  return { addressLine1: "", addressLine2: "", city: "", state: "", postcode: "" };
}

function addressFormFromAddress(address?: { address_line_1: string | null; address_line_2: string | null; city: string | null; state: string | null; postcode: string | null } | null): MerchantAddressForm {
  if (!address) return blankMerchantAddressForm();
  return {
    addressLine1: address.address_line_1 ?? "",
    addressLine2: address.address_line_2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postcode: address.postcode ?? "",
  };
}

function merchantInitialAddressForm(existingMerchant: MerchantOut | null, customer?: CustomerOut | null): MerchantAddressForm {
  if (existingMerchant) return addressFormFromAddress(existingMerchant.addresses?.[0]);
  return addressFormFromAddress(customer?.addresses?.[0]);
}

function buildMerchantAddressPayload(address: MerchantAddressForm): AddressIn[] {
  const line1 = address.addressLine1.trim();
  const line2 = address.addressLine2.trim();
  const city = address.city.trim();
  const state = address.state.trim();
  const postcode = address.postcode.trim();
  if (!line1 && !line2 && !city && !state && !postcode) return [];
  return [{
    address_line_1: line1 || null,
    address_line_2: line2 || null,
    city: city || null,
    state: state || null,
    postcode: postcode || null,
  }];
}

function merchantAddressRows(merchant: MerchantOut): Array<[string, string]> {
  const address = merchant.addresses?.[0];
  if (!address) return [];
  return [
    ["Address line 1", address.address_line_1 ?? ""],
    ["Address line 2", address.address_line_2 ?? ""],
    ["City", address.city ?? ""],
    ["State", address.state ?? ""],
    ["Postcode", address.postcode ?? ""],
  ].filter((row): row is [string, string] => Boolean(row[1].trim()));
}

function merchantTerminalSimLabel(t: MerchantTerminalOut) {
  const sim = t.simcard ?? t.sim;
  return [sim?.carrier, sim?.msisdn || sim?.iccid || t.sim_type].filter(Boolean).join(" · ");
}

function activeBanks(banks: BankOut[]) {
  return banks.filter((bank) => (bank.status ?? "Active").toLowerCase() === "active");
}

function bankNameForId(banks: BankOut[], id?: string | null) {
  return banks.find((bank) => bank.id === id)?.name ?? "";
}

export function CreateMerchantModal({ onClose, onSave, customerId, customerName, customer = null, existingMerchant = null }: CreateMerchantModalProps) {
  const MERCHANT_TYPES = ['Retail', 'Corporate'];
  const ACCOUNT_TYPES = ["Current", "Savings"];
  const editing = Boolean(existingMerchant);

  const [f, setF] = useState({
    name: existingMerchant?.name ?? "",
    type: existingMerchant?.type ?? MERCHANT_TYPES[0],
    mccCode: existingMerchant?.mcc_code ?? "",
    contact: existingMerchant?.contact ?? customer?.contact ?? "",
    phone: existingMerchant?.phone ?? customer?.phone ?? "",
    email: existingMerchant?.email ?? "",
    bankAccountName: existingMerchant?.bank_account_name ?? "",
    bankAccountNumber: existingMerchant?.bank_account_number ?? "",
    bankAccountType: existingMerchant?.bank_account_type ?? ACCOUNT_TYPES[0],
  });
  const [address, setAddress] = useState<MerchantAddressForm>(() => merchantInitialAddressForm(existingMerchant, customer));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setAddressField = (k: keyof MerchantAddressForm, v: string) => setAddress((prev) => ({ ...prev, [k]: v }));

  // Commercial profile step (create-only)
  const PLAN_PERIODS = ["Monthly", "Quarterly", "Bi-Annual", "Annual"];
  const [step, setStep] = useState<1 | 2>(1);
  const [rentalPlans, setRentalPlans] = useState<RentalPlanOut[]>([]);
  const [rentalPlansLoading, setRentalPlansLoading] = useState(false);
  const [commercial, setCommercial] = useState({
    rental_plan_id: "",
    rental_price: "",
    plan_period: "Monthly",
    effective_date: "",
  });
  const setC = (k: string, v: string) => setCommercial((p) => ({ ...p, [k]: v }));
  const [linkingSaving, setLinkingSaving] = useState(false);
  const hasCustomerLink = Boolean(customerId && customerName);
  const valid = Boolean(hasCustomerLink && f.name.trim() && f.contact.trim());

  function directAddressFields() {
    return {
      address_line_1: address.addressLine1.trim() || null,
      address_line_2: address.addressLine2.trim() || null,
      city: address.city.trim() || null,
      state: address.state.trim() || null,
      postcode: address.postcode.trim() || null,
    };
  }

  function buildBaseBody(): MerchantCreate {
    return {
      customer_id: customerId,
      name: f.name.trim(),
      type: f.type,
      mcc_code: f.mccCode.trim() || null,
      contact: f.contact.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      addresses: buildMerchantAddressPayload(address),
      ...directAddressFields(),
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
        name: f.name.trim(), type: f.type, mcc_code: f.mccCode.trim() || null,
        contact: f.contact.trim(), phone: f.phone.trim(),
        email: f.email.trim(),
        addresses: buildMerchantAddressPayload(address),
        ...directAddressFields(),
        bank_account_name: f.bankAccountName.trim() || f.name.trim(),
        bank_account_number: f.bankAccountNumber.trim(),
        bank_account_type: f.bankAccountType,
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
    if (!hasCustomerLink) {
      setErr("Select a customer before creating a merchant");
      return;
    }
    if (!valid) return;
    setRentalPlansLoading(true);
    api.rentalPlans.list({ active: true })
      .then(setRentalPlans)
      .catch(console.error)
      .finally(() => setRentalPlansLoading(false));
    setStep(2);
  }

  function setCommercialRentalPlan(planId: string) {
    const plan = rentalPlans.find((p) => p.id === planId);
    setCommercial((prev) => ({
      ...prev,
      rental_plan_id: planId,
      ...(plan ? { rental_price: String(plan.monthly_rate), plan_period: plan.plan_period } : {}),
    }));
  }

  async function saveCommercial() {
    if (!hasCustomerLink) {
      setErr("Select a customer before creating a merchant");
      return;
    }
    setLinkingSaving(true); setErr(null);
    try {
      const body: MerchantCreate = {
        ...buildBaseBody(),
        commercial_profile: {
          rental_plan_id: commercial.rental_plan_id || null,
          rental_price: commercial.rental_price ? parseFloat(commercial.rental_price) : null,
          plan_period: commercial.plan_period || null,
          effective_date: commercial.effective_date || null,
        },
      };
      const m = await api.merchants.create(body);
      onSave(m);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create merchant");
      setLinkingSaving(false);
    }
  }

  async function skipCommercial() {
    if (!hasCustomerLink) {
      setErr("Select a customer before creating a merchant");
      return;
    }
    setLinkingSaving(true); setErr(null);
    try {
      const m = await api.merchants.create(buildBaseBody());
      onSave(m);
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
          <Field label="MCC Code">
            <input className="input" placeholder="e.g. 5812" value={f.mccCode} onChange={(e) => set("mccCode", e.target.value)} />
          </Field>

          <Field label="Customer (billing entity)">
            <div className="input" style={{ background: "var(--bg-2, #f5f5f5)", color: "var(--ink-2)", cursor: "not-allowed" }}>
              {customerName || "No customer selected"}
            </div>
          </Field>

          {!editing && (
            <div style={{ padding: "10px 14px", background: "var(--bg-2, #f5f5f5)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)" }}>
              MIDs (and their bank, TID and Acceptance items) are added from the merchant's detail page once it's created.
            </div>
          )}

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
            <input className="input" placeholder="Address line 1" value={address.addressLine1} onChange={(e) => setAddressField("addressLine1", e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <input className="input" placeholder="Unit, floor, building" value={address.addressLine2} onChange={(e) => setAddressField("addressLine2", e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="City">
              <input className="input" placeholder="Kuala Lumpur" value={address.city} onChange={(e) => setAddressField("city", e.target.value)} />
            </Field>
            <Field label="State">
              <input className="input" placeholder="WP Kuala Lumpur" value={address.state} onChange={(e) => setAddressField("state", e.target.value)} />
            </Field>
          </div>
          <Field label="Postcode">
            <input className="input" placeholder="50000" value={address.postcode} onChange={(e) => setAddressField("postcode", e.target.value)} />
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
          <Field label="Rental plan">
            {rentalPlansLoading ? (
              <div className="input" style={{ color: "var(--ink-3)" }}>Loading plans…</div>
            ) : (
              <select className="input" value={commercial.rental_plan_id} onChange={(e) => setCommercialRentalPlan(e.target.value)}>
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
          {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
        </>
      )}
    </Modal>
  );
}

function CustomerPickerModal({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (customer: CustomerOut) => void;
}) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setErr(null);
      api.customers.list({ query: query.trim() || undefined, per_page: 8 })
        .then((page) => {
          if (!cancelled) setCustomers(page.items);
        })
        .catch((e) => {
          if (!cancelled) setErr(e instanceof ApiError ? e.message : "Failed to load customers");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Modal
      title="Select Customer"
      sub="Choose the billing entity for this merchant"
      icon="building"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </>}
    >
      <Field label="Customer" hint="required">
        <input
          className="input"
          placeholder="Search customer name, registration or contact..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </Field>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ padding: "14px 0", fontSize: 13, color: "var(--ink-3)" }}>Loading customers...</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: "14px 0", fontSize: 13, color: "var(--ink-3)" }}>No customers found.</div>
        ) : customers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => onSelect(customer)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              width: "100%",
              padding: "11px 13px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div className="cell-2">
              <span className="td-strong">{customer.name}</span>
              <span className="c2-sub mono">{customer.reg_no || customer.id}</span>
            </div>
            <Chip cls={customer.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{customer.status}</Chip>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* =================== ACCEPTANCE CATALOG (admin) =================== */

function AcceptanceSettingModal({ existing, onClose, onSaved }: {
  existing?: AcceptanceSettingOut | null;
  onClose: () => void;
  onSaved: (row: AcceptanceSettingOut) => void;
}) {
  const editing = Boolean(existing);
  const [name, setName] = useState(existing?.name ?? "");
  const [requiresTidMid, setRequiresTidMid] = useState(existing?.requires_tid_mid ?? false);
  const [defaultCompulsory, setDefaultCompulsory] = useState(existing?.default_compulsory ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSaving(true); setErr(null);
    try {
      const result = editing
        ? await api.acceptanceSettings.update(existing!.id, {
          name: name.trim(),
          requires_tid_mid: requiresTidMid,
          default_compulsory: defaultCompulsory,
        } satisfies AcceptanceSettingUpdate)
        : await api.acceptanceSettings.create({
          name: name.trim(),
          requires_tid_mid: requiresTidMid,
          default_compulsory: defaultCompulsory,
        } satisfies AcceptanceSettingCreate);
      onSaved(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save acceptance type");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Acceptance Type" : "Add Acceptance Type"}
      sub="Global catalog · selectable on any merchant MID"
      icon="tag"
      size="slim"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !name.trim()} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add Acceptance Type"}
        </Btn>
      </>}
    >
      <Field label="Name" hint="required">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Credit (Visa)" />
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer", fontSize: 13.5 }}>
          <input type="checkbox" checked={requiresTidMid} onChange={(e) => setRequiresTidMid(e.target.checked)} />
          Requires its own TID/MID pair
        </label>
        <label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer", fontSize: 13.5 }}>
          <input type="checkbox" checked={defaultCompulsory} onChange={(e) => setDefaultCompulsory(e.target.checked)} />
          Default compulsory (auto-attached to every new MID)
        </label>
      </div>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function AcceptanceCatalogTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<AcceptanceSettingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; existing?: AcceptanceSettingOut | null }>({ open: false });
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.acceptanceSettings.list()
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleSaved(row: AcceptanceSettingOut) {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === row.id);
      return exists ? prev.map((r) => r.id === row.id ? row : r) : [...prev, row];
    });
  }

  async function toggleStatus(row: AcceptanceSettingOut) {
    if (!canEdit || actionId) return;
    setActionId(row.id);
    setActionError(null);
    try {
      const next = row.active
        ? await api.acceptanceSettings.remove(row.id)
        : await api.acceptanceSettings.update(row.id, { active: true } satisfies AcceptanceSettingUpdate);
      handleSaved(next);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update acceptance type status");
    } finally {
      setActionId(null);
    }
  }

  return (
    <Card
      title="Acceptance Types"
      icon="tag"
      actions={canEdit ? <Btn variant="primary" sm icon="plus" onClick={() => setModal({ open: true })}>Add Acceptance Type</Btn> : undefined}
    >
      {loading ? (
        <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <Empty title="No acceptance types configured" sub="Add the first acceptance type to make it selectable on merchant MIDs" />
      ) : (
        <ResponsiveTable
          rows={rows}
          getKey={(r) => r.id}
          columns={[
            { key: "name", header: "Name", render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
            { key: "id", header: "ID", render: (r) => <span className="td-mono td-mut">{r.id}</span> },
            { key: "requires", header: "Requires TID/MID", render: (r) => r.requires_tid_mid ? <Chip cls="chip-info">Yes</Chip> : <span className="td-mut">No</span> },
            { key: "default", header: "Default compulsory", render: (r) => r.default_compulsory ? <Chip cls="chip-ok">Yes</Chip> : <span className="td-mut">No</span> },
            { key: "status", header: "Status", render: (r) => <Chip cls={r.active ? "chip-ok" : "chip-neutral"} dot>{r.active ? "Active" : "Inactive"}</Chip> },
            ...(canEdit ? [{
              key: "actions", header: "", render: (r: AcceptanceSettingOut) => (
                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <button className="icon-btn" title="Edit" onClick={() => setModal({ open: true, existing: r })}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    title={r.active ? "Deactivate" : "Reactivate"}
                    disabled={actionId === r.id}
                    onClick={() => toggleStatus(r)}
                  >
                    <Icon name={r.active ? "x" : "refresh"} size={14} />
                  </button>
                </div>
              ),
            }] : []),
          ]}
          renderMobile={(r) => (
            <MobileListItem
              title={r.name}
              sub={<>{r.id}</>}
              status={<Chip cls={r.active ? "chip-ok" : "chip-neutral"} dot>{r.active ? "Active" : "Inactive"}</Chip>}
              meta={[
                { label: "Requires TID/MID", value: r.requires_tid_mid ? "Yes" : "No" },
                { label: "Default compulsory", value: r.default_compulsory ? "Yes" : "No" },
              ]}
              onClick={canEdit ? () => setModal({ open: true, existing: r }) : undefined}
            />
          )}
        />
      )}
      {actionError && <div style={{ padding: "0 20px 16px", fontSize: 13, color: "var(--bad)" }}>{actionError}</div>}
      {modal.open && canEdit && (
        <AcceptanceSettingModal
          existing={modal.existing}
          onClose={() => setModal({ open: false })}
          onSaved={handleSaved}
        />
      )}
    </Card>
  );
}

/* =================== LISTING =================== */
export function Merchants({ nav }: { nav: NavFn }) {
  const can = useCan();
  const canViewAcceptance = can("Settings.View");
  const [pageTab, setPageTab] = useState<"merchants" | "acceptance">("merchants");
  const MERCHANTS_PAGE_SIZE = 20;
  const [merchantList, setMerchantList] = useState<MerchantOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [createCustomer, setCreateCustomer] = useState<CustomerOut | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.merchants.list({
        page,
        per_page: MERCHANTS_PAGE_SIZE,
        query: q.trim() || undefined,
        status: status !== "All" ? status : undefined,
      })
        .then((p) => {
          if (cancelled) return;
          setMerchantList(p.items);
          setTotal(p.total);
          setPages(p.pages);
        })
        .catch(console.error)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, q, status]);

  function handleMerchantCreated(merchant: MerchantOut) {
    setMerchantList((prev) => [merchant, ...prev]);
    setTotal((prev) => prev + 1);
    setCreateCustomer(null);
    setToast("Merchant " + merchant.name + " created");
    setTimeout(() => setToast(null), 2800);
  }

  function resetPage() { setPage(1); }

  return (
    <div>
      <PageHead
        title="Merchants"
        sub={pageTab === "merchants" ? total + " merchants · search by name, MID, TID, terminal serial or merchant ID" : "Global catalog of payment acceptance types"}
        actions={pageTab === "merchants" && can("Merchants.Create") ? <Btn variant="primary" icon="plus" onClick={() => setShowCustomerPicker(true)}>Create Merchant</Btn> : undefined}
      />

      {canViewAcceptance && (
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--line)" }}>
          {([["merchants", "Merchants"], ["acceptance", "Acceptance"]] as const).map(([t, lbl]) => (
            <button key={t} onClick={() => setPageTab(t)} style={{
              padding: "10px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 14,
              borderBottom: `2px solid ${pageTab === t ? "var(--ink)" : "transparent"}`,
              fontWeight: pageTab === t ? 700 : 500,
              color: pageTab === t ? "var(--ink)" : "var(--ink-3)",
              marginBottom: -1, transition: "color 0.15s",
            }}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {pageTab === "acceptance" && canViewAcceptance ? (
        <AcceptanceCatalogTab canEdit={can("Settings.Edit")} />
      ) : (
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={(value) => { setQ(value); resetPage(); }} placeholder="Search merchant, MID, TID, terminal…" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All","Active","Onboarding","Suspended","Inactive"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="tb-meta">{loading ? "Loading..." : `${total} results`}</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : merchantList.length === 0 ? <Empty title="No merchants match" sub="Try a different search or filter" /> : (
          <ResponsiveTable
            rows={merchantList}
            getKey={(m) => m.id}
            onRowClick={(m) => nav("merchant-detail", m.id)}
            columns={[
              { key: "merchant", header: "Merchant", render: (m) => <Entity name={m.name} sub={m.id + " · " + m.type} /> },
              { key: "mid", header: "MID", render: (m) => <span className="td-mono td-mut">{merchantDisplayMid(m)}</span> },
              { key: "bank", header: "Bank", render: (m) => <span style={{ display: "flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={15} style={{ color: "var(--ink-3)" }} />{merchantDisplayBank(m)}</span> },
              { key: "status", header: "Status", render: (m) => <MerchantStatus status={m.status} /> },
              { key: "terminals", header: "Terminals", render: (m) => { const n = m.terminal_count ?? 0; return n === 0 ? <span className="td-mut">—</span> : <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}><Icon name="terminal" size={15} style={{ color: "var(--ink-3)" }} />{n}</span>; } },
              { key: "jobs", header: "Jobs", render: (m) => (m.open_jobs_count ?? 0) > 0 ? <Chip cls="chip-warn">{m.open_jobs_count} open</Chip> : <span className="td-mut">None</span> },
            ]}
            renderMobile={(m) => (
              <MobileListItem
                title={m.name}
                sub={<>{m.id} · {m.type}</>}
                status={<MerchantStatus status={m.status} />}
                meta={[
                  { label: "MID", value: <span className="td-mono">{merchantDisplayMid(m)}</span> },
                  { label: "Bank", value: <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={15} style={{ color: "var(--ink-3)" }} />{merchantDisplayBank(m)}</span> },
                  { label: "Finance", value: <Readiness value={m.finance_status} /> },
                  { label: "Terminals", value: (() => { const n = m.terminal_count ?? 0; return n === 0 ? "—" : <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="terminal" size={15} style={{ color: "var(--ink-3)" }} />{n}</span>; })() },
                  { label: "Jobs", value: (m.open_jobs_count ?? 0) > 0 ? <Chip cls="chip-warn">{m.open_jobs_count} open</Chip> : "None" },
                ]}
                onClick={() => nav("merchant-detail", m.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={total} shown={merchantList.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>
      )}
      {showCustomerPicker && can("Merchants.Create") && (
        <CustomerPickerModal
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(customer) => {
            setCreateCustomer(customer);
            setShowCustomerPicker(false);
          }}
        />
      )}
      {createCustomer && can("Merchants.Create") && (
        <CreateMerchantModal
          onClose={() => setCreateCustomer(null)}
          onSave={handleMerchantCreated}
          customerId={createCustomer.id}
          customerName={createCustomer.name}
          customer={createCustomer}
        />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== COMMERCIAL PROFILE MODAL =================== */
function CommercialProfileModal({ merchantId, existing, onClose, onSaved }: {
  merchantId: string;
  existing?: MerchantCommercialProfileOut | null;
  onClose: () => void;
  onSaved: (cp: MerchantCommercialProfileOut) => void;
}) {
  const PLAN_PERIODS = ["Monthly", "Quarterly", "Bi-Annual", "Annual"];
  const editing = Boolean(existing);

  const [rentalPlans, setRentalPlans] = useState<RentalPlanOut[]>([]);
  const [rentalPlansLoading, setRentalPlansLoading] = useState(true);
  const [f, setF] = useState({
    rental_plan_id:  existing?.rental_plan_id  ?? "",
    rental_price:    existing?.rental_price != null ? String(existing.rental_price) : "",
    plan_period:     existing?.plan_period    ?? "Monthly",
    effective_date:  existing?.effective_date ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setRentalPlan(planId: string, plans = rentalPlans) {
    const plan = plans.find((p) => p.id === planId);
    setF((prev) => ({
      ...prev,
      rental_plan_id: planId,
      ...(plan ? { rental_price: String(plan.monthly_rate), plan_period: plan.plan_period } : {}),
    }));
  }

  useEffect(() => {
    api.rentalPlans.list({ active: true })
      .then((plans) => {
        setRentalPlans(plans);
        const plan = plans.find((p) => p.id === existing?.rental_plan_id);
        if (plan) {
          setF((prev) => ({
            ...prev,
            rental_price: String(plan.monthly_rate),
            plan_period: plan.plan_period,
          }));
        }
      })
      .catch(console.error)
      .finally(() => setRentalPlansLoading(false));
  }, [existing?.rental_plan_id]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body: MerchantCommercialProfileIn = {
        rental_plan_id:  f.rental_plan_id  || null,
        rental_price:    f.rental_price    ? parseFloat(f.rental_price)    : null,
        plan_period:     f.plan_period     || null,
        effective_date:  f.effective_date  || null,
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
      title={editing ? "Edit Commercial Profile" : "Set Up Commercial Profile"}
      sub={editing ? "Update rental and billing terms" : "Configure rental plan and billing terms"}
      icon="percent"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={save}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Set Up Profile"}
        </Btn>
      </>}
    >
      <Field label="Rental plan">
        {rentalPlansLoading ? (
          <div className="input" style={{ color: "var(--ink-3)" }}>Loading plans…</div>
        ) : (
          <select className="input" value={f.rental_plan_id} onChange={(e) => setRentalPlan(e.target.value)}>
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

      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

/* =================== DETAIL =================== */
export function MerchantDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
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

  function handleMidSaved(mid: MerchantMidOut) {
    setMerchant((prev) => {
      if (!prev) return prev;
      const mids = prev.mids ?? [];
      const exists = mids.some((item) => item.id === mid.id);
      return {
        ...prev,
        mids: exists
          ? mids.map((item) => item.id === mid.id ? mid : item)
          : [...mids, mid],
      };
    });
  }

  function handleAcceptanceSaved(midId: string, row: MerchantMidAcceptanceOut) {
    setMerchant((prev) => {
      if (!prev) return prev;
      const mids = prev.mids ?? [];
      return {
        ...prev,
        mids: mids.map((mid) => {
          if (mid.id !== midId) return mid;
          const acceptances = mid.acceptances ?? [];
          const exists = acceptances.some((item) => item.id === row.id);
          return {
            ...mid,
            acceptances: exists ? acceptances.map((item) => item.id === row.id ? row : item) : [...acceptances, row],
          };
        }),
      };
    });
  }

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
          {can("Merchants.Edit") && <Btn variant="ghost" icon="tag" onClick={() => setShowUpdateStatus(true)}>Update Status</Btn>}
          {can("Merchants.Edit") && <Btn variant="ghost" icon="edit" onClick={() => setShowEditMerchant(true)}>Edit</Btn>}
          {can("Jobs.Create") && <Btn variant="primary" icon="plus" onClick={() => setShowCreateJob(true)}>New Job</Btn>}
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { l: "Merchant Terminals", v: linkedTerminals.length,    ico: "terminal", c: "var(--info)" },
          { l: "Open Jobs",          v: merchantJobs.filter((j) => j.stage !== "Completed").length, ico: "jobs", c: "var(--warn)" },
          // { l: "Finance Readiness",  v: merchant.finance,           ico: "shield",   c: merchant.finance === "Ready" ? "var(--ok)" : "var(--warn)", small: true },
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
        {tab === "overview"    ? <OverviewTab m={merchant} nav={nav} canEdit={can("Merchants.Edit")} onMidSaved={handleMidSaved} onAcceptanceSaved={handleAcceptanceSaved} />
          : tab === "commercial" ? <CommercialTab m={merchant} canEdit={can("Merchants.Edit")} onEdit={() => setShowEditCommercial(true)} />
          : tab === "terminals"  ? <TerminalsTab rows={linkedTerminals} nav={nav} />
          : <JobsTab rows={merchantJobs} nav={nav} />}
      </div>

      {showCreateJob && can("Jobs.Create") && (
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
            type: null,
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

      {showEditMerchant && can("Merchants.Edit") && (
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
      {showUpdateStatus && can("Merchants.Edit") && (
        <UpdateMerchantStatusModal
          merchant={merchant}
          onClose={() => setShowUpdateStatus(false)}
          onSaved={(updated) => { setMerchant(updated); setShowUpdateStatus(false); }}
        />
      )}

      {showEditCommercial && can("Merchants.Edit") && (
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

/* Draft state for one selected Acceptance item in the create-MID flow */
type AcceptanceDraft = {
  acceptance_setting_id: string;
  uses_own_tid_mid: boolean;
  tid_value: string;
  mid_value: string;
  mdr_rate_id: string;
};

function AcceptancePicker({ settings, drafts, onChange }: {
  settings: AcceptanceSettingOut[];
  drafts: AcceptanceDraft[];
  onChange: (next: AcceptanceDraft[]) => void;
}) {
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  useEffect(() => { api.mdr.list().then(setMdrRates).catch(console.error); }, []);

  const selectable = settings.filter((s) => s.active && !s.default_compulsory);
  const defaultCompulsory = settings.filter((s) => s.active && s.default_compulsory);
  const draftFor = (id: string) => drafts.find((d) => d.acceptance_setting_id === id);

  function toggle(setting: AcceptanceSettingOut, checked: boolean) {
    if (checked) {
      onChange([...drafts, { acceptance_setting_id: setting.id, uses_own_tid_mid: false, tid_value: "", mid_value: "", mdr_rate_id: "" }]);
    } else {
      onChange(drafts.filter((d) => d.acceptance_setting_id !== setting.id));
    }
  }

  function update(id: string, patch: Partial<AcceptanceDraft>) {
    onChange(drafts.map((d) => d.acceptance_setting_id === id ? { ...d, ...patch } : d));
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {defaultCompulsory.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg-2, #f5f5f5)", borderRadius: 7, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{s.name}</span>
          <Chip cls="chip-neutral">Default (compulsory)</Chip>
        </div>
      ))}
      {selectable.map((s) => {
        const draft = draftFor(s.id);
        const checked = Boolean(draft);
        return (
          <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: 7, padding: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={checked} onChange={(e) => toggle(s, e.target.checked)} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
              {s.requires_tid_mid && <Chip cls="chip-info">Requires TID/MID</Chip>}
            </label>
            {checked && draft && s.requires_tid_mid && (
              <div style={{ marginTop: 10, paddingLeft: 24, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                    <input type="radio" checked={!draft.uses_own_tid_mid} onChange={() => update(s.id, { uses_own_tid_mid: false })} />
                    Use original MID/TID
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                    <input type="radio" checked={draft.uses_own_tid_mid} onChange={() => update(s.id, { uses_own_tid_mid: true })} />
                    Use this MID/TID
                  </label>
                </div>
                {draft.uses_own_tid_mid && (
                  <>
                    <div className="field-row">
                      <Field label="TID" hint="optional · can be filled in later">
                        <input className="input" value={draft.tid_value} onChange={(e) => update(s.id, { tid_value: e.target.value })} placeholder="TID value" />
                      </Field>
                      <Field label="MID" hint="optional · can be filled in later">
                        <input className="input" value={draft.mid_value} onChange={(e) => update(s.id, { mid_value: e.target.value })} placeholder="MID value" />
                      </Field>
                      <Field label="MDR rate">
                        <select className="input" value={draft.mdr_rate_id} onChange={(e) => update(s.id, { mdr_rate_id: e.target.value })}>
                          <option value="">No MDR rate</option>
                          {mdrRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.id} · {rate.type} {rate.rate}%</option>)}
                        </select>
                      </Field>
                    </div>
                    {!draft.tid_value.trim() && (
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        Without a TID, this acceptance item won't be offered on the Installation Job terminal picker until one is added.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MerchantMidModal({ merchant, existing, onClose, onSaved }: {
  merchant: MerchantOut;
  existing?: MerchantMidOut | null;
  onClose: () => void;
  onSaved: (mid: MerchantMidOut) => void;
}) {
  const editing = Boolean(existing);
  const [bankOptions, setBankOptions] = useState<BankOut[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankId, setBankId] = useState(existing?.bank_id ?? "");
  const [midValue, setMidValue] = useState(existing?.mid_value ?? "");
  const [tidValue, setTidValue] = useState(existing?.tid_value ?? "");
  const [mdrRateId, setMdrRateId] = useState(existing?.mdr_rate_id ?? "");
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [acceptanceSettingsList, setAcceptanceSettingsList] = useState<AcceptanceSettingOut[]>([]);
  const [acceptanceDrafts, setAcceptanceDrafts] = useState<AcceptanceDraft[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.mdr.list().then(setMdrRates).catch(console.error);
    if (!editing) api.acceptanceSettings.list().then(setAcceptanceSettingsList).catch(console.error);
  }, [editing]);

  useEffect(() => {
    let cancelled = false;
    api.banks.list()
      .then((items) => {
        if (cancelled) return;
        setBankOptions(items);
        const options = activeBanks(items);
        setBankId((current) => current || existing?.bank_id || options[0]?.id || "");
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setBanksLoading(false); });
    return () => { cancelled = true; };
  }, [existing?.bank_id]);

  const selectableBanks = bankOptions.filter((bank) => (bank.status ?? "Active").toLowerCase() === "active" || bank.id === bankId);
  const valid = Boolean(bankId && midValue.trim() && tidValue.trim());

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const result = editing
        ? await api.merchants.updateMid(merchant.id, existing!.id, {
          bank_id: bankId,
          mid_value: midValue.trim(),
          tid_value: tidValue.trim(),
          mdr_rate_id: mdrRateId || null,
          reason: reason.trim() || null,
        } satisfies MerchantMidUpdate)
        : await api.merchants.createMid(merchant.id, {
          bank_id: bankId,
          mid_value: midValue.trim(),
          tid_value: tidValue.trim(),
          mdr_rate_id: mdrRateId || null,
          acceptances: acceptanceDrafts.map((d) => ({
            acceptance_setting_id: d.acceptance_setting_id,
            uses_own_tid_mid: d.uses_own_tid_mid,
            tid_value: d.uses_own_tid_mid ? d.tid_value.trim() || null : null,
            mid_value: d.uses_own_tid_mid ? d.mid_value.trim() || null : null,
            mdr_rate_id: d.uses_own_tid_mid ? d.mdr_rate_id || null : null,
          } satisfies MerchantMidAcceptanceCreate)),
        } satisfies MerchantMidCreate);
      onSaved(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save MID");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit MID" : "Add MID"}
      sub={merchant.name}
      icon="tag"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !valid} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add MID"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="MID value" hint="required">
          <input className="input" value={midValue} onChange={(e) => setMidValue(e.target.value)} placeholder="MID123456" />
        </Field>
        <Field label="TID value" hint="required">
          <input className="input" value={tidValue} onChange={(e) => setTidValue(e.target.value)} placeholder="TID123456" />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Bank" hint="required">
          <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value)} disabled={banksLoading}>
            <option value="">{banksLoading ? "Loading banks..." : "Select bank..."}</option>
            {selectableBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
          </select>
        </Field>
        <Field label="MDR rate">
          <select className="input" value={mdrRateId} onChange={(e) => setMdrRateId(e.target.value)}>
            <option value="">No MDR rate</option>
            {mdrRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.id} · {rate.type} {rate.rate}%</option>)}
          </select>
        </Field>
      </div>
      {editing ? (
        <Field label="Change reason" hint="optional">
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change..." rows={3} />
        </Field>
      ) : (
        <Field label="Acceptance" hint="select the payment types this MID accepts">
          <AcceptancePicker settings={acceptanceSettingsList} drafts={acceptanceDrafts} onChange={setAcceptanceDrafts} />
        </Field>
      )}
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function AcceptanceModal({ mid, merchantName, existing, onClose, onSaved }: {
  mid: MerchantMidOut;
  merchantName: string;
  existing?: MerchantMidAcceptanceOut | null;
  onClose: () => void;
  onSaved: (row: MerchantMidAcceptanceOut) => void;
}) {
  const editing = Boolean(existing);
  const [settings, setSettings] = useState<AcceptanceSettingOut[]>([]);
  const [settingId, setSettingId] = useState(existing?.acceptance_setting_id ?? "");
  const [usesOwn, setUsesOwn] = useState(existing?.uses_own_tid_mid ?? false);
  const [tidValue, setTidValue] = useState(existing?.tid_value ?? "");
  const [midValue, setMidValue] = useState(existing?.mid_value ?? "");
  const [mdrRateId, setMdrRateId] = useState(existing?.mdr_rate_id ?? "");
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.mdr.list().then(setMdrRates).catch(console.error);
    if (!editing) api.acceptanceSettings.list().then(setSettings).catch(console.error);
  }, [editing]);

  const attachedSettingIds = new Set((mid.acceptances ?? []).map((a) => a.acceptance_setting_id));
  const selectedSetting = settings.find((s) => s.id === settingId);
  const requiresTidMid = existing ? existing.requires_tid_mid : Boolean(selectedSetting?.requires_tid_mid);
  const valid = Boolean(settingId);

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const result = editing
        ? await api.merchants.updateAcceptance(mid.merchant_id, mid.id, existing!.id, {
          uses_own_tid_mid: usesOwn,
          tid_value: usesOwn ? tidValue.trim() || null : null,
          mid_value: usesOwn ? midValue.trim() || null : null,
          mdr_rate_id: usesOwn ? mdrRateId || null : null,
          reason: reason.trim() || null,
        } satisfies MerchantMidAcceptanceUpdate)
        : await api.merchants.addAcceptance(mid.merchant_id, mid.id, {
          acceptance_setting_id: settingId,
          uses_own_tid_mid: usesOwn,
          tid_value: usesOwn ? tidValue.trim() || null : null,
          mid_value: usesOwn ? midValue.trim() || null : null,
          mdr_rate_id: usesOwn ? mdrRateId || null : null,
        } satisfies MerchantMidAcceptanceCreate);
      onSaved(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save acceptance item");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Acceptance" : "Add Acceptance"}
      sub={`${merchantName} · ${mid.mid_value}`}
      icon="tag"
      size="slim"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !valid} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add Acceptance"}
        </Btn>
      </>}
    >
      {editing ? (
        <Field label="Acceptance type">
          <div className="input" style={{ background: "var(--bg-2, #f5f5f5)", color: "var(--ink-2)" }}>{existing!.acceptance_name}</div>
        </Field>
      ) : (
        <Field label="Acceptance type" hint="required">
          <select className="input" value={settingId} onChange={(e) => setSettingId(e.target.value)}>
            <option value="">Select acceptance type...</option>
            {settings
              .filter((s) => s.active && !s.default_compulsory && !attachedSettingIds.has(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.requires_tid_mid ? " (requires TID/MID)" : ""}</option>
              ))}
          </select>
        </Field>
      )}
      {!editing && settings.length > 0 && settings.every((s) => s.default_compulsory || attachedSettingIds.has(s.id)) && (
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: -8, marginBottom: 8 }}>
          Every available acceptance type is already attached to this MID.
        </div>
      )}
      {requiresTidMid && (
        <>
          <div style={{ display: "flex", gap: 14, margin: "10px 0" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={!usesOwn} onChange={() => setUsesOwn(false)} />
              Use original MID/TID
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
              <input type="radio" checked={usesOwn} onChange={() => setUsesOwn(true)} />
              Use this MID/TID
            </label>
          </div>
          {usesOwn && (
            <>
              <div className="field-row">
                <Field label="TID" hint="optional · can be filled in later">
                  <input className="input" value={tidValue} onChange={(e) => setTidValue(e.target.value)} placeholder="TID value" />
                </Field>
                <Field label="MID" hint="optional · can be filled in later">
                  <input className="input" value={midValue} onChange={(e) => setMidValue(e.target.value)} placeholder="MID value" />
                </Field>
              </div>
              <Field label="MDR rate">
                <select className="input" value={mdrRateId} onChange={(e) => setMdrRateId(e.target.value)}>
                  <option value="">No MDR rate</option>
                  {mdrRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.id} · {rate.type} {rate.rate}%</option>)}
                </select>
              </Field>
              {!tidValue.trim() && (
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: -4, marginBottom: 10 }}>
                  Without a TID, this acceptance item won't be offered on the Installation Job terminal picker until one is added.
                </div>
              )}
            </>
          )}
        </>
      )}
      {editing && (
        <Field label="Change reason" hint="optional">
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change..." rows={3} />
        </Field>
      )}
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function MidHistoryModal({ mid, onClose }: {
  mid: MerchantMidOut;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MerchantMidHistoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    api.merchants.midHistory(mid.merchant_id, mid.id)
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load MID history"))
      .finally(() => setLoading(false));
  }, [mid.merchant_id, mid.id]);

  return (
    <Modal title="MID History" sub={`${mid.mid_value} · ${mid.id}`} icon="clock" size="slim" onClose={onClose}>
      {loading ? (
        <div style={{ padding: "20px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading...</div>
      ) : err ? (
        <div style={{ fontSize: 13, color: "var(--bad)" }}>{err}</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No changes recorded for this MID.</div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink-1)" }}>
                    <span className="td-mut" style={{ fontWeight: 500 }}>{row.field}: </span>
                    <span className="mono">{row.old_value || "-"}</span>
                    <span style={{ color: "var(--ink-3)", fontWeight: 500 }}> to </span>
                    <span className="mono">{row.new_value || "-"}</span>
                  </div>
                  <span className="td-mut" style={{ fontSize: 12 }}>{row.changed_at ? new Date(row.changed_at).toLocaleString() : "-"}</span>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: "92px 1fr", margin: 0 }}>
                  <dt>Reason</dt><dd>{row.reason || "-"}</dd>
                  <dt>Changed by</dt><dd className="mono">{row.changed_by_user_id || "-"}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function OverviewTab({ m, nav, canEdit, onMidSaved, onAcceptanceSaved }: {
  m: MerchantOut;
  nav: NavFn;
  canEdit: boolean;
  onMidSaved: (mid: MerchantMidOut) => void;
  onAcceptanceSaved: (midId: string, row: MerchantMidAcceptanceOut) => void;
}) {
  const [showAddMid, setShowAddMid] = useState(false);
  const [editingMid, setEditingMid] = useState<MerchantMidOut | null>(null);
  const [historyMid, setHistoryMid] = useState<MerchantMidOut | null>(null);
  const [midActionId, setMidActionId] = useState<string | null>(null);
  const [midActionError, setMidActionError] = useState<string | null>(null);
  const [acceptanceModalMid, setAcceptanceModalMid] = useState<MerchantMidOut | null>(null);
  const [editingAcceptance, setEditingAcceptance] = useState<MerchantMidAcceptanceOut | null>(null);
  const [acceptanceActionId, setAcceptanceActionId] = useState<string | null>(null);
  const [acceptanceActionError, setAcceptanceActionError] = useState<string | null>(null);
  const addressRows = merchantAddressRows(m);

  async function toggleMidStatus(mid: MerchantMidOut) {
    if (!canEdit || midActionId) return;
    setMidActionId(mid.id);
    setMidActionError(null);
    try {
      const active = (mid.status ?? "Active").toLowerCase() === "active";
      const next = active
        ? await api.merchants.deactivateMid(m.id, mid.id)
        : await api.merchants.reactivateMid(m.id, mid.id);
      onMidSaved(next);
    } catch (e) {
      setMidActionError(e instanceof ApiError ? e.message : "Failed to update MID status");
    } finally {
      setMidActionId(null);
    }
  }

  async function toggleAcceptanceStatus(mid: MerchantMidOut, row: MerchantMidAcceptanceOut) {
    if (!canEdit || acceptanceActionId) return;
    setAcceptanceActionId(row.id);
    setAcceptanceActionError(null);
    try {
      const active = (row.status ?? "Active").toLowerCase() === "active";
      const next = active
        ? await api.merchants.deactivateAcceptance(m.id, mid.id, row.id)
        : await api.merchants.reactivateAcceptance(m.id, mid.id, row.id);
      onAcceptanceSaved(mid.id, next);
    } catch (e) {
      setAcceptanceActionError(e instanceof ApiError ? e.message : "Failed to update acceptance status");
    } finally {
      setAcceptanceActionId(null);
    }
  }

  return (
      <div className="detail-grid merchant-overview-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Business Details" icon="building">
          <div className="card-pad">
            <dl className="kv">
              <dt>Legal name</dt><dd>{m.name}</dd>
              <dt>Merchant ID</dt><dd className="mono">{m.id}</dd>
              {m.mcc_code && <><dt>MCC Code</dt><dd className="mono">{m.mcc_code}</dd></>}
              <dt>Category</dt><dd>{m.type}</dd>
            </dl>
          </div>
        </Card>
        {addressRows.length > 0 && (
          <Card title="Address" icon="mapPin">
            <div className="card-pad">
              <dl className="kv">
                {addressRows.flatMap(([label, value]) => [
                  <dt key={`${label}-label`}>{label}</dt>,
                  <dd key={`${label}-value`}>{value}</dd>,
                ])}
              </dl>
            </div>
          </Card>
        )}
        <Card
          title={"MIDs" + (m.mids.length ? ` (${m.mids.length})` : "")}
          icon="tag"
          actions={canEdit ? <Btn variant="ghost" sm icon="plus" onClick={() => setShowAddMid(true)}>Add MID</Btn> : undefined}
        >
          <div className="card-pad">
            {m.mids.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {m.mids.map((mid) => (
                  <div key={mid.id} style={{ padding: "10px 12px", background: "var(--bg-2, #f5f5f5)", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <span className="mono" style={{ fontWeight: 700 }}>{mid.mid_value}</span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button className="icon-btn" title="History" onClick={() => setHistoryMid(mid)}>
                          <Icon name="clock" size={14} />
                        </button>
                        {canEdit && (
                          <>
                            <button className="icon-btn" title="Edit MID" onClick={() => setEditingMid(mid)}>
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              className="icon-btn"
                              title={(mid.status ?? "Active").toLowerCase() === "active" ? "Deactivate MID" : "Reactivate MID"}
                              disabled={midActionId === mid.id}
                              onClick={() => toggleMidStatus(mid)}
                            >
                              <Icon name={(mid.status ?? "Active").toLowerCase() === "active" ? "x" : "refresh"} size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <dl className="kv" style={{ margin: 0 }}>
                      <dt>MID</dt><dd className="mono">{mid.mid_value}</dd>
                      <dt>TID</dt><dd className="mono">{mid.tid_value}</dd>
                      <dt>Bank</dt><dd>{mid.bank || "-"}</dd>
                      <dt>MDR rate</dt><dd>{mid.mdr_rate ? `${mid.mdr_rate.type} · ${mid.mdr_rate.rate}% · ${mid.mdr_rate.network}` : "-"}</dd>
                      <dt>Terminal Serial</dt>
                      <dd className="mono">
                        {mid.terminal_serial ? (
                          <button
                            type="button"
                            style={{ border: 0, background: "transparent", padding: 0, color: "var(--info)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
                            onClick={() => nav("terminal-detail", mid.terminal_serial!)}
                          >
                            {mid.terminal_serial}
                          </button>
                        ) : "-"}
                      </dd>
                      <dt>Status</dt><dd>{mid.status ? <Chip cls={mid.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{mid.status}</Chip> : "-"}</dd>
                    </dl>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.3 }}>Acceptance</span>
                        {canEdit && (
                          <Btn variant="ghost" sm icon="plus" onClick={() => { setAcceptanceModalMid(mid); setEditingAcceptance(null); }}>Add Acceptance</Btn>
                        )}
                      </div>
                      {mid.acceptances.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {mid.acceptances.map((row) => (
                            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 8px", background: "var(--surface)", borderRadius: 5 }}>
                              <div>
                                <div className="mono" style={{ fontWeight: 600 }}>
                                  {row.acceptance_name}{" "}
                                  {row.status && <Chip cls={row.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{row.status}</Chip>}
                                </div>
                                <div className="td-mut" style={{ fontSize: 12 }}>
                                  {row.requires_tid_mid
                                    ? (row.uses_own_tid_mid
                                      ? `Own pair · TID ${row.tid_value || "-"} · MID ${row.mid_value || "-"}${row.mdr_rate ? ` · ${row.mdr_rate.rate}%` : ""}`
                                      : "Uses original MID/TID")
                                    : "No TID/MID required"}
                                </div>
                                {row.uses_own_tid_mid && (
                                  <div style={{ fontSize: 12, marginTop: 2 }}>
                                    <span className="td-mut">Terminal: </span>
                                    {row.terminal_serial ? (
                                      <button
                                        type="button"
                                        className="mono"
                                        style={{ border: 0, background: "transparent", padding: 0, color: "var(--info)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
                                        onClick={() => nav("terminal-detail", row.terminal_serial!)}
                                      >
                                        {row.terminal_serial}
                                      </button>
                                    ) : (
                                      <span className="td-mut">Not mounted</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                  <button className="icon-btn" title="Edit" onClick={() => { setAcceptanceModalMid(mid); setEditingAcceptance(row); }}>
                                    <Icon name="edit" size={13} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    title={(row.status ?? "Active").toLowerCase() === "active" ? "Deactivate" : "Reactivate"}
                                    disabled={acceptanceActionId === row.id}
                                    onClick={() => toggleAcceptanceStatus(mid, row)}
                                  >
                                    <Icon name={(row.status ?? "Active").toLowerCase() === "active" ? "x" : "refresh"} size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>No acceptance items selected.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "12px 0", fontSize: 13, color: "var(--ink-3)" }}>
                No MIDs on this merchant yet.
              </div>
            )}
            {midActionError && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 10 }}>{midActionError}</div>}
            {acceptanceActionError && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 10 }}>{acceptanceActionError}</div>}
          </div>
        </Card>
        {historyMid && (
          <MidHistoryModal mid={historyMid} onClose={() => setHistoryMid(null)} />
        )}
        {showAddMid && canEdit && (
          <MerchantMidModal
            merchant={m}
            onClose={() => setShowAddMid(false)}
            onSaved={onMidSaved}
          />
        )}
        {editingMid && canEdit && (
          <MerchantMidModal
            merchant={m}
            existing={editingMid}
            onClose={() => setEditingMid(null)}
            onSaved={onMidSaved}
          />
        )}
        {acceptanceModalMid && canEdit && (
          <AcceptanceModal
            mid={acceptanceModalMid}
            merchantName={m.name}
            existing={editingAcceptance}
            onClose={() => { setAcceptanceModalMid(null); setEditingAcceptance(null); }}
            onSaved={(row) => onAcceptanceSaved(acceptanceModalMid.id, row)}
          />
        )}
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
      <Card title="Settlement Bank Account" icon="bank">
        <div className="card-pad">
          <dl className="kv">
            <dt>Account name</dt><dd>{m.bank_account_name}</dd>
            <dt>Account number</dt><dd className="mono">{m.bank_account_number}</dd>
            <dt>Account type</dt><dd>{m.bank_account_type}</dd>
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
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

function CommercialTab({ m, canEdit, onEdit }: { m: MerchantOut; canEdit: boolean; onEdit: () => void }) {
  if (!m.commercial_profile) {
    return (
      <Card>
        <Empty icon="percent" title="No commercial profile" sub="Set up a commercial profile to configure rental plan and billing terms" />
        {canEdit && (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 20 }}>
            <Btn variant="primary" icon="plus" onClick={onEdit}>Set Up Commercial Profile</Btn>
          </div>
        )}
      </Card>
    );
  }
  const cp: MerchantCommercialProfileOut = m.commercial_profile;
  return (
    <Card title="Commercial Profile" icon="percent" actions={canEdit ? <Btn variant="ghost" sm icon="edit" onClick={onEdit}>Edit</Btn> : undefined}>
      <div className="card-pad">
        <dl className="kv">
          {cp.rental_plan_id      && <><dt>Rental Plan</dt><dd className="mono">{cp.rental_plan_id}</dd></>}
          {cp.rental_price != null && <><dt>Rental Price</dt><dd>RM {cp.rental_price.toFixed(2)}</dd></>}
          {cp.plan_period         && <><dt>Billing Period</dt><dd>{cp.plan_period}</dd></>}
          {cp.effective_date      && <><dt>Effective Date</dt><dd>{cp.effective_date}</dd></>}
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
          { key: "sim", header: "SIM", render: (t) => <span className="td-mut">{merchantTerminalSimLabel(t) || "—"}</span> },
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
              { label: "SIM", value: merchantTerminalSimLabel(t) || "—" },
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
