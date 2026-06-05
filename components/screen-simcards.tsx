/* PaidChain — SIM card inventory listing + detail */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { SIM_CARRIERS, SIM_PLANS, SIM_DATA_ALLOWANCES, SIM_STATUS } from "./data";
import type { SimCard } from "./data";
import { useSimCards } from "./simcards-context";
import { useTerminals } from "./terminals-context";
import { NavFn } from "./shell";

function SimStatus({ status }: { status: string }) {
  const m = SIM_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

/* =================== CREATE MODAL =================== */
interface CreateSimCardModalProps { onClose: () => void; onCreate: (s: SimCard) => void }

function CreateSimCardModal({ onClose, onCreate }: CreateSimCardModalProps) {
  const [form, setForm] = useState({
    iccid: "", msisdn: "",
    carrier: SIM_CARRIERS[0],
    plan: SIM_PLANS[0],
    dataAllowance: SIM_DATA_ALLOWANCES[0],
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    onCreate({
      id: "SIM-" + String(Date.now()).slice(-4),
      iccid: form.iccid.trim(),
      msisdn: form.msisdn.trim(),
      carrier: form.carrier,
      plan: form.plan,
      dataAllowance: form.dataAllowance,
      status: "In Storage",
      terminalSerial: null,
      isNew: true,
    });
    onClose();
  }

  return (
    <Modal
      title="Add SIM Card" sub="Register a new SIM card into the inventory" icon="phone"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={submit}>Add SIM Card</Btn>
      </>}
    >
      <Field label="ICCID" hint="required · min 10 digits">
        <input
          className="input" placeholder="e.g. 89601100001234567890"
          value={form.iccid} onChange={(e) => set("iccid", e.target.value)}
        />
      </Field>
      <Field label="MSISDN (phone number)">
        <input
          className="input" placeholder="e.g. 012-3456789"
          value={form.msisdn} onChange={(e) => set("msisdn", e.target.value)}
        />
      </Field>
      <div className="field-row">
        <Field label="Carrier">
          <select className="input" value={form.carrier} onChange={(e) => set("carrier", e.target.value)}>
            {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select className="input" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
            {SIM_PLANS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Data allowance">
        <select className="input" value={form.dataAllowance} onChange={(e) => set("dataAllowance", e.target.value)}>
          {SIM_DATA_ALLOWANCES.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>
        New SIM cards are added into storage first. Link or replace them later from terminal device details.
      </p>
    </Modal>
  );
}

/* =================== LISTING =================== */
export function SimCards({ nav }: { nav: NavFn }) {
  const { simCards, addSimCard } = useSimCards();
  const { terminals } = useTerminals();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = simCards.filter((s) => {
    const hay = (s.id + " " + s.iccid + " " + s.msisdn + " " + s.carrier + " " + (s.terminalSerial || "")).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (status !== "All" && s.status !== status) return false;
    return true;
  });

  const stats = {
    total: simCards.length,
    active: simCards.filter((s) => s.status === "Active").length,
    storage: simCards.filter((s) => s.status === "In Storage").length,
    suspended: simCards.filter((s) => s.status === "Suspended").length,
  };

  function handleCreate(s: SimCard) {
    addSimCard(s);
    setToast(s.id + " added to inventory");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title="SIM Cards"
        sub="SIM card inventory · manage carrier assignments and terminal links"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add SIM Card</Btn>
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { l: "Total SIMs",  v: stats.total,     ico: "phone",  c: "var(--ink-2)",     bg: "var(--bg-2, #f5f5f5)" },
          { l: "Active",      v: stats.active,     ico: "check",  c: "var(--ok)",        bg: "var(--green-050)" },
          { l: "In Storage",  v: stats.storage,    ico: "box",    c: "var(--info)",      bg: "var(--info-bg)" },
          { l: "Suspended",   v: stats.suspended,  ico: "alert",  c: "var(--warn)",      bg: "var(--warn-bg)" },
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
          <SearchBox value={q} onChange={setQ} placeholder="Search ICCID, MSISDN, carrier, terminal…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Active", "In Storage", "Suspended", "Retired"].map((s) => (
              <option key={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{filtered.length} SIM cards</span>
        </Toolbar>
        {filtered.length === 0 ? <Empty icon="phone" title="No SIM cards match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["SIM ID", "ICCID", "MSISDN", "Carrier", "Plan", "Linked Terminal", "Status", ""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const t = s.terminalSerial ? terminals.find((t) => t.serial === s.terminalSerial) : null;
                  return (
                    <tr key={s.id}>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span className="td-mono td-strong">{s.id}</span>
                          {s.isNew && <Chip cls="chip-ok" sq>New</Chip>}
                        </span>
                      </td>
                      <td className="td-mono td-mut" style={{ fontSize: 12 }}>{s.iccid}</td>
                      <td className="td-mono">{s.msisdn || <span className="td-mut">—</span>}</td>
                      <td>{s.carrier}</td>
                      <td className="td-mut">{s.plan}</td>
                      <td>
                        {t ? (
                          <div className="cell-2">
                            <span className="td-strong">{t.brand} {t.model}</span>
                            <span className="c2-sub mono">{t.serial}</span>
                          </div>
                        ) : (
                          <span className="td-mut">In Storage</span>
                        )}
                      </td>
                      <td><SimStatus status={s.status} /></td>
                      <td>
                        <Btn variant="ghost" sm icon="eye" onClick={() => nav("simcard-detail", s.id)}>View</Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={simCards.length} shown={filtered.length} />
      </Card>

      {showCreate && <CreateSimCardModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {toast && (
        <div className="toast">
          <span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}
        </div>
      )}
    </div>
  );
}

/* =================== DETAIL =================== */
export function SimCardDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { simCards, updateSimCard } = useSimCards();
  const { terminals, updateTerminal } = useTerminals();
  const sim = simCards.find((s) => s.id === id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SimCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!sim) return (
    <div>
      <PageHead title="SIM not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>} />
      <Empty icon="phone" title="SIM card not found" sub={"No SIM card with ID " + id} />
    </div>
  );

  const currentSim = sim;
  const linkedTerminal = currentSim.terminalSerial ? terminals.find((t) => t.serial === currentSim.terminalSerial) : null;
  const d = draft ?? currentSim;
  const draftLinkedTerminal = d.terminalSerial ? terminals.find((t) => t.serial === d.terminalSerial) : null;

  function startEdit() { setDraft(currentSim); setEditing(true); }
  function cancelEdit() { setDraft(null); setEditing(false); }

  function setDraftField(k: keyof SimCard, v: string | null) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [k]: v } as SimCard;
      if (k === "terminalSerial") {
        next.status = v ? "Active" : (prev.status === "Active" ? "In Storage" : prev.status);
      }
      return next;
    });
  }

  function updateTerminalConnectivity(serial: string | null, simState: "linked" | "unlinked") {
    if (!serial) return;
    updateTerminal(serial, { sim: simState === "linked" ? "4G + WiFi" : "WiFi only" });
  }

  function unlinkExistingTerminalSim(serial: string, keepSimId?: string) {
    const existing = simCards.find((entry) => entry.terminalSerial === serial && entry.id !== keepSimId);
    if (existing) {
      updateSimCard(existing.id, { terminalSerial: null, status: "In Storage" });
    }
    return existing;
  }

  function save() {
    if (!draft) return;
    const nextSerial = draft.terminalSerial;
    const nextStatus = nextSerial ? (draft.status === "In Storage" ? "Active" : draft.status) : (draft.status === "Active" ? "In Storage" : draft.status);

    if (currentSim.terminalSerial && currentSim.terminalSerial !== nextSerial) {
      updateTerminalConnectivity(currentSim.terminalSerial, "unlinked");
    }
    if (nextSerial) {
      unlinkExistingTerminalSim(nextSerial, currentSim.id);
      updateTerminalConnectivity(nextSerial, "linked");
    }

    updateSimCard(id, { ...draft, status: nextStatus });
    setEditing(false);
    setDraft(null);
    setToast(nextSerial !== currentSim.terminalSerial ? (nextSerial ? "SIM card linked to " + nextSerial : "SIM card moved to storage") : "SIM card updated");
    setTimeout(() => setToast(null), 2800);
  }

  function quickLink(serial: string | null) {
    if (currentSim.terminalSerial && currentSim.terminalSerial !== serial) {
      updateTerminalConnectivity(currentSim.terminalSerial, "unlinked");
    }
    if (serial) {
      unlinkExistingTerminalSim(serial, currentSim.id);
      updateTerminalConnectivity(serial, "linked");
    }
    const patch: Partial<SimCard> = {
      terminalSerial: serial,
      status: serial ? "Active" : "In Storage",
    };
    updateSimCard(id, patch);
    setToast(serial ? "Linked to " + serial : "Unlinked — moved to storage");
    setTimeout(() => setToast(null), 2800);
  }

  const infoRows: [string, string][] = [
    ["SIM ID",         currentSim.id],
    ["ICCID",          currentSim.iccid],
    ["MSISDN",         currentSim.msisdn || "—"],
    ["Carrier",        currentSim.carrier],
    ["Plan",           currentSim.plan],
    ["Data Allowance", currentSim.dataAllowance],
  ];

  return (
    <div>
      <PageHead
        title={currentSim.id}
        sub={currentSim.carrier + " · " + currentSim.iccid}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>
          {!editing ? (
            <Btn variant="ghost" icon="edit" onClick={startEdit}>Edit</Btn>
          ) : (
            <>
              <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
              <Btn variant="primary" icon="check" onClick={save}>Save Changes</Btn>
            </>
          )}
        </>}
      />

      {/* Status row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <SimStatus status={currentSim.status} />
        {currentSim.isNew && <Chip cls="chip-ok" sq>New</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* SIM Details */}
        <Card title="SIM Details" icon="phone">
          {!editing ? (
            <div style={{ padding: "4px 20px 16px" }}>
              {infoRows.map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500, fontFamily: ["ICCID","MSISDN"].includes(l) ? "var(--mono)" : undefined }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "4px 20px 16px" }}>
              <Field label="ICCID" hint="required">
                <input className="input" value={d.iccid} onChange={(e) => setDraftField("iccid", e.target.value)} />
              </Field>
              <Field label="MSISDN">
                <input className="input" placeholder="012-3456789" value={d.msisdn} onChange={(e) => setDraftField("msisdn", e.target.value)} />
              </Field>
              <div className="field-row">
                <Field label="Carrier">
                  <select className="input" value={d.carrier} onChange={(e) => setDraftField("carrier", e.target.value)}>
                    {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Plan">
                  <select className="input" value={d.plan} onChange={(e) => setDraftField("plan", e.target.value)}>
                    {SIM_PLANS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Data allowance">
                <select className="input" value={d.dataAllowance} onChange={(e) => setDraftField("dataAllowance", e.target.value)}>
                  {SIM_DATA_ALLOWANCES.map((da) => <option key={da}>{da}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={d.status} onChange={(e) => setDraftField("status", e.target.value)}>
                  {Object.keys(SIM_STATUS).map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Card>

        {/* Linked Terminal */}
        <Card title="Linked Terminal" icon="terminal">
          <div style={{ padding: "4px 20px 16px" }}>
            {!editing ? (
              <>
                {linkedTerminal ? (
                  <>
                    {[
                      ["Serial",   linkedTerminal.serial],
                      ["Brand",    linkedTerminal.brand],
                      ["Model",    linkedTerminal.model],
                      ["TID",      linkedTerminal.tid || "—"],
                      ["Status",   linkedTerminal.status],
                      ["Location", linkedTerminal.location],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                        <span style={{ color: "var(--ink-2)" }}>{l}</span>
                        <span style={{ fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 14 }}>
                      <Btn variant="ghost" sm icon="x" onClick={() => quickLink(null)}>Unlink Terminal</Btn>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "16px 0" }}>
                    <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 14 }}>
                      This SIM is currently in storage and not linked to any terminal.
                    </div>
                    <Field label="Link to terminal">
                      <select
                        className="input"
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) quickLink(e.target.value); }}
                      >
                        <option value="">Select terminal to link…</option>
                        {terminals.map((t) => (
                          <option key={t.serial} value={t.serial}>
                            {t.brand} {t.model} · {t.serial} · {t.status}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
              </>
            ) : (
              <>
                <Field label="Terminal">
                  <select
                    className="input"
                    value={d.terminalSerial || ""}
                    onChange={(e) => setDraftField("terminalSerial", e.target.value || null)}
                  >
                    <option value="">None — in storage</option>
                    {terminals.map((t) => (
                      <option key={t.serial} value={t.serial}>
                        {t.brand} {t.model} · {t.serial} · {t.status}
                      </option>
                    ))}
                  </select>
                </Field>
                {draftLinkedTerminal && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <Chip cls="chip-neutral">{draftLinkedTerminal.brand} {draftLinkedTerminal.model}</Chip>
                    <Chip cls="chip-info">{draftLinkedTerminal.status}</Chip>
                    {draftLinkedTerminal.merchant && <Chip cls="chip-neutral">{draftLinkedTerminal.merchant.name}</Chip>}
                  </div>
                )}
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12 }}>
                  Selecting a terminal sets status to Active. Clearing it moves the SIM to In Storage.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {toast && (
        <div className="toast">
          <span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}
        </div>
      )}
    </div>
  );
}
