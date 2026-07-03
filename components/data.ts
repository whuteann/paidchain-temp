/* PaidChain — mock data + status metadata */

export interface StatusMeta { chip: string; dot?: string; label?: string }
export interface FinanceMeta { chip: string; pct: number }
export interface JobTypeMeta { icon: string; stages: string[]; exportable: boolean; escalate?: boolean; needsTerminal?: boolean }
export interface RoleMeta { chip: string; desc: string }
export interface SlaTransitionRule { from: string; to: string; warningDays: number; breachDays: number }
export interface JobHistoryEntry {
  stage: string;
  at: string;
  actor: string;
  actorRole: string;
  note?: string;
  evidence?: string[];
}
export interface JobNotification {
  at: string;
  to: string[];
  subject: string;
}

export interface Customer {
  id: string; name: string; type: string; regNo: string;
  tin: string;
  contact: string; phone: string; email: string; address: string;
  status: string; onboarded: string; isNew?: boolean;
}

export interface Merchant {
  id: string; name: string; type: string; mid: string; bank: string;
  status: string; finance: string; terminals: number; openJobs: number;
  contact: string; phone: string; email: string; address: string;
  onboarded: string; mdrPlan: string;
  bankAccountName: string; bankAccountNumber: string; bankAccountType: string;
  customerId: string; customerName: string;
  isNew?: boolean;
}

export interface Terminal {
  serial: string; brand: string; model: string; status: string;
  tid: string | null; merchant: { id: string; name: string } | null;
  location: string; lastMovement: string; rentalRate: number;
  rentalPlan: string; sim: string; conditionNote: string;
  termSettingId: string;
  activityLog?: TimelineEntry[];
}

export interface Job {
  id: string; type: string; stage: string; stageIndex: number; status: string;
  sla: string; assignee: string; bank: string;
  customer: { id: string; name: string } | null;
  merchant: { id: string; name: string };
  terminal: { serial: string; brand: string; model: string } | null;
  previousTerminal: { serial: string; brand: string; model: string } | null;
  created: string; due: string; priority: string;
  escalatedTo: string | null; desc: string;
  createdByRole: string;
  createdByName: string;
  history: JobHistoryEntry[];
  notifications: JobNotification[];
  paperRollRequest: { quantity: number; paymentTarget: "Merchant" | "Bank" } | null;
  termSettingId?: string;
  isNew?: boolean;
}

export interface Payout {
  id: string; merchant: { id: string; name: string };
  mid: string; bank: string; gross: number; fee: number; net: number;
  txns: number; period: string; status: string; exceptions: PayoutException[];
  checks: string; einvoice: boolean; issued: string | null; isNew?: boolean;
  paymentMethod: string;
  paymentProof: string | null;
}

export interface Transaction {
  id: string;
  merchantName: string;
  amount: number;
  paymentMethod: string;
  date: string;
  payoutId: string | null;
}

export interface Rental {
  id: string;
  customer: { id: string; name: string; tin: string };
  merchant: { id: string; name: string; mid: string };
  terminal: { serial: string; brand: string; model: string; tid: string | null };
  plan: string;
  monthlyRate: number;
  deposit: number;
  startDate: string;
  endDate: string | null;
  status: string;
  invoiceIssued: string | null;
  einvoiceIssued: string | null;
  isNew?: boolean;
}

export interface SimCard {
  id: string;
  iccid: string;
  msisdn: string;
  carrier: string;
  plan: string;
  dataAllowance: string;
  status: string;
  terminalSerial: string | null;
  isNew?: boolean;
}

export interface PaperRollEntry {
  id: string;
  type: "Received" | "Issued" | "Adjustment";
  quantity: number;
  reference: string;
  note: string;
  date: string;
  createdBy: string;
  isNew?: boolean;
}

export interface TermSetting {
  id: string; brand: string; model: string; category: string; bank: string;
  monthly: number; deposit: number; setup: number; units: number; active: boolean;
}

export interface MDRRate {
  id: string; type: string; rate: number; cat: string; network: string;
}

export interface User {
  id: string; name: string; email: string; role: string;
  status: string; lastActive: string; jobs: number;
}

export interface TimelineEntry { dot: string; time: string; title: string; desc: string }

export interface AuditLog {
  id: string;
  actionAt: string;
  user: { id: string; name: string; role: string };
  description: string;
  type: "Create" | "Update" | "Delete" | "Auth" | "Export" | "System";
  entityType?: string;
  entityId?: string;
}

export interface PayoutException {
  code: string;
  severity: "error" | "warning";
  message: string;
}

/* ---------------- Status meta ---------------- */
export const TERMINAL_STATUS: Record<string, StatusMeta> = {
  "In Stock":        { chip: "chip-neutral", dot: "var(--neutral)", label: "In Stock / Available" },
  "Reserved":        { chip: "chip-info",    dot: "var(--info)",    label: "Reserved / Prepared" },
  "Assigned":        { chip: "chip-indigo",  dot: "var(--indigo)",  label: "Assigned" },
  "Installed":       { chip: "chip-ok",      dot: "var(--ok)",      label: "Installed Active" },
  "Maintenance":     { chip: "chip-warn",    dot: "var(--warn)",    label: "Under Maintenance" },
  "Replacement Out": { chip: "chip-orange",  dot: "var(--orange)",  label: "Replacement Out" },
  "Returned":        { chip: "chip-neutral", dot: "var(--neutral)", label: "Returned" },
  "Faulty":          { chip: "chip-bad",     dot: "var(--bad)",     label: "Faulty / Repair" },
  "Retired":         { chip: "chip-dark",    dot: "var(--dark)",    label: "Retired / Terminated" },
};
export const TERMINAL_STATUS_ORDER = Object.keys(TERMINAL_STATUS);

export const MERCHANT_STATUS: Record<string, StatusMeta> = {
  "Active":     { chip: "chip-ok" },
  "Onboarding": { chip: "chip-info" },
  "Suspended":  { chip: "chip-warn" },
  "Inactive":   { chip: "chip-neutral" },
};

export const FINANCE: Record<string, FinanceMeta> = {
  "Ready":        { chip: "chip-ok",   pct: 100 },
  "Pending Docs": { chip: "chip-warn", pct: 60 },
  "Not Ready":    { chip: "chip-bad",  pct: 25 },
};

export const JOB_STATUS: Record<string, StatusMeta> = {
  "Pending":         { chip: "chip-neutral" },
  "Escalated":       { chip: "chip-indigo" },
  "Device Prepared": { chip: "chip-info" },
  "Stock Prepared":  { chip: "chip-info" },
  "Installed":       { chip: "chip-info" },
  "Delivered":       { chip: "chip-info" },
  "Job Done":        { chip: "chip-info" },
  "In Progress":     { chip: "chip-info" },
  "Completed":       { chip: "chip-ok" },
  "Cancelled":       { chip: "chip-dark" },
};

export const SLA: Record<string, StatusMeta> = {
  "On Track": { chip: "chip-ok" },
  "Due Soon": { chip: "chip-warn" },
  "Breached": { chip: "chip-bad" },
  "Met":      { chip: "chip-neutral" },
};

export const PAYOUT_STATUS: Record<string, StatusMeta> = {
  "Pending": { chip: "chip-warn" },
  "Paid":    { chip: "chip-ok" },
};

/* ---------------- Job type meta ---------------- */
export const JOB_TYPES: Record<string, JobTypeMeta> = {
  "Installation":       { icon: "boxIn",   stages: ["Pending", "Device Prepared", "Job Done", "Completed"], exportable: true, needsTerminal: true },
  "Repair/Maintenance": { icon: "wrench",  stages: ["Pending", "Job Done", "Completed"], exportable: true },
  "Replacement":        { icon: "swap",    stages: ["Pending", "Device Prepared", "Job Done", "Completed"], exportable: true, needsTerminal: true },
  "Paper Roll Request": { icon: "receipt", stages: ["Pending", "Stock Prepared", "Job Done", "Completed"], exportable: false },
  "Remote Support":     { icon: "phone",   stages: ["Pending", "Completed"], exportable: false },
};

export const DEFAULT_JOB_SLA_RULES: Record<string, SlaTransitionRule[]> = {
  "Installation": [
    { from: "Pending", to: "Device Prepared", warningDays: 3, breachDays: 7 },
    { from: "Device Prepared", to: "Job Done", warningDays: 2, breachDays: 5 },
    { from: "Job Done", to: "Completed", warningDays: 1, breachDays: 3 },
  ],
  "Repair/Maintenance": [
    { from: "Pending", to: "Job Done", warningDays: 3, breachDays: 7 },
    { from: "Job Done", to: "Completed", warningDays: 1, breachDays: 3 },
  ],
  "Replacement": [
    { from: "Pending", to: "Device Prepared", warningDays: 3, breachDays: 7 },
    { from: "Device Prepared", to: "Job Done", warningDays: 2, breachDays: 5 },
    { from: "Job Done", to: "Completed", warningDays: 1, breachDays: 3 },
  ],
  "Paper Roll Request": [
    { from: "Pending", to: "Stock Prepared", warningDays: 2, breachDays: 4 },
    { from: "Stock Prepared", to: "Job Done", warningDays: 2, breachDays: 4 },
    { from: "Job Done", to: "Completed", warningDays: 1, breachDays: 2 },
  ],
  "Remote Support": [
    { from: "Pending", to: "Completed", warningDays: 1, breachDays: 3 },
  ],
};

/* ---------------- Reference data ---------------- */
export const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "AmBank"];
export const CUSTOMER_TYPES = ["Corporate", "SME", "Partnership"];
export const CUSTOMER_STATUS: Record<string, StatusMeta> = {
  "Active":    { chip: "chip-ok" },
  "Inactive":  { chip: "chip-neutral" },
  "Suspended": { chip: "chip-warn" },
};
export const RENTAL_PLANS = ["Monthly Rental", "12-mo Contract", "24-mo Contract", "Pay-as-you-go"];
export const SIM_CARRIERS = ["Maxis", "Celcom", "Digi", "U Mobile", "Yes 4G"];
export const SIM_PLANS = ["Basic 5GB", "Standard 10GB", "Pro 20GB", "Unlimited", "IoT 1GB"];
export const SIM_DATA_ALLOWANCES = ["5 GB/mo", "10 GB/mo", "20 GB/mo", "Unlimited", "1 GB/mo"];
export const SIM_STATUS: Record<string, StatusMeta> = {
  "Active":     { chip: "chip-ok" },
  "In Storage": { chip: "chip-neutral" },
  "Suspended":  { chip: "chip-warn" },
  "Retired":    { chip: "chip-dark" },
};
export const RENTAL_STATUS: Record<string, StatusMeta> = {
  "Active":    { chip: "chip-ok" },
  "Suspended": { chip: "chip-warn" },
  "Ended":     { chip: "chip-neutral" },
};
export const PAYOUT_METHODS = ["Visa", "Mastercard", "CIMB", "Maybank", "DuitNow QR", "Multi-Method", "AmBank"];
export const TXN_PAYMENT_METHODS = ["Visa Credit", "Visa Debit", "Mastercard Credit", "Mastercard Debit", "DuitNow QR", "Touch 'n Go", "American Express"];
export const BRANDS: Record<string, string[]> = {
  "Ingenico": ["Move/5000", "Desk/5000", "Lane/3000", "Move/3500"],
  "PAX":      ["A920 Pro", "A80", "A920", "S920"],
  "Verifone": ["V240m", "P400", "Engage V200c", "T650p"],
};
export const STAFF = ["Arif Rahman", "Mei Ling Tan", "Suresh Kumar", "Nurul Huda", "Daniel Wong", "Priya Nair", "Hafiz Ismail", "Joanne Lee"];

export const ROLES: Record<string, RoleMeta> = {
  "Admin":      { chip: "chip-bad",     desc: "Full access — manage everything" },
  "Operations": { chip: "chip-info",    desc: "Jobs, terminals, escalations" },
  "Warehouse":  { chip: "chip-orange",  desc: "Inventory & device preparation" },
  "Finance":    { chip: "chip-indigo",  desc: "Payouts, MDR, e-invoices" },
  "Viewer":     { chip: "chip-neutral", desc: "Read-only across modules" },
};

/* ---------------- Customers ---------------- */
const _custSeed: Customer[] = [
  { id: "CUST-001", name: "Sinar Holdings Bhd",       type: "Corporate",   regNo: "201901023456", tin: "C25884732010", contact: "Datuk Ahmad Fauzi",    phone: "+60 3-2345 6789", email: "admin@sinarholdings.com.my",    address: "Level 23, Menara Sinar, Jalan Raja Chulan, KL",    status: "Active",   onboarded: "2023-01-15" },
  { id: "CUST-002", name: "Maju Group Sdn Bhd",       type: "Corporate",   regNo: "201701045678", tin: "C19440012560", contact: "Tan Sri Wong Kah Fai", phone: "+60 3-3456 7890", email: "ceo@majugroup.com.my",          address: "Suite 12A, Plaza Maju, Petaling Jaya",             status: "Active",   onboarded: "2023-03-08" },
  { id: "CUST-003", name: "Primula Ventures Bhd",     type: "SME",         regNo: "202001067890", tin: "",             contact: "Rajesh Kumar",         phone: "+60 3-4567 8901", email: "rajesh@primulaventures.com",   address: "Jalan Ampang, Kuala Lumpur",                       status: "Active",   onboarded: "2023-06-20" },
  { id: "CUST-004", name: "Rakyat Holdings Group",    type: "Partnership", regNo: "201801089012", tin: "IG84001900270", contact: "Nurul Huda bt Azman",  phone: "+60 3-5678 9012", email: "nhuda@rakyatholdings.com.my",   address: "Jalan Tun Razak, Kuala Lumpur",                    status: "Active",   onboarded: "2024-01-12" },
  { id: "CUST-005", name: "Elara Capital Sdn Bhd",    type: "SME",         regNo: "202201001234", tin: "",             contact: "Marcus Lim",           phone: "+60 3-6789 0123", email: "marcus@elaracapital.com",       address: "Persiaran KLCC, Kuala Lumpur",                     status: "Active",   onboarded: "2024-05-30" },
  { id: "CUST-006", name: "Bintang Enterprise Bhd",   type: "Corporate",   regNo: "201601023456", tin: "C11290544330", contact: "Siti Mariam",          phone: "+60 3-7890 1234", email: "mariam@bintangenterprise.com.my", address: "Shah Alam, Selangor",                           status: "Inactive", onboarded: "2022-11-01" },
];
export const customers: Customer[] = _custSeed;

/* ---------------- Merchants ---------------- */
const mNames: [string, string][] = [
  ["Kopitiam Heritage Sdn Bhd", "F&B"], ["UrbanThreads Boutique", "Retail"],
  ["MediCare Pharmacy Group", "Healthcare"], ["Sunrise Mart Holdings", "Grocery"],
  ["TechGear Electronics", "Electronics"], ["GreenLeaf Organic Café", "F&B"],
  ["Pinnacle Auto Services", "Automotive"], ["BlueWave Spa & Wellness", "Services"],
  ["Golden Dragon Restaurant", "F&B"], ["Petals & Co Florist", "Retail"],
  ["CityFuel Petroleum", "Fuel"], ["Bookworm Stationers", "Retail"],
  ["Apex Fitness Studio", "Fitness"], ["Harbour Seafood Market", "F&B"],
  ["Lumina Beauty Bar", "Services"], ["QuickBite Express", "F&B"],
  ["Nordic Home Living", "Furniture"], ["PlayZone Arcade", "Entertainment"],
];
const mStatusPool = ["Active","Active","Active","Active","Onboarding","Active","Suspended","Active","Onboarding","Inactive"];
const finPool = ["Ready","Ready","Pending Docs","Ready","Pending Docs","Not Ready","Ready","Ready"];

export const merchants: Merchant[] = mNames.map((n, i) => {
  const id = "M" + (1042 + i);
  const status = mStatusPool[i % mStatusPool.length];
  const finance = status === "Onboarding" ? (i % 2 ? "Pending Docs" : "Not Ready") : finPool[i % finPool.length];
  return {
    id, name: n[0], type: n[1],
    mid: "MID" + (50231900 + i * 137),
    bank: BANKS[i % BANKS.length],
    status, finance,
    terminals: status === "Inactive" ? 0 : (status === "Onboarding" ? (i % 2) : 1 + (i % 4)),
    openJobs: i % 3 === 0 ? (1 + (i % 2)) : 0,
    contact: ["Lim Wei Jie","Sarah Abdullah","Rajesh Menon","Tan Boon Hock","Aisha Karim","Vincent Goh"][i % 6],
    phone: "+60 1" + (2 + i % 7) + "-" + (300 + i) + " " + (4000 + i * 7),
    email: "ops@" + n[0].toLowerCase().replace(/[^a-z]/g, "").slice(0, 10) + ".com",
    address: ["Jalan Bukit Bintang", "Jalan Ampang", "Lebuh Pasar", "Jalan Tun Razak", "Persiaran KLCC"][i % 5] + ", " + ["Kuala Lumpur","Petaling Jaya","Subang Jaya","Shah Alam"][i % 4],
    onboarded: "2024-" + String(1 + (i % 11)).padStart(2,"0") + "-" + String(3 + (i % 25)).padStart(2,"0"),
    mdrPlan: ["Standard Retail", "F&B Preferred", "Enterprise", "SME Flat"][i % 4],
    bankAccountName: n[0].replace(" Sdn Bhd", "").replace(" Holdings", ""),
    bankAccountNumber: String(1000000000 + i * 173891237).slice(0, 10 + (i % 3)),
    bankAccountType: i % 3 === 0 ? "Current" : "Savings",
    customerId: _custSeed[Math.floor(i / 3) % _custSeed.length].id,
    customerName: _custSeed[Math.floor(i / 3) % _custSeed.length].name,
  };
});

/* ---------------- Terminals ---------------- */
const statusSeq = ["Installed","Installed","Installed","Assigned","Reserved","In Stock","In Stock","Maintenance","Replacement Out","Faulty","Returned","Installed","In Stock","Retired","Installed","Assigned","In Stock","Maintenance","Installed","Reserved","In Stock","Faulty","Installed","In Stock"];
const brandKeys = Object.keys(BRANDS);

export const terminals: Terminal[] = statusSeq.map((status, i) => {
  const brand = brandKeys[i % brandKeys.length];
  const model = BRANDS[brand][i % BRANDS[brand].length];
  const linked = ["Installed","Assigned","Maintenance","Replacement Out"].includes(status);
  const merchant = linked ? merchants[i % merchants.length] : null;
  let loc = "KL Warehouse";
  if (status === "Installed" || status === "Assigned") loc = "Merchant Site";
  else if (status === "Maintenance" || status === "Faulty") loc = "Repair Center";
  else if (status === "Replacement Out" || status === "Returned") loc = "In Transit";
  else if (status === "Retired") loc = "Returns Bay";
  const termSettingId = brand.slice(0, 3).toUpperCase() + "-" + (100 + BRANDS[brand].indexOf(model));
  return {
    serial: "SN" + brand.slice(0,2).toUpperCase() + (480012 + i * 53),
    brand, model, status,
    tid: linked ? "TID" + (7700110 + i * 29) : null,
    merchant: merchant ? { id: merchant.id, name: merchant.name } : null,
    location: loc,
    lastMovement: "2026-0" + (1 + (i % 5)) + "-" + String(2 + (i % 26)).padStart(2,"0"),
    rentalRate: [85, 95, 120, 70, 110][i % 5],
    rentalPlan: ["Monthly Rental","Monthly Rental","12-mo Contract","Pay-as-you-go"][i % 4],
    sim: i % 3 === 0 ? "4G + WiFi" : "WiFi only",
    conditionNote: status === "Faulty" ? "Card reader intermittent" : (status === "Maintenance" ? "Battery swelling reported" : "Good"),
    termSettingId,
  };
});

/* ---------------- Jobs ---------------- */
const jobTypeSeq = ["Installation","Repair/Maintenance","Paper Roll Request","Replacement","Remote Support","Installation","Repair/Maintenance","Paper Roll Request","Installation","Replacement","Remote Support","Repair/Maintenance","Installation","Paper Roll Request","Repair/Maintenance","Installation"];

function addDays(date: string, days: number) {
  const d = new Date(date + "T09:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 16).replace("T", " · ");
}

export const jobs: Job[] = jobTypeSeq.map((type, i) => {
  const def = JOB_TYPES[type];
  const stages = def.stages;
  const si = i % stages.length;
  const stage = stages[si];
  const m = merchants[i % merchants.length];
  const isDone = stage === "Completed";
  const slaPool = isDone ? ["Met","Met","Breached"] : ["On Track","Due Soon","On Track","Breached"];
  const merchantTerminal = terminals.find((entry) => entry.merchant?.id === m.id) || terminals[(i * 2) % terminals.length];
  const replacementDevice = terminals.find((entry) => entry.status === "In Stock" && entry.serial !== merchantTerminal.serial) || terminals[(i * 3) % terminals.length];
  const term = type === "Replacement"
    ? replacementDevice
    : (def.needsTerminal || type === "Repair/Maintenance")
      ? merchantTerminal
      : null;
  const created = "2026-05-" + String(2 + (i % 27)).padStart(2,"0");
  const createdByRole = ({
    "Installation": "Admin",
    "Repair/Maintenance": "Helpdesk",
    "Replacement": "Helpdesk",
    "Paper Roll Request": "Admin",
    "Remote Support": "Helpdesk",
  } as Record<string, string>)[type];
  const firstRecipient = ({
    "Installation": ["Warehouse Manager"],
    "Repair/Maintenance": ["Operations"],
    "Replacement": ["Warehouse Manager"],
    "Paper Roll Request": ["Warehouse Manager"],
    "Remote Support": ["Admin"],
  } as Record<string, string[]>)[type];
  const history = stages.slice(0, si + 1).map((currentStage, idx) => ({
    stage: currentStage,
    at: addDays(created, idx),
    actor: STAFF[(i + idx) % STAFF.length],
    actorRole: idx === 0
      ? createdByRole
      : currentStage === "Device Prepared" || currentStage === "Stock Prepared"
        ? "Warehouse Manager"
        : currentStage === "Job Done"
          ? (type === "Paper Roll Request" || type === "Installation" || type === "Replacement" || type === "Repair/Maintenance" ? "Operations" : "Helpdesk")
          : (type === "Remote Support" ? "Helpdesk" : "Admin"),
    note: idx === 0 ? "Job created" : "Stage updated",
    evidence: currentStage === "Job Done" || currentStage === "Completed" ? ["evidence-" + (i + idx) + ".pdf"] : [],
  }));
  return {
    id: "JOB-" + (24080 + i),
    type, stage, stageIndex: si, status: stage,
    sla: slaPool[i % slaPool.length],
    assignee: STAFF[i % STAFF.length],
    bank: m.bank,
    customer: { id: m.customerId, name: m.customerName },
    merchant: { id: m.id, name: m.name },
    terminal: term ? { serial: term.serial, brand: term.brand, model: term.model } : null,
    previousTerminal: type === "Replacement" ? { serial: merchantTerminal.serial, brand: merchantTerminal.brand, model: merchantTerminal.model } : null,
    created,
    due: "2026-06-" + String(3 + (i % 20)).padStart(2,"0"),
    priority: ["Normal","High","Normal","Urgent","Low"][i % 5],
    escalatedTo: null,
    desc: ({
      "Installation": "New terminal deployment at merchant premises. Verify connectivity and run test transaction.",
      "Repair/Maintenance": "On-site diagnostics requested. Card reader reported faulty by merchant.",
      "Replacement": "Swap faulty unit with replacement device. Recover old terminal.",
      "Paper Roll Request": "Merchant requesting thermal paper roll resupply (box of 50).",
      "Remote Support": "Merchant unable to settle batch. Remote assistance over phone.",
    } as Record<string,string>)[type],
    createdByRole,
    createdByName: STAFF[(i + 2) % STAFF.length],
    history,
    notifications: [
      { at: history[0].at, to: firstRecipient, subject: type + " job " + ("JOB-" + (24080 + i)) + " created" },
    ],
    paperRollRequest: type === "Paper Roll Request"
      ? { quantity: 12 + (i % 4) * 6, paymentTarget: i % 2 === 0 ? "Merchant" : "Bank" }
      : null,
  };
});

/* ---------------- Payouts ---------------- */
const payoutStatusSeq = ["Paid","Paid","Pending","Paid","Pending","Pending","Paid","Pending","Paid","Paid","Pending","Paid","Paid","Pending"];

export const payouts: Payout[] = payoutStatusSeq.map((status, i) => {
  const m = merchants[i % merchants.length];
  const gross = 4200 + i * 1830 + (i % 3) * 920;
  const fee = Math.round(gross * 0.018);
  return {
    id: "PO-" + (90210 + i), merchant: { id: m.id, name: m.name },
    mid: m.mid, bank: m.bank, gross, fee, net: gross - fee,
    txns: 40 + i * 13,
    period: "2026-05-" + (i % 2 ? "16 – 31" : "01 – 15"),
    status,
    exceptions: [], checks: "8 of 8 passed",
    einvoice: status === "Paid",
    issued: status === "Paid" ? "2026-06-01" : null,
    paymentMethod: PAYOUT_METHODS[i % PAYOUT_METHODS.length],
    paymentProof: status === "Paid" ? "bank-receipt-PO-" + (90210 + i) + ".pdf" : null,
  };
});

/* Seed transactions linked to existing payouts */
const _txnMethods = TXN_PAYMENT_METHODS;
let _txnCounter = 100000;
export const transactions: Transaction[] = [];
[0, 1, 2, 3, 6, 9, 12].forEach((pi) => {
  if (pi >= payouts.length) return;
  const p = payouts[pi];
  const count = 8 + pi * 4;
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: "TXN-" + _txnCounter++,
      merchantName: p.merchant.name,
      amount: Math.round((80 + (i * 47 + pi * 13) % 900) * 100) / 100,
      paymentMethod: _txnMethods[(i + pi) % _txnMethods.length],
      date: "2026-05-" + String(1 + (i % 28)).padStart(2, "0"),
      payoutId: p.id,
    });
  }
});

/* ---------------- Terminal settings ---------------- */
export const termSettings: TermSetting[] = [];
let _tsIdx = 0;
brandKeys.forEach((brand) => {
  BRANDS[brand].forEach((model, j) => {
    termSettings.push({
      id: brand.slice(0,3).toUpperCase() + "-" + (100 + j),
      brand, model,
      category: j % 2 ? "Portable" : "Countertop",
      bank: BANKS[_tsIdx++ % BANKS.length],
      monthly: [85, 95, 120, 70][j % 4],
      deposit: [200, 250, 300, 150][j % 4],
      setup: [50, 0, 80, 0][j % 4],
      units: 6 + j * 3,
      active: !(brand === "Verifone" && j === 3),
    });
  });
});

/* ---------------- MDR ---------------- */
export const mdr: MDRRate[] = [
  { id: "MDR-01", type: "Visa — Domestic Debit",        rate: 0.55, cat: "Debit",  network: "Visa" },
  { id: "MDR-02", type: "Visa — Domestic Credit",       rate: 1.10, cat: "Credit", network: "Visa" },
  { id: "MDR-03", type: "Mastercard — Domestic Debit",  rate: 0.55, cat: "Debit",  network: "Mastercard" },
  { id: "MDR-04", type: "Mastercard — Domestic Credit", rate: 1.10, cat: "Credit", network: "Mastercard" },
  { id: "MDR-05", type: "Mastercard — Commercial",      rate: 2.05, cat: "Credit", network: "Mastercard" },
  { id: "MDR-06", type: "American Express",             rate: 2.80, cat: "Credit", network: "Amex" },
  { id: "MDR-07", type: "UnionPay QR",                  rate: 0.80, cat: "QR",     network: "UnionPay" },
  { id: "MDR-08", type: "DuitNow QR",                   rate: 0.25, cat: "QR",     network: "DuitNow" },
  { id: "MDR-09", type: "Contactless (NFC)",            rate: 0.95, cat: "Credit", network: "Multi" },
  { id: "MDR-10", type: "International Cards",          rate: 2.95, cat: "Credit", network: "Multi" },
];

/* ---------------- Users ---------------- */
const userSeq = ["Admin","Operations","Operations","Warehouse","Finance","Operations","Viewer","Warehouse","Finance","Admin"];
export const users: User[] = userSeq.map((role, i) => ({
  id: "U" + (201 + i),
  name: STAFF[i % STAFF.length],
  email: STAFF[i % STAFF.length].toLowerCase().replace(/[^a-z]/g, ".").replace(/\.+/g,".") + "@paidchain.com",
  role,
  status: i === 6 ? "Invited" : (i === 9 ? "Suspended" : "Active"),
  lastActive: i === 6 ? "—" : (i % 3 === 0 ? "2 hours ago" : i % 3 === 1 ? "Yesterday" : "3 days ago"),
  jobs: role === "Operations" || role === "Warehouse" ? 4 + i * 2 : 0,
}));

/* ---------------- Rentals ---------------- */
const _rentalStatusPool = ["Active","Active","Active","Active","Suspended","Active","Active","Ended","Active","Active","Suspended","Ended"];

export const rentals: Rental[] = terminals
  .filter((t) => t.merchant !== null)
  .slice(0, 12)
  .map((t, i) => {
    const m = merchants.find((mx) => mx.id === t.merchant!.id) || merchants[0];
    const status = _rentalStatusPool[i % _rentalStatusPool.length];
    return {
      id: "RNT-" + (4001 + i),
      customer: { id: m.customerId, name: m.customerName, tin: _custSeed.find((c) => c.id === m.customerId)?.tin || "" },
      merchant: { id: m.id, name: m.name, mid: m.mid },
      terminal: { serial: t.serial, brand: t.brand, model: t.model, tid: t.tid },
      plan: RENTAL_PLANS[i % RENTAL_PLANS.length],
      monthlyRate: t.rentalRate,
      deposit: [200, 250, 300, 150][i % 4],
      startDate: "2025-" + String(1 + (i % 10)).padStart(2, "0") + "-01",
      endDate: status === "Ended" ? "2026-03-31" : null,
      status,
      invoiceIssued: i % 3 === 0 ? "2026-05-" + String(10 + i).padStart(2, "0") : null,
      einvoiceIssued: (_custSeed.find((c) => c.id === m.customerId)?.tin && i % 4 === 0) ? "2026-05-" + String(12 + i).padStart(2, "0") : null,
    };
  });

/* Back-fill exception checks on seed payouts now that terminals + rentals are available */
{
  const _allCodes = ["merchant_found","mid_tid_match","merchant_active","mdr_setup","commission_rule","terminal_assigned","rental_setup","tin_ready"];
  payouts.forEach((p) => {
    const m = merchants.find((mx) => mx.id === p.merchant.id)!;
    const cust = _custSeed.find((c) => c.id === m.customerId);
    const excs: PayoutException[] = [];
    if (m.status === "Inactive" || m.status === "Suspended") {
      excs.push({ code: "merchant_active", severity: "error", message: `Merchant is ${m.status.toLowerCase()} — payouts cannot be processed` });
    }
    if (!m.mdrPlan || m.finance !== "Ready") {
      excs.push({ code: "mdr_setup", severity: "error", message: m.finance !== "Ready" ? `Finance status is "${m.finance}" — must be Ready` : "No MDR plan assigned to this merchant" });
    }
    if (!terminals.some((t) => t.merchant?.id === m.id && t.status === "Installed")) {
      excs.push({ code: "terminal_assigned", severity: "warning", message: "No installed terminal linked to this merchant" });
    }
    if (!rentals.some((r) => r.merchant.id === m.id && r.status === "Active")) {
      excs.push({ code: "rental_setup", severity: "warning", message: "No active rental found for this merchant" });
    }
    if (!cust?.tin) {
      excs.push({ code: "tin_ready", severity: "warning", message: "Customer TIN not registered — eInvoice cannot be issued" });
    }
    p.exceptions = excs;
    const failed = new Set(excs.map((e) => e.code));
    p.checks = `${_allCodes.filter((c) => !failed.has(c)).length} of ${_allCodes.length} passed`;
  });
}

/* ---------------- SIM Cards ---------------- */
const _msisdnPrefixes = ["012","013","016","017","018","011","019","012","016","013","017","011","018","016","012","013"];

export const simCards: SimCard[] = [
  // Active — linked to 4G+WiFi terminals
  ...terminals
    .filter((t) => t.sim === "4G + WiFi")
    .slice(0, 8)
    .map((t, i) => ({
      id: "SIM-" + String(1001 + i).padStart(4, "0"),
      iccid: "8960" + String(SIM_CARRIERS.indexOf(SIM_CARRIERS[i % SIM_CARRIERS.length]) + 10).padStart(2, "0") + String(100000000000000 + i * 137891237).slice(0, 13),
      msisdn: _msisdnPrefixes[i] + "-" + String(3000000 + i * 1234567).slice(0, 7),
      carrier: SIM_CARRIERS[i % SIM_CARRIERS.length],
      plan: SIM_PLANS[i % SIM_PLANS.length],
      dataAllowance: SIM_DATA_ALLOWANCES[i % SIM_DATA_ALLOWANCES.length],
      status: "Active",
      terminalSerial: t.serial,
    })),
  // In Storage / Suspended / Retired
  ...Array.from({ length: 8 }, (_, i) => ({
    id: "SIM-" + String(1009 + i).padStart(4, "0"),
    iccid: "8960" + String(20 + i).padStart(2, "0") + String(200000000000000 + i * 987654321).slice(0, 13),
    msisdn: _msisdnPrefixes[8 + i] + "-" + String(7000000 + i * 654321).slice(0, 7),
    carrier: SIM_CARRIERS[(i + 2) % SIM_CARRIERS.length],
    plan: SIM_PLANS[(i + 1) % SIM_PLANS.length],
    dataAllowance: SIM_DATA_ALLOWANCES[(i + 2) % SIM_DATA_ALLOWANCES.length],
    status: i === 3 ? "Suspended" : i === 6 ? "Retired" : "In Storage",
    terminalSerial: null,
  })),
];

/* ---------------- Paper Rolls ---------------- */
export const paperRollEntries: PaperRollEntry[] = [
  { id: "PR-001", type: "Received",   quantity:  200, reference: "PO-BX-2026-001",            note: "Initial stock order",         date: "2026-01-10", createdBy: "Arif Rahman" },
  { id: "PR-002", type: "Issued",     quantity:  -25, reference: "Kopitiam Heritage Sdn Bhd",  note: "Monthly resupply",            date: "2026-01-20", createdBy: "Mei Ling Tan" },
  { id: "PR-003", type: "Issued",     quantity:  -30, reference: "Multiple merchants",          note: "Batch delivery",              date: "2026-02-03", createdBy: "Arif Rahman" },
  { id: "PR-004", type: "Issued",     quantity:  -22, reference: "UrbanThreads Boutique",       note: "",                            date: "2026-02-15", createdBy: "Suresh Kumar" },
  { id: "PR-005", type: "Received",   quantity:  100, reference: "PO-BX-2026-002",            note: "Restocking",                  date: "2026-03-01", createdBy: "Arif Rahman" },
  { id: "PR-006", type: "Issued",     quantity:  -35, reference: "MediCare Pharmacy Group",    note: "Quarterly resupply",          date: "2026-03-12", createdBy: "Mei Ling Tan" },
  { id: "PR-007", type: "Issued",     quantity:  -28, reference: "Sunrise Mart Holdings",       note: "",                            date: "2026-03-20", createdBy: "Nurul Huda" },
  { id: "PR-008", type: "Issued",     quantity:  -25, reference: "TechGear Electronics",        note: "",                            date: "2026-04-05", createdBy: "Arif Rahman" },
  { id: "PR-009", type: "Received",   quantity:   50, reference: "PO-BX-2026-003",            note: "Top-up order",                date: "2026-04-15", createdBy: "Arif Rahman" },
  { id: "PR-010", type: "Issued",     quantity:  -22, reference: "GreenLeaf Organic Café",      note: "",                            date: "2026-04-22", createdBy: "Suresh Kumar" },
  { id: "PR-011", type: "Issued",     quantity:  -20, reference: "Pinnacle Auto Services",      note: "",                            date: "2026-05-01", createdBy: "Mei Ling Tan" },
  { id: "PR-012", type: "Issued",     quantity:  -25, reference: "BlueWave Spa & Wellness",     note: "",                            date: "2026-05-10", createdBy: "Arif Rahman" },
  { id: "PR-013", type: "Adjustment", quantity:  -10, reference: "",                           note: "Damaged stock — write-off",   date: "2026-05-25", createdBy: "Arif Rahman" },
  { id: "PR-014", type: "Issued",     quantity:  -18, reference: "Kopitiam Heritage Sdn Bhd",  note: "Monthly resupply",            date: "2026-06-01", createdBy: "Nurul Huda" },
  { id: "PR-015", type: "Issued",     quantity:  -15, reference: "QuickBite Express",           note: "",                            date: "2026-06-03", createdBy: "Suresh Kumar" },
];
// Running total: 350 received − 275 issued/adjusted = 75 rolls remaining

/* ---------------- Movement timeline helper ---------------- */
/* ---------------- Audit Logs ---------------- */
export const auditLogs: AuditLog[] = [
  { id: "AL-0001", actionAt: "2026-06-07 09:41:03", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Marked payout PO-90216 as Paid",                            type: "Update", entityType: "Payout",   entityId: "PO-90216"  },
  { id: "AL-0002", actionAt: "2026-06-07 09:28:17", user: { id: "U205", name: "Nurul Huda",    role: "Finance"    }, description: "Created payout PO-90223 for Harbour Seafood Market",         type: "Create", entityType: "Payout",   entityId: "PO-90223"  },
  { id: "AL-0003", actionAt: "2026-06-07 09:05:44", user: { id: "U202", name: "Mei Ling Tan",  role: "Operations" }, description: "Updated job JOB-24088 to Job Done",                          type: "Update", entityType: "Job",      entityId: "JOB-24088" },
  { id: "AL-0004", actionAt: "2026-06-07 08:52:09", user: { id: "U203", name: "Suresh Kumar",  role: "Warehouse"  }, description: "Updated job JOB-24085 to Device Prepared",                   type: "Update", entityType: "Job",      entityId: "JOB-24085" },
  { id: "AL-0005", actionAt: "2026-06-07 08:31:55", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Exported terminal inventory report",                         type: "Export", entityType: "Terminal"                        },
  { id: "AL-0006", actionAt: "2026-06-07 08:15:22", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Logged in",                                                  type: "Auth"                                                  },
  { id: "AL-0007", actionAt: "2026-06-06 17:44:31", user: { id: "U206", name: "Daniel Wong",   role: "Operations" }, description: "Created job JOB-24095 — Repair/Maintenance for BlueWave Spa", type: "Create", entityType: "Job",      entityId: "JOB-24095" },
  { id: "AL-0008", actionAt: "2026-06-06 17:12:08", user: { id: "U205", name: "Nurul Huda",    role: "Finance"    }, description: "Uploaded transactions batch — 6 payouts generated",          type: "Create", entityType: "Payout"                          },
  { id: "AL-0009", actionAt: "2026-06-06 16:55:40", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Registered terminal SNPA480224 to inventory",                type: "Create", entityType: "Terminal", entityId: "SNPA480224" },
  { id: "AL-0010", actionAt: "2026-06-06 16:30:17", user: { id: "U204", name: "Priya Nair",    role: "Finance"    }, description: "Issued eInvoice for rental RNT-4004",                        type: "Update", entityType: "Rental",   entityId: "RNT-4004"  },
  { id: "AL-0011", actionAt: "2026-06-06 15:48:02", user: { id: "U202", name: "Mei Ling Tan",  role: "Operations" }, description: "Completed job JOB-24082 — Installation",                    type: "Update", entityType: "Job",      entityId: "JOB-24082" },
  { id: "AL-0012", actionAt: "2026-06-06 15:20:55", user: { id: "U203", name: "Suresh Kumar",  role: "Warehouse"  }, description: "Linked SIM SIM-1003 to terminal SNIN480171",                 type: "Update", entityType: "SimCard",  entityId: "SIM-1003"  },
  { id: "AL-0013", actionAt: "2026-06-06 14:37:19", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Updated SLA threshold — Replacement · Pending → Device Prepared from 7 to 5 days", type: "Update", entityType: "SLARule" },
  { id: "AL-0014", actionAt: "2026-06-06 13:59:44", user: { id: "U207", name: "Hafiz Ismail",  role: "Operations" }, description: "Created rental RNT-4013 — Apex Fitness Studio",               type: "Create", entityType: "Rental",   entityId: "RNT-4013"  },
  { id: "AL-0015", actionAt: "2026-06-06 13:22:08", user: { id: "U205", name: "Nurul Huda",    role: "Finance"    }, description: "Exported payout report for period 2026-05-16 – 31",          type: "Export", entityType: "Payout"                          },
  { id: "AL-0016", actionAt: "2026-06-06 12:05:33", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Created merchant Harbour Seafood Market under Elara Capital", type: "Create", entityType: "Merchant", entityId: "M1055"     },
  { id: "AL-0017", actionAt: "2026-06-06 11:48:20", user: { id: "U202", name: "Mei Ling Tan",  role: "Operations" }, description: "Updated terminal SNVE480437 status to Maintenance",           type: "Update", entityType: "Terminal", entityId: "SNVE480437" },
  { id: "AL-0018", actionAt: "2026-06-06 10:31:05", user: { id: "U208", name: "Joanne Lee",    role: "Admin"      }, description: "Invited user priya.nair@paidchain.com with role Finance",    type: "Create", entityType: "User"                            },
  { id: "AL-0019", actionAt: "2026-06-06 09:44:58", user: { id: "U203", name: "Suresh Kumar",  role: "Warehouse"  }, description: "Received paper roll stock — 100 rolls (PO-BX-2026-003)",    type: "Create", entityType: "PaperRoll"                       },
  { id: "AL-0020", actionAt: "2026-06-06 09:12:37", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Logged in",                                                  type: "Auth"                                                  },
  { id: "AL-0021", actionAt: "2026-06-05 18:03:14", user: { id: "U206", name: "Daniel Wong",   role: "Operations" }, description: "Logged out",                                                 type: "Auth"                                                  },
  { id: "AL-0022", actionAt: "2026-06-05 17:55:41", user: { id: "U204", name: "Priya Nair",    role: "Finance"    }, description: "Exported MDR rate schedule",                                 type: "Export", entityType: "MDRRate"                          },
  { id: "AL-0023", actionAt: "2026-06-05 16:29:08", user: { id: "U202", name: "Mei Ling Tan",  role: "Operations" }, description: "Swapped device on job JOB-24091 — SNPA480118 → SNIN480065",  type: "Update", entityType: "Job",      entityId: "JOB-24091" },
  { id: "AL-0024", actionAt: "2026-06-05 15:44:22", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Deleted terminal setting PAX-103",                           type: "Delete", entityType: "TermSetting", entityId: "PAX-103" },
  { id: "AL-0025", actionAt: "2026-06-05 14:58:09", user: { id: "U207", name: "Hafiz Ismail",  role: "Operations" }, description: "Uploaded transactions batch — 4 payouts generated",          type: "Create", entityType: "Payout"                          },
  { id: "AL-0026", actionAt: "2026-06-05 13:22:46", user: { id: "U205", name: "Nurul Huda",    role: "Finance"    }, description: "Updated MDR rate for DuitNow QR from 0.25% to 0.20%",        type: "Update", entityType: "MDRRate",  entityId: "MDR-08"    },
  { id: "AL-0027", actionAt: "2026-06-05 12:11:33", user: { id: "U203", name: "Suresh Kumar",  role: "Warehouse"  }, description: "Linked SIM SIM-1007 to terminal SNVE480490",                 type: "Update", entityType: "SimCard",  entityId: "SIM-1007"  },
  { id: "AL-0028", actionAt: "2026-06-05 11:05:17", user: { id: "U208", name: "Joanne Lee",    role: "Admin"      }, description: "Created customer Primula Ventures Bhd",                      type: "Create", entityType: "Customer", entityId: "CUST-003"  },
  { id: "AL-0029", actionAt: "2026-06-05 09:48:54", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "System backup completed",                                    type: "System"                                                },
  { id: "AL-0030", actionAt: "2026-06-05 09:00:00", user: { id: "U201", name: "Arif Rahman",   role: "Admin"      }, description: "Logged in",                                                  type: "Auth"                                                  },
];

/* ---------------- Role Permissions ---------------- */
export const PERMISSION_MODULES: { module: string; actions: string[] }[] = [
  { module: "Customers",   actions: ["View", "Create", "Edit", "Delete", "Export"] },
  { module: "Merchants",   actions: ["View", "Create", "Edit", "Delete", "Export"] },
  { module: "Terminals",   actions: ["View", "Create", "Edit", "Delete", "Export"] },
  { module: "Jobs",        actions: ["View", "Create", "Edit", "Delete", "Export", "Escalate", "Close"] },
  { module: "Payouts",     actions: ["View", "Create", "Edit", "Export", "Process"] },
  { module: "Rentals",     actions: ["View", "Create", "Edit", "Export"] },
  { module: "SIM Cards",   actions: ["View", "Create", "Edit", "Delete"] },
  { module: "Paper Rolls", actions: ["View", "Record", "Adjust", "Export"] },
  { module: "Users",       actions: ["View", "Invite", "Edit", "Suspend"] },
  { module: "Settings",          actions: ["View", "Edit"] },
  { module: "Audit Logs",        actions: ["View", "Export"] },
  { module: "Referral Bonuses",  actions: ["View", "Create", "Edit", "Confirm", "Process", "Export"] },
];

const _allPerms = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => `${m.module}.${a}`));

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  "Admin": _allPerms,
  "Operations": [
    "Customers.View",
    "Merchants.View",
    "Terminals.View", "Terminals.Edit",
    "Jobs.View", "Jobs.Create", "Jobs.Edit", "Jobs.Escalate", "Jobs.Close", "Jobs.Export",
    "Payouts.View",
    "Rentals.View", "Rentals.Create", "Rentals.Edit",
    "SIM Cards.View",
    "Paper Rolls.View",
    "Users.View",
    "Settings.View",
    "Audit Logs.View",
  ],
  "Warehouse": [
    "Customers.View",
    "Merchants.View",
    "Terminals.View", "Terminals.Create", "Terminals.Edit", "Terminals.Export",
    "Jobs.View", "Jobs.Edit",
    "SIM Cards.View", "SIM Cards.Edit",
    "Paper Rolls.View", "Paper Rolls.Record", "Paper Rolls.Adjust", "Paper Rolls.Export",
    "Settings.View",
  ],
  "Finance": [
    "Customers.View",
    "Merchants.View",
    "Terminals.View",
    "Jobs.View",
    "Payouts.View", "Payouts.Create", "Payouts.Process", "Payouts.Export",
    "Rentals.View", "Rentals.Create", "Rentals.Edit",
    "Users.View",
    "Settings.View",
    "Audit Logs.View", "Audit Logs.Export",
  ],
  "Viewer": [
    "Customers.View",
    "Merchants.View",
    "Terminals.View",
    "Jobs.View",
    "Payouts.View",
    "Rentals.View",
    "SIM Cards.View",
    "Paper Rolls.View",
    "Audit Logs.View",
  ],
};

export function terminalTimeline(t: Terminal): TimelineEntry[] {
  const base: TimelineEntry[] = [
    { dot: "", time: t.lastMovement + " · 14:22", title: "Status → " + (TERMINAL_STATUS[t.status]?.label || t.status), desc: "Updated by " + STAFF[2] + (t.merchant ? " · linked to " + t.merchant.name : "") },
  ];
  if (["Installed","Assigned","Maintenance","Replacement Out"].includes(t.status)) {
    base.push({ dot: "", time: "2026-04-18 · 09:10", title: "Dispatched to merchant site", desc: "Job JOB-24091 · " + (t.merchant ? t.merchant.name : "") });
    base.push({ dot: "mut", time: "2026-04-15 · 16:40", title: "Device prepared in warehouse", desc: "SIM provisioned · firmware v3.2.1" });
  }
  if (t.status === "Maintenance" || t.status === "Faulty") {
    base.unshift({ dot: "warn", time: "2026-05-28 · 11:05", title: "Flagged for maintenance", desc: t.conditionNote });
  }
  base.push({ dot: "mut", time: "2026-02-02 · 10:00", title: "Received into inventory", desc: "PO batch BX-2026-014 · " + t.brand + " " + t.model });
  return base;
}
