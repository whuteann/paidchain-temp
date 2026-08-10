/* PaidChain — Job listing + detail + workflow engine */
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, JobStatus, SlaChip, Pagination, Empty, Chip, Modal, Field, Dropzone, Stepper, MobileListItem, ResponsiveTable } from "./components";
import type { DropzoneFile } from "./components";
import { JOB_TYPES } from "./data";
import type { SlaTransitionRule } from "./data";
import { api, ApiError, terminalSerial } from "@/lib/api";
import type { JobOut, JobCreate, TerminalOut, TermSettingOut, CustomerOut, MerchantOut, TerminalTidOut, TerminalTidMidOut, TerminalTidMidCreate, TerminalTidMidUpdate, MerchantTerminalOut, UserOut, JobEvidenceOut, EscalateToReplacementBody, MdrOut } from "@/lib/api";
import { useJobSla } from "./job-sla-context";
import { NavFn } from "./shell";
import { useCan } from "@/lib/use-permissions";

/* =================== ASYNC SEARCH SELECT =================== */
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

function JobTidMidModal({ tid, merchantName, existing, onClose, onSaved }: {
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

const TYPE_META: Record<string, string> = {
  "Installation": "Deploy a terminal and create the rental after admin sign-off",
  "Repair/Maintenance": "Resolve a merchant device issue and close with maintenance proof",
  "Replacement": "Prepare a replacement device and swap out the previous rental unit",
  "Retrieval": "Retrieve installed merchant devices and close their active rental links",
  "Paper Roll Request": "Prepare, deliver and reconcile paper roll stock requests",
  "Remote Support": "Resolve a merchant issue remotely and close with evidence",
};

const REPLACEMENT_STATUS_OPTIONS = ["Faulty", "Maintenance", "Returned", "Retired", "In Stock"];

type InstallationTerminalDraft = {
  rowId: string;
  terminal_setting_id: string;
  terminal_tid_id: string;
  terminal_tid_mid_id: string;
  mid: string;
  mdr_rate_id: string;
};

type ServiceTerminalDraft = {
  rowId: string;
  terminal_id: string;
  term_setting_id: string;
};

function newInstallationTerminalDraft(): InstallationTerminalDraft {
  return {
    rowId: Math.random().toString(36).slice(2),
    terminal_setting_id: "",
    terminal_tid_id: "",
    terminal_tid_mid_id: "",
    mid: "",
    mdr_rate_id: "",
  };
}

function newServiceTerminalDraft(): ServiceTerminalDraft {
  return {
    rowId: Math.random().toString(36).slice(2),
    terminal_id: "",
    term_setting_id: "",
  };
}

function stampNow() {
  return new Date().toISOString().slice(0, 16).replace("T", " · ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function parseStamp(stamp: string) {
  if (stamp.includes(" · ")) {
    return new Date(stamp.replace(" · ", "T") + ":00Z");
  }
  return new Date(stamp);
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

function currentJobSla(job: JobOut, rules: Record<string, SlaTransitionRule[]>, now = stampNow()) {
  if (job.stage === "Completed") return "Met";
  const stages = job.stage_sequence?.length ? job.stage_sequence : JOB_TYPES[job.type]?.stages ?? [];
  const history = job.history ?? [];
  const currentStage = history[history.length - 1];
  const sequenceIndex = stages.indexOf(job.stage);
  const currentIndex = sequenceIndex >= 0 ? sequenceIndex : job.stage_index;
  const nextStage = stages[currentIndex + 1];
  if (!currentStage || !nextStage) return job.sla;
  const rule = findRule(rules, job.type, currentStage.stage, nextStage);
  return elapsedToSla(daysBetween(currentStage.at, now), rule);
}

function transitionNeedsEvidence(jobType: string, nextStage: string) {
  if (nextStage === "Completed") return true;
  if (nextStage === "Job Done") return true;
  if ((jobType === "Retrieval" || jobType === "Replacement") && nextStage === "Device Returned") return true;
  return jobType === "Remote Support" && nextStage === "Completed";
}

function evidenceFilename(evidence: JobEvidenceOut) {
  return evidence.filename;
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

function evidenceIsImage(evidence: JobEvidenceOut) {
  return /\.(png|jpe?g)$/i.test(evidence.filename);
}

/* =================== CREATE JOB MODAL =================== */

interface CreateJobModalProps {
  onClose: () => void;
  onCreate: (job: JobOut) => void;
  nav: NavFn;
  presetCustomer?: CustomerOut | null;
  presetMerchant?: MerchantOut | null;
  presetType?: string | null;
}

export function CreateJobModal({ onClose, onCreate, nav, presetCustomer = null, presetMerchant = null, presetType = null }: CreateJobModalProps) {
  const types = Object.keys(JOB_TYPES);
  const initialType = presetType && JOB_TYPES[presetType] ? presetType : null;
  const presetTypeLocked = Boolean(initialType);
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [type, setType] = useState<string | null>(initialType);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOut | null>(presetCustomer);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantOut | null>(presetMerchant);
  const [merchantTerminalState, setMerchantTerminalState] = useState<{
    merchantId: string | null;
    items: MerchantTerminalOut[];
    loading: boolean;
  }>({
    merchantId: presetMerchant?.id ?? null,
    items: [],
    loading: Boolean(presetMerchant?.id),
  });
  const [installationTerminals, setInstallationTerminals] = useState<InstallationTerminalDraft[]>([newInstallationTerminalDraft()]);
  const [serviceTerminals, setServiceTerminals] = useState<ServiceTerminalDraft[]>([newServiceTerminalDraft()]);
  const [merchantTids, setMerchantTids] = useState<TerminalTidOut[]>(presetMerchant?.tids ?? []);
  const [merchantTidsLoading, setMerchantTidsLoading] = useState(Boolean(presetMerchant?.id));
  const [midLoadingTidIds, setMidLoadingTidIds] = useState<string[]>([]);
  const [midModal, setMidModal] = useState<{ tidId: string; midId?: string | null; rowIndex: number } | null>(null);
  const [termSettingsList, setTermSettingsList] = useState<TermSettingOut[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserOut[]>([]);
  const [form, setForm] = useState({
    assignee: "",
    priority: "Normal",
    due: "",
    notes: "",
    paperRollQty: "50",
    paymentTarget: "Merchant",
    invoiceParty: "",
    invoiceRequired: "",
    invoiceStatus: "",
    accountingHandling: "",
    billingReference: "",
  });

  useEffect(() => {
    api.termSettings.list({ active: true }).then(setTermSettingsList).catch(console.error);
    api.users.list({ role: "Operations", per_page: 100 }).then((p) => setAdminUsers(p.items)).catch(console.error);
  }, []);

  const selectedMerchantId = selectedMerchant?.id;
  const selectedMerchantInitialTids = selectedMerchant?.tids;

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!selectedMerchantId) {
        if (!cancelled) {
          setMerchantTids([]);
          setMerchantTidsLoading(false);
          setMidLoadingTidIds([]);
          setMidModal(null);
          setInstallationTerminals([newInstallationTerminalDraft()]);
        }
        return;
      }

      setMerchantTidsLoading(true);
      setMerchantTids(selectedMerchantInitialTids ?? []);
      setMidLoadingTidIds([]);
      setMidModal(null);
      setInstallationTerminals([newInstallationTerminalDraft()]);

      api.merchants.get(selectedMerchantId)
        .then((merchant) => {
          if (!cancelled) setMerchantTids(merchant.tids ?? []);
        })
        .catch((e) => {
          if (!cancelled) console.error(e);
        })
        .finally(() => {
          if (!cancelled) setMerchantTidsLoading(false);
        });

      api.merchants.terminals(selectedMerchantId)
        .then((items) => {
          if (!cancelled) {
            setMerchantTerminalState({ merchantId: selectedMerchantId, items, loading: false });
          }
        })
        .catch((e) => {
          if (!cancelled) {
            console.error(e);
            setMerchantTerminalState({ merchantId: selectedMerchantId, items: [], loading: false });
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMerchantId, selectedMerchantInitialTids]);

  const def = type ? JOB_TYPES[type] : null;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const merchantTerminals = merchantTerminalState.merchantId === selectedMerchant?.id ? merchantTerminalState.items : [];
  const merchantTerminalsLoading = merchantTerminalState.merchantId === selectedMerchant?.id && merchantTerminalState.loading;
  const requiresInstallationTerminals = type === "Installation";
  const requiresServiceTerminals = type === "Repair/Maintenance" || type === "Replacement" || type === "Remote Support" || type === "Retrieval";
  const requiresPaperRollFields = type === "Paper Roll Request";
  const selectedInstallationTidIds = installationTerminals.map((row) => row.terminal_tid_id).filter(Boolean);
  const hasDuplicateInstallationTids = new Set(selectedInstallationTidIds).size !== selectedInstallationTidIds.length;
  const installationTerminalsComplete = installationTerminals.length > 0 && installationTerminals.every((row) =>
    row.terminal_setting_id && row.terminal_tid_id && row.terminal_tid_mid_id && row.mid.trim() && row.mdr_rate_id
  );
  const selectedServiceTerminalIds = serviceTerminals.map((row) => row.terminal_id).filter(Boolean);
  const hasDuplicateServiceTerminals = new Set(selectedServiceTerminalIds).size !== selectedServiceTerminalIds.length;
  const serviceTerminalsComplete = serviceTerminals.length > 0 && serviceTerminals.every((row) =>
    row.terminal_id && (type !== "Replacement" || row.term_setting_id)
  );

  const valid = !!(
    type &&
    selectedCustomer &&
    selectedMerchant &&
    form.due &&
    form.assignee &&
    (!requiresInstallationTerminals || (installationTerminalsComplete && !hasDuplicateInstallationTids)) &&
    (!requiresServiceTerminals || (serviceTerminalsComplete && !hasDuplicateServiceTerminals && !merchantTerminalsLoading)) &&
    (!requiresPaperRollFields || Number(form.paperRollQty) > 0)
  );

  function setInstallationTerminalRow(index: number, patch: Partial<InstallationTerminalDraft>) {
    setInstallationTerminals((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  function isActiveMid(mid: TerminalTidMidOut) {
    return (mid.status ?? "Active").toLowerCase() !== "inactive";
  }

  async function loadTidMids(tidId: string, force = false): Promise<TerminalTidMidOut[]> {
    const existing = merchantTids.find((item) => item.id === tidId);
    if (!force && existing?.mids) return existing.mids;
    setMidLoadingTidIds((ids) => ids.includes(tidId) ? ids : [...ids, tidId]);
    try {
      const mids = await api.terminals.listTidMids(tidId);
      setMerchantTids((items) => items.map((item) => item.id === tidId ? { ...item, mids } : item));
      return mids;
    } finally {
      setMidLoadingTidIds((ids) => ids.filter((id) => id !== tidId));
    }
  }

  function selectInstallationTid(index: number, tidId: string) {
    setInstallationTerminalRow(index, {
      terminal_tid_id: tidId,
      terminal_tid_mid_id: "",
      mid: "",
      mdr_rate_id: "",
    });
    if (!tidId) return;

    void loadTidMids(tidId, true)
      .then((mids) => {
        const firstMid = mids.filter(isActiveMid)[0] ?? mids[0];
        setInstallationTerminals((rows) => rows.map((row, i) => {
          if (i !== index || row.terminal_tid_id !== tidId) return row;
          return {
            ...row,
            terminal_tid_mid_id: firstMid?.id ?? "",
            mid: firstMid?.mid ?? "",
            mdr_rate_id: firstMid?.mdr_rate_id ?? "",
          };
        }));
      })
      .catch((e) => {
        console.error(e);
        setErr("Failed to load MIDs for the selected TID.");
      });
  }

  function selectInstallationMid(index: number, tidId: string, midId: string) {
    const tid = merchantTids.find((item) => item.id === tidId);
    const mid = tid?.mids?.find((item) => item.id === midId);
    setInstallationTerminalRow(index, {
      terminal_tid_mid_id: midId,
      mid: mid?.mid ?? "",
      mdr_rate_id: mid?.mdr_rate_id ?? "",
    });
  }

  function handleInstallationMidSaved(savedMid: TerminalTidMidOut) {
    const tidId = midModal?.tidId ?? savedMid.terminal_tid_id;
    setMerchantTids((items) => items.map((item) => {
      if (item.id !== tidId) return item;
      const mids = item.mids ?? [];
      const exists = mids.some((mid) => mid.id === savedMid.id);
      return {
        ...item,
        mids: exists
          ? mids.map((mid) => mid.id === savedMid.id ? savedMid : mid)
          : [...mids, savedMid],
      };
    }));
    if (!midModal) return;
    setInstallationTerminals((rows) => rows.map((row, index) => {
      if (index !== midModal.rowIndex || row.terminal_tid_id !== tidId) return row;
      if (midModal.midId && row.terminal_tid_mid_id !== savedMid.id) return row;
      return {
        ...row,
        terminal_tid_mid_id: savedMid.id,
        mid: savedMid.mid,
        mdr_rate_id: savedMid.mdr_rate_id ?? "",
      };
    }));
  }

  function addInstallationTerminalRow() {
    setInstallationTerminals((rows) => [...rows, newInstallationTerminalDraft()]);
  }

  function removeInstallationTerminalRow(index: number) {
    setInstallationTerminals((rows) => rows.length > 1 ? rows.filter((_, i) => i !== index) : rows);
  }

  function setServiceTerminalRow(index: number, patch: Partial<ServiceTerminalDraft>) {
    setServiceTerminals((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  function addServiceTerminalRow() {
    setServiceTerminals((rows) => [...rows, newServiceTerminalDraft()]);
  }

  function removeServiceTerminalRow(index: number) {
    setServiceTerminals((rows) => rows.length > 1 ? rows.filter((_, i) => i !== index) : rows);
  }

  async function submit() {
    if (!type || !selectedCustomer || !selectedMerchant) return;
    if (requiresInstallationTerminals && hasDuplicateInstallationTids) {
      setErr("Duplicate TID ids are not allowed in one installation job.");
      return;
    }
    if (requiresServiceTerminals && hasDuplicateServiceTerminals) {
      setErr("Duplicate terminal serials are not allowed in one service job.");
      return;
    }
    setSaving(true); setErr(null);
    const body: JobCreate = {
      type,
      customer_id: selectedCustomer.id,
      merchant_id: selectedMerchant.id,
      assignee: form.assignee,
      priority: form.priority,
      due_date: form.due,
      notes: form.notes || TYPE_META[type],
      term_setting_id: null,
      terminals: requiresInstallationTerminals
        ? installationTerminals.map((row) => ({
          terminal_setting_id: row.terminal_setting_id,
          tid: row.terminal_tid_id,
          mid: row.mid.trim(),
          mdr: row.mdr_rate_id,
        }))
        : undefined,
      service_terminals: requiresServiceTerminals
        ? serviceTerminals.map((row) => (
          type === "Replacement"
            ? { terminal_id: row.terminal_id, term_setting_id: row.term_setting_id }
            : type === "Retrieval"
              ? { terminal_id: row.terminal_id, term_setting_id: null }
            : { terminal_id: row.terminal_id }
        ))
        : undefined,
      service_terminal_serial: undefined,
      paper_roll_qty: requiresPaperRollFields ? Number(form.paperRollQty) : null,
      payment_target: requiresPaperRollFields ? form.paymentTarget : null,
      invoice_party: requiresPaperRollFields ? (form.invoiceParty || null) : null,
      invoice_required: requiresPaperRollFields && form.invoiceRequired !== "" ? form.invoiceRequired === "Yes" : null,
      invoice_status: requiresPaperRollFields ? (form.invoiceStatus || null) : null,
      accounting_handling: requiresPaperRollFields ? (form.accountingHandling || null) : null,
      billing_reference: requiresPaperRollFields ? (form.billingReference || null) : null,
    };
    try {
      const job = await api.jobs.create(body);
      onCreate(job);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create job");
      setSaving(false);
    }
  }

  const midModalTid = midModal ? merchantTids.find((tid) => tid.id === midModal.tidId) : null;
  const midModalExisting = midModalTid && midModal?.midId
    ? midModalTid.mids?.find((mid) => mid.id === midModal.midId) ?? null
    : null;

  return (
    <>
      <Modal
        title="Create Job"
        sub={step === 1 ? "Select a workflow to begin" : (type || "")}
        icon="plus"
        size="wide"
        onClose={onClose}
        foot={<>
          {step === 2 && !presetTypeLocked && <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(1)}>Back</Btn>}
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {step === 1
            ? <Btn variant="primary" iconRight="chevRight" disabled={!type} onClick={() => setStep(2)}>Continue</Btn>
            : <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
              {saving ? "Creating…" : "Create Job"}
            </Btn>}
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

          {presetCustomer ? (
            <Field label="Customer" hint="prefilled · billing entity">
              <div className="input" style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: "var(--bg-2, #f5f5f5)" }}>
                <span style={{ fontWeight: 600 }}>{presetCustomer.name}</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{presetCustomer.reg_no || presetCustomer.id}</span>
              </div>
            </Field>
          ) : (
            <>
              <EntitySearchSelect<CustomerOut>
                label="Customer" hint="required · billing entity"
                placeholder="Search customer name, registration, contact…"
                value={selectedCustomer}
                onSelect={(c) => {
                  setSelectedCustomer(c);
                  setSelectedMerchant(null);
                  setServiceTerminals([newServiceTerminalDraft()]);
                  setMerchantTerminalState({ merchantId: null, items: [], loading: false });
                }}
                fetchResults={(query) => api.customers.list({ query, per_page: 8 }).then((p) => p.items)}
                getLabel={(c) => c.name}
                renderOption={(c) => (
                  <div className="cell-2">
                    <span className="td-strong">{c.name}</span>
                    <span className="c2-sub">{c.reg_no || c.id}</span>
                  </div>
                )}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--info)" }}>
                <Icon name="plus" size={13} />
                <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { onClose(); nav("customers"); }}>
                  Create new customer
                </span>
              </div>
            </>
          )}

          {presetMerchant ? (
            <Field label="Merchant" hint="prefilled · job location">
              <div className="input" style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: "var(--bg-2, #f5f5f5)" }}>
                <span style={{ fontWeight: 600 }}>{presetMerchant.name}</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{presetMerchant.mid}</span>
              </div>
            </Field>
          ) : (
            <EntitySearchSelect<MerchantOut>
              key={selectedCustomer?.id || "no-customer"}
              label="Merchant" hint="required · job location"
              placeholder="Search merchant name or MID…"
              disabled={!selectedCustomer}
              disabledHint="Select a customer first"
              value={selectedMerchant}
              onSelect={(merchant) => {
                setSelectedMerchant(merchant);
                setServiceTerminals([newServiceTerminalDraft()]);
                setMerchantTerminalState({ merchantId: merchant?.id ?? null, items: [], loading: !!merchant });
              }}
              fetchResults={(query) => selectedCustomer
                ? api.merchants.list({ query, customer_id: selectedCustomer.id, per_page: 8 }).then((p) => p.items)
                : Promise.resolve([])}
              getLabel={(m) => m.name + " · " + m.mid}
              renderOption={(m) => (
                <div className="cell-2">
                  <span className="td-strong">{m.name}</span>
                  <span className="c2-sub">{m.mid}</span>
                </div>
              )}
            />
          )}

          {selectedMerchant && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Chip cls="chip-neutral">{selectedMerchant.bank}</Chip>
              <Chip cls="chip-neutral">{selectedMerchant.type}</Chip>
            </div>
          )}

          {requiresServiceTerminals && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {type === "Replacement" ? "Replacement lines" : type === "Retrieval" ? "Retrieval devices" : "Service terminals"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {type === "Retrieval" ? "required · select every merchant device to retrieve" : "required · one line per merchant terminal"}
                  </div>
                </div>
                <Btn variant="ghost" sm icon="plus" onClick={addServiceTerminalRow}>Add Line</Btn>
              </div>

              {merchantTerminalsLoading ? (
                <div className="input" style={{ background: "var(--bg-2, #f5f5f5)", color: "var(--ink-3)", marginBottom: 14 }}>
                  Loading merchant terminals…
                </div>
              ) : merchantTerminals.length === 0 ? (
                <div className="input" style={{ color: "var(--warn)", background: "var(--warn-bg)", marginBottom: 14 }}>
                  No linked merchant terminal found for this workflow.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {serviceTerminals.map((row, index) => {
                    const duplicateTerminal = !!row.terminal_id && serviceTerminals.some((other, otherIndex) =>
                      otherIndex !== index && other.terminal_id === row.terminal_id
                    );
                    return (
                      <div key={row.rowId} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                            {type === "Replacement" ? `Replacement ${index + 1}` : type === "Retrieval" ? `Retrieval ${index + 1}` : `Terminal ${index + 1}`}
                          </div>
                          {serviceTerminals.length > 1 && (
                            <Btn variant="ghost" sm icon="x" onClick={() => removeServiceTerminalRow(index)}>Remove</Btn>
                          )}
                        </div>
                        <div className={type === "Replacement" ? "field-row" : undefined} style={type === "Replacement" ? undefined : { marginBottom: 0 }}>
                          <Field label={type === "Replacement" ? "Terminal to replace" : type === "Retrieval" ? "Terminal to retrieve" : "Affected terminal"} hint={duplicateTerminal ? "duplicate selected" : "terminal serial"}>
                            <select
                              className="input"
                              value={row.terminal_id}
                              onChange={(e) => setServiceTerminalRow(index, { terminal_id: e.target.value })}
                              style={duplicateTerminal ? { borderColor: "var(--bad)" } : undefined}
                            >
                              <option value="">Select terminal…</option>
                              {merchantTerminals.map((terminal) => (
                                <option key={terminal.serial} value={terminal.serial}>
                                  {terminal.serial} · {terminal.brand} {terminal.model}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {type === "Replacement" && (
                            <Field label="Replacement model" hint="required">
                              <select
                                className="input"
                                value={row.term_setting_id}
                                onChange={(e) => setServiceTerminalRow(index, { term_setting_id: e.target.value })}
                              >
                                <option value="">Select model…</option>
                                {termSettingsList.map((setting) => (
                                  <option key={setting.id} value={setting.id}>
                                    {setting.brand} {setting.model} · {setting.id}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasDuplicateServiceTerminals && (
                <div style={{ fontSize: 12.5, color: "var(--bad)", marginTop: -6, marginBottom: 14 }}>
                  Duplicate terminal serials are not allowed in one service job.
                </div>
              )}
            </>
          )}

          {type === "Installation" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Terminal lines</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>required · one line per installation device</div>
                </div>
                <Btn variant="ghost" sm icon="plus" onClick={addInstallationTerminalRow}>Add Line</Btn>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {installationTerminals.map((row, index) => {
                  

                  console.log("Jello")
                  console.log(row)
                  const duplicateTid = !!row.terminal_tid_id && installationTerminals.some((other, otherIndex) =>
                    otherIndex !== index && other.terminal_tid_id === row.terminal_tid_id
                  );
                  const rowTid = merchantTids.find((tid) => tid.id === row.terminal_tid_id);
                  const rowMidLoading = !!row.terminal_tid_id && midLoadingTidIds.includes(row.terminal_tid_id);
                  const rowMids = rowTid?.mids ?? [];
                  const selectedMid = rowMids.find((m) => m.id === row.terminal_tid_mid_id);
                  const mdrLabel = selectedMid?.mdr_rate
                    ? `${selectedMid.mdr_rate.id} · ${selectedMid.mdr_rate.type} ${selectedMid.mdr_rate.rate}%`
                    : row.mdr_rate_id || "—";
                  return (
                    <div key={row.rowId} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>Terminal {index + 1}</div>
                        {installationTerminals.length > 1 && (
                          <Btn variant="ghost" sm icon="x" onClick={() => removeInstallationTerminalRow(index)}>Remove</Btn>
                        )}
                      </div>
                      <div className="field-row">
                        <Field label="Terminal setting" hint="model id">
                          <select
                            className="input"
                            value={row.terminal_setting_id}
                            onChange={(e) => setInstallationTerminalRow(index, { terminal_setting_id: e.target.value })}
                          >
                            <option value="">Select model…</option>
                            {termSettingsList.map((setting) => (
                              <option key={setting.id} value={setting.id}>
                                {setting.brand} {setting.model} · {setting.id}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="TID" hint={duplicateTid ? "duplicate selected" : "terminal_tids id"}>
                          <select
                            className="input"
                            value={row.terminal_tid_id}
                            onChange={(e) => selectInstallationTid(index, e.target.value)}
                            style={duplicateTid ? { borderColor: "var(--bad)" } : undefined}
                            disabled={merchantTidsLoading}
                          >
                            <option value="">{merchantTidsLoading ? "Loading TIDs…" : "Select TID…"}</option>
                            {merchantTids.map((tid) => (
                              <option key={tid.id} value={tid.id}>
                                {tid.tid} · {tid.id}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="field-row" style={{ marginBottom: 0 }}>
                        <Field label="MID" hint={!rowTid ? "select a TID first" : rowMidLoading ? "loading linked MIDs" : rowMids.length === 0 ? "no connected MIDs" : "linked to selected TID"}>
                          <select
                            className="input"
                            value={row.terminal_tid_mid_id}
                            onChange={(e) => selectInstallationMid(index, row.terminal_tid_id, e.target.value)}
                            disabled={!rowTid || rowMidLoading || rowMids.length === 0}
                          >
                            <option value="">{!rowTid ? "Select TID first…" : rowMidLoading ? "Loading MIDs…" : rowMids.length ? "Select MID…" : "No connected MIDs"}</option>
                            {rowMids.map((mid) => (
                              <option key={mid.id} value={mid.id}>
                                {mid.mid} · {mid.id}{mid.status ? ` · ${mid.status}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="MDR" hint="derived from MID">
                          <input className="input" value={mdrLabel} disabled readOnly />
                        </Field>
                      </div>
                      {rowTid && (
                        <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-2, #f5f5f5)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                              {rowMids.length ? `${rowMids.length} MID${rowMids.length === 1 ? "" : "s"} connected to this TID.` : "No MID is connected to this TID yet."}
                            </span>
                            <Btn variant="ghost" sm icon="plus" disabled={rowMidLoading} onClick={() => setMidModal({ tidId: rowTid.id, rowIndex: index })}>Add MID</Btn>
                          </div>
                          {rowMids.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                              {rowMids.map((mid) => {
                                const selected = mid.id === row.terminal_tid_mid_id;
                                const midMdrLabel = mid.mdr_rate
                                  ? `${mid.mdr_rate.id} · ${mid.mdr_rate.type} ${mid.mdr_rate.rate}%`
                                  : mid.mdr_rate_id || "No MDR rate";
                                return (
                                  <div key={mid.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 8px", border: selected ? "1px solid var(--green-500)" : "1px solid var(--line)", borderRadius: 7, background: "var(--surface)" }}>
                                    <button
                                      type="button"
                                      onClick={() => selectInstallationMid(index, rowTid.id, mid.id)}
                                      style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", flex: 1, minWidth: 0 }}
                                    >
                                      <span className="mono" style={{ display: "block", fontWeight: 700 }}>{mid.mid} · {mid.id}</span>
                                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 3, fontSize: 12, color: "var(--ink-3)" }}>
                                        <span>{midMdrLabel}</span>
                                        {mid.status && <Chip cls={isActiveMid(mid) ? "chip-ok" : "chip-neutral"} dot>{mid.status}</Chip>}
                                        {selected && <Chip cls="chip-ok">Selected</Chip>}
                                      </span>
                                    </button>
                                    <Btn variant="ghost" sm icon="edit" disabled={rowMidLoading} onClick={() => setMidModal({ tidId: rowTid.id, midId: mid.id, rowIndex: index })}>Edit</Btn>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!merchantTidsLoading && selectedMerchant && merchantTids.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--warn)", marginTop: -6, marginBottom: 14 }}>
                  This merchant has no linked TIDs available for installation.
                </div>
              )}

              {hasDuplicateInstallationTids && (
                <div style={{ fontSize: 12.5, color: "var(--bad)", marginTop: -6, marginBottom: 14 }}>
                  Duplicate TID ids are not allowed in one installation request.
                </div>
              )}
            </>
          )}

          {type === "Paper Roll Request" && (
            <>
              <div className="field-row">
                <Field label="Paper roll quantity" hint="required">
                  <input className="input" type="number" min="1" value={form.paperRollQty} onChange={(e) => set("paperRollQty", e.target.value)} />
                </Field>
                <Field label="Pay by">
                  <select className="input" value={form.paymentTarget} onChange={(e) => set("paymentTarget", e.target.value)}>
                    {["Merchant", "Bank"].map((opt) => <option key={opt}>{opt}</option>)}
                  </select>
                </Field>
                <Field label="Invoice required">
                  <select className="input" value={form.invoiceRequired} onChange={(e) => set("invoiceRequired", e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </Field>
              </div>
              <div className="field-row">
                <Field label="Invoice party">
                  <input className="input" placeholder="e.g. merchant name or bank…" value={form.invoiceParty} onChange={(e) => set("invoiceParty", e.target.value)} />
                </Field>
                <Field label="Invoice status">
                  <input className="input" placeholder="e.g. Pending, Issued…" value={form.invoiceStatus} onChange={(e) => set("invoiceStatus", e.target.value)} />
                </Field>
              </div>
              <div className="field-row">
                <Field label="Accounting handling">
                  <input className="input" placeholder="e.g. Billable, Internal…" value={form.accountingHandling} onChange={(e) => set("accountingHandling", e.target.value)} />
                </Field>
                <Field label="Billing reference">
                  <input className="input" placeholder="PO number or reference…" value={form.billingReference} onChange={(e) => set("billingReference", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          <div className="field-row">
            <Field label="Assigned to" hint="required">
              <select className="input" value={form.assignee} onChange={(e) => set("assignee", e.target.value)}>
                <option value="">Select assignee…</option>
                {adminUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
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

          {err && <div style={{ marginTop: 8, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
        </div>
      )}
      </Modal>
      {midModal && midModalTid && selectedMerchant && (
        <JobTidMidModal
          tid={midModalTid}
          merchantName={selectedMerchant.name}
          existing={midModalExisting}
          onClose={() => setMidModal(null)}
          onSaved={handleInstallationMidSaved}
        />
      )}
    </>
  );
}

/* =================== JOBS LISTING =================== */

const JOBS_PAGE_SIZE = 20;

export function Jobs({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [jobList, setJobList] = useState<JobOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [sla, setSla] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.jobs.list({
      page,
      per_page: JOBS_PAGE_SIZE,
      query: q || undefined,
      type: type !== "All" ? type : undefined,
      status: status !== "All" ? status : undefined,
      sla: sla !== "All" ? sla : undefined,
    })
      .then((p) => {
        setJobList(p.items);
        setPages(p.pages);
        setTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, type, status, sla]);

  function resetPage() { setPage(1); }

  function handleCreate(job: JobOut) {
    setJobList((prev) => [job, ...prev]);
    setTotal((prev) => prev + 1);
    setShowCreate(false);
    setToast("Job " + job.id + " created");
    setTimeout(() => { setToast(null); nav("job-detail", job.id); }, 1000);
  }

  return (
    <div>
      <PageHead
        title="Jobs"
        sub={total + " workflow jobs · SLA tracking, notifications and downstream actions"}
        actions={<>
          {can("Jobs.Export") && <Btn variant="ghost" icon="download">Export</Btn>}
          {can("Jobs.Create") && <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Job</Btn>}
        </>}
      />

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={(v) => { setQ(v); resetPage(); }} placeholder="Search job ID, customer, merchant, assignee…" />
          <select className="select" value={type} onChange={(e) => { setType(e.target.value); resetPage(); }}>
            {["All", ...Object.keys(JOB_TYPES)].map((option) => <option key={option} value={option}>{option === "All" ? "All Types" : option}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All", "Pending", "Device Prepared", "Device Returned", "Stock Prepared", "Job Done", "Completed"].map((option) => <option key={option} value={option}>{option === "All" ? "All Statuses" : option}</option>)}
          </select>
          <select className="select" value={sla} onChange={(e) => { setSla(e.target.value); resetPage(); }}>
            {["All", "On Track", "Due Soon", "Breached", "Met"].map((option) => <option key={option} value={option}>{option === "All" ? "All SLA" : option}</option>)}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} jobs`}</span>
        </Toolbar>

        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : jobList.length === 0 ? <Empty icon="jobs" title="No jobs match" /> : (
          <ResponsiveTable
            rows={jobList}
            getKey={(job) => job.id}
            onRowClick={(job) => nav("job-detail", job.id)}
            columns={[
              { key: "id", header: "Job ID", render: (job) => <span className="td-mono td-strong">{job.id}</span> },
              { key: "type", header: "Type", render: (job) => <span style={{ display: "flex", gap: 7, alignItems: "center" }}><span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--bg)", display: "grid", placeItems: "center", color: "var(--slate)", flexShrink: 0 }}><Icon name={JOB_TYPES[job.type]?.icon ?? "jobs"} size={14} /></span>{job.type}</span> },
              { key: "merchant", header: "Customer / Merchant", mobileLabel: "Merchant", render: (job) => <div className="cell-2"><span className="td-strong">{job.customer?.name || "—"}</span><span className="c2-sub">{job.merchant.name}</span></div> },
              { key: "status", header: "Status", render: (job) => <JobStatus status={job.stage} /> },
              { key: "sla", header: "SLA", render: (job) => <SlaChip sla={job.sla} /> },
              { key: "assignee", header: "Assignee", render: (job) => <span className="td-mut">{job.assignee}</span> },
              { key: "due", header: "Due", render: (job) => <span className="td-mut td-mono">{job.due_date.slice(5)}</span> },
            ]}
            renderMobile={(job) => (
              <MobileListItem
                title={<span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--bg)", display: "grid", placeItems: "center", color: "var(--slate)", flexShrink: 0 }}><Icon name={JOB_TYPES[job.type]?.icon ?? "jobs"} size={14} /></span>{job.type}</span>}
                sub={<>{job.merchant.name} · <span className="td-mono">{job.id}</span></>}
                status={<JobStatus status={job.stage} />}
                meta={[
                  { label: "SLA", value: <SlaChip sla={job.sla} /> },
                  { label: "Assignee", value: job.assignee },
                  { label: "Due", value: <span className="td-mono">{job.due_date.slice(5)}</span> },
                  { label: "Customer", value: job.customer?.name || "—" },
                ]}
                onClick={() => nav("job-detail", job.id)}
                chevron
              />
            )}
          />
        )}

        <Pagination total={total} shown={jobList.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>

      {showCreate && can("Jobs.Create") && <CreateJobModal onClose={() => setShowCreate(false)} onCreate={handleCreate} nav={nav} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== SWAP DEVICE MODAL =================== */
function SwapDeviceModal({ job, onClose, onSwap }: {
  job: JobOut;
  onClose: () => void;
  onSwap: (serial: string) => void;
}) {
  const [terminals, setTerminals] = useState<TerminalOut[]>([]);
  const [spec, setSpec] = useState<TermSettingOut | null>(null);
  const [selected, setSelected] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (job.term_setting?.id) {
      api.termSettings.get(job.term_setting.id).then(setSpec).catch(console.error);
    }
  }, [job.term_setting?.id]);

  useEffect(() => {
    api.terminals.list({ query: q || undefined }).then((page) => setTerminals(page.items)).catch(console.error);
  }, [q]);

  const currentSerial = job.terminal?.serial || "";
  const available = terminals.filter(
    (t) => (t.status === "In Stock" || t.status === "Reserved") && terminalSerial(t) !== currentSerial
  );
  const matching = spec ? available.filter((t) => t.brand === spec.brand && t.model === spec.model) : [];
  const matchingSerials = new Set(matching.map((t) => terminalSerial(t)));
  const others = available.filter((t) => !matchingSerials.has(terminalSerial(t)));

  function renderDevice(t: TerminalOut) {
    const sel = selected === terminalSerial(t);
    return (
      <label key={terminalSerial(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
        <input type="radio" name="swap-terminal" checked={sel} onChange={() => setSelected(terminalSerial(t))} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.brand} {t.model}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{terminalSerial(t)} · {t.location}</div>
        </div>
        <Chip cls={t.status === "In Stock" ? "chip-ok" : "chip-neutral"}>{t.status}</Chip>
      </label>
    );
  }

  return (
    <Modal
      title="Swap Device" sub="Select a replacement terminal from available inventory" icon="swap"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="swap" disabled={!selected} onClick={() => onSwap(selected)}>
          Swap Device
        </Btn>
      </>}
    >
      {spec && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", background: "var(--info-bg)", borderRadius: 9, marginBottom: 16, fontSize: 12.5 }}>
          <Icon name="terminal" size={15} style={{ color: "var(--info)" }} />
          <span>Requested spec: <strong>{spec.brand} {spec.model}</strong> · {spec.category}</span>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search serial, brand, model…" fullWidth />
      </div>

      {available.length === 0 ? (
        <Empty icon="terminal" title="No devices available" sub={q ? "No devices match your search" : "All terminals are deployed or under maintenance"} />
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

/* =================== ASSIGN DEVICE MODAL =================== */
function AssignDeviceModal({ job, onClose, onAssign, initialJobTerminalId = null }: {
  job: JobOut;
  onClose: () => void;
  onAssign: (serial: string, jobTerminalId?: string | null) => void;
  initialJobTerminalId?: string | null;
}) {
  const router = useRouter();
  const can = useCan();
  const jobTerminals = job.job_terminals ?? [];
  const [terminals, setTerminals] = useState<TerminalOut[]>([]);
  const [spec, setSpec] = useState<TermSettingOut | null>(null);
  const [selectedJobTerminalId, setSelectedJobTerminalId] = useState(
    initialJobTerminalId ?? (jobTerminals.length === 1 ? jobTerminals[0].id : "")
  );
  const [selected, setSelected] = useState(job.terminal?.serial || "");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (job.term_setting?.id) {
      api.termSettings.get(job.term_setting.id).then(setSpec).catch(console.error);
    }
  }, [job.term_setting?.id]);

  useEffect(() => {
    api.terminals.list({ status: "In Stock", query: q || undefined }).then((page) => setTerminals(page.items)).catch(console.error);
  }, [q]);

  const selectedJobTerminal = jobTerminals.find((terminal) => terminal.id === selectedJobTerminalId) ?? null;
  const selectedRequestedSpec = selectedJobTerminal?.term_setting ?? spec;
  const targetSettingId = selectedJobTerminal?.terminal_setting_id ?? job.term_setting?.id ?? "";
  const matching = targetSettingId
    ? terminals.filter((t) => t.term_setting_id === targetSettingId)
    : spec ? terminals.filter((t) => t.brand === spec.brand && t.model === spec.model) : [];
  const matchingSerials = new Set(matching.map((t) => terminalSerial(t)));
  const others = terminals.filter((t) => !matchingSerials.has(terminalSerial(t)));
  const chosen = terminals.find((t) => terminalSerial(t) === selected) ?? null;
  const requestedSettingId = targetSettingId;
  const needsJobTerminalTarget = jobTerminals.length > 1;

  function addRequestedTerminal() {
    if (!requestedSettingId) return;
    router.push({
      pathname: "/terminals",
      query: { register: "1", term_setting_id: requestedSettingId },
    });
  }

  function renderDevice(t: TerminalOut) {
    const sel = selected === terminalSerial(t);
    return (
      <label key={terminalSerial(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
        <input type="radio" name="assign-terminal" checked={sel} onChange={() => setSelected(terminalSerial(t))} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.brand} {t.model}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{terminalSerial(t)} · {t.location}</div>
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
        <Btn
          variant="primary"
          icon="check"
          disabled={!chosen || (needsJobTerminalTarget && !selectedJobTerminalId)}
          onClick={() => chosen && onAssign(terminalSerial(chosen), selectedJobTerminalId || undefined)}
        >
          Assign Device
        </Btn>
      </>}
    >
      <div style={{display: "flex", gap: 10, marginBottom: 10}}>
        {can("Terminals.Create") && <Btn variant="ghost" icon="plus" onClick={() => router.push("/terminals")}>Add New Terminal</Btn>}
        {can("Terminals.Create") && <Btn variant="ghost" icon="terminal" disabled={!requestedSettingId} onClick={addRequestedTerminal}>Add Requested Terminal</Btn>}
      </div>

      {jobTerminals.length > 0 && (
        <Field label="Job device line" hint="selected">
          <div className="input" style={{ display: "flex", flexDirection: "column", justifyContent: "center", background: "var(--bg-2, #f5f5f5)" }}>
            {selectedJobTerminal ? (
              <>
                <span style={{ fontWeight: 600 }}>
                  {(jobTerminals.findIndex((terminal) => terminal.id === selectedJobTerminal.id) + 1) || 1}.{" "}
                  {selectedJobTerminal.term_setting?.brand ?? "Terminal"} {selectedJobTerminal.term_setting?.model ?? selectedJobTerminal.terminal_setting_id ?? ""}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {selectedJobTerminal.service_terminal_serial
                    ? `Service terminal ${selectedJobTerminal.service_terminal_serial}`
                    : selectedJobTerminal.tid?.tid
                      ? `TID ${selectedJobTerminal.tid.tid}`
                      : selectedJobTerminal.terminal_tid_id || "No linked service terminal"}
                  {(() => {
                    const mid = selectedJobTerminal.mid || selectedJobTerminal.tid?.mids?.[0]?.mid;
                    return mid ? ` · MID ${mid}` : "";
                  })()}
                </span>
              </>
            ) : (
              <span style={{ color: "var(--ink-3)" }}>No job device line selected</span>
            )}
          </div>
        </Field>
      )}

      {selectedRequestedSpec && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", background: "var(--info-bg)", borderRadius: 9, marginBottom: 16, fontSize: 12.5 }}>
          <Icon name="terminal" size={15} style={{ color: "var(--info)" }} />
          <span>Requested spec: <strong>{selectedRequestedSpec.brand} {selectedRequestedSpec.model}</strong> · {selectedRequestedSpec.category}</span>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search serial, brand, model…" fullWidth />
      </div>

      {terminals.length === 0 ? (
        <Empty icon="terminal" title="No devices in stock" sub={q ? "No devices match your search" : "All terminals are currently deployed or under maintenance"} />
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

/* =================== ESCALATE TO REPLACEMENT MODAL =================== */
function EscalateToReplacementModal({ job, onClose, onEscalate }: {
  job: JobOut;
  onClose: () => void;
  onEscalate: (replacementJobId: string) => void;
}) {
  const [selectedTermSetting, setSelectedTermSetting] = useState<TermSettingOut | null>(null);
  const [termSettingsList, setTermSettingsList] = useState<TermSettingOut[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserOut[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    due_date: "",
    assignee: "",
    priority: "Normal",
    service_terminal_serial: job.terminal?.serial ?? "",
    escalation_reason: "",
    notes: "",
  });

  useEffect(() => {
    api.termSettings.list({ active: true }).then(setTermSettingsList).catch(console.error);
    api.users.list({ role: "Operations", per_page: 100 }).then((p) => setAdminUsers(p.items)).catch(console.error);
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = !!(selectedTermSetting && form.due_date && form.escalation_reason.trim());

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    const body: EscalateToReplacementBody = {
      term_setting_id: selectedTermSetting!.id,
      due_date: form.due_date,
      assignee: form.assignee || undefined,
      priority: form.priority || undefined,
      service_terminal_serial: form.service_terminal_serial || undefined,
      escalation_reason: form.escalation_reason.trim(),
      notes: form.notes || undefined,
    };
    try {
      const result = await api.jobs.escalateToReplacement(job.id, body);
      onEscalate(result.replacement_job.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to escalate job");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Escalate to Replacement"
      sub={job.id + " · " + job.type}
      icon="swap"
      size="wide"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="swap" disabled={!valid || saving} onClick={submit}>
          {saving ? "Escalating…" : "Escalate to Replacement"}
        </Btn>
      </>}
    >
      <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", background: "var(--warn-bg)", borderRadius: 9, marginBottom: 18, fontSize: 12.5 }}>
        <Icon name="activity" size={15} style={{ color: "var(--warn)" }} />
        <span>A new Replacement job will be created and linked to this repair. This job will be marked as escalated.</span>
      </div>

      <EntitySearchSelect<TermSettingOut>
        label="Replacement terminal model"
        hint="required · warehouse assigns the actual unit"
        placeholder="Search brand or model…"
        value={selectedTermSetting}
        onSelect={setSelectedTermSetting}
        fetchResults={(query) => Promise.resolve(
          termSettingsList.filter((t) => (t.brand + " " + t.model).toLowerCase().includes(query.toLowerCase()))
        )}
        getLabel={(t) => t.brand + " " + t.model}
        renderOption={(t) => (
          <div className="cell-2">
            <span className="td-strong">{t.brand} {t.model}</span>
            <span className="c2-sub">{t.category} · RM {t.monthly_rental}/mo</span>
          </div>
        )}
      />

      <div className="field-row">
        <Field label="Assigned to">
          <select className="input" value={form.assignee} onChange={(e) => set("assignee", e.target.value)}>
            <option value="">Unassigned</option>
            {adminUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Due date" hint="required">
          <input className="input" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
      </div>

      <Field label="Device to replace" hint="auto-filled from current job">
        <input className="input" disabled value={form.service_terminal_serial} onChange={(e) => set("service_terminal_serial", e.target.value)} placeholder="Terminal serial number…" />
      </Field>

      <Field label="Escalation reason" hint="required">
        <textarea className="textarea" placeholder="Why is this repair being escalated to a replacement?" value={form.escalation_reason} onChange={(e) => set("escalation_reason", e.target.value)} />
      </Field>

      <Field label="Additional notes">
        <textarea className="textarea" placeholder="Any further instructions for the replacement job…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      {err && <div style={{ marginTop: 8, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
    </Modal>
  );
}

function TrackParcelModal({ job, onClose, onSaved }: {
  job: JobOut;
  onClose: () => void;
  onSaved: (job: JobOut) => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState(job.shipment_tracking?.tracking_number ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!trackingNumber.trim()) {
      setErr("Tracking number is required");
      return;
    }
    setSaving(true); setErr(null);
    try {
      const updated = await api.jobs.setParcel(job.id, trackingNumber.trim());
      onSaved(updated);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save tracking number");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={job.shipment_tracking ? "Change Tracking Number" : "Track Parcel"}
      sub={job.id + " · " + job.type}
      icon="truck"
      size="slim"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving || !trackingNumber.trim()} onClick={submit}>
          {saving ? "Saving…" : "Track Parcel"}
        </Btn>
      </>}
    >
      <Field label="Tracking number" hint="required">
        <input className="input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="EE123456789MY" />
      </Field>
      {err && <div style={{ marginTop: 8, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
    </Modal>
  );
}

/* =================== JOB DETAIL =================== */

export function JobDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const { rules } = useJobSla();
  const [job, setJob] = useState<JobOut | null>(null);
  const [requestedSpec, setRequestedSpec] = useState<TermSettingOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [files, setFiles] = useState<DropzoneFile[]>([]);
  const [transitionNote, setTransitionNote] = useState("");
  const [previousTerminalStatus, setPreviousTerminalStatus] = useState("Faulty");
  const [advancing, setAdvancing] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showAssignDevice, setShowAssignDevice] = useState(false);
  const [assignJobTerminalId, setAssignJobTerminalId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showTrackParcel, setShowTrackParcel] = useState(false);
  const [refreshingParcel, setRefreshingParcel] = useState(false);
  const [docBusy, setDocBusy] = useState<"form" | "do" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setDetailLoading(true);
    api.jobs.get(id)
      .then((j) => {
        setJob(j);
        if (j.term_setting?.id) {
          api.termSettings.get(j.term_setting.id).then(setRequestedSpec).catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [id]);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  if (detailLoading) return (
    <div>
      <div className="back-link" onClick={() => nav("jobs")}><Icon name="arrowLeft" size={16} /> Back to Jobs</div>
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>Loading…</div>
    </div>
  );

  if (!job) return (
    <div>
      <PageHead title="Job not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("jobs")}>Back</Btn>} />
      <Empty icon="jobs" title="Job not found" sub={"No job with ID " + id} />
    </div>
  );

  const def = JOB_TYPES[job.type] ?? { stages: [], icon: "jobs", exportable: false };
  const stages = job.stage_sequence?.length ? job.stage_sequence : def.stages;
  const sequenceIndex = stages.indexOf(job.stage);
  const currentIndex = sequenceIndex >= 0 ? sequenceIndex : job.stage_index;
  const currentSla = currentJobSla(job, rules);
  const nextStage = stages[currentIndex + 1] || null;
  const done = job.stage === "Completed";
  const activeHistory = job.history[job.history.length - 1];
  const activeRule = nextStage ? findRule(rules, job.type, activeHistory?.stage ?? "", nextStage) : null;
  const activeElapsedDays = nextStage && activeHistory ? daysBetween(activeHistory.at, stampNow()) : 0;
  const evidenceStages = Object.entries(job.evidence_by_stage ?? {}).filter(([, evidence]) => evidence.length > 0);
  const jobTerminals = job.job_terminals ?? [];
  const hasJobTerminals = jobTerminals.length > 0;
  const allJobTerminalsAssigned = hasJobTerminals && jobTerminals.every((terminal) =>
    Boolean(terminal.terminal_serial || terminal.terminal?.serial || terminal.terminal?.serial_no)
  );
  const hasPreparedDevice = hasJobTerminals ? allJobTerminalsAssigned : Boolean(job.terminal);
  const devicePreparationBlocked = ["Installation", "Replacement"].includes(job.type) && nextStage === "Device Prepared" && !hasPreparedDevice;
  const jobTerminalAssignmentRequired = job.type === "Installation" || job.type === "Replacement";
  const deviceReturnedIdx = stages.indexOf("Device Returned");
  const parcelTrackingStage = deviceReturnedIdx > 0 ? stages[deviceReturnedIdx - 1] : null;
  const showTrackParcelAction = parcelTrackingStage !== null && job.stage === parcelTrackingStage && !done;
  const jobTerminalCardTitle =
    job.type === "Installation" ? "Installation Devices"
      : job.type === "Replacement" ? "Replacement Devices"
        : job.type === "Retrieval" ? "Retrieval Devices"
        : "Service Terminals";

  const historyRows = job.history.map((entry, index) => {
    if (index === 0) return { entry, durationDays: null as number | null, transitionSla: "On Track" };
    const previous = job.history[index - 1];
    const elapsedDays = daysBetween(previous.at, entry.at);
    const rule = findRule(rules, job.type, previous.stage, entry.stage);
    return { entry, durationDays: elapsedDays, transitionSla: elapsedToSla(elapsedDays, rule, true) };
  });

  async function openAdvance() {
    if (!nextStage) return;
    if (!can(nextStage === "Completed" ? "Jobs.Close" : "Jobs.Edit")) return;
    if (transitionNeedsEvidence(job!.type, nextStage) || (job!.type === "Replacement" && nextStage === "Completed")) {
      setPendingStage(nextStage);
      return;
    }
    setAdvancing(true);
    try {
      const updated = await api.jobs.advance(job!.id, {});
      setJob(updated);
      flash(nextStage + " recorded");
    } catch {
      flash("Failed to advance job");
    } finally {
      setAdvancing(false);
    }
  }

  async function refreshParcel() {
    if (!job || !can("Jobs.Edit")) return;
    setRefreshingParcel(true);
    try {
      const updated = await api.jobs.refreshParcel(job.id);
      setJob(updated);
      flash("Tracking info refreshed");
    } catch {
      flash("Failed to refresh tracking");
    } finally {
      setRefreshingParcel(false);
    }
  }

  function openDocument(blob: Blob) {
    if (typeof window === "undefined") return;
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }

  async function downloadInstallationForm() {
    if (!job || !can("Jobs.Export")) return;
    setDocBusy("form");
    try {
      const blob = await api.jobs.installationForm(job.id);
      openDocument(blob);
    } catch {
      flash("Failed to generate installation form");
    } finally {
      setDocBusy(null);
    }
  }

  async function downloadDeliveryOrder() {
    if (!job || !can("Jobs.Export")) return;
    setDocBusy("do");
    try {
      const blob = await api.jobs.deliveryOrder(job.id);
      openDocument(blob);
    } catch {
      flash("Failed to generate delivery order");
    } finally {
      setDocBusy(null);
    }
  }

  async function confirmPendingStage() {
    if (!pendingStage || !job) return;
    if (!can(pendingStage === "Completed" ? "Jobs.Close" : "Jobs.Edit")) return;
    const evidenceRequired = transitionNeedsEvidence(job.type, pendingStage);
    if (evidenceRequired && files.length === 0) return;
    setAdvancing(true);
    try {
      const updated = await api.jobs.advance(job.id, {
        note: transitionNote.trim() || undefined,
        previous_terminal_status:
          job.type === "Replacement" && pendingStage === "Completed" ? previousTerminalStatus : undefined,
        proof: files.map((entry) => entry.file),
      });
      setJob(updated);
      setPendingStage(null);
      setFiles([]);
      setTransitionNote("");
      flash(pendingStage + " recorded");
    } catch {
      flash("Failed to advance job");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAssignDevice(serial: string, jobTerminalId?: string | null) {
    if (!job) return;
    if (!can("Jobs.Edit")) return;
    try {
      const updated = await api.jobs.assignDevice(job.id, serial, jobTerminalId);
      setJob(updated);
      setShowAssignDevice(false);
      setAssignJobTerminalId(null);
      flash("Device " + serial + " assigned to " + job.id);
    } catch {
      flash("Failed to assign device");
    }
  }

  function openAssignDevice(jobTerminalId?: string | null) {
    setAssignJobTerminalId(jobTerminalId ?? null);
    setShowAssignDevice(true);
  }

  async function handleSwapDevice(serial: string) {
    if (!job) return;
    if (!can("Jobs.Edit")) return;
    try {
      const updated = await api.jobs.assignDevice(job.id, serial);
      setJob(updated);
      setShowSwap(false);
      flash("Device swapped to " + serial);
    } catch {
      flash("Failed to swap device");
    }
  }

  const canAdvanceStage = !!nextStage && can(nextStage === "Completed" ? "Jobs.Close" : "Jobs.Edit");


  return (
    <div>
      <div className="back-link" onClick={() => nav("jobs")}><Icon name="arrowLeft" size={16} /> Back to Jobs</div>

      <div className="page-head job-detail-head">
        <div className="job-title-block" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--green-050)", color: "var(--green-700)", display: "grid", placeItems: "center" }}>
            <Icon name={def.icon} size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title mono">{job.id}</h1>
              <JobStatus status={job.stage} />
              <SlaChip sla={currentSla} />
            </div>
            <p className="page-sub">{job.type + " · " + job.merchant.name + " · due " + job.due_date}</p>
          </div>
        </div>
        <div className="page-head-actions">
          {can("Jobs.Escalate") && job.type === "Repair/Maintenance" && job.stage === "Pending" && !done && (
            <Btn variant="ghost" icon="swap" onClick={() => setShowEscalate(true)}>Escalate to Replacement</Btn>
          )}
          {can("Jobs.Edit") && showTrackParcelAction && (
            <Btn variant="ghost" icon="truck" onClick={() => setShowTrackParcel(true)}>
              {job.shipment_tracking ? "Change Tracking #" : "Track Parcel"}
            </Btn>
          )}
          {can("Jobs.Export") && job.print_form && (
            <Btn variant="ghost" icon="invoice" disabled={docBusy !== null} onClick={downloadInstallationForm}>
              {docBusy === "form" ? "Generating…" : "Installation Form"}
            </Btn>
          )}
          {can("Jobs.Export") && job.print_do && (
            <Btn variant="ghost" icon="file" disabled={docBusy !== null} onClick={downloadDeliveryOrder}>
              {docBusy === "do" ? "Generating…" : "Delivery Order"}
            </Btn>
          )}
          {can("Jobs.Export") && def.exportable && <Btn variant="ghost" icon="export" onClick={() => setShowExport(true)}>Export Details</Btn>}
          {can("Jobs.Edit") && <Btn variant="ghost" icon="edit">Edit</Btn>}
        </div>
      </div>

      <Card className="job-stepper-card">
        <div className="card-pad" style={{ paddingTop: 26, paddingBottom: 24 }}>
          <Stepper stages={stages} current={currentIndex} complete={done} />
        </div>
      </Card>

      <div className="job-current-stage" style={{ margin: "16px 0", padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, boxShadow: "var(--sh-sm)", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: done ? "var(--green-050)" : currentSla === "Breached" ? "var(--bad-bg)" : currentSla === "Due Soon" ? "var(--warn-bg)" : "var(--info-bg)", color: done ? "var(--green-700)" : currentSla === "Breached" ? "var(--bad)" : currentSla === "Due Soon" ? "var(--warn)" : "var(--info)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={done ? "checkCircle" : "activity"} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{done ? "This job is complete" : "Current stage: " + (activeHistory?.stage ?? job.stage)}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {done
              ? "Workflow finished with evidence and notifications logged."
              : devicePreparationBlocked
                ? "Assign a device from inventory before advancing to Device Prepared."
                : nextStage && activeRule
                  ? `${activeElapsedDays} day(s) elapsed · warning after ${activeRule.warningDays} day(s), breach after ${activeRule.breachDays} day(s).`
                  : "Advance this job when the next team has completed its work."}
          </div>
        </div>
        {!done && nextStage && canAdvanceStage && (
          <Btn
            variant="primary"
            iconRight={transitionNeedsEvidence(job.type, nextStage) ? "upload" : "chevRight"}
            disabled={advancing || devicePreparationBlocked}
            onClick={openAdvance}
          >
            {advancing ? "Saving…" : transitionNeedsEvidence(job.type, nextStage) ? "Record " + nextStage : "Advance to " + nextStage}
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
                    <div className="tl-time">{formatDateTime(entry.at)}</div>
                    <div className="tl-title">{entry.stage} · {entry.actor_role}</div>
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

          {hasJobTerminals && (
            <Card title={jobTerminalCardTitle} icon="terminal">
              <div className="card-pad">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {jobTerminals.map((terminal, index) => {
                    const assignedSerial = terminal.terminal_serial || terminal.terminal?.serial || terminal.terminal?.serial_no || "";
                    const serviceSerial = terminal.service_terminal_serial || terminal.service_terminal?.serial || terminal.service_terminal?.serial_no || "";
                    const rowNeedsAssignment = jobTerminalAssignmentRequired;
                    const tidMids = terminal.tid?.mids ?? [];

                    return (
                      <div key={terminal.id} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {job.type === "Replacement" ? `Replacement ${index + 1}` : job.type === "Installation" ? `Terminal ${index + 1}` : job.type === "Retrieval" ? `Retrieval ${index + 1}` : `Service terminal ${index + 1}`}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                              {job.type !== "Installation" && serviceSerial
                                ? `${serviceSerial} · ${terminal.service_terminal?.brand ?? ""} ${terminal.service_terminal?.model ?? ""}`.trim()
                                : terminal.term_setting
                                ? `${terminal.term_setting.brand} ${terminal.term_setting.model} · ${terminal.term_setting.category}`
                                : terminal.terminal_setting_id}
                            </div>
                          </div>
                          <Chip cls={rowNeedsAssignment ? assignedSerial ? "chip-ok" : "chip-warn" : "chip-neutral"}>
                            {rowNeedsAssignment ? assignedSerial ? "Assigned" : "Pending" : "Selected"}
                          </Chip>
                        </div>
                        <dl className="kv" style={{ gridTemplateColumns: "88px 1fr", margin: 0 }}>
                          {serviceSerial && (<><dt>Old serial</dt><dd className="mono">{serviceSerial}</dd></>)}
                          {job.type === "Replacement" && terminal.term_setting && (
                            <><dt>Requested</dt><dd>{terminal.term_setting.brand} {terminal.term_setting.model}</dd></>
                          )}
                          {terminal.terminal_setting_id && (<><dt>Brand & Model</dt><dd className="mono">{terminal.term_setting?.brand} {terminal.term_setting?.model}</dd></>)}
                          {job.type === "Installation" && (<>
                            <dt>TID</dt><dd className="mono">{terminal.tid?.tid || terminal.terminal_tid_id || "—"}</dd>
                            <dt>MIDs</dt>
                            <dd>
                              {tidMids.length ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {tidMids.map((mid) => {
                                    const mdrLabel = mid.mdr_rate
                                      ? `${mid.mdr_rate.id} · ${mid.mdr_rate.type} ${mid.mdr_rate.rate}%`
                                      : mid.mdr_rate_id || "No MDR";
                                    return (
                                      <div key={mid.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)" }}>
                                        <div style={{ minWidth: 0 }}>
                                          <div className="mono" style={{ fontWeight: 700 }}>{mid.mid}</div>
                                          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{mdrLabel}</div>
                                        </div>
                                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                                          {mid.status && <Chip cls={mid.status === "Active" ? "chip-ok" : "chip-neutral"} dot>{mid.status}</Chip>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="mono">{terminal.mid || "—"}</span>
                              )}
                            </dd>
                          </>)}
                          {rowNeedsAssignment && (<><dt>{job.type === "Replacement" ? "New serial" : "Serial"}</dt><dd className="mono">{assignedSerial || "—"}</dd></>)}
                          {terminal.previous_terminal_status && (<><dt>Old status</dt><dd>{terminal.previous_terminal_status}</dd></>)}
                        </dl>
                        {assignedSerial ? (
                          <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%", marginTop: 10 }} onClick={() => nav("terminal-detail", assignedSerial)}>View device</Btn>
                        ) : rowNeedsAssignment && can("Jobs.Edit") && !done ? (
                          <Btn variant="ghost" sm icon="terminal" style={{ width: "100%", marginTop: 10 }} onClick={() => openAssignDevice(terminal.id)}>
                            Assign Device
                          </Btn>
                        ) : serviceSerial ? (
                          <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%", marginTop: 10 }} onClick={() => nav("terminal-detail", serviceSerial)}>View service terminal</Btn>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          <Card title="Evidence & Notes" icon="file">
            <div className="card-pad">
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{job.notes}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {evidenceStages.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No evidence uploaded yet.</div>
                ) : (
                  evidenceStages.map(([stage, evidence]) => (
                    <div key={stage} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{stage}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {evidence.map((file) => {
                          const href = evidenceUrl(file.path);
                          const isImage = evidenceIsImage(file);
                          return (
                            <div
                              key={file.id}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                                padding: "12px",
                                border: "1px solid var(--line)",
                                borderRadius: 12,
                                background: "var(--bg-2, #f7f7f7)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--line)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                                      <Icon name={isImage ? "image" : "file"} size={15} />
                                    </span>
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: "var(--ink-1)", fontWeight: 600, fontSize: 13, textDecoration: "none", wordBreak: "break-word" }}
                                    >
                                      {evidenceFilename(file)}
                                    </a>
                                  </div>
                                  <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                                    Uploaded by {file.uploaded_by} · {formatDateTime(file.uploaded_at)}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-1)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}
                                  >
                                    <Icon name="link" size={13} />
                                    Open
                                  </a>
                                  <a
                                    href={href}
                                    download
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-1)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}
                                  >
                                    <Icon name="download" size={13} />
                                    Download
                                  </a>
                                </div>
                              </div>
                              {isImage && (
                                <iframe
                                  title={file.filename}
                                  src={href}
                                  style={{ width: "100%", height: 240, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}
                                />
                              )}
                            </div>
                          );
                        })}
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
                <dt>Created by</dt><dd>{job.created_by_role} · {job.created_by_name}</dd>
                <dt>Priority</dt><dd><Chip cls={job.priority === "Urgent" ? "chip-bad" : job.priority === "High" ? "chip-warn" : "chip-neutral"}>{job.priority}</Chip></dd>
                <dt>Assignee</dt><dd>{job.assignee}</dd>
                <dt>Created</dt><dd className="mono">{formatDateTime(job.created_at)}</dd>
                <dt>Due</dt><dd className="mono">{job.due_date}</dd>
                {job.escalation_reason && (<><dt>Escalation reason</dt><dd>{job.escalation_reason}</dd></>)}
                {job.paper_roll_request && (<>
                  <dt>Paper rolls</dt><dd>{job.paper_roll_request.quantity} rolls · pay to {job.paper_roll_request.payment_target}</dd>
                  {job.paper_roll_request.invoice_party && (<><dt>Invoice party</dt><dd>{job.paper_roll_request.invoice_party}</dd></>)}
                  {job.paper_roll_request.invoice_required !== null && (<><dt>Invoice req.</dt><dd>{job.paper_roll_request.invoice_required ? "Yes" : "No"}</dd></>)}
                  {job.paper_roll_request.invoice_status && (<><dt>Invoice status</dt><dd>{job.paper_roll_request.invoice_status}</dd></>)}
                  {job.paper_roll_request.accounting_handling && (<><dt>Accounting</dt><dd>{job.paper_roll_request.accounting_handling}</dd></>)}
                  {job.paper_roll_request.billing_reference && (<><dt>Billing ref.</dt><dd className="mono">{job.paper_roll_request.billing_reference}</dd></>)}
                </>)}
              </dl>
            </div>
          </Card>

          {job.shipment_tracking && (
            <Card
              title="Shipment Tracking"
              icon="truck"
              actions={can("Jobs.Edit") ? (
                <Btn variant="ghost" sm icon="refresh" disabled={refreshingParcel} onClick={refreshParcel}>
                  {refreshingParcel ? "Refreshing…" : "Refresh status"}
                </Btn>
              ) : undefined}
            >
              <div className="card-pad">
                <dl className="kv" style={{ gridTemplateColumns: "128px 1fr" }}>
                  <dt>Tracking #</dt><dd className="mono">{job.shipment_tracking.tracking_number}</dd>
                  <dt>Carrier</dt><dd>{job.shipment_tracking.carrier}</dd>
                  <dt>Status</dt><dd>{job.shipment_tracking.status ? <Chip cls="chip-neutral" dot>{job.shipment_tracking.status}</Chip> : "—"}</dd>
                  {job.shipment_tracking.status_description && (<><dt>Details</dt><dd>{job.shipment_tracking.status_description}</dd></>)}
                  <dt>Last event</dt><dd className="mono">{job.shipment_tracking.last_event_at ? formatDateTime(job.shipment_tracking.last_event_at) : "—"}</dd>
                  <dt>Last checked</dt><dd className="mono">{job.shipment_tracking.last_checked_at ? formatDateTime(job.shipment_tracking.last_checked_at) : "—"}</dd>
                </dl>
              </div>
            </Card>
          )}

          <Card title="SLA Tracking" icon="clock">
            <div className="card-pad">
              {job.sla_leg ? (
                <dl className="kv" style={{ gridTemplateColumns: "128px 1fr" }}>
                  <dt>Current leg</dt><dd>{job.sla_leg.from_stage} → {job.sla_leg.to_stage}</dd>
                  <dt>Elapsed</dt><dd>{job.sla_leg.elapsed_days} day(s)</dd>
                  <dt>Warning</dt><dd>{job.sla_leg.warning_days} day(s)</dd>
                  <dt>Breach</dt><dd>{job.sla_leg.breach_days} day(s)</dd>
                  <dt>Flag</dt><dd><SlaChip sla={job.sla_leg.status} /></dd>
                </dl>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Workflow complete. All SLA legs are closed.</div>
              )}
            </div>
          </Card>

          <Card title="Customer & Merchant" icon="merchants">
            <div className="card-pad">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{job.customer?.name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 10 }}>{job.customer?.id || "No customer linked"}</div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{job.merchant.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>{job.merchant.id + " · " + job.bank}</div>
              <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%" }} onClick={() => nav("merchant-detail", job.merchant.id)}>View merchant</Btn>
            </div>
          </Card>

          {(!hasJobTerminals && (job.terminal || (["Installation", "Replacement"].includes(job.type) && !done))) && (
            <Card title={job.type === "Replacement" ? "Replacement Device" : "Device"} icon="terminal">
              <div className="card-pad">
                {requestedSpec && (
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 2 }}>Requested spec</div>
                    <div>{requestedSpec.brand} {requestedSpec.model} · {requestedSpec.category}</div>
                  </div>
                )}
                {job.terminal ? (
                  <>
                    <div className="mono" style={{ fontWeight: 600, marginBottom: 2 }}>{job.terminal.serial}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 12 }}>{job.terminal.brand + " " + job.terminal.model}</div>
                    <Btn variant="ghost" sm iconRight="chevRight" style={{ width: "100%" }} onClick={() => nav("terminal-detail", job.terminal!.serial)}>View device</Btn>
                    {can("Jobs.Edit") && !done && job.type == "Replacement/Maintenance" && (
                      <Btn variant="ghost" sm icon="swap" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowSwap(true)}>Swap Device</Btn>
                    )}
                    {job.previous_terminal && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>Previous rental device</div>
                        <div className="mono" style={{ fontWeight: 600 }}>{job.previous_terminal.serial}</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{job.previous_terminal.brand + " " + job.previous_terminal.model}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--warn)", marginBottom: 12 }}>
                      <Icon name="activity" size={14} />
                      No device assigned yet
                    </div>
                    {can("Jobs.Edit") && (
                      <Btn variant="ghost" sm icon="terminal" style={{ width: "100%" }} onClick={() => openAssignDevice()}>
                        Assign Device from Inventory
                      </Btn>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          <Card title="Email Notifications" icon="mail">
            <div className="card-pad">
              <div className="timeline">
                {job.notifications.map((notification, index) => (
                  <div className="tl-item" key={notification.at + notification.subject + index}>
                    <div className="tl-dot" />
                    <div className="tl-time">{formatDateTime(notification.at)}</div>
                    <div className="tl-title">{notification.subject}</div>
                    {/* <div className="tl-desc">Sent to {notification.to.join(", ")}</div> */}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {pendingStage && can(pendingStage === "Completed" ? "Jobs.Close" : "Jobs.Edit") && (
        <Modal
          title={"Record " + pendingStage}
          sub={job.id + " · " + job.type}
          icon={transitionNeedsEvidence(job.type, pendingStage) ? "upload" : "check"}
          size="slim"
          onClose={() => { setPendingStage(null); setFiles([]); setTransitionNote(""); }}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => { setPendingStage(null); setFiles([]); setTransitionNote(""); }}>Cancel</Btn>
            <Btn
              variant="primary" icon="check"
              disabled={advancing || (transitionNeedsEvidence(job.type, pendingStage) && files.length === 0)}
              onClick={confirmPendingStage}
            >
              {advancing ? "Saving…" : "Confirm"}
            </Btn>
          </>}
        >
          {job.type === "Replacement" && pendingStage === "Completed" && (
            <Field label="Previous terminal status" hint="required">
              <select className="input" value={previousTerminalStatus} onChange={(e) => setPreviousTerminalStatus(e.target.value)}>
                {REPLACEMENT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
          )}

          <Field label="Transition note">
            <textarea className="textarea" placeholder="Optional note for this status update…" value={transitionNote} onChange={(e) => setTransitionNote(e.target.value)} />
          </Field>

          {transitionNeedsEvidence(job.type, pendingStage) && (
            <Field label="Evidence / proof" hint="required">
              <Dropzone files={files} setFiles={setFiles} hint="Attach proof, forms, photos, or signed documents" />
            </Field>
          )}
        </Modal>
      )}

      {showExport && can("Jobs.Export") && (
        <Modal
          title="Export Job Details"
          sub={job.id + " · " + job.type}
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

      {showSwap && can("Jobs.Edit") && job.terminal && (
        <SwapDeviceModal
          job={job}
          onClose={() => setShowSwap(false)}
          onSwap={handleSwapDevice}
        />
      )}

      {showAssignDevice && can("Jobs.Edit") && (
        <AssignDeviceModal
          job={job}
          initialJobTerminalId={assignJobTerminalId}
          onClose={() => {
            setShowAssignDevice(false);
            setAssignJobTerminalId(null);
          }}
          onAssign={handleAssignDevice}
        />
      )}

      {showEscalate && can("Jobs.Escalate") && (
        <EscalateToReplacementModal
          job={job}
          onClose={() => setShowEscalate(false)}
          onEscalate={(replacementJobId) => {
            setShowEscalate(false);
            flash("Escalated — Replacement job " + replacementJobId + " created");
            setTimeout(() => nav("job-detail", replacementJobId), 1200);
          }}
        />
      )}

      {showTrackParcel && can("Jobs.Edit") && (
        <TrackParcelModal
          job={job}
          onClose={() => setShowTrackParcel(false)}
          onSaved={(updated) => {
            setJob(updated);
            flash("Tracking number saved");
          }}
        />
      )}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
