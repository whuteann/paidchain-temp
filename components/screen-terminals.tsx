/* PaidChain — Terminal inventory + detail */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, TerminalStatus, Pagination, Empty, JobStatus, SlaChip, Modal, Field, Chip } from "./components";
import { jobs, TERMINAL_STATUS, TERMINAL_STATUS_ORDER, BRANDS, BANKS, termSettings, terminalTimeline } from "./data";
import type { Terminal, TermSetting } from "./data";
import { useTerminals } from "./terminals-context";
import { useSimCards } from "./simcards-context";
import { NavFn } from "./shell";

/* =================== REGISTER DEVICE MODAL =================== */
function RegisterDeviceModal({ onClose, onRegister }: {
  onClose: () => void;
  onRegister: (t: Terminal, simId?: string) => void;
}) {
  const { simCards } = useSimCards();
  const [step, setStep] = useState<1 | 2>(1);
  const [settingId, setSettingId] = useState("");
  const [location, setLocation] = useState("KL Warehouse");
  const [selectedSimId, setSelectedSimId] = useState("");

  const setting = termSettings.find((s) => s.id === settingId);
  const storedSims = simCards.filter((s) => s.status === "In Storage");
  const selectedSim = simCards.find((s) => s.id === selectedSimId);

  function register(linkSim: boolean) {
    if (!setting) return;
    const idx = Date.now();
    const terminal: Terminal = {
      serial: "SN" + setting.brand.slice(0, 2).toUpperCase() + String(idx).slice(-6),
      brand: setting.brand, model: setting.model,
      status: "In Stock", tid: null, merchant: null, location,
      lastMovement: new Date().toISOString().slice(0, 10),
      rentalRate: setting.monthly, rentalPlan: "Monthly Rental",
      sim: linkSim && selectedSimId ? "4G + WiFi" : "WiFi only",
      conditionNote: "Good",
      termSettingId: setting.id,
    };
    onRegister(terminal, linkSim && selectedSimId ? selectedSimId : undefined);
    onClose();
  }

  return (
    <Modal
      title="Register Device" sub="Add a new terminal to the inventory" icon="terminal"
      onClose={onClose}
      foot={step === 1 ? (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" iconRight="chevRight" disabled={!settingId} onClick={() => setStep(2)}>Create Device</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(1)}>Back</Btn>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={() => register(false)}>Skip — No SIM</Btn>
          <Btn variant="primary" icon="check" onClick={() => register(true)}>Register Device</Btn>
        </>
      )}
    >
      {step === 1 ? (
        <>
          <Field label="Terminal setting" hint="required">
            <select className="input" value={settingId} onChange={(e) => setSettingId(e.target.value)}>
              <option value="">Select model…</option>
              {termSettings.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model} · {s.category} · RM {s.monthly}/mo
                </option>
              ))}
            </select>
          </Field>
          {setting && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Chip cls="chip-neutral">{setting.brand}</Chip>
              <Chip cls="chip-neutral">{setting.model}</Chip>
              <Chip cls="chip-info">{setting.category}</Chip>
              <Chip cls="chip-neutral">RM {setting.monthly}/mo</Chip>
              {setting.deposit > 0 && <Chip cls="chip-neutral">Deposit RM {setting.deposit}</Chip>}
            </div>
          )}
          <Field label="Initial location">
            <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
              {["KL Warehouse", "Repair Center", "In Transit"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          {setting && (
            <div style={{ padding: "10px 14px", background: "var(--bg-2, #f5f5f5)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)" }}>
              Serial will be auto-generated on registration.
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
            Optionally link a SIM card from the <strong>In Storage</strong> inventory to this device. You can do this later from the device detail page.
          </div>
          {storedSims.length === 0 ? (
            <Empty icon="phone" title="No SIM cards in storage" sub="All available SIMs are already linked to devices" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {storedSims.map((s) => {
                const sel = selectedSimId === s.id;
                return (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
                    <input type="radio" name="sim" checked={sel} onChange={() => setSelectedSimId(s.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.carrier} — {s.plan}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{s.iccid} · {s.msisdn || "No MSISDN"}</div>
                    </div>
                    <Chip cls="chip-neutral">{s.dataAllowance}</Chip>
                  </label>
                );
              })}
            </div>
          )}
          {selectedSim && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--info)", display: "flex", gap: 6, alignItems: "center" }}>
              <Icon name="check" size={14} />Selected: {selectedSim.carrier} · {selectedSim.iccid}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* =================== SIM LINK MODAL =================== */
function SimLinkModal({ terminal, onClose, onLink }: {
  terminal: Terminal;
  onClose: () => void;
  onLink: (simId: string) => void;
}) {
  const { simCards } = useSimCards();
  const [selected, setSelected] = useState("");
  const storedSims = simCards.filter((s) => s.status === "In Storage");
  const hasExisting = !!simCards.find((s) => s.terminalSerial === terminal.serial);

  return (
    <Modal
      title={hasExisting ? "Replace SIM Card" : "Link SIM Card"}
      sub={terminal.serial + " · " + terminal.brand + " " + terminal.model}
      icon="phone"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!selected} onClick={() => onLink(selected)}>
          {hasExisting ? "Replace SIM" : "Link SIM"}
        </Btn>
      </>}
    >
      {storedSims.length === 0 ? (
        <Empty icon="phone" title="No SIM cards in storage" sub="All available SIMs are already linked to devices" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {storedSims.map((s) => {
            const sel = selected === s.id;
            return (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
                <input type="radio" name="simlink" checked={sel} onChange={() => setSelected(s.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.carrier} — {s.plan}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{s.iccid} · {s.msisdn || "No MSISDN"} · {s.dataAllowance}</div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* =================== TERMINAL SETTINGS TAB =================== */
function TerminalSettingModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: TermSetting) => void }) {
  const brandKeys = Object.keys(BRANDS);
  const [f, setF] = useState({ brand: brandKeys[0], model: "", category: "Countertop", bank: BANKS[0], monthly: "", deposit: "", setup: "", active: true });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.model && f.monthly;

  return (
    <Modal title="New Terminal Setting" sub="Define a device model and its rental rate card" icon="tag" onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={() => onCreate({ ...f, id: "", monthly: +f.monthly, deposit: +f.deposit || 0, setup: +f.setup || 0, units: 0 })}>Create Setting</Btn>
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

function TerminalSettingsTab() {
  const [rows, setRows] = useState<TermSetting[]>(termSettings);
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = rows.filter((r) =>
    (r.brand + " " + r.model + " " + r.category).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search brand or model…" />
          <Btn variant="primary" icon="plus" onClick={() => setShow(true)}>New Terminal Setting</Btn>
          <span className="tb-meta">{filtered.length} rate cards</span>
        </Toolbar>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>{["Brand / Model","Bank","Category","Monthly Rental","Deposit","Setup Fee","Units","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
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
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </>
  );
}

/* =================== LISTING =================== */
export function Terminals({ nav, initialFilter }: { nav: NavFn; initialFilter?: string }) {
  const { terminals, addTerminal } = useTerminals();
  const { updateSimCard } = useSimCards();
  const [tab, setTab] = useState<"inventory" | "settings">("inventory");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("All");
  const [status, setStatus] = useState(initialFilter || "All");
  const [showRegister, setShowRegister] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const RENTED = ["Installed", "Assigned"];
  const matchStatus = (t: Terminal) => {
    if (status === "All") return true;
    if (status === "Rented") return RENTED.includes(t.status);
    return t.status === status;
  };

  const filtered = terminals.filter((t) => {
    const hay = (t.serial + " " + t.brand + " " + t.model + " " + (t.tid || "") + " " + (t.merchant ? t.merchant.name : "")).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (brand !== "All" && t.brand !== brand) return false;
    return matchStatus(t);
  });

  const counts: Record<string, number> = {};
  TERMINAL_STATUS_ORDER.forEach((s) => (counts[s] = terminals.filter((t) => t.status === s).length));
  const rentedCount = terminals.filter((t) => RENTED.includes(t.status)).length;

  const quick = [
    { id: "All",         label: "All",         n: terminals.length },
    { id: "Rented",      label: "Rented",       n: rentedCount },
    { id: "In Stock",    label: "In Stock",     n: counts["In Stock"] || 0 },
    { id: "Maintenance", label: "Maintenance",  n: counts["Maintenance"] || 0 },
    { id: "Faulty",      label: "Faulty",       n: counts["Faulty"] || 0 },
  ];

  function handleRegister(terminal: Terminal, simId?: string) {
    addTerminal(terminal);
    if (simId) updateSimCard(simId, { terminalSerial: terminal.serial, status: "Active" });
    setToast("Device " + terminal.serial + " registered");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title="Terminals"
        sub={tab === "inventory"
          ? terminals.length + " devices · search by serial, brand, model or assigned merchant"
          : "Device model templates · rental rates, deposit and setup fees"}
        actions={tab === "inventory" ? (
          <>
            <Btn variant="ghost" icon="download">Export</Btn>
            <Btn variant="primary" icon="plus" onClick={() => setShowRegister(true)}>Register Device</Btn>
          </>
        ) : undefined}
      />

      <div className="tabs" style={{ marginBottom: 20 }}>
        {([["inventory", "Inventory"], ["settings", "Terminal Settings"]] as const).map(([id, label]) => (
          <div key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === "inventory" ? (
        <>
          <div className="seg" style={{ marginBottom: 14 }}>
            {quick.map((qk) => (
              <button key={qk.id} className={status === qk.id ? "active" : ""} onClick={() => setStatus(qk.id)}>
                {qk.label} · {qk.n}
              </button>
            ))}
          </div>

          {status === "Rented" && (
            <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "11px 14px", background: "var(--green-050)", border: "1px solid var(--green-100)", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
              <Icon name="link" size={16} style={{ color: "var(--green-700)" }} />
              <span><b>Rented view</b> — showing devices currently out on rental (Installed Active + Assigned).</span>
            </div>
          )}

          <Card>
            <Toolbar>
              <SearchBox value={q} onChange={setQ} placeholder="Search serial, model, merchant…" />
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Rented">Rented (out)</option>
                {TERMINAL_STATUS_ORDER.map((s) => <option key={s} value={s}>{TERMINAL_STATUS[s].label}</option>)}
              </select>
              <select className="select" value={brand} onChange={(e) => setBrand(e.target.value)}>
                {["All", ...Object.keys(BRANDS)].map((b) => <option key={b}>{b === "All" ? "All Brands" : b}</option>)}
              </select>
              <span className="tb-meta">{filtered.length} devices</span>
            </Toolbar>
            {filtered.length === 0 ? <Empty icon="terminal" title="No devices match" /> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>{["Serial","Brand / Model","Status","Assigned Merchant","Location","Last Movement","Rental",""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.serial} className="clickable" onClick={() => nav("terminal-detail", t.serial)}>
                        <td>
                          <div className="cell-2">
                            <span className="td-mono td-strong">{t.serial}</span>
                            {t.tid && <span className="c2-sub mono">{t.tid}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="ent">
                            <div className="ent-ava slate" style={{ borderRadius: 7 }}><Icon name="terminal" size={15} /></div>
                            <div><div className="ent-name">{t.brand}</div><div className="ent-sub">{t.model}</div></div>
                          </div>
                        </td>
                        <td><TerminalStatus status={t.status} /></td>
                        <td className="td-mut">{t.merchant ? t.merchant.name : <span style={{ color: "var(--ink-4)" }}>Unassigned</span>}</td>
                        <td><span style={{ display: "flex", gap: 6, alignItems: "center" }}><Icon name="mapPin" size={14} style={{ color: "var(--ink-3)" }} />{t.location}</span></td>
                        <td className="td-mut td-mono">{t.lastMovement.slice(5)}</td>
                        <td className="td-mut">RM {t.rentalRate}</td>
                        <td><button className="icon-btn"><Icon name="chevRight" size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={terminals.length} shown={filtered.length} />
          </Card>

          {showRegister && <RegisterDeviceModal onClose={() => setShowRegister(false)} onRegister={handleRegister} />}
          {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
        </>
      ) : (
        <TerminalSettingsTab />
      )}
    </div>
  );
}

/* =================== DETAIL =================== */
export function TerminalDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { terminals, updateTerminal } = useTerminals();
  const { simCards, updateSimCard } = useSimCards();
  const terminal = terminals.find((t) => t.serial === id);

  const [showStatus, setShowStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [showSimModal, setShowSimModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!terminal) return (
    <div>
      <PageHead title="Device not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("terminals")}>Back</Btn>} />
      <Empty icon="terminal" title="Terminal not found" sub={"No device with serial " + id} />
    </div>
  );

  const currentTerminal = terminal;
  const linkedSim = simCards.find((s) => s.terminalSerial === currentTerminal.serial);
  const linkedSetting = termSettings.find((s) => s.id === currentTerminal.termSettingId);
  const tl = terminalTimeline(currentTerminal);
  const linkedJobs = jobs.filter((j) => j.terminal && j.terminal.serial === currentTerminal.serial).slice(0, 4);
  const jobsForThis = linkedJobs.length ? linkedJobs : [];

  function applyStatus() {
    updateTerminal(currentTerminal.serial, { status: pendingStatus, lastMovement: new Date().toISOString().slice(0, 10) });
    setShowStatus(false);
    setToast(`Status updated to "${TERMINAL_STATUS[pendingStatus]?.label || pendingStatus}"`);
    setTimeout(() => setToast(null), 2600);
  }

  function handleLinkSim(simId: string) {
    // Unlink current SIM if any
    if (linkedSim) {
      updateSimCard(linkedSim.id, { terminalSerial: null, status: "In Storage" });
    }
    // Link new SIM
    updateSimCard(simId, { terminalSerial: currentTerminal.serial, status: "Active" });
    // Update terminal connectivity
    updateTerminal(currentTerminal.serial, { sim: "4G + WiFi" });
    setShowSimModal(false);
    setToast(linkedSim ? "SIM card replaced" : "SIM card linked");
    setTimeout(() => setToast(null), 2600);
  }

  function handleUnlinkSim() {
    if (!linkedSim) return;
    updateSimCard(linkedSim.id, { terminalSerial: null, status: "In Storage" });
    updateTerminal(currentTerminal.serial, { sim: "WiFi only" });
    setToast("SIM card unlinked — moved to storage");
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <div>
      <div className="back-link" onClick={() => nav("terminals")}><Icon name="arrowLeft" size={16} /> Back to Inventory</div>

      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--dark-bg)", color: "var(--slate)", display: "grid", placeItems: "center" }}>
            <Icon name="terminal" size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title mono">{currentTerminal.serial}</h1>
              <TerminalStatus status={currentTerminal.status} />
            </div>
            <p className="page-sub">{currentTerminal.brand + " " + currentTerminal.model + " · " + currentTerminal.sim + (currentTerminal.merchant ? " · " + currentTerminal.merchant.name : " · Unassigned")}</p>
          </div>
        </div>
        <div className="page-head-actions">
          <Btn variant="ghost" icon="edit">Edit</Btn>
          <Btn variant="slate" icon="refresh" onClick={() => { setPendingStatus(currentTerminal.status); setShowStatus(true); }}>Update Status</Btn>
        </div>
      </div>

      <div className="detail-grid">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Movement Timeline" icon="activity">
            <div className="card-pad">
              <div className="timeline">
                {tl.map((e, i) => (
                  <div className="tl-item" key={i}>
                    <div className={"tl-dot " + (e.dot || "")} />
                    <div className="tl-time">{e.time}</div>
                    <div className="tl-title">{e.title}</div>
                    <div className="tl-desc">{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title={"Linked Jobs" + (jobsForThis.length ? " (" + jobsForThis.length + ")" : "")} icon="jobs" actions={<Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>All jobs</Btn>}>
            {jobsForThis.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)" }}>No jobs linked to this device yet.</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>{["Job ID","Type","Status","SLA","Due"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {jobsForThis.map((j) => (
                      <tr key={j.id} className="clickable" onClick={() => nav("job-detail", j.id)}>
                        <td className="td-mono td-strong">{j.id}</td>
                        <td>{j.type}</td>
                        <td><JobStatus status={j.stage} /></td>
                        <td><SlaChip sla={j.sla} /></td>
                        <td className="td-mut td-mono">{j.due.slice(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Photos & Inspection Forms" icon="image">
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {["device front","serial label","install site","signed form"].map((p, i) => (
                  <div key={i} className="ph" style={{ aspectRatio: "1", flexDirection: "column" }}>
                    <Icon name={i === 3 ? "file" : "image"} size={20} style={{ marginBottom: 5 }} />{p}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Device Details" icon="terminal">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                <dt>Serial</dt><dd className="mono">{currentTerminal.serial}</dd>
                <dt>TID</dt><dd className="mono">{currentTerminal.tid || "—"}</dd>
                <dt>Brand</dt><dd>{currentTerminal.brand}</dd>
                <dt>Model</dt><dd>{currentTerminal.model}</dd>
                <dt>Connectivity</dt><dd>{currentTerminal.sim}</dd>
                <dt>Location</dt><dd>{currentTerminal.location}</dd>
                <dt>Condition</dt><dd style={{ fontWeight: 400 }}>{currentTerminal.conditionNote}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Terminal Setting" icon="settings">
            <div className="card-pad">
              {linkedSetting ? (
                <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                  <dt>Setting ID</dt><dd className="mono">{linkedSetting.id}</dd>
                  <dt>Category</dt><dd>{linkedSetting.category}</dd>
                  <dt>Bank</dt><dd>{linkedSetting.bank}</dd>
                  <dt>Monthly rate</dt><dd>RM {linkedSetting.monthly}</dd>
                  <dt>Deposit</dt><dd>RM {linkedSetting.deposit}</dd>
                  {linkedSetting.setup > 0 && <><dt>Setup fee</dt><dd>RM {linkedSetting.setup}</dd></>}
                </dl>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No terminal setting linked.</div>
              )}
            </div>
          </Card>

          {/* SIM Card */}
          <Card title="SIM Card" icon="phone" actions={
            <Btn variant="ghost" sm icon="phone" onClick={() => setShowSimModal(true)}>
              {linkedSim ? "Replace SIM Card" : "Link SIM Card"}
            </Btn>
          }>
            <div className="card-pad">
              {linkedSim ? (
                <>
                  <dl className="kv" style={{ gridTemplateColumns: "100px 1fr" }}>
                    <dt>ICCID</dt><dd className="mono" style={{ fontSize: 12 }}>{linkedSim.iccid}</dd>
                    <dt>MSISDN</dt><dd className="mono">{linkedSim.msisdn || "—"}</dd>
                    <dt>Carrier</dt><dd>{linkedSim.carrier}</dd>
                    <dt>Plan</dt><dd>{linkedSim.plan}</dd>
                    <dt>Data</dt><dd>{linkedSim.dataAllowance}</dd>
                    <dt>Status</dt><dd><Chip cls="chip-ok" dot>{linkedSim.status}</Chip></dd>
                  </dl>
                  <Btn
                    variant="ghost" sm icon="x"
                    style={{ marginTop: 12, color: "var(--bad)" }}
                    onClick={handleUnlinkSim}
                  >
                    Unlink SIM
                  </Btn>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  No SIM card linked to this terminal.
                  <Btn variant="ghost" sm icon="plus" style={{ marginTop: 12, display: "flex" }} onClick={() => setShowSimModal(true)}>Link SIM Card</Btn>
                </div>
              )}
            </div>
          </Card>

          <Card title="Rental Setup" icon="tag">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                <dt>Plan</dt><dd>{currentTerminal.rentalPlan}</dd>
                <dt>Monthly</dt><dd>RM {currentTerminal.rentalRate}.00</dd>
                <dt>Merchant</dt><dd>{currentTerminal.merchant ? currentTerminal.merchant.name : "—"}</dd>
              </dl>
              {currentTerminal.merchant && (
                <Btn variant="ghost" sm iconRight="chevRight" style={{ marginTop: 14, width: "100%" }} onClick={() => nav("merchant-detail", currentTerminal.merchant!.id)}>
                  View merchant
                </Btn>
              )}
            </div>
          </Card>

          <Card title="Replacement History" icon="swap">
            <div className="card-pad">
              {currentTerminal.status === "Replacement Out" || currentTerminal.status === "Faulty" ? (
                <div className="timeline">
                  <div className="tl-item">
                    <div className="tl-dot warn" />
                    <div className="tl-time">2026-05-28</div>
                    <div className="tl-title">Replacement dispatched</div>
                    <div className="tl-desc">Unit SNPA481xx sent · job JOB-24089</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "4px 0" }}>No replacements recorded for this device.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status update modal */}
      {showStatus && (
        <Modal
          title="Update Terminal Status" sub={currentTerminal.serial + " · " + currentTerminal.brand + " " + currentTerminal.model} icon="refresh" size="slim"
          onClose={() => setShowStatus(false)}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => setShowStatus(false)}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={applyStatus} disabled={pendingStatus === currentTerminal.status}>Apply Status</Btn>
          </>}
        >
          <Field label="Current status">
            <div style={{ padding: "2px 0 4px" }}><TerminalStatus status={currentTerminal.status} /></div>
          </Field>
          <Field label="Change to" hint="movement will be logged to timeline">
            <select className="input" value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value)}>
              {TERMINAL_STATUS_ORDER.map((s) => <option key={s} value={s}>{TERMINAL_STATUS[s].label}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)">
            <textarea className="textarea" placeholder="Reason or context for this status change…" />
          </Field>
        </Modal>
      )}

      {showSimModal && <SimLinkModal terminal={currentTerminal} onClose={() => setShowSimModal(false)} onLink={handleLinkSim} />}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
