/* PaidChain — Merchant listing + detail */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, MerchantStatus, Readiness, Entity, Pagination, Empty, Chip, TerminalStatus, JobStatus, SlaChip, Modal, Field, MobileListItem, ResponsiveTable } from "./components";
import { BANKS, JOB_TYPES } from "./data";
import { api, ApiError } from "@/lib/api";
import type { AddressIn, BankOut, CustomerOut, MerchantOut, MerchantCreate, MerchantUpdate, MerchantTerminalOut, MerchantJobOut, RentalPlanOut, MerchantCommercialProfileIn, MerchantCommercialProfileOut, TerminalTidCreate, TerminalTidUpdate, TerminalTidOut, TerminalTidMidOut, TerminalTidMidCreate, TerminalTidMidUpdate, TerminalTidMidHistoryOut, MdrOut } from "@/lib/api";
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

type MerchantTidDraft = {
  tid: string;
  bank_id: string;
  mids: MerchantTidMidDraft[];
};

type MerchantTidMidDraft = {
  mid: string;
  mdr_rate_id: string;
};

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

function tidSimLabel(tid: TerminalTidOut) {
  const sim = tid.sim_card ?? tid.simcard;
  if (!sim) return "";
  return [sim.carrier, sim.msisdn || sim.iccid, sim.plan].filter(Boolean).join(" · ");
}

function activeBanks(banks: BankOut[]) {
  return banks.filter((bank) => (bank.status ?? "Active").toLowerCase() === "active");
}

function bankIdForName(banks: BankOut[], name?: string | null) {
  return banks.find((bank) => bank.name === name)?.id ?? "";
}

function bankNameForId(banks: BankOut[], id?: string | null) {
  return banks.find((bank) => bank.id === id)?.name ?? "";
}

function blankMerchantTidMidDraft(): MerchantTidMidDraft {
  return { mid: "", mdr_rate_id: "" };
}

function blankMerchantTidDraft(bankId = ""): MerchantTidDraft {
  return { tid: "", bank_id: bankId, mids: [blankMerchantTidMidDraft()] };
}

function merchantTidDraftsFromMerchant(merchant: MerchantOut | null): MerchantTidDraft[] {
  if (!merchant?.tids?.length) return [blankMerchantTidDraft(merchant?.bank_id ?? "")];
  return merchant.tids.map((tid) => ({
    tid: tid.tid ?? "",
    bank_id: tid.bank_id ?? merchant.bank_id ?? "",
    mids: tid.mids?.length
      ? tid.mids.map((mid) => ({ mid: mid.mid ?? "", mdr_rate_id: mid.mdr_rate_id ?? "" }))
      : [blankMerchantTidMidDraft()],
  }));
}

export function CreateMerchantModal({ onClose, onSave, customerId, customerName, customer = null, existingMerchant = null }: CreateMerchantModalProps) {
  const MERCHANT_TYPES = ['Retail', 'Corporate'];
  const ACCOUNT_TYPES = ["Current", "Savings"];
  const editing = Boolean(existingMerchant);

  const [f, setF] = useState({
    name: existingMerchant?.name ?? "",
    type: existingMerchant?.type ?? MERCHANT_TYPES[0],
    mccCode: existingMerchant?.mcc_code ?? "",
    bankId: existingMerchant?.bank_id ?? "",
    bank: existingMerchant?.bank ?? BANKS[0],
    contact: existingMerchant?.contact ?? "",
    phone: existingMerchant?.phone ?? "",
    email: existingMerchant?.email ?? "",
    bankAccountName: existingMerchant?.bank_account_name ?? "",
    bankAccountNumber: existingMerchant?.bank_account_number ?? "",
    bankAccountType: existingMerchant?.bank_account_type ?? ACCOUNT_TYPES[0],
  });
  const [address, setAddress] = useState<MerchantAddressForm>(() => merchantInitialAddressForm(existingMerchant, customer));
  const [bankOptions, setBankOptions] = useState<BankOut[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [tidRows, setTidRows] = useState<MerchantTidDraft[]>(() => merchantTidDraftsFromMerchant(existingMerchant));
  const [tidRowsTouched, setTidRowsTouched] = useState(false);
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
  const selectedTidBankIds = new Set(tidRows.map((row) => row.bank_id).filter(Boolean));
  const selectableBanks = bankOptions.filter((bank) =>
    (bank.status ?? "Active").toLowerCase() === "active" || bank.id === f.bankId || selectedTidBankIds.has(bank.id)
  );
  const selectedBankName = bankNameForId(bankOptions, f.bankId) || f.bank;
  const valid = Boolean(hasCustomerLink && f.name.trim() && f.contact.trim() && f.bankId);

  useEffect(() => {
    let cancelled = false;
    api.banks.list()
      .then((items) => {
        if (cancelled) return;
        setBankOptions(items);
        const options = activeBanks(items);
        const resolvedBankId = existingMerchant?.bank_id || bankIdForName(options, existingMerchant?.bank) || options[0]?.id || "";
        const resolvedBankName = bankNameForId(items, resolvedBankId) || existingMerchant?.bank || options[0]?.name || BANKS[0];
        setF((prev) => ({ ...prev, bankId: prev.bankId || resolvedBankId, bank: resolvedBankName }));
        setTidRows((rows) => rows.map((row) => ({ ...row, bank_id: row.bank_id || resolvedBankId })));
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setF((prev) => ({ ...prev, bank: prev.bank || BANKS[0] }));
        }
      })
      .finally(() => {
        if (!cancelled) setBanksLoading(false);
      });
    return () => { cancelled = true; };
  }, [existingMerchant?.bank, existingMerchant?.bank_id]);

  useEffect(() => {
    api.mdr.list().then(setMdrRates).catch(console.error);
  }, []);

  function setTidRow(index: number, key: "tid" | "bank_id", value: string) {
    setTidRowsTouched(true);
    setTidRows((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  function setTidMidRow(tidIndex: number, midIndex: number, key: keyof MerchantTidMidDraft, value: string) {
    setTidRowsTouched(true);
    setTidRows((rows) => rows.map((row, i) => {
      if (i !== tidIndex) return row;
      return {
        ...row,
        mids: row.mids.map((mid, j) => j === midIndex ? { ...mid, [key]: value } : mid),
      };
    }));
  }

  function addTidRow() {
    setTidRowsTouched(true);
    setTidRows((rows) => [...rows, blankMerchantTidDraft(f.bankId)]);
  }

  function removeTidRow(index: number) {
    setTidRowsTouched(true);
    setTidRows((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [blankMerchantTidDraft(f.bankId)];
    });
  }

  function addTidMidRow(tidIndex: number) {
    setTidRowsTouched(true);
    setTidRows((rows) => rows.map((row, i) =>
      i === tidIndex ? { ...row, mids: [...row.mids, blankMerchantTidMidDraft()] } : row
    ));
  }

  function removeTidMidRow(tidIndex: number, midIndex: number) {
    setTidRowsTouched(true);
    setTidRows((rows) => rows.map((row, i) => {
      if (i !== tidIndex) return row;
      const mids = row.mids.filter((_, j) => j !== midIndex);
      return { ...row, mids: mids.length ? mids : [blankMerchantTidMidDraft()] };
    }));
  }

  function buildTidPayload(): TerminalTidCreate[] {
    return tidRows
      .map((row) => ({
        tid: row.tid.trim(),
        bank_id: row.bank_id,
        bank: bankNameForId(bankOptions, row.bank_id) || selectedBankName,
        mids: row.mids
          .map((mid) => ({ mid: mid.mid.trim(), mdr_rate_id: mid.mdr_rate_id || null }))
          .filter((mid) => mid.mid),
      }))
      .filter((row) => row.tid);
  }

  function directAddressFields() {
    return {
      address_line_1: address.addressLine1.trim() || null,
      address_line_2: address.addressLine2.trim() || null,
      city: address.city.trim() || null,
      state: address.state.trim() || null,
      postcode: address.postcode.trim() || null,
    };
  }

  function shouldSubmitTidPayload() {
    if (!editing) return Boolean(buildTidPayload().length);
    return tidRowsTouched;
  }

  function tidValidationError() {
    const filledTidRows = tidRows
      .map((row, index) => ({ index, tid: row.tid.trim(), bank_id: row.bank_id, mids: row.mids }))
      .filter((row) => row.tid || row.mids.some((mid) => mid.mid.trim()));
    const tids = filledTidRows.map((row) => row.tid).filter(Boolean);
    if (tids.length !== new Set(tids).size) return "Duplicate TIDs are not allowed in one merchant.";
    for (const row of filledTidRows) {
      if (!row.tid) return `TID is required for Terminal ID row ${row.index + 1}.`;
      if (!row.bank_id) return `Bank is required for Terminal ID row ${row.index + 1}.`;
      const mids = row.mids.map((mid) => mid.mid.trim()).filter(Boolean);
      if (mids.length !== new Set(mids).size) return `Duplicate MIDs are not allowed under TID ${row.tid}.`;
    }
    return null;
  }

  function buildBaseBody(): MerchantCreate {
    return {
      customer_id: customerId,
      name: f.name.trim(),
      type: f.type,
      mcc_code: f.mccCode.trim() || null,
      bank_id: f.bankId,
      bank: selectedBankName,
      contact: f.contact.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      addresses: buildMerchantAddressPayload(address),
      ...directAddressFields(),
      bank_account_name: f.bankAccountName.trim() || f.name.trim(),
      bank_account_number: f.bankAccountNumber.trim(),
      bank_account_type: f.bankAccountType,
      tids: buildTidPayload(),
    };
  }

  // Edit-only: save changes directly
  async function submit() {
    if (!valid || !existingMerchant) return;
    const tidError = shouldSubmitTidPayload() ? tidValidationError() : null;
    if (tidError) {
      setErr(tidError);
      return;
    }
    setSaving(true); setErr(null);
    try {
      const updateBody: MerchantUpdate = {
        name: f.name.trim(), type: f.type, mcc_code: f.mccCode.trim() || null, bank_id: f.bankId, bank: selectedBankName,
        contact: f.contact.trim(), phone: f.phone.trim(),
        email: f.email.trim(),
        addresses: buildMerchantAddressPayload(address),
        ...directAddressFields(),
        bank_account_name: f.bankAccountName.trim() || f.name.trim(),
        bank_account_number: f.bankAccountNumber.trim(),
        bank_account_type: f.bankAccountType,
        ...(shouldSubmitTidPayload() ? { tids: buildTidPayload() } : {}),
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
    const tidError = tidValidationError();
    if (tidError) {
      setErr(tidError);
      return;
    }
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
      const tidError = tidValidationError();
      if (tidError) {
        setErr(tidError);
        setLinkingSaving(false);
        return;
      }
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
      const tidError = tidValidationError();
      if (tidError) {
        setErr(tidError);
        setLinkingSaving(false);
        return;
      }
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

          <Field label="Terminal IDs" hint="optional · each TID can have multiple MIDs">
            <div style={{ display: "grid", gap: 10 }}>
              {tidRows.map((row, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "var(--surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>TID {i + 1}</div>
                    {tidRows.length > 1 && (
                      <Btn
                        variant="ghost"
                        sm
                        icon="x"
                        title="Remove TID"
                        onClick={() => removeTidRow(i)}
                        style={{ color: "var(--bad)" }}
                      >
                        Remove
                      </Btn>
                    )}
                  </div>
                  <div className="field-row" style={{ marginBottom: 10 }}>
                    <Field label="TID">
                      <input
                        className="input"
                        placeholder="e.g. 12345678"
                        value={row.tid}
                        onChange={(e) => setTidRow(i, "tid", e.target.value)}
                      />
                    </Field>
                    <Field label="Bank">
                      <select className="input" value={row.bank_id} onChange={(e) => setTidRow(i, "bank_id", e.target.value)} disabled={banksLoading}>
                        <option value="">{banksLoading ? "Loading banks..." : "Select bank..."}</option>
                        {selectableBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>{bank.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.3 }}>MIDs</span>
                    <Btn variant="ghost" sm icon="plus" onClick={() => addTidMidRow(i)}>Add MID</Btn>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {row.mids.map((mid, j) => (
                      <div key={j} style={{ display: "grid", gridTemplateColumns: row.mids.length > 1 ? "minmax(0, 1fr) minmax(0, 1fr) auto" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
                        <Field label={j === 0 ? "MID" : undefined}>
                          <input
                            className="input"
                            placeholder="e.g. MID001"
                            value={mid.mid}
                            onChange={(e) => setTidMidRow(i, j, "mid", e.target.value)}
                          />
                        </Field>
                        <Field label={j === 0 ? "MDR rate" : undefined}>
                          <select className="input" value={mid.mdr_rate_id} onChange={(e) => setTidMidRow(i, j, "mdr_rate_id", e.target.value)}>
                            <option value="">No MDR rate</option>
                            {mdrRates.map((rate) => (
                              <option key={rate.id} value={rate.id}>
                                {rate.id} · {rate.type} {rate.rate}%
                              </option>
                            ))}
                          </select>
                        </Field>
                        {row.mids.length > 1 && (
                          <div style={{ paddingTop: j === 0 ? 24 : 0 }}>
                            <Btn
                              variant="ghost"
                              sm
                              icon="x"
                              title="Remove MID"
                              onClick={() => removeTidMidRow(i, j)}
                              style={{ color: "var(--bad)", height: 40 }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Btn variant="ghost" sm icon="plus" onClick={addTidRow} style={{ justifySelf: "start" }}>
                Add TID
              </Btn>
            </div>
          </Field>

          <Field label="Bank">
            <select
              className="input"
              value={f.bankId}
              disabled={banksLoading}
              onChange={(e) => {
                const bankId = e.target.value;
                const name = bankNameForId(bankOptions, bankId);
                setF((prev) => ({ ...prev, bankId, bank: name || prev.bank }));
                setTidRows((rows) => rows.map((row) => ({ ...row, bank_id: row.bank_id || bankId })));
              }}
            >
              <option value="">{banksLoading ? "Loading banks..." : "Select bank..."}</option>
              {selectableBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
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

/* =================== LISTING =================== */
export function Merchants({ nav }: { nav: NavFn }) {
  const can = useCan();
  const MERCHANTS_PAGE_SIZE = 20;
  const [merchantList, setMerchantList] = useState<MerchantOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [bankId, setBankId] = useState("All");
  const [bankOptions, setBankOptions] = useState<BankOut[]>([]);
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [createCustomer, setCreateCustomer] = useState<CustomerOut | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.banks.list().then(setBankOptions).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.merchants.list({
        page,
        per_page: MERCHANTS_PAGE_SIZE,
        query: q.trim() || undefined,
        status: status !== "All" ? status : undefined,
        bank_id: bankId !== "All" ? bankId : undefined,
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
  }, [page, q, status, bankId]);

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
        sub={total + " merchants · search by name, MID, TID, terminal serial or merchant ID"}
        actions={can("Merchants.Create") ? <Btn variant="primary" icon="plus" onClick={() => setShowCustomerPicker(true)}>Create Merchant</Btn> : undefined}
      />
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={(value) => { setQ(value); resetPage(); }} placeholder="Search merchant, MID, TID, terminal…" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All","Active","Onboarding","Suspended","Inactive"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="select" value={bankId} onChange={(e) => { setBankId(e.target.value); resetPage(); }}>
            <option value="All">All Banks</option>
            {bankOptions.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
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
        <Pagination total={total} shown={merchantList.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>
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

  function handleTidSaved(tid: TerminalTidOut) {
    setMerchant((prev) => {
      if (!prev) return prev;
      const tids = prev.tids ?? [];
      const exists = tids.some((item) => item.id === tid.id);
      return {
        ...prev,
        tids: exists
          ? tids.map((item) => item.id === tid.id ? tid : item)
          : [...tids, tid],
      };
    });
  }

  function handleMidSaved(tidId: string, mid: TerminalTidMidOut) {
    setMerchant((prev) => {
      if (!prev) return prev;
      const tids = prev.tids ?? [];
      return {
        ...prev,
        tids: tids.map((tid) => {
          if (tid.id !== tidId) return tid;
          const mids = tid.mids ?? [];
          const exists = mids.some((item) => item.id === mid.id);
          return {
            ...tid,
            mids: exists ? mids.map((item) => item.id === mid.id ? mid : item) : [...mids, mid],
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
        {tab === "overview"    ? <OverviewTab m={merchant} nav={nav} canEdit={can("Merchants.Edit")} onTidSaved={handleTidSaved} onMidSaved={handleMidSaved} />
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

function MerchantTidModal({ merchant, existing, onClose, onSaved }: {
  merchant: MerchantOut;
  existing?: TerminalTidOut | null;
  onClose: () => void;
  onSaved: (tid: TerminalTidOut) => void;
}) {
  const editing = Boolean(existing);
  const [tid, setTid] = useState(existing?.tid ?? "");
  const [bankOptions, setBankOptions] = useState<BankOut[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankId, setBankId] = useState(existing?.bank_id ?? merchant.bank_id ?? "");
  const [bank, setBank] = useState(existing?.bank ?? merchant.bank ?? "");
  const [mid, setMid] = useState("");
  const [mdrRateId, setMdrRateId] = useState("");
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    api.mdr.list().then(setMdrRates).catch(console.error);
  }, [editing]);

  useEffect(() => {
    let cancelled = false;
    api.banks.list()
      .then((items) => {
        if (cancelled) return;
        setBankOptions(items);
        const options = activeBanks(items);
        const resolvedBankId = existing?.bank_id || merchant.bank_id || bankIdForName(options, existing?.bank ?? merchant.bank) || options[0]?.id || "";
        const resolvedBankName = bankNameForId(items, resolvedBankId) || existing?.bank || merchant.bank || options[0]?.name || "";
        setBankId((current) => current || resolvedBankId);
        setBank((current) => current || resolvedBankName);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setBanksLoading(false);
      });
    return () => { cancelled = true; };
  }, [existing?.bank, existing?.bank_id, merchant.bank, merchant.bank_id]);

  const selectableBanks = bankOptions.filter((bank) => (bank.status ?? "Active").toLowerCase() === "active" || bank.id === bankId);
  const selectedBankName = bankNameForId(bankOptions, bankId) || bank;

  async function submit() {
    if (!tid.trim()) {
      setErr("TID is required");
      return;
    }
    setSaving(true); setErr(null);
    try {
      const result = editing
        ? await api.merchants.updateTid(merchant.id, existing!.id, {
          tid: tid.trim(),
          bank_id: bankId,
          bank: selectedBankName,
        } satisfies TerminalTidUpdate)
        : await api.merchants.createTid(merchant.id, {
          tid: tid.trim(),
          bank_id: bankId,
          bank: selectedBankName,
          mid: mid.trim() || null,
          mdr_rate_id: mdrRateId || null,
        } satisfies TerminalTidCreate);
      onSaved(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save TID");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit TID" : "Add TID"}
      sub={merchant.name}
      icon="tag"
      size="slim"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !tid.trim() || !bankId} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add TID"}
        </Btn>
      </>}
    >
      <Field label="TID" hint="required">
        <input className="input" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="TID123456" />
      </Field>
      <Field label="Bank" hint="required">
        <select
          className="input"
          value={bankId}
          disabled={banksLoading}
          onChange={(e) => {
            const nextBankId = e.target.value;
            setBankId(nextBankId);
            setBank(bankNameForId(bankOptions, nextBankId));
          }}
        >
          <option value="">{banksLoading ? "Loading banks..." : "Select bank..."}</option>
          {selectableBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
        </select>
      </Field>
      {!editing && (
        <>
          <Field label="Initial MID" hint="optional">
            <input className="input" value={mid} onChange={(e) => setMid(e.target.value)} placeholder="MID123456" />
          </Field>
          <Field label="MDR rate" hint="optional">
            <select className="input" value={mdrRateId} onChange={(e) => setMdrRateId(e.target.value)}>
              <option value="">No MDR rate</option>
              {mdrRates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.id} · {rate.type} {rate.rate}%
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function MidModal({ tid, merchantName, existing, onClose, onSaved }: {
  tid: TerminalTidOut;
  merchantName: string;
  existing?: TerminalTidMidOut | null;
  onClose: () => void;
  onSaved: (mid: TerminalTidMidOut) => void;
}) {
  const editing = Boolean(existing);
  const [mid, setMid] = useState(existing?.mid ?? "");
  const [mdrRateId, setMdrRateId] = useState(existing?.mdr_rate_id ?? "");
  const [reason, setReason] = useState("");
  const [mdrRates, setMdrRates] = useState<MdrOut[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.mdr.list().then(setMdrRates).catch(console.error);
  }, []);

  async function submit() {
    if (!mid.trim()) {
      setErr("MID is required");
      return;
    }
    setSaving(true); setErr(null);
    try {
      const result = editing
        ? await api.terminals.updateTidMid(tid.id, existing!.id, {
          mid: mid.trim(),
          mdr_rate_id: mdrRateId || null,
          reason: mid.trim() !== existing?.mid ? (reason.trim() || null) : null,
        } satisfies TerminalTidMidUpdate)
        : await api.terminals.createTidMid(tid.id, {
          mid: mid.trim(),
          mdr_rate_id: mdrRateId || null,
        } satisfies TerminalTidMidCreate);
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
      sub={`${merchantName} · ${tid.tid}`}
      icon="tag"
      size="slim"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !mid.trim()} onClick={submit}>
          {saving ? "Saving…" : editing ? "Save Changes" : "Add MID"}
        </Btn>
      </>}
    >
      <Field label="MID" hint="required">
        <input className="input" value={mid} onChange={(e) => setMid(e.target.value)} placeholder="MID123456" />
      </Field>
      <Field label="MDR rate">
        <select className="input" value={mdrRateId} onChange={(e) => setMdrRateId(e.target.value)}>
          <option value="">No MDR rate</option>
          {mdrRates.map((rate) => (
            <option key={rate.id} value={rate.id}>
              {rate.id} · {rate.type} {rate.rate}%
            </option>
          ))}
        </select>
      </Field>
      {editing && (
        <Field label="MID change reason" hint="optional">
          <textarea
            className="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for changing the MID..."
            rows={3}
          />
        </Field>
      )}
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

function TidMidHistoryModal({ tid, onClose }: {
  tid: TerminalTidOut;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TerminalTidMidHistoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    api.terminals.tidMidHistory(tid.id)
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load MID history"))
      .finally(() => setLoading(false));
  }, [tid.id]);

  function midLabel(terminalTidMidId: string) {
    const slot = tid.mids?.find((m) => m.id === terminalTidMidId);
    return slot ? `${slot.mid} (${terminalTidMidId})` : terminalTidMidId;
  }

  return (
    <Modal title="MID History" sub={`${tid.tid} · ${tid.id}`} icon="clock" size="slim" onClose={onClose}>
      {loading ? (
        <div style={{ padding: "20px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading...</div>
      ) : err ? (
        <div style={{ fontSize: 13, color: "var(--bad)" }}>{err}</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No MID changes recorded for this TID.</div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink-1)" }}>
                    <span className="mono">{row.old_mid || "-"}</span>
                    <span style={{ color: "var(--ink-3)", fontWeight: 500 }}> to </span>
                    <span className="mono">{row.new_mid || "-"}</span>
                  </div>
                  <span className="td-mut" style={{ fontSize: 12 }}>{row.changed_at ? new Date(row.changed_at).toLocaleString() : "-"}</span>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: "92px 1fr", margin: 0 }}>
                  <dt>MID slot</dt><dd className="mono">{midLabel(row.terminal_tid_mid_id)}</dd>
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

function OverviewTab({ m, nav, canEdit, onTidSaved, onMidSaved }: {
  m: MerchantOut;
  nav: NavFn;
  canEdit: boolean;
  onTidSaved: (tid: TerminalTidOut) => void;
  onMidSaved: (tidId: string, mid: TerminalTidMidOut) => void;
}) {
  const tidValue = (value: string | null | undefined) => value || "-";
  const [showAddTid, setShowAddTid] = useState(false);
  const [editingTid, setEditingTid] = useState<TerminalTidOut | null>(null);
  const [historyTid, setHistoryTid] = useState<TerminalTidOut | null>(null);
  const [tidActionId, setTidActionId] = useState<string | null>(null);
  const [tidActionError, setTidActionError] = useState<string | null>(null);
  const [midModalTid, setMidModalTid] = useState<TerminalTidOut | null>(null);
  const [editingMid, setEditingMid] = useState<TerminalTidMidOut | null>(null);
  const [midActionId, setMidActionId] = useState<string | null>(null);
  const [midActionError, setMidActionError] = useState<string | null>(null);
  const addressRows = merchantAddressRows(m);

  async function toggleTidStatus(tid: TerminalTidOut) {
    if (!canEdit || tidActionId) return;
    setTidActionId(tid.id);
    setTidActionError(null);
    try {
      const active = (tid.status ?? "Active").toLowerCase() === "active";
      const next = active
        ? await api.terminals.deleteTid(tid.id)
        : await api.terminals.reactivateTid(tid.id);
      onTidSaved(next);
    } catch (e) {
      setTidActionError(e instanceof ApiError ? e.message : "Failed to update TID status");
    } finally {
      setTidActionId(null);
    }
  }

  async function toggleMidStatus(tid: TerminalTidOut, mid: TerminalTidMidOut) {
    if (!canEdit || midActionId) return;
    setMidActionId(mid.id);
    setMidActionError(null);
    try {
      const active = (mid.status ?? "Active").toLowerCase() === "active";
      const next = active
        ? await api.terminals.deleteTidMid(tid.id, mid.id)
        : await api.terminals.reactivateTidMid(tid.id, mid.id);
      onMidSaved(tid.id, next);
    } catch (e) {
      setMidActionError(e instanceof ApiError ? e.message : "Failed to update MID status");
    } finally {
      setMidActionId(null);
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
              <dt>Bank</dt><dd>{m.bank}</dd>
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
        <Card
          title="Terminal IDs (TIDs)"
          icon="tag"
          actions={canEdit ? <Btn variant="ghost" sm icon="plus" onClick={() => setShowAddTid(true)}>Add TID</Btn> : undefined}
        >
          <div className="card-pad">
            {m.tids?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {m.tids.map((tid) => (
                  <div key={tid.id} style={{ padding: "10px 12px", background: "var(--bg-2, #f5f5f5)", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <span className="mono" style={{ fontWeight: 700 }}>{tidValue(tid.tid)}</span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <button className="icon-btn" title="MID history" onClick={() => setHistoryTid(tid)}>
                          <Icon name="clock" size={14} />
                        </button>
                        {canEdit && (
                          <>
                            <button className="icon-btn" title="Edit TID" onClick={() => setEditingTid(tid)}>
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              className="icon-btn"
                              title={(tid.status ?? "Active").toLowerCase() === "active" ? "Deactivate TID" : "Reactivate TID"}
                              disabled={tidActionId === tid.id}
                              onClick={() => toggleTidStatus(tid)}
                            >
                              <Icon name={(tid.status ?? "Active").toLowerCase() === "active" ? "x" : "refresh"} size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <dl className="kv" style={{ margin: 0 }}>
                      <dt>TID</dt><dd className="mono">{tidValue(tid.tid)}</dd>
                      <dt>Bank</dt><dd>{tid.bank || "-"}</dd>
                      <dt>Terminal Serial</dt>
                      <dd className="mono">
                        {tid.terminal_serial ? (
                          <button
                            type="button"
                            style={{ border: 0, background: "transparent", padding: 0, color: "var(--info)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
                            onClick={() => nav("terminal-detail", tid.terminal_serial!)}
                          >
                            {tid.terminal_serial}
                          </button>
                        ) : "-"}
                      </dd>
                      {(tid.sim_card || tid.simcard) && (
                        <>
                          <dt>SIM Card</dt>
                          <dd>
                            {(() => {
                              const sim = tid.sim_card ?? tid.simcard;
                              if (!sim) return null;
                              const label = tidSimLabel(tid);
                              return (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    style={{ border: 0, background: "transparent", padding: 0, color: "var(--info)", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
                                    onClick={() => nav("simcard-detail", sim.id)}
                                  >
                                    {sim.id}
                                  </button>
                                  {label && <span className="td-mut">{label}</span>}
                                  {sim.status && <Chip cls={sim.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{sim.status}</Chip>}
                                </span>
                              );
                            })()}
                          </dd>
                        </>
                      )}
                      <dt>Status</dt><dd>{tid.status ? <Chip cls={tid.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{tid.status}</Chip> : "-"}</dd>
                    </dl>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.3 }}>MIDs</span>
                        {canEdit && (
                          <Btn variant="ghost" sm icon="plus" onClick={() => { setMidModalTid(tid); setEditingMid(null); }}>Add MID</Btn>
                        )}
                      </div>
                      {tid.mids?.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {tid.mids.map((mid) => (
                            <div key={mid.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 8px", background: "var(--surface)", borderRadius: 5 }}>
                              <div>
                                <div className="mono" style={{ fontWeight: 600 }}>
                                  {mid.mid}{" "}
                                  {mid.status && <Chip cls={mid.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{mid.status}</Chip>}
                                </div>
                                <div className="td-mut" style={{ fontSize: 12 }}>
                                  {mid.mdr_rate ? `${mid.mdr_rate.type} · ${mid.mdr_rate.rate}% · ${mid.mdr_rate.network}` : "No MDR rate"}
                                </div>
                              </div>
                              {canEdit && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                  <button className="icon-btn" title="Edit MID" onClick={() => { setMidModalTid(tid); setEditingMid(mid); }}>
                                    <Icon name="edit" size={13} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    title={(mid.status ?? "Active").toLowerCase() === "active" ? "Deactivate MID" : "Reactivate MID"}
                                    disabled={midActionId === mid.id}
                                    onClick={() => toggleMidStatus(tid, mid)}
                                  >
                                    <Icon name={(mid.status ?? "Active").toLowerCase() === "active" ? "x" : "refresh"} size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>No MIDs linked.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "12px 0", fontSize: 13, color: "var(--ink-3)" }}>
                No TIDs linked.
              </div>
            )}
            {tidActionError && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 10 }}>{tidActionError}</div>}
            {midActionError && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 10 }}>{midActionError}</div>}
          </div>
        </Card>
        {historyTid && (
          <TidMidHistoryModal tid={historyTid} onClose={() => setHistoryTid(null)} />
        )}
        {showAddTid && canEdit && (
          <MerchantTidModal
            merchant={m}
            onClose={() => setShowAddTid(false)}
            onSaved={onTidSaved}
          />
        )}
        {editingTid && canEdit && (
          <MerchantTidModal
            merchant={m}
            existing={editingTid}
            onClose={() => setEditingTid(null)}
            onSaved={onTidSaved}
          />
        )}
        {midModalTid && canEdit && (
          <MidModal
            tid={midModalTid}
            merchantName={m.name}
            existing={editingMid}
            onClose={() => { setMidModalTid(null); setEditingMid(null); }}
            onSaved={(mid) => onMidSaved(midModalTid.id, mid)}
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
