/* PaidChain — Job listing + detail + workflow engine */
import { useMemo, useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, JobStatus, SlaChip, Pagination, Empty, Chip, Modal, Field, Dropzone, Stepper } from "./components";
import { JOB_TYPES, STAFF, termSettings } from "./data";
import type { Job, JobHistoryEntry, JobNotification, Rental, SlaTransitionRule, Terminal, TermSetting } from "./data";
import { useCustomers } from "./customers-context";
import { useJobSla } from "./job-sla-context";
import { useMerchants } from "./merchants-context";
import { usePaperRolls } from "./paper-rolls-context";
import { useRentals } from "./rentals-context";
import { useTerminals } from "./terminals-context";
import { NavFn } from "./shell";

const TYPE_META: Record<string, string> = {
  "Installation":       "Deploy a terminal and create the rental after admin sign-off",
  "Repair/Maintenance": "Resolve a merchant device issue and close with maintenance proof",
  "Replacement":        "Prepare a replacement device and swap out the previous rental unit",
  "Paper Roll Request": "Prepare, deliver and reconcile paper roll stock requests",
  "Remote Support":     "Resolve a merchant issue remotely and close with evidence",
};

const ROLE_DEFAULT_ACTOR: Record<string, string> = {
  "Admin": STAFF[0],
  "Warehouse Manager": STAFF[6],
  "Operations": STAFF[2],
  "Helpdesk": STAFF[7],
};

const JOB_CREATOR_ROLE: Record<string, string> = {
  "Installation": "Admin",
  "Repair/Maintenance": "Helpdesk",
  "Replacement": "Helpdesk",
  "Paper Roll Request": "Admin",
  "Remote Support": "Helpdesk",
};

const CREATE_EMAIL_TARGETS: Record<string, string[]> = {
  "Installation": ["Warehouse Manager"],
  "Repair/Maintenance": ["Operations"],
  "Replacement": ["Warehouse Manager"],
  "Paper Roll Request": ["Warehouse Manager"],
  "Remote Support": ["Admin"],
};

const TRANSITION_RULES: Record<string, Record<string, { actorRole: string; notify: string[]; note: string }>> = {
  "Installation": {
    "Device Prepared": { actorRole: "Warehouse Manager", notify: ["Operations"], note: "Device prepared and released to operations." },
    "Job Done": { actorRole: "Operations", notify: ["Admin"], note: "Installation completed on-site with evidence." },
    "Completed": { actorRole: "Admin", notify: [], note: "Admin sign-off complete. Rental created and device activated." },
  },
  "Repair/Maintenance": {
    "Job Done": { actorRole: "Operations", notify: ["Helpdesk", "Admin"], note: "Maintenance resolved and form uploaded." },
    "Completed": { actorRole: "Admin", notify: [], note: "Helpdesk/Admin signed off and proof archived." },
  },
  "Replacement": {
    "Device Prepared": { actorRole: "Warehouse Manager", notify: ["Operations"], note: "Replacement unit prepared and handed to operations." },
    "Job Done": { actorRole: "Operations", notify: ["Helpdesk", "Admin"], note: "Replacement completed on-site with swap evidence." },
    "Completed": { actorRole: "Helpdesk", notify: [], note: "Final proof received. Rental updated to the new device." },
  },
  "Paper Roll Request": {
    "Stock Prepared": { actorRole: "Warehouse Manager", notify: ["Operations"], note: "Paper roll stock prepared for delivery." },
    "Job Done": { actorRole: "Operations", notify: ["Admin"], note: "Paper roll delivery completed with evidence." },
    "Completed": { actorRole: "Admin", notify: [], note: "Payment confirmed and stock movement posted." },
  },
  "Remote Support": {
    "Completed": { actorRole: "Helpdesk", notify: [], note: "Remote issue resolved and evidence attached." },
  },
};

const REPLACEMENT_STATUS_OPTIONS = ["Faulty", "Maintenance", "Returned", "Retired", "In Stock"];

function stampNow() {
  return new Date().toISOString().slice(0, 16).replace("T", " · ");
}

function parseStamp(stamp: string) {
  return new Date(stamp.replace(" · ", "T") + ":00Z");
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.floor((parseStamp(end).getTime() - parseStamp(start).getTime()) / 86400000));
}

function findRule(rules: Record<string, SlaTransitionRule[]>, jobType: string, from: string, to: string) {
  return (rules[jobType] || []).find((rule) => rule.from === from && rule.to === to) || null;
}

function elapsedToSla(elapsedDays: number, rule: SlaTransitionRule | null, completed = false) {
  if (!rule) return completed ? "Met" : "On Track";
  if (elapsedDays > rule.breachDays) return "Breached";
  if (elapsedDays > rule.warningDays) return "Due Soon";
  return completed ? "Met" : "On Track";
}

function currentJobSla(job: Job, rules: Record<string, SlaTransitionRule[]>, now = stampNow()) {
  if (job.stage === "Completed") return "Met";
  const stages = JOB_TYPES[job.type].stages;
  const currentStage = job.history[job.history.length - 1];
  const nextStage = stages[job.stageIndex + 1];
  if (!currentStage || !nextStage) return job.sla;
  const rule = findRule(rules, job.type, currentStage.stage, nextStage);
  return elapsedToSla(daysBetween(currentStage.at, now), rule);
}

function makeNotification(to: string[], subject: string): JobNotification {
  return { at: stampNow(), to, subject };
}

function makeHistoryEntry(stage: string, actorRole: string, note: string, evidence: string[] = []): JobHistoryEntry {
  return {
    stage,
    at: stampNow(),
    actor: ROLE_DEFAULT_ACTOR[actorRole] || STAFF[0],
    actorRole,
    note,
    evidence,
  };
}

function terminalLocationForStatus(status: string) {
  if (status === "Installed" || status === "Assigned") return "Merchant Site";
  if (status === "Maintenance" || status === "Faulty") return "Repair Center";
  if (status === "Replacement Out" || status === "Returned") return "In Transit";
  if (status === "Retired") return "Returns Bay";
  return "KL Warehouse";
}

function rentalFromJob(job: Job, terminal: Terminal): Rental {
  const idSuffix = String(Date.now()).slice(-4);
  return {
    id: "RNT-" + idSuffix,
    customer: { id: job.customer!.id, name: job.customer!.name, tin: "" },
    merchant: { id: job.merchant.id, name: job.merchant.name, mid: "" },
    terminal: { serial: terminal.serial, brand: terminal.brand, model: terminal.model, tid: terminal.tid },
    plan: terminal.rentalPlan,
    monthlyRate: terminal.rentalRate,
    deposit: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    status: "Active",
    invoiceIssued: null,
    einvoiceIssued: null,
    isNew: true,
  };
}

function transitionNeedsEvidence(jobType: string, nextStage: string) {
  if (nextStage === "Completed") return true;
  if (nextStage === "Job Done") return true;
  return jobType === "Remote Support" && nextStage === "Completed";
}

function getMerchantDevice(merchantId: string, terminals: Terminal[]) {
  return terminals.find((t) => t.merchant?.id === merchantId && ["Installed", "Assigned", "Maintenance", "Replacement Out"].includes(t.status)) || null;
}

interface CreateJobModalProps { onClose: () => void; onCreate: (job: Job) => void; nav: NavFn }

export function CreateJobModal({ onClose, onCreate, nav }: CreateJobModalProps) {
  const { customers } = useCustomers();
  const { merchants } = useMerchants();
  const { terminals } = useTerminals();
  const types = Object.keys(JOB_TYPES);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: "",
    merchant: "",
    termSettingId: "",
    assignee: STAFF[0],
    priority: "Normal",
    due: "",
    notes: "",
    paperRollQty: "50",
    paymentTarget: "Merchant" as "Merchant" | "Bank",
  });

  const def = type ? JOB_TYPES[type] : null;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const availableMerchants = form.customerId ? merchants.filter((m) => m.customerId === form.customerId) : merchants;
  const selectedMerchant = availableMerchants.find((m) => m.id === form.merchant) || null;
  const merchantDevice = selectedMerchant ? getMerchantDevice(selectedMerchant.id, terminals) : null;
  const requiresTermSpec = type === "Installation" || type === "Replacement";
  const requiresMerchantDevice = type === "Repair/Maintenance" || type === "Replacement" || type === "Remote Support";
  const requiresPaperRollFields = type === "Paper Roll Request";
  const selectedTermSetting = termSettings.find((ts) => ts.id === form.termSettingId) || null;
  const valid = !!(
    type &&
    form.customerId &&
    form.merchant &&
    form.due &&
    (!requiresTermSpec || form.termSettingId) &&
    (!requiresMerchantDevice || merchantDevice) &&
    (!requiresPaperRollFields || Number(form.paperRollQty) > 0)
  );

  function submit() {
    if (!type || !selectedMerchant || !selectedCustomer) return;
    const creatorRole = JOB_CREATOR_ROLE[type];
    const createdAt = stampNow();
    const pendingEntry: JobHistoryEntry = {
      stage: "Pending",
      at: createdAt,
      actor: ROLE_DEFAULT_ACTOR[creatorRole],
      actorRole: creatorRole,
      note: "Job created",
      evidence: [],
    };
    const job: Job = {
      id: "JOB-" + Math.floor(24100 + Math.random() * 800),
      type,
      stage: "Pending",
      stageIndex: 0,
      status: "Pending",
      sla: "On Track",
      assignee: form.assignee,
      bank: selectedMerchant.bank,
      customer: { id: selectedCustomer.id, name: selectedCustomer.name },
      merchant: { id: selectedMerchant.id, name: selectedMerchant.name },
      terminal: (type === "Repair/Maintenance" || type === "Remote Support") && merchantDevice
        ? { serial: merchantDevice.serial, brand: merchantDevice.brand, model: merchantDevice.model }
        : null,
      previousTerminal: type === "Replacement" && merchantDevice
        ? { serial: merchantDevice.serial, brand: merchantDevice.brand, model: merchantDevice.model }
        : null,
      created: createdAt.slice(0, 10),
      due: form.due,
      priority: form.priority,
      escalatedTo: null,
      desc: form.notes || TYPE_META[type],
      createdByRole: creatorRole,
      createdByName: ROLE_DEFAULT_ACTOR[creatorRole],
      history: [pendingEntry],
      notifications: [
        { at: createdAt, to: CREATE_EMAIL_TARGETS[type], subject: type + " job created" },
      ],
      paperRollRequest: type === "Paper Roll Request"
        ? { quantity: Number(form.paperRollQty), paymentTarget: form.paymentTarget }
        : null,
      termSettingId: requiresTermSpec ? form.termSettingId : undefined,
      isNew: true,
    };
    onCreate(job);
  }

  return (
    <Modal
      title="Create Job"
      sub={step === 1 ? "Select a workflow to begin" : (type || "")}
      icon="plus"
      size="wide"
      onClose={onClose}
      foot={<>
        {step === 2 && <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(1)}>Back</Btn>}
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        {step === 1
          ? <Btn variant="primary" iconRight="chevRight" disabled={!type} onClick={() => setStep(2)}>Continue</Btn>
          : <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>Create Job</Btn>}
      </>}
    >
      {step === 1 ? (
        <div className="type-grid">
          {types.map((jobType) => (
            <div key={jobType} className={"type-card" + (type === jobType ? " sel" : "")} onClick={() => setType(jobType)}>
              <div className="tc-ico"><Icon name={JOB_TYPES[jobType].icon} size={17} /></div>
              <div>
                <div className="tc-title">{jobType}</div>
                <div className="tc-sub">{TYPE_META[jobType]}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", background: "var(--green-050)", borderRadius: 9, marginBottom: 18, fontSize: 12.5 }}>
            <Icon name={def!.icon} size={16} style={{ color: "var(--green-700)" }} />
            <span>Stages: {def!.stages.join(" → ")}</span>
          </div>

          <Field label="Customer" hint="required · billing entity">
            <select className="input" value={form.customerId} onChange={(e) => { set("customerId", e.target.value); set("merchant", ""); }}>
              <option value="">Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--info)" }}>
            <Icon name="plus" size={13} />
            <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { onClose(); nav("customers"); }}>
              Create new customer
            </span>
          </div>

          <Field label="Merchant" hint="required · job location">
            <select className="input" value={form.merchant} onChange={(e) => set("merchant", e.target.value)}>
              <option value="">Select merchant…</option>
              {availableMerchants.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.mid}</option>)}
            </select>
          </Field>

          {selectedMerchant && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Chip cls="chip-neutral">{selectedMerchant.bank}</Chip>
              <Chip cls="chip-neutral">{selectedMerchant.type}</Chip>
            </div>
          )}

          {(type === "Repair/Maintenance" || type === "Remote Support") && (
            <Field label="Affected terminal">
              {merchantDevice ? (
                <div className="input" style={{ background: "var(--bg-2, #f5f5f5)" }}>
                  {merchantDevice.serial} · {merchantDevice.brand} {merchantDevice.model}
                </div>
              ) : (
                <div className="input" style={{ color: "var(--warn)", background: "var(--warn-bg)" }}>
                  No deployed merchant terminal found for this workflow.
                </div>
              )}
            </Field>
          )}

          {type === "Replacement" && merchantDevice && (
            <Field label="Device to be replaced">
              <div className="input" style={{ background: "var(--bg-2, #f5f5f5)" }}>
                {merchantDevice.serial} · {merchantDevice.brand} {merchantDevice.model}
              </div>
            </Field>
          )}

          {type === "Replacement" && !merchantDevice && (
            <Field label="Device to be replaced">
              <div className="input" style={{ color: "var(--warn)", background: "var(--warn-bg)" }}>
                No currently deployed merchant terminal found to replace.
              </div>
            </Field>
          )}

          {requiresTermSpec && (
            <Field label={type === "Replacement" ? "Replacement terminal model" : "Terminal model"} hint="required · warehouse assigns the actual unit">
              <select className="input" value={form.termSettingId} onChange={(e) => set("termSettingId", e.target.value)}>
                <option value="">Select brand &amp; model…</option>
                {termSettings.filter((ts) => ts.active).map((ts) => (
                  <option key={ts.id} value={ts.id}>{ts.brand} {ts.model} · {ts.category}</option>
                ))}
              </select>
              {selectedTermSetting && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <Chip cls="chip-neutral">{selectedTermSetting.brand} {selectedTermSetting.model}</Chip>
                  <Chip cls="chip-info">{selectedTermSetting.category}</Chip>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 }}>
                The Warehouse Manager will assign a specific unit from inventory.
              </div>
            </Field>
          )}

          {type === "Paper Roll Request" && (
            <div className="field-row">
              <Field label="Paper roll quantity" hint="required">
                <input className="input" type="number" min="1" value={form.paperRollQty} onChange={(e) => set("paperRollQty", e.target.value)} />
              </Field>
              <Field label="Pay by">
                <select className="input" value={form.paymentTarget} onChange={(e) => set("paymentTarget", e.target.value)}>
                  {["Merchant", "Bank"].map((opt) => <option key={opt}>{opt}</option>)}
                </select>
              </Field>
            </div>
          )}

          <div className="field-row">
            <Field label="Assigned to">
              <select className="input" value={form.assignee} onChange={(e) => set("assignee", e.target.value)}>
                {STAFF.map((staff) => <option key={staff}>{staff}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Due date" hint="required">
              <input className="input" type="date" value={form.due} onChange={(e) => set("due", e.target.value)} />
            </Field>
          </div>

          <Field label="Details / instructions">
            <textarea className="textarea" placeholder="Describe the work to be done…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

interface JobsProps { nav: NavFn; jobs: Job[]; onCreate: (job: Job) => void }

export function Jobs({ nav, jobs, onCreate }: JobsProps) {
  const { terminals, updateTerminal } = useTerminals();
  const { rules } = useJobSla();
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [sla, setSla] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const decorated = useMemo(
    () => jobs.map((job) => ({ ...job, computedSla: currentJobSla(job, rules) })),
    [jobs, rules]
  );

  const filtered = decorated.filter((job) => {
    const hay = (job.id + " " + (job.customer?.name || "") + " " + job.merchant.name + " " + job.assignee + " " + job.bank + " " + job.type).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (type !== "All" && job.type !== type) return false;
    if (status !== "All") {
      if (status === "Open" && job.stage === "Completed") return false;
      if (status === "Completed" && job.stage !== "Completed") return false;
    }
    if (sla !== "All" && job.computedSla !== sla) return false;
    return true;
  });

  function create(job: Job) {
    onCreate(job);
    if (job.terminal && ["Installation", "Replacement"].includes(job.type)) {
      const device = terminals.find((t) => t.serial === job.terminal!.serial);
      if (device) {
        updateTerminal(device.serial, {
          status: "Reserved",
          lastMovement: new Date().toISOString().slice(0, 10),
          activityLog: [
            {
              dot: "",
              time: stampNow(),
              title: "Reserved for " + job.type + " job",
              desc: job.id + " · " + job.merchant.name,
            },
            ...(device.activityLog || []),
          ],
        });
      }
    }
    setShowCreate(false);
    setToast("Job " + job.id + " created · email sent to " + CREATE_EMAIL_TARGETS[job.type].join(", "));
    setTimeout(() => { setToast(null); nav("job-detail", job.id); }, 1000);
  }

  return (
    <div>
      <PageHead
        title="Jobs"
        sub={jobs.length + " workflow jobs · SLA tracking, notifications and downstream actions"}
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Job</Btn>
        </>}
      />

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search job ID, customer, merchant, assignee…" />
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {["All", ...Object.keys(JOB_TYPES)].map((option) => <option key={option}>{option === "All" ? "All Types" : option}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Open", "Completed"].map((option) => <option key={option}>{option === "All" ? "All Statuses" : option}</option>)}
          </select>
          <select className="select" value={sla} onChange={(e) => setSla(e.target.value)}>
            {["All", "On Track", "Due Soon", "Breached", "Met"].map((option) => <option key={option}>{option === "All" ? "All SLA" : option}</option>)}
          </select>
          <span className="tb-meta">{filtered.length} jobs</span>
        </Toolbar>

        {filtered.length === 0 ? <Empty icon="jobs" title="No jobs match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["Job ID", "Type", "Customer / Merchant", "Status", "SLA", "Assignee", "Due", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((job) => (
                  <tr key={job.id} className="clickable" onClick={() => nav("job-detail", job.id)}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="td-mono td-strong">{job.id}</span>
                        {job.isNew && <Chip cls="chip-ok" sq>New</Chip>}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                        <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--bg)", display: "grid", placeItems: "center", color: "var(--slate)", flexShrink: 0 }}>
                          <Icon name={JOB_TYPES[job.type].icon} size={14} />
                        </span>{job.type}
                      </span>
                    </td>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong">{job.customer?.name || "—"}</span>
                        <span className="c2-sub">{job.merchant.name}</span>
                      </div>
                    </td>
                    <td><JobStatus status={job.stage} /></td>
                    <td><SlaChip sla={job.computedSla} /></td>
                    <td className="td-mut">{job.assignee}</td>
                    <td className="td-mut td-mono">{job.due.slice(5)}</td>
                    <td><button className="icon-btn"><Icon name="chevRight" size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination total={jobs.length} shown={filtered.length} />
      </Card>

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} onCreate={create} nav={nav} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== SWAP DEVICE MODAL =================== */
function SwapDeviceModal({ currentSerial, terminals, onClose, onSwap }: {
  currentSerial: string;
  terminals: Terminal[];
  onClose: () => void;
  onSwap: (t: Terminal) => void;
}) {
  const [selected, setSelected] = useState("");
  const available = terminals.filter(
    (t) => (t.status === "In Stock" || t.status === "Reserved") && t.serial !== currentSerial
  );
  const chosenTerminal = terminals.find((t) => t.serial === selected) ?? null;

  return (
    <Modal
      title="Swap Device" sub="Select a replacement terminal from available inventory" icon="swap"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="swap" disabled={!selected} onClick={() => chosenTerminal && onSwap(chosenTerminal)}>
          Swap Device
        </Btn>
      </>}
    >
      {available.length === 0 ? (
        <Empty icon="terminal" title="No devices available" sub="All terminals are deployed or under maintenance" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {available.map((t) => {
            const sel = selected === t.serial;
            return (
              <label key={t.serial} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
                <input type="radio" name="swap-terminal" checked={sel} onChange={() => setSelected(t.serial)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.brand} {t.model}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.serial} · {t.location}</div>
                </div>
                <Chip cls={t.status === "In Stock" ? "chip-ok" : "chip-neutral"}>{t.status}</Chip>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* =================== ASSIGN DEVICE MODAL =================== */
function AssignDeviceModal({ job, terminals, onClose, onAssign }: {
  job: Job;
  terminals: Terminal[];
  onClose: () => void;
  onAssign: (t: Terminal) => void;
}) {
  const [selected, setSelected] = useState(job.terminal?.serial || "");
  const spec: TermSetting | null = termSettings.find((ts) => ts.id === job.termSettingId) || null;
  const inStock = terminals.filter((t) => t.status === "In Stock");
  const matching = spec ? inStock.filter((t) => t.brand === spec.brand && t.model === spec.model) : [];
  const matchingSerials = new Set(matching.map((t) => t.serial));
  const others = inStock.filter((t) => !matchingSerials.has(t.serial));
  const chosen = terminals.find((t) => t.serial === selected) ?? null;

  function renderDevice(t: Terminal) {
    const sel = selected === t.serial;
    return (
      <label key={t.serial} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
        <input type="radio" name="assign-terminal" checked={sel} onChange={() => setSelected(t.serial)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.brand} {t.model}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.serial} · {t.location}</div>
        </div>
        <Chip cls="chip-ok">In Stock</Chip>
      </label>
    );
  }

  return (
    <Modal
      title="Assign Device" sub="Select a unit from inventory to fulfil this job" icon="terminal"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!selected} onClick={() => chosen && onAssign(chosen)}>Assign Device</Btn>
      </>}
    >
      {spec && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", background: "var(--info-bg)", borderRadius: 9, marginBottom: 16, fontSize: 12.5 }}>
          <Icon name="terminal" size={15} style={{ color: "var(--info)" }} />
          <span>Requested spec: <strong>{spec.brand} {spec.model}</strong> · {spec.category}</span>
        </div>
      )}

      {inStock.length === 0 ? (
        <Empty icon="terminal" title="No devices in stock" sub="All terminals are currently deployed or under maintenance" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {matching.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--ink-3)", marginBottom: 4 }}>
                Matching spec ({matching.length})
              </div>
              {matching.map(renderDevice)}
            </>
          )}
          {others.length > 0 && (
            <>
              {matching.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--ink-3)", margin: "10px 0 4px" }}>
                  Other available
                </div>
              )}
              {others.map(renderDevice)}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

interface JobDetailProps { id: string; nav: NavFn; jobs: Job[]; onUpdate: (id: string, patch: Partial<Job>) => void }

export function JobDetail({ id, nav, jobs, onUpdate }: JobDetailProps) {
  const { rules } = useJobSla();
  const { customers } = useCustomers();
  const { merchants } = useMerchants();
  const { terminals, updateTerminal } = useTerminals();
  const { rentals, addRental, updateRental } = useRentals();
  const { addEntry } = usePaperRolls();
  const job = jobs.find((entry) => entry.id === id);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: string }[]>([]);
  const [transitionNote, setTransitionNote] = useState("");
  const [previousTerminalStatus, setPreviousTerminalStatus] = useState("Faulty");
  const [showSwap, setShowSwap] = useState(false);
  const [showAssignDevice, setShowAssignDevice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!job) {
    return (
      <div>
        <PageHead title="Job not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("jobs")}>Back</Btn>} />
        <Empty icon="jobs" title="Job not found" sub={"No job with ID " + id} />
      </div>
    );
  }

  const currentJob = job;
  const customer = customers.find((entry) => entry.id === currentJob.customer?.id);
  const merchant = merchants.find((entry) => entry.id === currentJob.merchant.id);
  const selectedTerminal = currentJob.terminal ? terminals.find((entry) => entry.serial === currentJob.terminal!.serial) || null : null;
  const previousTerminal = currentJob.previousTerminal ? terminals.find((entry) => entry.serial === currentJob.previousTerminal!.serial) || null : null;
  const requestedSpec = currentJob.termSettingId ? termSettings.find((ts) => ts.id === currentJob.termSettingId) || null : null;
  const activeRental = rentals.find((entry) => entry.merchant.id === currentJob.merchant.id && entry.status === "Active") || null;
  const def = JOB_TYPES[currentJob.type];
  const stages = def.stages;
  const currentIndex = currentJob.stageIndex;
  const currentSla = currentJobSla(currentJob, rules);
  const nextStage = stages[currentIndex + 1] || null;
  const done = currentJob.stage === "Completed";
  const activeHistory = currentJob.history[currentJob.history.length - 1];
  const activeRule = nextStage ? findRule(rules, currentJob.type, activeHistory.stage, nextStage) : null;
  const activeElapsedDays = nextStage ? daysBetween(activeHistory.at, stampNow()) : 0;

  const historyRows = currentJob.history.map((entry, index) => {
    if (index === 0) return { entry, durationDays: null as number | null, transitionSla: "On Track" };
    const previous = currentJob.history[index - 1];
    const elapsedDays = daysBetween(previous.at, entry.at);
    const rule = findRule(rules, currentJob.type, previous.stage, entry.stage);
    return { entry, durationDays: elapsedDays, transitionSla: elapsedToSla(elapsedDays, rule, true) };
  });

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  function handleSwapDevice(newTerminal: Terminal) {
    if (selectedTerminal) {
      updateTerminal(selectedTerminal.serial, { status: "In Stock", lastMovement: new Date().toISOString().slice(0, 10) });
      appendTerminalActivity(selectedTerminal.serial, "Removed from job", currentJob.id + " · swapped out");
    }
    updateTerminal(newTerminal.serial, { status: "Reserved", lastMovement: new Date().toISOString().slice(0, 10) });
    appendTerminalActivity(newTerminal.serial, "Assigned to job", currentJob.id + " · swapped in");
    onUpdate(currentJob.id, { terminal: { serial: newTerminal.serial, brand: newTerminal.brand, model: newTerminal.model } });
    setShowSwap(false);
    flash("Device swapped to " + newTerminal.serial);
  }

  function handleAssignDevice(terminal: Terminal) {
    updateTerminal(terminal.serial, { status: "Reserved", lastMovement: new Date().toISOString().slice(0, 10) });
    appendTerminalActivity(terminal.serial, "Reserved for " + currentJob.type + " job", currentJob.id + " · " + currentJob.merchant.name);
    onUpdate(currentJob.id, { terminal: { serial: terminal.serial, brand: terminal.brand, model: terminal.model } });
    setShowAssignDevice(false);
    flash("Device " + terminal.serial + " assigned to " + currentJob.id);
  }

  function appendTerminalActivity(serial: string, title: string, desc: string, patch: Partial<Terminal> = {}) {
    const terminal = terminals.find((entry) => entry.serial === serial);
    if (!terminal) return;
    updateTerminal(serial, {
      ...patch,
      activityLog: [{ dot: "", time: stampNow(), title, desc }, ...(terminal.activityLog || [])],
    });
  }

  function completeInstallation() {
    if (!currentJob.terminal || !selectedTerminal || !currentJob.customer) return;
    const merchantMid = merchant?.mid || activeRental?.merchant.mid || "—";
    updateTerminal(currentJob.terminal.serial, {
      status: "Installed",
      merchant: { id: currentJob.merchant.id, name: currentJob.merchant.name },
      location: "Merchant Site",
      lastMovement: new Date().toISOString().slice(0, 10),
    });
    appendTerminalActivity(currentJob.terminal.serial, "Installation completed", currentJob.id + " · rental activated for " + currentJob.merchant.name);
    addRental({
      ...rentalFromJob(currentJob, selectedTerminal),
      customer: { id: currentJob.customer.id, name: currentJob.customer.name, tin: customer?.tin || "" },
      merchant: { id: currentJob.merchant.id, name: currentJob.merchant.name, mid: merchantMid },
    });
  }

  function completeRepair() {
    if (!currentJob.terminal) return;
    updateTerminal(currentJob.terminal.serial, {
      status: "Installed",
      merchant: { id: currentJob.merchant.id, name: currentJob.merchant.name },
      location: "Merchant Site",
      lastMovement: new Date().toISOString().slice(0, 10),
    });
    appendTerminalActivity(currentJob.terminal.serial, "Maintenance completed", currentJob.id + " · service proof archived");
  }

  function completeReplacement() {
    if (!currentJob.terminal || !selectedTerminal || !currentJob.customer) return;
    const merchantMid = merchant?.mid || activeRental?.merchant.mid || "—";
    if (previousTerminal) {
      updateTerminal(previousTerminal.serial, {
        status: previousTerminalStatus,
        merchant: null,
        location: terminalLocationForStatus(previousTerminalStatus),
        lastMovement: new Date().toISOString().slice(0, 10),
      });
      appendTerminalActivity(previousTerminal.serial, "Replacement completed", currentJob.id + " · removed from rental fleet", { merchant: null });
    }

    updateTerminal(currentJob.terminal.serial, {
      status: "Installed",
      merchant: { id: currentJob.merchant.id, name: currentJob.merchant.name },
      location: "Merchant Site",
      lastMovement: new Date().toISOString().slice(0, 10),
    });
    appendTerminalActivity(currentJob.terminal.serial, "Replacement deployed", currentJob.id + " · activated for " + currentJob.merchant.name);

    if (activeRental) {
      updateRental(activeRental.id, {
        terminal: {
          serial: selectedTerminal.serial,
          brand: selectedTerminal.brand,
          model: selectedTerminal.model,
          tid: selectedTerminal.tid,
        },
      });
    } else {
      addRental({
        ...rentalFromJob(currentJob, selectedTerminal),
        customer: { id: currentJob.customer.id, name: currentJob.customer.name, tin: customer?.tin || "" },
        merchant: { id: currentJob.merchant.id, name: currentJob.merchant.name, mid: merchantMid },
      });
    }
  }

  function completePaperRoll() {
    if (!currentJob.paperRollRequest) return;
    addEntry({
      id: "PR-" + currentJob.id.slice(-3) + String(currentJob.history.length).padStart(2, "0"),
      type: "Issued",
      quantity: -currentJob.paperRollRequest.quantity,
      reference: currentJob.merchant.name + " · " + currentJob.id,
      note: "Paper roll request completed · pay to " + currentJob.paperRollRequest.paymentTarget,
      date: new Date().toISOString().slice(0, 10),
      createdBy: ROLE_DEFAULT_ACTOR["Admin"],
      isNew: true,
    });
  }

  function applyTransition(stage: string, evidenceFiles: string[] = [], note = "") {
    const nextIndex = stages.indexOf(stage);
    const meta = TRANSITION_RULES[currentJob.type][stage];
    const entry = makeHistoryEntry(stage, meta.actorRole, note || meta.note, evidenceFiles);
    const notifications = meta.notify.length
      ? [...currentJob.notifications, makeNotification(meta.notify, currentJob.id + " updated to " + stage)]
      : currentJob.notifications;
    const draft: Job = {
      ...currentJob,
      stage,
      stageIndex: nextIndex,
      status: stage,
      history: [...currentJob.history, entry],
      notifications,
    };

    if (stage === "Device Prepared" && currentJob.terminal) {
      updateTerminal(currentJob.terminal.serial, {
        status: "Assigned",
        location: "KL Warehouse",
        lastMovement: new Date().toISOString().slice(0, 10),
      });
      appendTerminalActivity(currentJob.terminal.serial, "Device prepared", currentJob.id + " · ready for deployment");
    }

    if (stage === "Completed") {
      if (currentJob.type === "Installation") completeInstallation();
      if (currentJob.type === "Repair/Maintenance") completeRepair();
      if (currentJob.type === "Replacement") completeReplacement();
      if (currentJob.type === "Paper Roll Request") completePaperRoll();
      if (currentJob.type === "Remote Support" && currentJob.terminal) {
        appendTerminalActivity(currentJob.terminal.serial, "Remote support resolved", currentJob.id + " · issue closed remotely");
      }
    }

    onUpdate(currentJob.id, {
      stage: draft.stage,
      stageIndex: draft.stageIndex,
      status: draft.status,
      history: draft.history,
      notifications: draft.notifications,
      sla: draft.stage === "Completed" ? "Met" : currentJobSla(draft, rules),
    });

    const notifyCopy = meta.notify.length ? " · email sent to " + meta.notify.join(", ") : "";
    flash(stage + " recorded" + notifyCopy);
    setPendingStage(null);
    setFiles([]);
    setTransitionNote("");
  }

  function openAdvance() {
    if (!nextStage) return;
    if (transitionNeedsEvidence(currentJob.type, nextStage) || (currentJob.type === "Replacement" && nextStage === "Completed")) {
      setPendingStage(nextStage);
      return;
    }
    applyTransition(nextStage);
  }

  function confirmPendingStage() {
    if (!pendingStage) return;
    const evidenceRequired = transitionNeedsEvidence(currentJob.type, pendingStage);
    if (evidenceRequired && files.length === 0) return;
    applyTransition(pendingStage, files.map((file) => file.name), transitionNote.trim());
  }

  return (
    <div>
      <div className="back-link" onClick={() => nav("jobs")}><Icon name="arrowLeft" size={16} /> Back to Jobs</div>

      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--green-050)", color: "var(--green-700)", display: "grid", placeItems: "center" }}>
            <Icon name={def.icon} size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title mono">{currentJob.id}</h1>
              <JobStatus status={currentJob.stage} />
              <SlaChip sla={currentSla} />
            </div>
            <p className="page-sub">{currentJob.type + " · " + currentJob.merchant.name + " · due " + currentJob.due}</p>
          </div>
        </div>
        <div className="page-head-actions">
          {def.exportable && <Btn variant="ghost" icon="export" onClick={() => setShowExport(true)}>Export Details</Btn>}
          <Btn variant="ghost" icon="edit">Edit</Btn>
        </div>
      </div>

      <Card>
        <div className="card-pad" style={{ paddingTop: 26, paddingBottom: 24 }}>
          <Stepper stages={stages} current={currentIndex} />
        </div>
      </Card>

      <div style={{ margin: "16px 0", padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, boxShadow: "var(--sh-sm)", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: done ? "var(--green-050)" : currentSla === "Breached" ? "var(--bad-bg)" : currentSla === "Due Soon" ? "var(--warn-bg)" : "var(--info-bg)", color: done ? "var(--green-700)" : currentSla === "Breached" ? "var(--bad)" : currentSla === "Due Soon" ? "var(--warn)" : "var(--info)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={done ? "checkCircle" : "activity"} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{done ? "This job is complete" : "Current stage: " + activeHistory.stage}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {done
              ? "Workflow finished with evidence and notifications logged."
              : (["Installation", "Replacement"].includes(currentJob.type) && nextStage === "Device Prepared" && !currentJob.terminal)
                ? "Assign a device from inventory before advancing to Device Prepared."
                : nextStage && activeRule
                  ? `${activeElapsedDays} day(s) elapsed · warning after ${activeRule.warningDays} day(s), breach after ${activeRule.breachDays} day(s).`
                  : "Advance this job when the next team has completed its work."}
          </div>
        </div>
        {!done && nextStage && (
          <Btn
            variant="primary"
            iconRight={transitionNeedsEvidence(currentJob.type, nextStage) ? "upload" : "chevRight"}
            disabled={["Installation", "Replacement"].includes(currentJob.type) && nextStage === "Device Prepared" && !currentJob.terminal}
            onClick={openAdvance}
          >
            {transitionNeedsEvidence(currentJob.type, nextStage) ? "Record " + nextStage : "Advance to " + nextStage}
          </Btn>
        )}
      </div>

      <div className="detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Status Timeline" icon="activity">
            <div className="card-pad">
              <div className="timeline">
                {historyRows.map(({ entry, durationDays, transitionSla }, index) => (
                  <div className="tl-item" key={entry.stage + entry.at + index}>
                    <div className={"tl-dot " + (index === historyRows.length - 1 && !done ? "" : index === 0 ? "mut" : transitionSla === "Breached" ? "warn" : "")} />
                    <div className="tl-time">{entry.at}</div>
                    <div className="tl-title">{entry.stage} · {entry.actorRole}</div>
                    <div className="tl-desc">
                      {entry.note || "Stage updated"}
                      {durationDays !== null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
                          <span>{durationDays} day(s) since previous status</span>
                          <SlaChip sla={transitionSla} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Evidence & Notes" icon="file">
            <div className="card-pad">
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{currentJob.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentJob.history.filter((entry) => (entry.evidence || []).length > 0).length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No evidence uploaded yet.</div>
                ) : (
                  currentJob.history.filter((entry) => (entry.evidence || []).length > 0).map((entry) => (
                    <div key={entry.stage + entry.at} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{entry.stage} · {entry.at}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {(entry.evidence || []).map((file) => <Chip key={file} cls="chip-neutral">{file}</Chip>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Job Information" icon="jobs">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "128px 1fr" }}>
                <dt>Created by</dt><dd>{currentJob.createdByRole} · {currentJob.createdByName}</dd>
                <dt>Priority</dt><dd><Chip cls={currentJob.priority === "Urgent" ? "chip-bad" : currentJob.priority === "High" ? "chip-warn" : "chip-neutral"}>{currentJob.priority}</Chip></dd>
                <dt>Assignee</dt><dd>{currentJob.assignee}</dd>
                <dt>Created</dt><dd className="mono">{currentJob.created}</dd>
                <dt>Due</dt><dd className="mono">{currentJob.due}</dd>
                {currentJob.paperRollRequest && <><dt>Paper rolls</dt><dd>{currentJob.paperRollRequest.quantity} rolls · pay to {currentJob.paperRollRequest.paymentTarget}</dd></>}
              </dl>
            </div>
          </Card>

          <Card title="SLA Tracking" icon="clock">
            <div className="card-pad">
              {nextStage && activeRule ? (
                <dl className="kv" style={{ gridTemplateColumns: "128px 1fr" }}>
                  <dt>Current leg</dt><dd>{activeHistory.stage} → {nextStage}</dd>
                  <dt>Elapsed</dt><dd>{activeElapsedDays} day(s)</dd>
                  <dt>Warning</dt><dd>{activeRule.warningDays} day(s)</dd>
                  <dt>Breach</dt><dd>{activeRule.breachDays} day(s)</dd>
                  <dt>Flag</dt><dd><SlaChip sla={currentSla} /></dd>
                </dl>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Workflow complete. All SLA legs are closed.</div>
              )}
            </div>
          </Card>

          <Card title="Customer & Merchant" icon="merchants">
            <div className="card-pad">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{currentJob.customer?.name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 10 }}>{currentJob.customer?.id || "No customer linked"}</div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{currentJob.merchant.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>{currentJob.merchant.id + " · " + currentJob.bank}</div>
              <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%" }} onClick={() => nav("merchant-detail", currentJob.merchant.id)}>View merchant</Btn>
            </div>
          </Card>

          {(currentJob.terminal || (["Installation", "Replacement"].includes(currentJob.type) && !done)) && (
            <Card title={currentJob.type === "Replacement" ? "Replacement Device" : "Device"} icon="terminal">
              <div className="card-pad">
                {requestedSpec && (
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 2 }}>Requested spec</div>
                    <div>{requestedSpec.brand} {requestedSpec.model} · {requestedSpec.category}</div>
                  </div>
                )}
                {currentJob.terminal ? (
                  <>
                    <div className="mono" style={{ fontWeight: 600, marginBottom: 2 }}>{currentJob.terminal.serial}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>{currentJob.terminal.brand + " " + currentJob.terminal.model}</div>
                    <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%" }} onClick={() => nav("terminal-detail", currentJob.terminal!.serial)}>View device</Btn>
                    {!done && (
                      <Btn variant="ghost" sm icon="swap" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowSwap(true)}>Swap Device</Btn>
                    )}
                    {currentJob.previousTerminal && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>Previous rental device</div>
                        <div className="mono" style={{ fontWeight: 600 }}>{currentJob.previousTerminal.serial}</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{currentJob.previousTerminal.brand + " " + currentJob.previousTerminal.model}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--warn)", marginBottom: 12 }}>
                      <Icon name="activity" size={14} />
                      No device assigned yet
                    </div>
                    <Btn variant="ghost" sm icon="terminal" style={{ width: "100%" }} onClick={() => setShowAssignDevice(true)}>
                      Assign Device from Inventory
                    </Btn>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card title="Email Notifications" icon="mail">
            <div className="card-pad">
              <div className="timeline">
                {currentJob.notifications.map((notification, index) => (
                  <div className="tl-item" key={notification.at + notification.subject + index}>
                    <div className="tl-dot" />
                    <div className="tl-time">{notification.at}</div>
                    <div className="tl-title">{notification.subject}</div>
                    <div className="tl-desc">Sent to {notification.to.join(", ")}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {pendingStage && (
        <Modal
          title={"Record " + pendingStage}
          sub={currentJob.id + " · " + currentJob.type}
          icon={transitionNeedsEvidence(currentJob.type, pendingStage) ? "upload" : "check"}
          size="slim"
          onClose={() => { setPendingStage(null); setFiles([]); setTransitionNote(""); }}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => { setPendingStage(null); setFiles([]); setTransitionNote(""); }}>Cancel</Btn>
            <Btn variant="primary" icon="check" disabled={transitionNeedsEvidence(currentJob.type, pendingStage) && files.length === 0} onClick={confirmPendingStage}>Confirm</Btn>
          </>}
        >
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-2)" }}>
            {TRANSITION_RULES[currentJob.type][pendingStage].note}
          </p>

          {currentJob.type === "Replacement" && pendingStage === "Completed" && (
            <Field label="Previous terminal status" hint="required">
              <select className="input" value={previousTerminalStatus} onChange={(e) => setPreviousTerminalStatus(e.target.value)}>
                {REPLACEMENT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
          )}

          <Field label="Transition note">
            <textarea className="textarea" placeholder="Optional note for this status update…" value={transitionNote} onChange={(e) => setTransitionNote(e.target.value)} />
          </Field>

          {transitionNeedsEvidence(currentJob.type, pendingStage) && (
            <>
              <Field label="Evidence / proof" hint="required">
                <Dropzone files={files} setFiles={setFiles} hint="Attach proof, forms, photos, or signed documents" />
              </Field>
            </>
          )}
        </Modal>
      )}

      {showExport && (
        <Modal
          title="Export Job Details"
          sub={currentJob.id + " · " + currentJob.type}
          icon="export"
          size="slim"
          onClose={() => setShowExport(false)}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => setShowExport(false)}>Cancel</Btn>
            <Btn variant="primary" icon="download" onClick={() => { setShowExport(false); flash("Job sheet exported (PDF)"); }}>Download</Btn>
          </>}
        >
          <Field label="Format">
            <select className="input">
              {["PDF job sheet", "CSV row", "Print-ready work order"].map((format) => <option key={format}>{format}</option>)}
            </select>
          </Field>
          <Field label="Include">
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {["Stage history & durations", "Customer / merchant details", "Notification log", "Evidence summary"].map((option, index) => (
                <label key={index} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, fontWeight: 500 }}>
                  <input type="checkbox" defaultChecked={index < 3} />{option}
                </label>
              ))}
            </div>
          </Field>
        </Modal>
      )}

      {showSwap && currentJob.terminal && (
        <SwapDeviceModal
          currentSerial={currentJob.terminal.serial}
          terminals={terminals}
          onClose={() => setShowSwap(false)}
          onSwap={handleSwapDevice}
        />
      )}

      {showAssignDevice && (
        <AssignDeviceModal
          job={currentJob}
          terminals={terminals}
          onClose={() => setShowAssignDevice(false)}
          onAssign={handleAssignDevice}
        />
      )}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
