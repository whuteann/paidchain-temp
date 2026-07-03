/* PaidChain — Customer listing + detail + onboarding */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field, MerchantStatus, MobileListItem, ResponsiveTable } from "./components";
import { CUSTOMER_TYPES, CUSTOMER_STATUS } from "./data";
import { CreateMerchantModal } from "./screen-merchants";
import { api, ApiError } from "@/lib/api";
import type { CustomerOut, CustomerCreate, CustomerUpdate, CustomerDetails, CustomerMerchantOut, MerchantOut } from "@/lib/api";
import { NavFn } from "./shell";

function CustomerStatus({ status }: { status: string }) {
  const m = CUSTOMER_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

/* =================== CREATE CUSTOMER MODAL =================== */
function CreateCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: CustomerOut) => void }) {
  const [f, setF] = useState({ name: "", type: CUSTOMER_TYPES[0], regNo: "", tin: "", contact: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.contact.trim();

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const body: CustomerCreate = {
        name: f.name.trim(), type: f.type,
        reg_no: f.regNo.trim(), tin: f.tin.trim() || null,
        contact: f.contact.trim(), phone: f.phone.trim(),
        email: f.email.trim(), address: f.address.trim(),
      };
      const c = await api.customers.create(body);
      onCreate(c);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create customer");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Create Customer" sub="Register a new customer as a billing entity" icon="building"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Creating…" : "Create Customer"}
        </Btn>
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
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

/* =================== EDIT CUSTOMER MODAL =================== */
function EditCustomerModal({ customer, onClose, onSave }: { customer: CustomerOut; onClose: () => void; onSave: (c: CustomerOut) => void }) {
  const [f, setF] = useState<CustomerUpdate>({
    name: customer.name,
    type: customer.type,
    reg_no: customer.reg_no || "",
    tin: customer.tin || "",
    contact: customer.contact || "",
    phone: customer.phone || "",
    email: customer.email || "",
    address: customer.address || "",
    status: customer.status,
  });
  const set = (k: keyof CustomerUpdate, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.customers.update(customer.id, f);
      onSave(updated);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Customer" sub={customer.id} icon="building"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save Changes"}</Btn>
      </>}
    >
      <Field label="Registered Name" hint="required">
        <input className="input" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Type">
          <select className="input" value={f.type ?? ""} onChange={(e) => set("type", e.target.value)}>
            {CUSTOMER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={f.status ?? ""} onChange={(e) => set("status", e.target.value)}>
            {Object.keys(CUSTOMER_STATUS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Registration No.">
          <input className="input" value={f.reg_no ?? ""} onChange={(e) => set("reg_no", e.target.value)} />
        </Field>
        <Field label="TIN No.">
          <input className="input" value={f.tin ?? ""} onChange={(e) => set("tin", e.target.value)} />
        </Field>
      </div>
      <Field label="Contact Person">
        <input className="input" value={f.contact ?? ""} onChange={(e) => set("contact", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Phone">
          <input className="input" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Address">
        <textarea className="textarea" value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
      </Field>
      {err && <div style={{ fontSize: 13, color: "var(--bad)", marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}

/* =================== ONBOARDING FLOW MODAL =================== */
function CustomerOnboardingModal({ customer, onSkip, onCreateMerchant }: {
  customer: CustomerOut;
  onSkip: () => void;
  onCreateMerchant: () => void;
}) {
  return (
    <Modal
      title="Customer Onboarding"
      sub="Customer created — set up their merchant account"
      icon="building"
      foot={
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onSkip}>Skip for now</Btn>
          <Btn variant="primary" iconRight="chevRight" onClick={onCreateMerchant}>Create First Merchant</Btn>
        </>
      }
    >
      <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green-050)", color: "var(--green-700)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Icon name="checkCircle" size={28} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Customer Created!</div>
        <div style={{ color: "var(--ink-2)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
          <strong>{customer.name}</strong> is ready. Would you like to set up their first merchant account?
        </div>
      </div>
    </Modal>
  );
}

const CUSTOMERS_PAGE_SIZE = 20;

/* =================== LISTING =================== */
export function Customers({ nav }: { nav: NavFn }) {
  const [customers, setCustomers] = useState<CustomerOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [onboardingCustomer, setOnboardingCustomer] = useState<CustomerOut | null>(null);
  const [merchantOnboardingCustomer, setMerchantOnboardingCustomer] = useState<CustomerOut | null>(null);

  useEffect(() => {
    api.customers.details().then(setDetails).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.customers.list({
      page,
      per_page: CUSTOMERS_PAGE_SIZE,
      query: q || undefined,
      status: status !== "All" ? status : undefined,
    })
      .then((p) => {
        setCustomers(p.items);
        setPages(p.pages);
        setTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, status]);

  function resetPage() { setPage(1); }

  function handleCreate(c: CustomerOut) {
    setCustomers((prev) => [c, ...prev]);
    setNewIds((prev) => new Set([...prev, c.id]));
    setShowCreate(false);
    setOnboardingCustomer(c);
    api.customers.details().then(setDetails).catch(console.error);
  }

  function finishOnboarding() {
    const cid = onboardingCustomer?.id;
    setOnboardingCustomer(null);
    if (cid) nav("customer-detail", cid);
  }

  function startMerchantOnboarding() {
    const c = onboardingCustomer;
    setOnboardingCustomer(null);
    setMerchantOnboardingCustomer(c);
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
          { l: "Total Customers",  v: details?.total_customers ?? 0,   ico: "building",  c: "var(--ink-2)",  bg: "var(--bg-2, #f5f5f5)" },
          { l: "Active",           v: details?.total_active ?? 0,      ico: "check",     c: "var(--ok)",     bg: "var(--green-050)" },
          { l: "Linked Merchants", v: details?.linked_merchants ?? 0,  ico: "merchants", c: "var(--info)",   bg: "var(--info-bg)" },
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
          <SearchBox value={q} onChange={(v) => { setQ(v); resetPage(); }} placeholder="Search customer name, registration, contact…" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All", "Active", "Inactive", "Suspended"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} customers`}</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : customers.length === 0 ? <Empty icon="building" title="No customers match" /> : (
          <ResponsiveTable
            rows={customers}
            getKey={(c) => c.id}
            onRowClick={(c) => nav("customer-detail", c.id)}
            columns={[
              { key: "customer", header: "Customer", render: (c) => <div className="cell-2"><span className="td-strong" style={{ display: "flex", alignItems: "center", gap: 7 }}>{c.name}{newIds.has(c.id) && <Chip cls="chip-ok" sq>New</Chip>}</span><span className="c2-sub mono">{c.id}</span></div> },
              { key: "type", header: "Type", render: (c) => <Chip cls="chip-neutral">{c.type}</Chip> },
              { key: "reg", header: "Reg No", mobileLabel: "Registration", render: (c) => <span className="td-mono td-mut">{c.reg_no || "—"}</span> },
              { key: "merchants", header: "Merchants", render: (c) => <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}><Icon name="merchants" size={14} style={{ color: "var(--ink-3)" }} />{c.merchant_count}</span> },
              { key: "contact", header: "Contact", render: (c) => <span className="td-mut">{c.contact}</span> },
              { key: "onboarded", header: "Onboarded", render: (c) => <span className="td-mono td-mut">{c.onboarded_date}</span> },
              { key: "status", header: "Status", render: (c) => <CustomerStatus status={c.status} /> },
            ]}
            renderMobile={(c) => (
              <MobileListItem
                title={<>{c.name}{newIds.has(c.id) && <Chip cls="chip-ok" sq>New</Chip>}</>}
                sub={<span className="mono">{c.id}</span>}
                status={<CustomerStatus status={c.status} />}
                meta={[
                  { label: "Type", value: <Chip cls="chip-neutral">{c.type}</Chip> },
                  { label: "Merchants", value: <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="merchants" size={14} style={{ color: "var(--ink-3)" }} />{c.merchant_count}</span> },
                  { label: "Contact", value: c.contact },
                  { label: "Registration", value: <span className="td-mono">{c.reg_no || "—"}</span> },
                ]}
                onClick={() => nav("customer-detail", c.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={total} shown={customers.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>

      {showCreate && <CreateCustomerModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {onboardingCustomer && (
        <CustomerOnboardingModal
          customer={onboardingCustomer}
          onSkip={finishOnboarding}
          onCreateMerchant={startMerchantOnboarding}
        />
      )}
      {merchantOnboardingCustomer && (
        <CreateMerchantModal
          customerId={merchantOnboardingCustomer.id}
          customerName={merchantOnboardingCustomer.name}
          onClose={() => {
            const cid = merchantOnboardingCustomer.id;
            setMerchantOnboardingCustomer(null);
            nav("customer-detail", cid);
          }}
          onSave={(_m) => {
            const cid = merchantOnboardingCustomer.id;
            setMerchantOnboardingCustomer(null);
            nav("customer-detail", cid);
          }}
        />
      )}
    </div>
  );
}

/* =================== DETAIL =================== */
export function CustomerDetail({ id, nav }: { id: string; nav: NavFn }) {
  const [customer, setCustomer] = useState<CustomerOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [linked, setLinked] = useState<CustomerMerchantOut[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(true);
  const [showAddMerchant, setShowAddMerchant] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.customers.get(id)
      .then(setCustomer)
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
    loadLinkedMerchants();
  }, [id]);

  function loadLinkedMerchants() {
    setLinkedLoading(true);
    api.customers.merchants(id)
      .then(setLinked)
      .catch(console.error)
      .finally(() => setLinkedLoading(false));
  }

  if (loading) return (
    <div>
      <PageHead title="Customer" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("customers")}>Back</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading…</div>
    </div>
  );

  if (notFound || !customer) return (
    <div>
      <PageHead title="Customer not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("customers")}>Back</Btn>} />
      <Empty icon="building" title="Customer not found" sub={"No customer with ID " + id} />
    </div>
  );

  function handleAddMerchant(m: MerchantOut) {
    setShowAddMerchant(false);
    setToast("Merchant " + m.name + " added");
    setTimeout(() => setToast(null), 2800);
    loadLinkedMerchants();
  }

  return (
    <div>
      <PageHead
        title={customer.name}
        sub={customer.id + " · " + customer.type}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("customers")}>Back</Btn>
          <Btn variant="ghost" icon="edit" onClick={() => setShowEdit(true)}>Edit</Btn>
        </>}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <CustomerStatus status={customer.status} />
        <Chip cls="chip-neutral">{customer.type}</Chip>
      </div>

      <div className="customer-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="Company Details" icon="building">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Customer ID",      customer.id],
              ["Registered Name",  customer.name],
              ["Type",             customer.type],
              ["Registration No.", customer.reg_no || "—"],
              ["TIN No.",          customer.tin || "—"],
              ["Onboarded",        customer.onboarded_date],
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
              {customer.email   && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mail"   size={15} style={{ color: "var(--ink-3)" }} />{customer.email}</div>}
              {customer.phone   && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="phone"  size={15} style={{ color: "var(--ink-3)" }} />{customer.phone}</div>}
              {customer.address && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mapPin" size={15} style={{ color: "var(--ink-3)" }} />{customer.address}</div>}
            </div>
          </div>
        </Card>
      </div>

      <Card
        title={"Merchants (" + linked.length + ")"}
        icon="merchants"
        actions={<Btn variant="primary" sm icon="plus" onClick={() => setShowAddMerchant(true)}>Add Merchant</Btn>}
      >
        {linkedLoading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : linked.length === 0 ? (
          <Empty icon="merchants" title="No merchants linked" sub="Add a merchant account to this customer to get started" />
        ) : (
          <ResponsiveTable
            rows={linked}
            getKey={(m) => m.id}
            onRowClick={(m) => nav("merchant-detail", m.id)}
            columns={[
              { key: "merchant", header: "Merchant", render: (m) => <div className="cell-2"><span className="td-strong">{m.name}</span><span className="c2-sub mono">{m.id}</span></div> },
              { key: "mid", header: "MID", render: (m) => <span className="td-mono td-mut">{m.mid}</span> },
              { key: "bank", header: "Bank", render: (m) => <span style={{ display: "flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={14} style={{ color: "var(--ink-3)" }} />{m.bank}</span> },
              { key: "type", header: "Type", render: (m) => <span className="td-mut">{m.type}</span> },
              { key: "terminals", header: "Terminals", render: (m) => <span className="td-mut">{m.terminal_count || "—"}</span> },
              { key: "finance", header: "Finance", render: (m) => <MerchantStatus status={m.finance_status} /> },
              { key: "status", header: "Status", render: (m) => <MerchantStatus status={m.status} /> },
            ]}
            renderMobile={(m) => (
              <MobileListItem
                title={m.name}
                sub={<span className="mono">{m.id}</span>}
                status={<MerchantStatus status={m.status} />}
                meta={[
                  { label: "MID", value: <span className="td-mono">{m.mid}</span> },
                  { label: "Bank", value: <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Icon name="bank" size={14} style={{ color: "var(--ink-3)" }} />{m.bank}</span> },
                  { label: "Type", value: m.type },
                  { label: "Terminals", value: m.terminal_count || "—" },
                  { label: "Finance", value: <MerchantStatus status={m.finance_status} /> },
                ]}
                onClick={() => nav("merchant-detail", m.id)}
                chevron
              />
            )}
          />
        )}
      </Card>

      {showEdit && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => { setCustomer(updated); setShowEdit(false); setToast("Customer updated"); setTimeout(() => setToast(null), 2800); }}
        />
      )}

      {showAddMerchant && (
        <CreateMerchantModal
          onClose={() => setShowAddMerchant(false)}
          onSave={handleAddMerchant}
          customerId={customer.id}
          customerName={customer.name}
        />
      )}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
