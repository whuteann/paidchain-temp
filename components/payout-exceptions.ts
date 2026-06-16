import type { Merchant, Customer, Terminal, Rental, MDRRate, PayoutException } from "./data";

export type CheckCode =
  | "merchant_found"
  | "mid_tid_match"
  | "merchant_active"
  | "mdr_setup"
  | "commission_rule"
  | "terminal_assigned"
  | "rental_setup"
  | "tin_ready";

export const ALL_CHECKS: { code: CheckCode; label: string; severity: "error" | "warning" }[] = [
  { code: "merchant_found",    label: "Merchant found",          severity: "error" },
  { code: "mid_tid_match",     label: "MID / TID matched",       severity: "error" },
  { code: "merchant_active",   label: "Merchant active",         severity: "error" },
  { code: "mdr_setup",         label: "MDR setup complete",      severity: "error" },
  { code: "commission_rule",   label: "Commission rule exists",  severity: "warning" },
  { code: "terminal_assigned", label: "Terminal assigned",       severity: "warning" },
  { code: "rental_setup",      label: "Rental setup present",    severity: "warning" },
  { code: "tin_ready",         label: "TIN / eInvoice ready",    severity: "warning" },
];

/* Maps a transaction payment method string to MDR rate entries */
const METHOD_PATTERNS: [RegExp, RegExp][] = [
  [/visa/i,             /visa/i],
  [/mastercard/i,       /mastercard/i],
  [/american express/i, /american|amex/i],
  [/duitnow/i,          /duitnow/i],
  [/unionpay/i,         /unionpay/i],
  [/contactless|nfc/i,  /contactless/i],
];

function matchesMdrRate(method: string, rates: MDRRate[]): boolean {
  for (const [methodPat, ratePat] of METHOD_PATTERNS) {
    if (methodPat.test(method) && rates.some(r => ratePat.test(r.type) || ratePat.test(r.network))) {
      return true;
    }
  }
  return false;
}

export interface RunChecksInput {
  merchant: Merchant | null | undefined;
  customer: Customer | null | undefined;
  allTerminals: Terminal[];
  allRentals: Rental[];
  allMdrRates: MDRRate[];
  txnPaymentMethods?: string[];
  fileMid?: string;
}

export function runPayoutChecks(input: RunChecksInput): PayoutException[] {
  const { merchant, customer, allTerminals, allRentals, allMdrRates, txnPaymentMethods = [], fileMid } = input;
  const ex: PayoutException[] = [];

  /* 1. Merchant found */
  if (!merchant) {
    ex.push({ code: "merchant_found", severity: "error", message: "Merchant not found in the system" });
    return ex; // all remaining checks require a merchant
  }

  /* 2. MID / TID matched — only checked when a file-supplied MID is available */
  if (fileMid && fileMid !== merchant.mid) {
    ex.push({ code: "mid_tid_match", severity: "error", message: `File MID (${fileMid}) does not match registered MID (${merchant.mid})` });
  }

  /* 3. Merchant active */
  if (merchant.status === "Inactive" || merchant.status === "Suspended") {
    ex.push({ code: "merchant_active", severity: "error", message: `Merchant is ${merchant.status.toLowerCase()} — payouts cannot be processed` });
  }

  /* 4. MDR setup complete */
  if (!merchant.mdrPlan || merchant.finance !== "Ready") {
    const detail = merchant.finance !== "Ready"
      ? `Finance status is "${merchant.finance}" — must be Ready`
      : "No MDR plan assigned to this merchant";
    ex.push({ code: "mdr_setup", severity: "error", message: detail });
  }

  /* 5. Commission rule exists for every payment method in the transaction set */
  const uniqueMethods = [...new Set(txnPaymentMethods)];
  const unmatched = uniqueMethods.filter(m => !matchesMdrRate(m, allMdrRates));
  if (unmatched.length > 0) {
    ex.push({ code: "commission_rule", severity: "warning", message: `No MDR rate configured for: ${unmatched.join(", ")}` });
  }

  /* 6. Terminal assigned */
  const hasTerminal = allTerminals.some(t => t.merchant?.id === merchant.id && t.status === "Installed");
  if (!hasTerminal) {
    ex.push({ code: "terminal_assigned", severity: "warning", message: "No installed terminal linked to this merchant" });
  }

  /* 7. Rental setup present */
  const hasRental = allRentals.some(r => r.merchant.id === merchant.id && r.status === "Active");
  if (!hasRental) {
    ex.push({ code: "rental_setup", severity: "warning", message: "No active rental found for this merchant" });
  }

  /* 8. TIN / eInvoice readiness */
  if (!customer?.tin) {
    ex.push({ code: "tin_ready", severity: "warning", message: "Customer TIN not registered — eInvoice cannot be issued" });
  }

  return ex;
}

export function checksPassedSummary(exceptions: PayoutException[]): string {
  const failedCodes = new Set(exceptions.map(e => e.code));
  const passed = ALL_CHECKS.filter(c => !failedCodes.has(c.code)).length;
  return `${passed} of ${ALL_CHECKS.length} passed`;
}
