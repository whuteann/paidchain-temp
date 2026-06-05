/* PaidChain — Merchant listing + detail */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, MerchantStatus, Readiness, Entity, Pagination, Empty, Chip, TerminalStatus, JobStatus, SlaChip, Modal, Field } from "./components";
import { terminals, jobs, BANKS, JOB_TYPES } from "./data";
import type { Merchant } from "./data";
import { useMerchants } from "./merchants-context";
import { useCustomers } from "./customers-context";
import { NavFn } from "./shell";

/* =================== CREATE MERCHANT MODAL =================== */
interface CreateMerchantModalProps {
  onClose: () => void;
  onCreate: (m: Merchant) => void;
  prefilledCustomerId?: string;
}

export function CreateMerchantModal({ onClose, onCreate, prefilledCustomerId }: CreateMerchantModalProps) {
  const { customers } = useCustomers();
  const MERCHANT_TYPES = ["F&B", "Retail", "Healthcare", "Grocery", "Electronics", "Automotive", "Services", "Fitness", "Fuel", "Entertainment", "Furniture"];
  const MDR_PLANS = ["Standard Retail", "F&B Preferred", "Enterprise", "SME Flat"];

  const prefilledCustomer = customers.find((c) => c.id === prefilledCustomerId);

  const [f, setF] = useState({
    name: "", type: MERCHANT_TYPES[0],
    customerId: prefilledCustomerId || "",
    bank: BANKS[0], mdrPlan: MDR_PLANS[0],
    contact: "", phone: "", email: "", address: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.customerId && f.contact.trim();

  const selectedCustomer = customers.find((c) => c.id === f.customerId);

  function submit() {
    const cust = selectedCustomer!;
    const now = new Date().toISOString().slice(0, 10);
    const idx = Date.now();
    onCreate({
      id: "M" + String(idx).slice(-4),
      name: f.name.trim(), type: f.type,
      mid: "MID" + String(idx).slice(-8),
      bank: f.bank, status: "Onboarding", finance: "Pending Docs",
      terminals: 0, openJobs: 0,
      contact: f.contact.trim(), phone: f.phone, email: f.email, address: f.address,
      onboarded: now, mdrPlan: f.mdrPlan,
      bankAccountName: f.name.trim(), bankAccountNumber: "", bankAccountType: "Current",
      customerId: cust.id, customerName: cust.name,
      isNew: true,
    });
    onClose();
  }

  return (
    <Modal
      title="Create Merchant" sub="Add a new merchant under an existing customer" icon="merchants"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>Create Merchant</Btn>
      </>}
    >
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

      <Field label="Customer (billing entity)" hint="required">
        {prefilledCustomer ? (
          <div className="input" style={{ background: "var(--bg-2, #f5f5f5)", color: "var(--ink-2)", cursor: "not-allowed" }}>
            {prefilledCustomer.name}
          </div>
        ) : (
          <select className="input" value={f.customerId} onChange={(e) => set("customerId", e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </Field>

      <div className="field-row">
        <Field label="Bank">
          <select className="input" value={f.bank} onChange={(e) => set("bank", e.target.value)}>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="MDR plan">
          <select className="input" value={f.mdrPlan} onChange={(e) => set("mdrPlan", e.target.value)}>
            {MDR_PLANS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>

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
    </Modal>
  );
}

/* =================== LISTING =================== */
export function Merchants({ nav }: { nav: NavFn }) {
  const { merchants, addMerchant } = useMerchants();
  const [q, setQ] = useState("");
  const [bank, setBank] = useState("All");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = merchants.filter((m) => {
    const hay = (m.name + " " + m.mid + " " + m.bank + " " + m.id).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (bank !== "All" && m.bank !== bank) return false;
    if (status !== "All" && m.status !== status) return false;
    return true;
  });

  function handleCreate(m: Merchant) {
    addMerchant(m);
    setToast("Merchant " + m.name + " created");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title="Merchants"
        sub={merchants.length + " merchants · search by name, MID, bank or merchant ID"}
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
        </>}
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
        {filtered.length === 0 ? <Empty title="No merchants match" sub="Try a different search or filter" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["Merchant","MID","Bank","Status","Terminals","Finance Readiness","Jobs",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="clickable" onClick={() => nav("merchant-detail", m.id)}>
                    <td><Entity name={m.name} sub={m.id + " · " + m.type} /></td>
                    <td className="td-mono td-mut">{m.mid}</td>
                    <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                      <Icon name="bank" size={15} style={{ color: "var(--ink-3)" }} />{m.bank}
                    </span></td>
                    <td><MerchantStatus status={m.status} /></td>
                    <td>{m.terminals === 0
                      ? <span className="td-mut">—</span>
                      : <span style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
                          <Icon name="terminal" size={15} style={{ color: "var(--ink-3)" }} />{m.terminals}
                        </span>}
                    </td>
                    <td><Readiness value={m.finance} /></td>
                    <td>{m.openJobs > 0 ? <Chip cls="chip-warn">{m.openJobs} open</Chip> : <span className="td-mut">None</span>}</td>
                    <td><button className="icon-btn"><Icon name="chevRight" size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={merchants.length} shown={filtered.length} />
      </Card>
      {showCreate && <CreateMerchantModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== DETAIL =================== */
export function MerchantDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { merchants } = useMerchants();
  const [tab, setTab] = useState("overview");
  const m = merchants.find((x) => x.id === id);

  if (!m) return (
    <div>
      <PageHead title="Merchant not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("merchants")}>Back</Btn>} />
      <Empty icon="merchants" title="Merchant not found" sub={"No merchant with ID " + id} />
    </div>
  );

  const linkedTerminals = terminals.filter((t) => t.merchant?.id === m.id);
  const merchantJobs = jobs.filter((j) => j.merchant.id === m.id);
  const history = merchantJobs.length ? merchantJobs : jobs.slice(0, 3).map((j) => ({ ...j, merchant: { id: m.id, name: m.name } }));

  return (
    <div>
      <div className="back-link" onClick={() => nav("merchants")}>
        <Icon name="arrowLeft" size={16} /> Back to Merchants
      </div>

      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="ent-ava" style={{ width: 52, height: 52, fontSize: 18, borderRadius: 13 }}>
            {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title">{m.name}</h1>
              <MerchantStatus status={m.status} />
            </div>
            <p className="page-sub">{m.id + " · " + m.type + " · onboarded " + m.onboarded}</p>
          </div>
        </div>
        <div className="page-head-actions">
          <Btn variant="ghost" icon="mail">Contact</Btn>
          <Btn variant="ghost" icon="edit">Edit</Btn>
          <Btn variant="primary" icon="plus">New Job</Btn>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { l: "Merchant Terminals", v: linkedTerminals.length, ico: "terminal", c: "var(--info)" },
          { l: "Open Jobs", v: history.filter((j) => j.stage !== "Completed").length, ico: "jobs", c: "var(--warn)" },
          { l: "Finance Readiness", v: m.finance, ico: "shield", c: m.finance === "Ready" ? "var(--ok)" : "var(--warn)", small: true },
          { l: "MDR Plan", v: m.mdrPlan, ico: "percent", c: "var(--indigo)", small: true },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: "var(--bg)", color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: s.small ? 18 : 28 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[["overview","Overview"],["terminals","Linked Terminals (" + linkedTerminals.length + ")"],["jobs","Job History (" + history.length + ")"]].map(([k,lbl]) => (
          <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        {tab === "overview" ? <OverviewTab m={m} /> : tab === "terminals" ? <TerminalsTab rows={linkedTerminals} nav={nav} /> : <JobsTab rows={history} nav={nav} />}
      </div>
    </div>
  );
}

function OverviewTab({ m }: { m: Merchant }) {
  return (
    <div className="detail-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Business Details" icon="building">
          <div className="card-pad">
            <dl className="kv">
              <dt>Legal name</dt><dd>{m.name}</dd>
              <dt>Merchant ID</dt><dd className="mono">{m.id}</dd>
              <dt>MID</dt><dd className="mono">{m.mid}</dd>
              <dt>Category</dt><dd>{m.type}</dd>
              <dt>Bank</dt><dd>{m.bank}</dd>
              <dt>MDR plan</dt><dd>{m.mdrPlan}</dd>
              <dt>Address</dt><dd style={{ fontWeight: 400 }}>{m.address}</dd>
            </dl>
          </div>
        </Card>
        <Card title="Finance Readiness" icon="shield">
          <div className="card-pad">
            <div style={{ marginBottom: 16 }}><Readiness value={m.finance} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["Business registration (SSM)", true],
                ["Bank account verification", m.finance !== "Not Ready"],
                ["Director IC / passport", m.finance === "Ready"],
                ["Signed merchant agreement", m.finance === "Ready"],
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
        </Card>
      </div>
      <Card title="Bank Details" icon="bank">
        <div className="card-pad">
          <dl className="kv">
            <dt>Account name</dt><dd>{m.bankAccountName}</dd>
            <dt>Account number</dt><dd className="mono">{m.bankAccountNumber}</dd>
            <dt>Account type</dt><dd>{m.bankAccountType}</dd>
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
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mail" size={15} style={{ color: "var(--ink-3)" }} />{m.email}</div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="phone" size={15} style={{ color: "var(--ink-3)" }} />{m.phone}</div>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Icon name="mapPin" size={15} style={{ color: "var(--ink-3)" }} />{m.address}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TerminalsTab({ rows, nav }: { rows: typeof terminals; nav: NavFn }) {
  if (!rows.length) return <Card><Empty icon="terminal" title="No terminals linked" sub="This merchant has no deployed devices yet" /></Card>;
  return (
    <Card>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>{["Serial","Device","TID","Status","Location","Rental",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.serial} className="clickable" onClick={() => nav("terminal-detail", t.serial)}>
                <td className="td-mono td-strong">{t.serial}</td>
                <td><div className="cell-2"><span className="td-strong">{t.brand}</span><span className="c2-sub">{t.model}</span></div></td>
                <td className="td-mono td-mut">{t.tid || "—"}</td>
                <td><TerminalStatus status={t.status} /></td>
                <td className="td-mut">{t.location}</td>
                <td>RM {t.rentalRate}/mo</td>
                <td><button className="icon-btn"><Icon name="chevRight" size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JobsTab({ rows, nav }: { rows: typeof jobs; nav: NavFn }) {
  return (
    <Card>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>{["Job ID","Type","Status","SLA","Assignee","Created","Due"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="clickable" onClick={() => nav("job-detail", j.id)}>
                <td className="td-mono td-strong">{j.id}</td>
                <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <Icon name={JOB_TYPES[j.type].icon} size={15} style={{ color: "var(--ink-3)" }} />{j.type}
                </span></td>
                <td><JobStatus status={j.stage} /></td>
                <td><SlaChip sla={j.sla} /></td>
                <td className="td-mut">{j.assignee}</td>
                <td className="td-mut td-mono">{j.created.slice(5)}</td>
                <td className="td-mut td-mono">{j.due.slice(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
