/* PaidChain — Customer listing + detail + onboarding */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field, MerchantStatus } from "./components";
import { CUSTOMER_TYPES, CUSTOMER_STATUS, BANKS } from "./data";
import type { Customer, Merchant } from "./data";
import { useCustomers } from "./customers-context";
import { useMerchants } from "./merchants-context";
import { CreateMerchantModal } from "./screen-merchants";
import { NavFn } from "./shell";

function CustomerStatus({ status }: { status: string }) {
  const m = CUSTOMER_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

/* =================== CREATE CUSTOMER MODAL =================== */
interface CreateCustomerModalProps { onClose: () => void; onCreate: (c: Customer) => void }

function CreateCustomerModal({ onClose, onCreate }: CreateCustomerModalProps) {
  const [f, setF] = useState({ name: "", type: CUSTOMER_TYPES[0], regNo: "", tin: "", contact: "", phone: "", email: "", address: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.contact.trim();

  function submit() {
    onCreate({
      id: "CUST-" + String(Date.now()).slice(-3),
      name: f.name.trim(), type: f.type, regNo: f.regNo, tin: f.tin.trim(),
      contact: f.contact.trim(), phone: f.phone, email: f.email, address: f.address,
      status: "Active",
      onboarded: new Date().toISOString().slice(0, 10),
      isNew: true,
    });
    onClose();
  }

  return (
    <Modal
      title="Create Customer" sub="Register a new customer as a billing entity" icon="building"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>Create Customer</Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Company / customer name" hint="required">
          <input className="input" placeholder="e.g. Sinar Holdings Bhd" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Type">
          <select className="input" value={f.type} onChange={(e) => set("type", e.target.value)}>
            {CUSTOMER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Registration number">
        <input className="input" placeholder="e.g. 202301012345" value={f.regNo} onChange={(e) => set("regNo", e.target.value)} />
      </Field>
      <Field label="TIN number">
        <input className="input" placeholder="Required for eInvoice generation" value={f.tin} onChange={(e) => set("tin", e.target.value)} />
      </Field>
      <Field label="Primary contact name" hint="required">
        <input className="input" placeholder="e.g. Ahmad Fauzi" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Phone">
          <input className="input" placeholder="+60 3-XXXX XXXX" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" placeholder="admin@company.com" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Address">
        <input className="input" placeholder="Street, City" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
    </Modal>
  );
}

/* =================== ONBOARDING FLOW MODAL =================== */
type OnboardingStep = "prompt" | "merchant";

interface OnboardingModalProps {
  customer: Customer;
  onFinish: (merchant?: Merchant) => void;
}

function CustomerOnboardingModal({ customer, onFinish }: OnboardingModalProps) {
  const MDR_PLANS = ["Standard Retail", "F&B Preferred", "Enterprise", "SME Flat"];
  const MERCHANT_TYPES = ["F&B", "Retail", "Healthcare", "Grocery", "Electronics", "Automotive", "Services", "Fitness", "Fuel", "Entertainment", "Furniture"];

  const [step, setStep] = useState<OnboardingStep>("prompt");
  const [mForm, setMForm] = useState({
    name: "", type: MERCHANT_TYPES[0], bank: BANKS[0], mdrPlan: MDR_PLANS[0],
    contact: customer.contact, phone: customer.phone, email: "", address: customer.address,
  });
  const setM = (k: string, v: string) => setMForm((f) => ({ ...f, [k]: v }));

  function buildMerchant(): Merchant {
    const idx = Date.now();
    return {
      id: "M" + String(idx).slice(-4),
      name: mForm.name.trim(), type: mForm.type,
      mid: "MID" + String(idx).slice(-8),
      bank: mForm.bank, status: "Onboarding", finance: "Pending Docs",
      terminals: 0, openJobs: 0,
      contact: mForm.contact, phone: mForm.phone, email: mForm.email, address: mForm.address,
      onboarded: new Date().toISOString().slice(0, 10), mdrPlan: mForm.mdrPlan,
      bankAccountName: mForm.name.trim(), bankAccountNumber: "", bankAccountType: "Current",
      customerId: customer.id, customerName: customer.name,
      isNew: true,
    };
  }

  const merchantValid = mForm.name.trim() && mForm.contact.trim();

  const stepIdx = step === "prompt" ? 0 : 1;
  const stepLabels = ["Customer", "Merchant"];

  return (
    <Modal
      title="Customer Onboarding"
      sub={step === "prompt" ? "Customer created — set up their merchant account" : "Create the first merchant location"}
      icon="building"
      size="wide"
      foot={
        step === "prompt" ? (
          <>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => onFinish()}>Skip for now</Btn>
            <Btn variant="primary" iconRight="chevRight" onClick={() => setStep("merchant")}>Create First Merchant</Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep("prompt")}>Back</Btn>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => onFinish()}>Skip</Btn>
            <Btn variant="primary" icon="check" disabled={!merchantValid} onClick={() => onFinish(buildMerchant())}>Create Merchant</Btn>
          </>
        )
      }
    >
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        {stepLabels.map((label, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < stepLabels.length - 1 ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: done ? "var(--green-700)" : active ? "var(--slate)" : "var(--bg-2, #f0f0f0)",
                  color: done || active ? "#fff" : "var(--ink-3)",
                  fontSize: 12, fontWeight: 700,
                }}>
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

      {/* Step: prompt */}
      {step === "prompt" && (
        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green-050)", color: "var(--green-700)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="checkCircle" size={28} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Customer Created!</div>
          <div style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
            <strong>{customer.name}</strong> is ready. Would you like to set up their first merchant account and link terminal devices?
          </div>
        </div>
      )}

      {/* Step: merchant form */}
      {step === "merchant" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--bg-2, #f5f5f5)", borderRadius: 9, marginBottom: 16, fontSize: 12.5, color: "var(--ink-2)" }}>
            <Icon name="building" size={14} />
            <span>Billing customer: <strong>{customer.name}</strong></span>
          </div>
          <div className="field-row">
            <Field label="Merchant name" hint="required">
              <input className="input" placeholder="e.g. Kopitiam Damansara" value={mForm.name} onChange={(e) => setM("name", e.target.value)} />
            </Field>
            <Field label="Business type">
              <select className="input" value={mForm.type} onChange={(e) => setM("type", e.target.value)}>
                {MERCHANT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Bank">
              <select className="input" value={mForm.bank} onChange={(e) => setM("bank", e.target.value)}>
                {BANKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="MDR plan">
              <select className="input" value={mForm.mdrPlan} onChange={(e) => setM("mdrPlan", e.target.value)}>
                {MDR_PLANS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Contact person" hint="required">
            <input className="input" placeholder="On-site contact" value={mForm.contact} onChange={(e) => setM("contact", e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="Phone">
              <input className="input" placeholder="+60 1X-XXX XXXX" value={mForm.phone} onChange={(e) => setM("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" placeholder="ops@merchant.com" value={mForm.email} onChange={(e) => setM("email", e.target.value)} />
            </Field>
          </div>
          <Field label="Merchant address">
            <input className="input" placeholder="Street, City" value={mForm.address} onChange={(e) => setM("address", e.target.value)} />
          </Field>
        </div>
      )}

    </Modal>
  );
}

/* =================== LISTING =================== */
export function Customers({ nav }: { nav: NavFn }) {
  const { customers, addCustomer } = useCustomers();
  const { merchants, addMerchant } = useMerchants();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [onboardingCustomer, setOnboardingCustomer] = useState<Customer | null>(null);

  const filtered = customers.filter((c) => {
    const hay = (c.id + " " + c.name + " " + c.regNo + " " + c.contact).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (status !== "All" && c.status !== status) return false;
    return true;
  });

  const getMerchantCount = (id: string) => merchants.filter((m) => m.customerId === id).length;

  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.status === "Active").length,
    merchants: merchants.length,
  };

  function handleCreate(c: Customer) {
    addCustomer(c);
    setShowCreate(false);
    setOnboardingCustomer(c);
  }

  function finishOnboarding(merchant?: Merchant) {
    const cid = onboardingCustomer?.id;
    setOnboardingCustomer(null);
    if (merchant) addMerchant(merchant);
    if (cid) nav("customer-detail", cid);
  }

  return (
    <div>
      <PageHead
        title="Customers"
        sub="Billing entities · parent organisations that own one or more merchants"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Customer</Btn>
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { l: "Total Customers",   v: stats.total,     ico: "building",  c: "var(--ink-2)",     bg: "var(--bg-2, #f5f5f5)" },
          { l: "Active",            v: stats.active,    ico: "check",     c: "var(--ok)",        bg: "var(--green-050)" },
          { l: "Linked Merchants",  v: stats.merchants, ico: "merchants", c: "var(--info)",      bg: "var(--info-bg)" },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: s.bg, color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val">{s.v}</div>
          </div>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search customer name, registration, contact…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Active", "Inactive", "Suspended"].map((s) => (
              <option key={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{filtered.length} customers</span>
        </Toolbar>
        {filtered.length === 0 ? <Empty icon="building" title="No customers match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Customer","Type","Reg No","Merchants","Contact","Onboarded","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {c.name}{c.isNew && <Chip cls="chip-ok" sq>New</Chip>}
                        </span>
                        <span className="c2-sub mono">{c.id}</span>
                      </div>
                    </td>
                    <td><Chip cls="chip-neutral">{c.type}</Chip></td>
                    <td className="td-mono td-mut">{c.regNo || "—"}</td>
                    <td>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
                        <Icon name="merchants" size={14} style={{ color: "var(--ink-3)" }} />
                        {getMerchantCount(c.id)}
                      </span>
                    </td>
                    <td className="td-mut">{c.contact}</td>
                    <td className="td-mono td-mut">{c.onboarded}</td>
                    <td><CustomerStatus status={c.status} /></td>
                    <td>
                      <Btn variant="ghost" sm icon="eye" onClick={() => nav("customer-detail", c.id)}>View</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={customers.length} shown={filtered.length} />
      </Card>

      {showCreate && <CreateCustomerModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {onboardingCustomer && <CustomerOnboardingModal customer={onboardingCustomer} onFinish={finishOnboarding} />}

    </div>
  );
}

/* =================== DETAIL =================== */
export function CustomerDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { customers } = useCustomers();
  const { merchants, addMerchant } = useMerchants();
  const customer = customers.find((c) => c.id === id);
  const [showAddMerchant, setShowAddMerchant] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!customer) return (
    <div>
      <PageHead title="Customer not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("customers")}>Back</Btn>} />
      <Empty icon="building" title="Customer not found" sub={"No customer with ID " + id} />
    </div>
  );

  const linked = merchants.filter((m) => m.customerId === id);

  function handleAddMerchant(m: Merchant) {
    addMerchant(m);
    setShowAddMerchant(false);
    setToast("Merchant " + m.name + " added");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title={customer.name}
        sub={customer.id + " · " + customer.type}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("customers")}>Back</Btn>
          <Btn variant="ghost" icon="edit">Edit</Btn>
        </>}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <CustomerStatus status={customer.status} />
        <Chip cls="chip-neutral">{customer.type}</Chip>
        {customer.isNew && <Chip cls="chip-ok" sq>New</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="Company Details" icon="building">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Customer ID",      customer.id],
              ["Registered Name",  customer.name],
              ["Type",             customer.type],
              ["Registration No.", customer.regNo || "—"],
              ["TIN No.",          customer.tin || "—"],
              ["Onboarded",        customer.onboarded],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500, fontFamily: ["Customer ID","Registration No.","TIN No."].includes(l as string) ? "var(--mono)" : undefined }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Primary Contact" icon="user">
          <div style={{ padding: "4px 20px 16px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
                {customer.contact.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{customer.contact}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Authorised representative</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13 }}>
              {customer.email    && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mail"   size={15} style={{ color: "var(--ink-3)" }} />{customer.email}</div>}
              {customer.phone    && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="phone"  size={15} style={{ color: "var(--ink-3)" }} />{customer.phone}</div>}
              {customer.address  && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mapPin" size={15} style={{ color: "var(--ink-3)" }} />{customer.address}</div>}
            </div>
          </div>
        </Card>
      </div>

      {/* Linked merchants */}
      <Card
        title={"Merchants (" + linked.length + ")"}
        icon="merchants"
        actions={<Btn variant="primary" sm icon="plus" onClick={() => setShowAddMerchant(true)}>Add Merchant</Btn>}
      >
        {linked.length === 0 ? (
          <Empty icon="merchants" title="No merchants linked" sub="Add a merchant account to this customer to get started" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Merchant","MID","Bank","Type","Terminals","Finance","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {linked.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {m.name}{m.isNew && <Chip cls="chip-ok" sq>New</Chip>}
                        </span>
                        <span className="c2-sub mono">{m.id}</span>
                      </div>
                    </td>
                    <td className="td-mono td-mut">{m.mid}</td>
                    <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={14} style={{ color: "var(--ink-3)" }} />{m.bank}</span></td>
                    <td className="td-mut">{m.type}</td>
                    <td className="td-mut">{m.terminals || "—"}</td>
                    <td><MerchantStatus status={m.finance} /></td>
                    <td><MerchantStatus status={m.status} /></td>
                    <td><Btn variant="ghost" sm icon="eye" onClick={() => nav("merchant-detail", m.id)}>View</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAddMerchant && (
        <CreateMerchantModal
          onClose={() => setShowAddMerchant(false)}
          onCreate={handleAddMerchant}
          prefilledCustomerId={customer.id}
        />
      )}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
