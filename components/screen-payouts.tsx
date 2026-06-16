/* PaidChain — Payout listing + upload + detail */
import { useState, useRef } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, PayoutStatus, Pagination, Empty, Chip, Modal, Field } from "./components";
import { customers, merchants, mdr, PAYOUT_METHODS, TXN_PAYMENT_METHODS } from "./data";
import type { Payout, Transaction, PayoutException } from "./data";
import { runPayoutChecks, checksPassedSummary, ALL_CHECKS } from "./payout-exceptions";
import { usePayouts } from "./payouts-context";
import { useTerminals } from "./terminals-context";
import { useRentals } from "./rentals-context";
import { NavFn } from "./shell";

const money = (n: number) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* =================== SHARED EXCEPTION UI =================== */
function ExceptionBadge({ exceptions }: { exceptions: PayoutException[] }) {
  const errors = exceptions.filter((e) => e.severity === "error").length;
  const warns  = exceptions.filter((e) => e.severity === "warning").length;
  if (errors > 0) return <Chip cls="chip-bad"><Icon name="x" size={12} />{errors} error{errors > 1 ? "s" : ""}{warns > 0 ? ` · ${warns} warn` : ""}</Chip>;
  if (warns  > 0) return <Chip cls="chip-warn"><Icon name="alert" size={12} />{warns} warning{warns > 1 ? "s" : ""}</Chip>;
  return <Chip cls="chip-ok"><Icon name="check" size={12} />All clear</Chip>;
}

function ExceptionChecksPanel({ exceptions }: { exceptions: PayoutException[] }) {
  const failedCodes = new Set(exceptions.map((e) => e.code));
  const errors = exceptions.filter((e) => e.severity === "error").length;
  const warns  = exceptions.filter((e) => e.severity === "warning").length;
  const summaryColor = errors > 0 ? "var(--bad)" : warns > 0 ? "var(--warn)" : "var(--ok)";
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "9px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Exception Checks</span>
        <span style={{ fontSize: 12, color: summaryColor, fontWeight: 600 }}>{checksPassedSummary(exceptions)}</span>
      </div>
      <div style={{ padding: "6px 0" }}>
        {ALL_CHECKS.map((check) => {
          const exc = exceptions.find((e) => e.code === check.code);
          const passed = !exc;
          const color = passed ? "var(--ok)" : exc.severity === "error" ? "var(--bad)" : "var(--warn)";
          return (
            <div key={check.code} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "5px 14px" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={passed ? "check" : exc.severity === "error" ? "x" : "alert"} size={9} style={{ color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: passed ? "var(--ink-2)" : "var(--ink-1)", fontWeight: passed ? 400 : 500 }}>{check.label}</div>
                {exc && <div style={{ fontSize: 11.5, color, marginTop: 1 }}>{exc.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =================== CREATE PAYOUT MODAL =================== */
interface CreatePayoutModalProps { onClose: () => void; onCreate: (p: Payout, txns: Transaction[]) => void }

function CreatePayoutModal({ onClose, onCreate }: CreatePayoutModalProps) {
  const { terminals } = useTerminals();
  const { rentals } = useRentals();
  const [step, setStep] = useState<1 | 2>(1);
  const [customerId, setCustomerId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [period, setPeriod] = useState("2026-05-16 – 31");
  const [paymentMethod, setPaymentMethod] = useState(PAYOUT_METHODS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [parsedTxns, setParsedTxns] = useState<{ id: string; amount: number; paymentMethod: string; date: string }[] | null>(null);
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const customer = customers.find((c) => c.id === customerId);
  const availableMerchants = customerId ? merchants.filter((m) => m.customerId === customerId) : [];
  const merchant = merchants.find((m) => m.id === merchantId);
  const canNext = !!customerId && !!merchantId;

  const gross = parsedTxns ? Math.round(parsedTxns.reduce((a, t) => a + t.amount, 0) * 100) / 100 : 0;
  const fee = Math.round(gross * 0.018 * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;

  const exceptions: PayoutException[] = parsedTxns && merchant
    ? runPayoutChecks({
        merchant, customer: customer || null,
        allTerminals: terminals, allRentals: rentals, allMdrRates: mdr,
        txnPaymentMethods: parsedTxns.map((t) => t.paymentMethod),
      })
    : [];
  const hasErrors = exceptions.some((e) => e.severity === "error");

  function handleFileDrop(files: FileList | null) {
    if (files?.[0]) { setFile(files[0]); setParsedTxns(null); }
  }

  function parseFile() {
    if (!file) return;
    const seed = file.name.split("").reduce((a, c) => a + c.charCodeAt(0), 42);
    const rng = (i: number, s = 0) => ((seed + s * 17) * 2654435761 + i * 1234567891) >>> 0;
    const count = 15 + (rng(1) % 20);
    const txns = Array.from({ length: count }, (_, i) => ({
      id: "TXN-" + (Date.now() + i),
      amount: Math.round((100 + rng(i, 2) % 900) * 100) / 100,
      paymentMethod: TXN_PAYMENT_METHODS[rng(i, 3) % TXN_PAYMENT_METHODS.length],
      date: period.split(" – ")[0] + String(1 + rng(i, 4) % 14).padStart(2, "0"),
    }));
    setParsedTxns(txns);
  }

  function submit() {
    if (!merchant || !parsedTxns) return;
    const poId = "PO-" + Math.floor(90300 + Math.random() * 400);
    const today = new Date().toISOString().slice(0, 10);
    const newTxns: Transaction[] = parsedTxns.map((t) => ({
      id: t.id, merchantName: merchant.name, amount: t.amount,
      paymentMethod: t.paymentMethod, date: t.date, payoutId: poId,
    }));
    const po: Payout = {
      id: poId, merchant: { id: merchant.id, name: merchant.name },
      mid: merchant.mid, bank: merchant.bank,
      gross, fee, net, txns: parsedTxns.length,
      period, status: "Pending",
      exceptions, checks: checksPassedSummary(exceptions),
      einvoice: generateInvoice, issued: generateInvoice ? today : null,
      isNew: true, paymentMethod, paymentProof: null,
    };
    onCreate(po, newTxns);
    onClose();
  }

  const stepLabels = ["Customer & Merchant", "Transactions"];

  return (
    <Modal
      title="Create Payout"
      sub={step === 1 ? "Select customer and merchant for this payout" : "Upload transactions for " + (merchant?.name || "")}
      icon="payouts"
      onClose={onClose}
      size={step === 2 && parsedTxns ? "modal-lg" : undefined}
      foot={step === 1 ? (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="arrowRight" disabled={!canNext} onClick={() => setStep(2)}>Next</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => { setStep(1); setParsedTxns(null); setFile(null); }}>Back</Btn>
          <div className="mf-spacer" />
          {parsedTxns && <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{parsedTxns.length} txns · {money(gross)} gross</span>}
          <Btn variant="primary" icon="check" disabled={!parsedTxns || hasErrors} onClick={submit}>Create Payout</Btn>
        </>
      )}
    >
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20 }}>
        {stepLabels.map((label, idx) => {
          const n = idx + 1; const active = n === step; const done = n < step;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {idx > 0 && <div style={{ width: 28, height: 1, background: "var(--line)" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? "var(--ok)" : active ? "var(--ink-1)" : "var(--bg-2)", color: done || active ? "#fff" : "var(--ink-3)", border: "1.5px solid " + (done ? "var(--ok)" : active ? "var(--ink-1)" : "var(--line)") }}>
                  {done ? <Icon name="check" size={11} /> : n}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? "var(--ink-1)" : "var(--ink-3)" }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <>
          <Field label="Customer" hint="required">
            <select className="input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setMerchantId(""); }}>
              <option value="">Select existing customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {customer && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Chip cls="chip-neutral">{customer.type}</Chip>
              <Chip cls={customer.status === "Active" ? "chip-ok" : "chip-warn"}>{customer.status}</Chip>
            </div>
          )}
          <Field label="Merchant" hint="required">
            <select className="input" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} disabled={!customerId}>
              <option value="">{customerId ? (availableMerchants.length ? "Select merchant…" : "No merchants for this customer") : "Select customer first…"}</option>
              {availableMerchants.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.mid}</option>)}
            </select>
          </Field>
          {merchant && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Chip cls="chip-neutral">{merchant.bank}</Chip>
              <Chip cls="chip-neutral">MID {merchant.mid}</Chip>
              {merchant.finance === "Ready" ? <Chip cls="chip-ok">Finance ready</Chip> : <Chip cls="chip-warn">{merchant.finance}</Chip>}
            </div>
          )}
          <div className="field-row">
            <Field label="Settlement period">
              <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {["2026-05-16 – 31","2026-05-01 – 15","2026-04-16 – 30"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Payment method">
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYOUT_METHODS.map((pm) => <option key={pm}>{pm}</option>)}
              </select>
            </Field>
          </div>
        </>
      ) : (
        <>
          {!parsedTxns ? (
            <Field label="Transaction file" hint="Excel or CSV">
              <div
                className={"dropzone" + (file ? " has" : "")}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
              >
                <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                  Excel (.xlsx, .xls) or CSV · Expected columns: Amount, Payment Method, Date
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleFileDrop(e.target.files)} />
              </div>
              {file && (
                <div className="dz-files" style={{ marginTop: 8 }}>
                  <div className="dz-file">
                    <Icon name="fileCheck" size={16} className="dzf-ico" />
                    <span className="dzf-name">{file.name}</span>
                    <span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span>
                    <button className="modal-close" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <Btn variant="primary" icon="arrowRight" disabled={!file} onClick={parseFile}>Parse File</Btn>
              </div>
            </Field>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Icon name="fileCheck" size={15} style={{ color: "var(--ok)" }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{file!.name}</span>
                <button style={{ fontSize: 12, color: "var(--ink-3)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => { setFile(null); setParsedTxns(null); }}>Change file</button>
              </div>
              <ExceptionChecksPanel exceptions={exceptions} />
              {hasErrors && (
                <div style={{ padding: "10px 14px", background: "var(--bad-bg, #fff5f5)", border: "1px solid var(--bad-line, var(--line))", borderRadius: 8, fontSize: 12.5, color: "var(--bad)", marginBottom: 14 }}>
                  Resolve the errors above before creating this payout.
                </div>
              )}
              <div style={{ marginBottom: 10, fontSize: 13, color: "var(--ink-2)" }}>
                Found <strong>{parsedTxns.length} transactions</strong> totalling <strong>{money(gross)}</strong>
              </div>
              <div className="tbl-wrap" style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                <table className="tbl">
                  <thead>
                    <tr>{["Date","Payment Method","Amount (RM)"].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsedTxns.map((t) => (
                      <tr key={t.id}>
                        <td className="td-mono td-mut">{t.date}</td>
                        <td><Chip cls="chip-neutral">{t.paymentMethod}</Chip></td>
                        <td className="td-mono">{money(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 16px", marginBottom: 14 }}>
                {[["Gross", money(gross)], ["MDR fee (1.8%)", "− " + money(fee)]].map(([l, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
                    <span>{l}</span><span className="mono">{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 9, marginTop: 3, fontWeight: 700, fontSize: 15 }}>
                  <span>Net payout</span>
                  <span className="mono" style={{ color: "var(--green-700)" }}>{money(net)}</span>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "12px 14px", background: generateInvoice ? "var(--info-bg, var(--bg-2))" : "var(--bg-2)", border: "1px solid " + (generateInvoice ? "var(--info-line, var(--line))" : "var(--line)"), borderRadius: 8 }}>
                <input type="checkbox" checked={generateInvoice} onChange={(e) => setGenerateInvoice(e.target.checked)} style={{ width: 15, height: 15, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Generate eInvoice</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Issue a tax-compliant e-invoice for this payout upon creation</div>
                </div>
                {generateInvoice && <Chip cls="chip-indigo"><Icon name="invoice" size={13} />Will issue</Chip>}
              </label>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/* =================== UPLOAD TRANSACTIONS MODAL =================== */
interface MerchantGroup {
  merchantName: string;
  txns: { merchantName: string; amount: number; paymentMethod: string; date: string }[];
  gross: number;
  fee: number;
  net: number;
  exceptions: PayoutException[];
}

type RawGroup = Omit<MerchantGroup, "exceptions">;

function simulateParse(fileName: string, period: string): RawGroup[] {
  const seed = fileName.split("").reduce((a, c) => a + c.charCodeAt(0), 42);
  const rng = (n: number, s = 0) => ((seed + s) * 2654435761 + n * 1234567891) >>> 0;
  const merchantPool = merchants.slice(0, 6).map((m) => m.name);
  const count = 28 + (rng(1) % 22);
  const raw = Array.from({ length: count }, (_, i) => ({
    merchantName: merchantPool[rng(i, 100) % merchantPool.length],
    amount: Math.round((100 + rng(i, 200) % 900) * 100) / 100,
    paymentMethod: TXN_PAYMENT_METHODS[rng(i, 300) % TXN_PAYMENT_METHODS.length],
    date: period.split(" – ")[0] + String(1 + rng(i, 400) % 14).padStart(2, "0"),
  }));
  const byMerchant: Record<string, RawGroup> = {};
  raw.forEach((t) => {
    if (!byMerchant[t.merchantName]) byMerchant[t.merchantName] = { merchantName: t.merchantName, txns: [], gross: 0, fee: 0, net: 0 };
    byMerchant[t.merchantName].txns.push(t);
    byMerchant[t.merchantName].gross = Math.round((byMerchant[t.merchantName].gross + t.amount) * 100) / 100;
  });
  Object.values(byMerchant).forEach((g) => {
    g.fee = Math.round(g.gross * 0.018 * 100) / 100;
    g.net = Math.round((g.gross - g.fee) * 100) / 100;
  });
  return Object.values(byMerchant);
}

interface UploadModalProps {
  onClose: () => void;
  onProcess: (payouts: Payout[], txns: Transaction[]) => void;
}

function UploadTransactionsModal({ onClose, onProcess }: UploadModalProps) {
  const { terminals } = useTerminals();
  const { rentals } = useRentals();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("2026-06-01 – 15");
  const [groups, setGroups] = useState<MerchantGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(files: FileList | null) {
    if (files?.[0]) setFile(files[0]);
  }

  function parseFile() {
    if (!file) return;
    const raw = simulateParse(file.name, period);
    const enriched: MerchantGroup[] = raw.map((g) => {
      const merchant = merchants.find((m) => m.name === g.merchantName);
      const customer = merchant ? customers.find((c) => c.id === merchant.customerId) : null;
      const exceptions = runPayoutChecks({
        merchant: merchant || null,
        customer: customer || null,
        allTerminals: terminals,
        allRentals: rentals,
        allMdrRates: mdr,
        txnPaymentMethods: g.txns.map((t) => t.paymentMethod),
        fileMid: merchant?.mid,
      });
      return { ...g, exceptions };
    });
    setGroups(enriched);
    setStep(2);
  }

  function processPayouts() {
    let txnId = Date.now();
    const newTxns: Transaction[] = [];
    const newPayouts: Payout[] = groups.map((g, i) => {
      const merchant = merchants.find((m) => m.name === g.merchantName) || merchants[i % merchants.length];
      const poId = "PO-" + (Date.now() + i).toString().slice(-5);
      g.txns.forEach((t) => {
        newTxns.push({ id: "TXN-" + txnId++, merchantName: t.merchantName, amount: t.amount, paymentMethod: t.paymentMethod, date: t.date, payoutId: poId });
      });
      return {
        id: poId, merchant: { id: merchant.id, name: g.merchantName },
        mid: merchant.mid, bank: merchant.bank,
        gross: g.gross, fee: g.fee, net: g.net, txns: g.txns.length,
        period, status: "Pending",
        exceptions: g.exceptions, checks: checksPassedSummary(g.exceptions),
        einvoice: false, issued: null, isNew: true,
        paymentMethod: g.txns[0]?.paymentMethod.split(" ")[0] || "Multi-Method", paymentProof: null,
      };
    });
    onProcess(newPayouts, newTxns);
    onClose();
  }

  const totalTxns = groups.reduce((a, g) => a + g.txns.length, 0);
  const totalNet  = groups.reduce((a, g) => a + g.net, 0);
  const totalErrors = groups.reduce((a, g) => a + g.exceptions.filter((e) => e.severity === "error").length, 0);
  const totalWarns  = groups.reduce((a, g) => a + g.exceptions.filter((e) => e.severity === "warning").length, 0);

  return (
    <Modal
      title="Upload Transactions" sub="Parse an Excel/CSV file to auto-generate payouts grouped by merchant" icon="upload"
      onClose={onClose} size="modal-lg"
      foot={
        step === 1 ? (
          <>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" icon="arrowRight" disabled={!file} onClick={parseFile}>Parse File</Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(1)}>Back</Btn>
            <div className="mf-spacer" />
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{totalTxns} transactions · {money(totalNet)} net</span>
            <Btn variant="primary" icon="check" onClick={processPayouts}>Process {groups.length} Payouts</Btn>
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <Field label="Settlement period">
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {["2026-06-01 – 15","2026-06-16 – 30","2026-05-16 – 31","2026-05-01 – 15"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Transaction file" hint="Excel or CSV">
            <div
              className={"dropzone" + (file ? " has" : "")}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
            >
              <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                Excel (.xlsx, .xls) or CSV · Expected columns: Merchant Name, Amount, Payment Method
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleFileDrop(e.target.files)} />
            </div>
            {file && (
              <div className="dz-files" style={{ marginTop: 8 }}>
                <div className="dz-file">
                  <Icon name="fileCheck" size={16} className="dzf-ico" />
                  <span className="dzf-name">{file.name}</span>
                  <span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span>
                  <button className="modal-close" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            )}
          </Field>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 10, fontSize: 13, color: "var(--ink-2)" }}>
            Found <strong>{totalTxns} transactions</strong> across <strong>{groups.length} merchants</strong>.{" "}
            {totalErrors > 0
              ? <span style={{ color: "var(--bad)", fontWeight: 600 }}>{totalErrors} merchant{totalErrors > 1 ? "s" : ""} with errors.</span>
              : totalWarns > 0
                ? <span style={{ color: "var(--warn)", fontWeight: 600 }}>{totalWarns} warning{totalWarns > 1 ? "s" : ""} across merchants.</span>
                : <span style={{ color: "var(--ok)", fontWeight: 600 }}>All checks passed.</span>}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Merchant","Transactions","Gross","MDR Fee","Net Payout","Checks"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.merchantName} style={{ opacity: g.exceptions.some((e) => e.severity === "error") ? 0.6 : 1 }}>
                    <td className="td-strong">{g.merchantName}</td>
                    <td className="td-mut">{g.txns.length}</td>
                    <td className="td-mono td-mut">{money(g.gross)}</td>
                    <td className="td-mono td-mut" style={{ color: "var(--bad)" }}>− {money(g.fee)}</td>
                    <td className="td-mono td-strong" style={{ color: "var(--green-700)" }}>{money(g.net)}</td>
                    <td><ExceptionBadge exceptions={g.exceptions} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--line)" }}>
                  <td className="td-strong">Total</td>
                  <td className="td-mut">{totalTxns}</td>
                  <td className="td-mono">{money(groups.reduce((a, g) => a + g.gross, 0))}</td>
                  <td className="td-mono" style={{ color: "var(--bad)" }}>− {money(groups.reduce((a, g) => a + g.fee, 0))}</td>
                  <td className="td-mono td-strong" style={{ color: "var(--green-700)" }}>{money(totalNet)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/* =================== LISTING =================== */
export function Payouts({ nav }: { nav: NavFn }) {
  const { payouts: rows, addPayouts } = usePayouts();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const filtered = rows.filter((p) => {
    const hay = (p.id + " " + p.merchant.name + " " + p.mid + " " + p.bank).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (status !== "All" && p.status !== status) return false;
    return true;
  });

  const totals = {
    net: rows.reduce((a, p) => a + p.net, 0),
    paid: rows.filter((p) => p.status === "Paid").reduce((a, p) => a + p.net, 0),
    pending: rows.filter((p) => p.status === "Pending").length,
    pendingNet: rows.filter((p) => p.status === "Pending").reduce((a, p) => a + p.net, 0),
  };

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  function handleCreate(po: Payout, txns: Transaction[]) {
    addPayouts([po], txns);
    showToast("Payout " + po.id + " created" + (po.einvoice ? " · eInvoice issued" : ""));
  }

  function handleUpload(newPayouts: Payout[], txns: Transaction[]) {
    addPayouts(newPayouts, txns);
    showToast(newPayouts.length + " payouts created from uploaded transactions");
  }

  return (
    <div>
      <PageHead
        title="Payouts"
        sub="Settlement & merchant payouts · exception checks and e-invoicing"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="ghost" icon="upload" onClick={() => setShowUpload(true)}>Upload Transactions</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Payout</Btn>
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { l: "Net This Cycle",  v: money(totals.net),        ico: "cash",        c: "var(--green-700)", bg: "var(--green-050)" },
          { l: "Paid Out",        v: money(totals.paid),       ico: "checkCircle", c: "var(--info)",      bg: "var(--info-bg)" },
          { l: "Pending",         v: totals.pending,           ico: "clock",       c: "var(--warn)",      bg: "var(--warn-bg)" },
          { l: "Pending Net",     v: money(totals.pendingNet), ico: "payouts",     c: "var(--ink-2)",     bg: "var(--bg-2)" },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: s.bg, color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: typeof s.v === "string" && s.v.length > 8 ? 21 : 28 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search payout ID, merchant, MID…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All","Pending","Paid"].map((s) => (
              <option key={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{filtered.length} payouts</span>
        </Toolbar>
        {filtered.length === 0 ? <Empty icon="payouts" title="No payouts match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {["Payout ID","Merchant","Txns","Gross","Net","Status","Checks","eInvoice",""].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="td-mono td-strong">{p.id}</span>
                      {p.isNew && <Chip cls="chip-ok" sq>New</Chip>}
                    </span></td>
                    <td><div className="cell-2">
                      <span className="td-strong">{p.merchant.name}</span>
                      <span className="c2-sub mono">{p.mid}</span>
                    </div></td>
                    <td className="td-mut">{p.txns}</td>
                    <td className="td-mono td-mut">{money(p.gross)}</td>
                    <td className="td-mono td-strong">{money(p.net)}</td>
                    <td><PayoutStatus status={p.status} /></td>
                    <td><ExceptionBadge exceptions={p.exceptions} /></td>
                    <td>
                      {p.einvoice
                        ? <Chip cls="chip-indigo"><Icon name="invoice" size={13} />Issued</Chip>
                        : <span className="td-mut">—</span>}
                    </td>
                    <td>
                      <Btn variant="ghost" sm icon="eye" onClick={() => nav("payout-detail", p.id)}>View</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={rows.length} shown={filtered.length} />
      </Card>

      {showCreate && <CreatePayoutModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showUpload && <UploadTransactionsModal onClose={() => setShowUpload(false)} onProcess={handleUpload} />}
      {toast && (
        <div className="toast">
          <span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}
        </div>
      )}
    </div>
  );
}

/* =================== PAYOUT DETAIL =================== */
export function PayoutDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { payouts, transactions, markAsPaid } = usePayouts();
  const payout = payouts.find((p) => p.id === id);
  const [q, setQ] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  if (!payout) return (
    <div>
      <PageHead title="Payout not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("payouts")}>Back to Payouts</Btn>} />
      <Empty icon="payouts" title="Payout not found" sub={"No payout with ID " + id} />
    </div>
  );

  const txns = transactions.filter((t) => t.payoutId === id);
  const filteredTxns = txns.filter((t) => {
    if (!q) return true;
    return (t.id + " " + t.merchantName + " " + t.paymentMethod).toLowerCase().includes(q.toLowerCase());
  });

  const methodBreakdown: Record<string, number> = {};
  txns.forEach((t) => { methodBreakdown[t.paymentMethod] = (methodBreakdown[t.paymentMethod] || 0) + t.amount; });

  function handleMarkPaid() {
    markAsPaid(id, proofFile!.name);
    setShowMarkPaid(false);
    setProofFile(null);
  }

  return (
    <div>
      <PageHead
        title={payout.id}
        sub={payout.merchant.name + " · " + payout.period}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("payouts")}>Back</Btn>
          <Btn variant="ghost" icon="download">Export</Btn>
          {payout.status === "Pending" && !showMarkPaid && (
            <Btn variant="primary" icon="check" onClick={() => setShowMarkPaid(true)}>Mark as Paid</Btn>
          )}
        </>}
      />

      {/* Inline mark-as-paid panel */}
      {showMarkPaid && (
        <div className="card" style={{ marginBottom: 16, border: "1px solid var(--info-line, var(--line))", background: "var(--info-bg, var(--bg-2))" }}>
          <div className="card-head">
            <Icon name="checkCircle" size={17} style={{ color: "var(--info)" }} />
            <h3>Proof of Payment</h3>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
              Upload a bank transfer receipt or payment confirmation document to mark this payout as paid.
            </p>
            <div
              className={"dropzone" + (proofFile ? " has" : "")}
              onClick={() => proofInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setProofFile(f); }}
            >
              <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>PDF, JPG or PNG · bank receipt or transfer confirmation</div>
              <input ref={proofInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setProofFile(f); }} />
            </div>
            {proofFile && (
              <div className="dz-files" style={{ marginTop: 8 }}>
                <div className="dz-file">
                  <Icon name="fileCheck" size={16} className="dzf-ico" />
                  <span className="dzf-name">{proofFile.name}</span>
                  <span className="dzf-size">{(proofFile.size / 1024).toFixed(0)} KB</span>
                  <button className="modal-close" style={{ width: 24, height: 24 }} onClick={() => setProofFile(null)}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => { setShowMarkPaid(false); setProofFile(null); }}>Cancel</Btn>
              <Btn variant="primary" icon="check" disabled={!proofFile} onClick={handleMarkPaid}>Confirm Payment</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <PayoutStatus status={payout.status} />
        {payout.einvoice && <Chip cls="chip-indigo"><Icon name="invoice" size={13} />eInvoice Issued</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Summary card */}
        <Card title="Payout Summary" icon="payouts">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Merchant", payout.merchant.name],
              ["MID", payout.mid],
              ["Bank", payout.bank],
              ["Payment Method", payout.paymentMethod],
              ["Period", payout.period],
              ["Issued", payout.issued || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>
                Payment Proof
                {payout.status === "Paid" && !payout.paymentProof && (
                  <span style={{ marginLeft: 6, color: "var(--bad)", fontWeight: 600 }}>· required</span>
                )}
              </span>
              {payout.paymentProof ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, color: "var(--ink-1)" }}>
                  <Icon name="fileCheck" size={14} style={{ color: "var(--ok)" }} />
                  {payout.paymentProof}
                </span>
              ) : payout.status === "Paid" ? (
                <Chip cls="chip-bad"><Icon name="alert" size={13} />Missing</Chip>
              ) : (
                <span style={{ color: "var(--ink-3)" }}>—</span>
              )}
            </div>
          </div>
        </Card>

        {/* Financials card */}
        <Card title="Financials" icon="cash">
          <div style={{ padding: "4px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>Gross Amount</span>
              <span className="mono">{money(payout.gross)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>MDR Fee (1.8%)</span>
              <span className="mono" style={{ color: "var(--bad)" }}>− {money(payout.fee)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 16, fontWeight: 700 }}>
              <span>Net Payout</span>
              <span className="mono" style={{ color: "var(--green-700)" }}>{money(payout.net)}</span>
            </div>
            {Object.keys(methodBreakdown).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginTop: 8, marginBottom: 6 }}>By Payment Method</div>
                {Object.entries(methodBreakdown).map(([method, amt]) => (
                  <div key={method} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4 }}>
                    <span>{method}</span>
                    <span className="mono">{money(amt)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Exception Checks */}
      <Card title={"Exception Checks · " + payout.checks} icon="alert">
        <div style={{ padding: "8px 20px 16px" }}>
          <ExceptionChecksPanel exceptions={payout.exceptions} />
        </div>
      </Card>

      {/* Transactions table */}
      <Card title={`Transactions (${txns.length})`} icon="receipt">
        {txns.length === 0 ? (
          <Empty icon="receipt" title="No transactions linked" sub="Transactions are created when payouts are processed from an uploaded file" />
        ) : (
          <>
            <Toolbar>
              <SearchBox value={q} onChange={setQ} placeholder="Search transaction ID, method…" />
              <span className="tb-meta">{filteredTxns.length} of {txns.length} transactions</span>
            </Toolbar>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>{["Transaction ID","Date","Merchant","Amount (RM)","Payment Method"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="td-mono td-strong">{t.id}</td>
                      <td className="td-mono td-mut">{t.date}</td>
                      <td>{t.merchantName}</td>
                      <td className="td-mono">{money(t.amount)}</td>
                      <td><Chip cls="chip-neutral">{t.paymentMethod}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={txns.length} shown={filteredTxns.length} />
          </>
        )}
      </Card>
    </div>
  );
}
