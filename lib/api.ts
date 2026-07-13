/* PaidChain — typed API client (OpenAPI 3.1.0) */

const BASE = process.env.NEXT_PUBLIC_API_URL;

// ─── Token helpers (read/clear via Redux store; lazy require avoids SSR crash) ─

type _Store = import("@/store").RootState;

function getAuthStore() {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("@/store") as { store: { getState: () => { auth: _Store["auth"] }; dispatch: (a: unknown) => void } }).store;
}

export function getToken(): string | null {
  return getAuthStore()?.getState().auth.token ?? null;
}

function dispatchLogout() {
  const s = getAuthStore();
  if (!s) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logout } = require("@/store/authSlice") as { logout: () => { type: string } };
  s.dispatch(logout());
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item !== "object" || item === null) return null;
          const entry = item as { loc?: unknown; msg?: unknown };
          const field = Array.isArray(entry.loc) ? entry.loc.at(-1) : null;
          const message = typeof entry.msg === "string" ? entry.msg : null;
          if (!message) return null;
          return typeof field === "string" ? `${field}: ${message}` : message;
        })
        .filter((part): part is string => !!part);
      if (parts.length > 0) return parts.join(", ");
    }
  }
  return fallback;
}

// ─── Base request ─────────────────────────────────────────────────────────────

async function req<T>(
  method: string,
  path: string,
  opts: { body?: unknown; form?: FormData; params?: object } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = new URL(`${BASE}/api${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== null && v !== undefined) url.searchParams.append(k, String(v));
    }
  }

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), { method, headers, body });

  if (res.status === 401) {
    const hadToken = !!getToken();
    dispatchLogout();
    if (hadToken && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = getErrorMessage(data, `HTTP ${res.status}`);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

async function reqBlob(
  method: string,
  path: string,
  opts: { body?: unknown; form?: FormData; params?: object } = {}
): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = new URL(`${BASE}/api${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== null && v !== undefined) url.searchParams.append(k, String(v));
    }
  }

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), { method, headers, body });

  if (res.status === 401) {
    const hadToken = !!getToken();
    dispatchLogout();
    if (hadToken && typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = getErrorMessage(data, `HTTP ${res.status}`);
    throw new ApiError(res.status, msg);
  }

  return res.blob();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  size: number;
}

export interface ActivityOut {
  at: string;
  event: string;
  note: string | null;
  actor: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type { AuthUser } from "@/store/authSlice";

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: import("@/store/authSlice").AuthUser;
}

export interface MeOut {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id?: string;
  status: string;
  last_active: string | null;
  jobs: number;
  open_jobs_count?: number;
  permissions: string[];
}

export const auth = {
  login: (email: string, password: string) =>
    req<LoginResponse>("POST", "/auth/login", { body: { email, password } }),

  me: () => req<MeOut>("GET", "/auth/me"),

  logout: () => req<void>("POST", "/auth/logout"),

  changePassword: (current_password: string, new_password: string) =>
    req<void>("PATCH", "/auth/password", { body: { current_password, new_password } }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_customers: number;
  total_merchants: number;
  active_terminals: number;
  open_jobs: number;
  pending_payouts: number;
  jobs_breached: number;
}

export interface DashboardJobRef {
  id: string;
  type: string;
  stage: string;
  sla: string;
  merchant: { id: string; name: string };
  due: string;
}

export interface DashboardAlert {
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  entity_id: string | null;
  entity_type: string | null;
}

export interface DashboardActivityItem {
  id: number;
  action_at: string;
  user: { id: string; name: string; role: string };
  description: string;
  type: string;
  entity_type: string;
  entity_id: string;
}

export interface DashboardOut {
  total_active_merchants: number;
  open_jobs_count: number;
  open_jobs_by_type: Record<string, number>;
  terminal_status_breakdown: Record<string, number>;
  pending_payouts_count: number;
  pending_payouts_net: number;
  recent_activity: DashboardActivityItem[];
}

export const dashboard = {
  get: (is_month = false) => req<DashboardOut>("GET", "/dashboard", { params: { is_month } }),
};

// ─── Customers ────────────────────────────────────────────────────────────────

export interface CustomerOut {
  id: string;
  name: string;
  type: string;
  reg_no: string;
  tin: string | null;
  contact: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  onboarded_date: string;
  merchant_count: number;
}

export interface CustomerCreate {
  name: string;
  type: string;
  reg_no: string;
  tin?: string | null;
  contact: string;
  phone: string;
  email: string;
  address: string;
}

export interface CustomerUpdate {
  name?: string | null;
  type?: string | null;
  reg_no?: string | null;
  tin?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
}

export interface CustomerListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
}

export interface CustomerPage {
  items: CustomerOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CustomerDetails {
  total_customers: number;
  total_active: number;
  linked_merchants: number;
}

export interface CustomerMerchantOut {
  id: string;
  customer_id: string;
  customer_name: string;
  name: string;
  type: string;
  mid: string;
  bank: string;
  status: string;
  finance_status: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  onboarded_date: string;
  mdr_plan: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_account_type: string;
  terminal_count: number;
  open_jobs_count: number;
}

export const customers = {
  list: (p?: CustomerListParams) => req<CustomerPage>("GET", "/customers", { params: p }),
  get: (id: string) => req<CustomerOut>("GET", `/customers/${id}`),
  create: (body: CustomerCreate) => req<CustomerOut>("POST", "/customers/create", { body }),
  update: (id: string, body: CustomerUpdate) =>
    req<CustomerOut>("PATCH", `/customers/${id}`, { body }),
  remove: (id: string) => req<void>("DELETE", `/customers/${id}`),
  details: () => req<CustomerDetails>("GET", "/customers/details"),
  merchants: (customerId: string, status?: string) =>
    req<CustomerMerchantOut[]>("GET", `/customers/${customerId}/merchants`, { params: { status } }),
};

// ─── Merchants ────────────────────────────────────────────────────────────────

export interface MerchantOut {
  id: string;
  name: string;
  type: string;
  mid: string;
  bank: string;
  status: string;
  finance: string;
  terminals: number;
  terminal_count?: number;
  open_jobs: number;
  contact: string;
  phone: string;
  email: string;
  address: string;
  onboarded: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_account_type: string;
  customer_id: string;
  customer_name: string;
  secondary_mid?: string | null;
  mids?: MerchantMIDOut[] | null;
  commercial_profile?: MerchantCommercialProfileOut | null;
}

export interface MerchantMIDOut {
  id: string;
  mid: string;
  bank: string;
  status: string;
  is_primary: boolean;
}

export interface MerchantMIDIn {
  mid: string;
  bank: string;
  status: string;
  is_primary?: boolean | null;
  remarks?: string | null;
}


export interface MerchantCommercialProfileIn {
  rental_plan_id?: string | null;
  rental_price?: number | null;
  plan_period?: string | null;
  mdr_plan?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  effective_date?: string | null;
}

export interface MerchantCreate {
  customer_id: string;
  name: string;
  type: string;
  bank: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_account_type: string;
  mid?: string | null;
  secondary_mid?: string | null;
  mids?: MerchantMIDIn[] | null;
  commercial_profile?: MerchantCommercialProfileIn | null;
}

export interface MerchantUpdate {
  name?: string | null;
  type?: string | null;
  bank?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_account_type?: string | null;
  mid?: string | null;
  secondary_mid?: string | null;
  status?: string | null;
  finance_status?: string | null;
}

export interface MerchantListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
  bank?: string;
  customer_id?: string;
}

export interface MerchantPage {
  items: MerchantOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface MerchantDetails {
  total_merchants: number;
  by_status: Record<string, number>;
}

export interface MerchantTerminalOut {
  serial: string;
  term_setting_id: string;
  brand: string;
  model: string;
  status: string;
  tid: string | null;
  location: string;
  last_movement: string;
  rental_rate: number;
  rental_plan: string;
  sim_type: string;
  condition_note: string;
  merchant: { id: string; name: string };
}

export interface MerchantJobOut {
  id: string;
  type: string;
  stage: string;
  stage_index: number;
  status: string;
  sla: string;
  priority: string;
  assignee: string;
  bank: string;
  due_date: string;
  created_at: string;
  created_by_role: string;
  created_by_name: string;
  escalated_to: string | null;
  notes: string;
  customer: { id: string; name: string };
  merchant: { id: string; name: string };
  terminal: { serial: string; brand: string; model: string } | null;
  previous_terminal: { serial: string; brand: string; model: string } | null;
}

export interface MerchantCommercialProfileOut {
  id: string;
  merchant_id: string;
  rental_plan_id: string | null;
  rental_price: number | null;
  plan_period: string | null;
  mdr_plan: string | null;
  trial_start: string | null;
  trial_end: string | null;
  discount_type: string | null;
  discount_value: number | null;
  effective_date: string | null;
}

export const merchants = {
  list: (p?: MerchantListParams) => req<MerchantPage>("GET", "/merchants", { params: p }),
  get: (id: string) => req<MerchantOut>("GET", `/merchants/${id}`),
  create: (body: MerchantCreate) => req<MerchantOut>("POST", "/merchants/create", { body }),
  update: (id: string, body: MerchantUpdate) =>
    req<MerchantOut>("PATCH", `/merchants/${id}`, { body }),
  remove: (id: string) => req<CustomerMerchantOut>("DELETE", `/merchants/${id}`),
  details: () => req<MerchantDetails>("GET", "/merchants/details"),
  terminals: (merchantId: string) => req<MerchantTerminalOut[]>("GET", `/merchants/${merchantId}/terminals`),
  jobs: (merchantId: string, status?: string) =>
    req<MerchantJobOut[]>("GET", `/merchants/${merchantId}/jobs`, { params: { status } }),
  updateCommercial: (merchantId: string, body: MerchantCommercialProfileIn) =>
    req<MerchantCommercialProfileOut>("PATCH", `/merchants/${merchantId}/commercial`, { body }),
};

// ─── Terminal Settings ────────────────────────────────────────────────────────

export interface TermSettingOut {
  id: string;
  brand: string;
  model: string;
  category: string;
  bank: string;
  monthly_rental: number;
  deposit: number;
  setup_fee: number;
  units: number;
  active: boolean;
}

export interface TermSettingCreate {
  brand: string;
  model: string;
  category: string;
  bank: string;
  monthly_rental: number;
  deposit: number;
  setup_fee: number;
  active?: boolean;
}

export const termSettings = {
  list: (params?: { active?: boolean; brand?: string }) =>
    req<TermSettingOut[]>("GET", "/terminals/settings", { params }),
  get: (id: string) => req<TermSettingOut>("GET", `/terminals/settings/${id}`),
  create: (body: TermSettingCreate) => req<TermSettingOut>("POST", "/terminals/settings", { body }),
  update: (id: string, body: Partial<TermSettingCreate>) =>
    req<TermSettingOut>("PATCH", `/terminals/settings/${id}`, { body }),
  remove: (id: string) => req<void>("DELETE", `/terminals/settings/${id}`),
};

// ─── Terminals ────────────────────────────────────────────────────────────────

export interface TerminalOut {
  serial_no: string;
  serial?: string;
  brand: string;
  model: string;
  bank: string;
  status: string;
  tid: string | null;
  merchant: { id: string; name: string } | null;
  location: string;
  last_movement: string;
  rental_rate: number;
  rental_plan: string;
  sim: string;
  condition_note: string;
  term_setting_id: string;
  activity_log?: ActivityOut[];
  open_jobs?: { id: string; type: string; stage: string }[];
}

export function terminalSerial(t: TerminalOut): string {
  return t.serial_no || t.serial || "";
}

export interface TerminalCreate {
  serial_no: string;
  brand: string;
  model: string;
  location: string;
  bank: string;
  rental_rate: number;
  rental_plan: string;
  sim: string;
  condition_note: string;
  term_setting_id: string;
}

export interface TerminalUpdate {
  status?: string;
  tid?: string | null;
  merchant_id?: string | null;
  location?: string;
  rental_rate?: number;
  rental_plan?: string;
  sim?: string;
  condition_note?: string;
}

export interface TerminalListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
  brand?: string;
}

export interface TerminalPage {
  items: TerminalOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SimCardLinkBody {
  terminal_serial: string;
  simcard_id: string;
}

export interface TerminalBulkItem {
  serial_no: string;
  tid?: string | null;
}

export interface TerminalBulkCreate {
  term_setting_id: string;
  serial_numbers?: string[] | null;
  terminals?: TerminalBulkItem[] | null;
  tids?: string[] | null;
  bank?: string | null;
  initial_location?: string;
  sim_type?: string | null;
}

export interface TerminalTidOut {
  id: string;
  terminal_serial: string;
  tid: string;
  mid: string | null;
  merchant_id: string | null;
  bank: string | null;
  status: string;
  effective_date: string;
  termination_date: string | null;
  remarks: string | null;
}

export interface TerminalTidCreate {
  tid: string;
  mid?: string | null;
  merchant_id?: string | null;
  bank?: string | null;
  status?: string;
  effective_date?: string | null;
  termination_date?: string | null;
  remarks?: string | null;
}

export interface TerminalTidUpdate {
  tid?: string;
  mid?: string | null;
  merchant_id?: string | null;
  bank?: string | null;
  status?: string;
  effective_date?: string | null;
  termination_date?: string | null;
  remarks?: string | null;
}

export const terminals = {
  list: (p?: TerminalListParams) => req<TerminalPage>("GET", "/terminals", { params: p }),
  get: (serial: string) => req<TerminalOut>("GET", `/terminals/${serial}`),
  simCard: (serial: string) => req<SimCardOut>("GET", `/terminals/${serial}/simcard`),
  create: (body: TerminalCreate) => req<TerminalOut>("POST", "/terminals", { body }),
  bulkCreate: (body: TerminalBulkCreate) => req<BulkCreateResult>("POST", "/terminals/bulk", { body }),
  update: (serial: string, body: TerminalUpdate) =>
    req<TerminalOut>("PATCH", `/terminals/${serial}`, { body }),
  activity: (serial: string) => req<ActivityOut[]>("GET", `/terminals/${serial}/activity`),
  linkSim: (body: SimCardLinkBody) => req<TerminalOut>("POST", "/terminals/simcard", { body }),
  unlinkSim: (serial: string) => req<TerminalOut>("DELETE", `/terminals/${serial}/simcard`),
  createTid: (serial: string, body: TerminalTidCreate) =>
    req<TerminalTidOut>("POST", `/terminals/${serial}/tids`, { body }),
  listTids: (serial: string) => req<TerminalTidOut[]>("GET", `/terminals/${serial}/tids`),
  updateTid: (tidId: string, body: TerminalTidUpdate) =>
    req<TerminalTidOut>("PATCH", `/terminal-tids/${tidId}`, { body }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface JobEvidenceOut {
  id: number;
  stage: string;
  filename: string;
  path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface JobHistoryEntryOut {
  stage: string;
  at: string;
  actor: string;
  actor_role: string;
  note: string | null;
  evidence: JobEvidenceOut[] | null;
}

export interface JobNotificationOut {
  at: string;
  to: string[];
  subject: string;
}

export interface JobSlaLeg {
  from_stage: string;
  to_stage: string;
  elapsed_days: number;
  warning_days: number;
  breach_days: number;
  status: string;
}

export interface JobOut {
  id: string;
  type: string;
  stage: string;
  stage_index: number;
  status: string;
  sla: string;
  assignee: string;
  bank: string;
  customer: { id: string; name: string } | null;
  merchant: { id: string; name: string };
  terminal: { serial: string; brand: string; model: string } | null;
  previous_terminal: { serial: string; brand: string; model: string } | null;
  merchant_detail: { id: string; name: string; mid: string; bank: string } | null;
  term_setting: { id: string; brand: string; model: string; category: string; monthly_rental: number } | null;
  created_at: string;
  due_date: string;
  priority: string;
  escalated_to: string | null;
  escalated_from_job_id: string | null;
  original_type: string | null;
  escalation_reason: string | null;
  escalated_by_user_id: string | null;
  escalated_at: string | null;
  notes: string;
  created_by_role: string;
  created_by_name: string;
  history: JobHistoryEntryOut[];
  notifications: JobNotificationOut[];
  paper_roll_request: {
    quantity: number;
    payment_target: string;
    invoice_party: string | null;
    invoice_required: boolean | null;
    invoice_status: string | null;
    accounting_handling: string | null;
    billing_reference: string | null;
  } | null;
  sla_leg: JobSlaLeg | null;
  stage_sequence: string[];
  evidence_by_stage: Record<string, JobEvidenceOut[]>;
}

export interface JobCreate {
  type: string;
  customer_id: string;
  merchant_id: string;
  assignee: string;
  priority?: string;
  due_date: string;
  notes?: string | null;
  term_setting_id?: string | null;
  service_terminal_serial?: string | null;
  paper_roll_qty?: number | null;
  payment_target?: string | null;
  invoice_party?: string | null;
  invoice_required?: boolean | null;
  invoice_status?: string | null;
  accounting_handling?: string | null;
  billing_reference?: string | null;
  courier_required?: boolean;
  courier_status?: string | null;
  courier_name?: string | null;
  courier_tracking_no?: string | null;
}

export interface JobUpdate {
  assignee?: string;
  priority?: string;
  desc?: string;
}

export interface JobSlaTransition {
  from_stage: string;
  to_stage: string;
  warning_days: number;
  breach_days: number;
}

export type JobSlaMap = Record<string, JobSlaTransition[]>;

export interface EscalateToReplacementBody {
  term_setting_id: string;
  due_date: string;
  assignee?: string;
  priority?: string;
  service_terminal_serial?: string;
  escalation_reason: string;
  notes?: string;
}

export interface EscalateToReplacementResult {
  repair_job: JobOut;
  replacement_job: JobOut;
}

export interface JobListParams {
  page?: number;
  per_page?: number;
  query?: string;
  type?: string;
  status?: string;
  sla?: string;
}

export interface JobPage {
  items: JobOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface JobDetails {
  total_open: number;
  total_completed: number;
  by_type: Record<string, number>;
  by_sla: Record<string, number>;
}

export const jobs = {
  list: (p?: JobListParams) => req<JobPage>("GET", "/jobs", { params: p }),
  details: () => req<JobDetails>("GET", "/jobs/details"),
  get: (id: string) => req<JobOut>("GET", `/jobs/${id}`),
  create: (body: JobCreate) => req<JobOut>("POST", "/jobs", { body }),
  update: (id: string, body: JobUpdate) => req<JobOut>("PATCH", `/jobs/${id}`, { body }),
  remove: (id: string) => req<void>("DELETE", `/jobs/${id}`),
  advance: (
    id: string,
    opts: { note?: string; previous_terminal_status?: string; proof?: Array<File | { file: File }> }
  ) => {
    const form = new FormData();
    if (opts.note) form.append("note", opts.note);
    if (opts.previous_terminal_status) form.append("previous_terminal_status", opts.previous_terminal_status);
    for (const proof of opts.proof ?? []) {
      const file = proof instanceof File ? proof : proof.file;
      if (file instanceof File) form.append("proof", file, file.name);
    }
    return req<JobOut>("PATCH", `/jobs/${id}/next`, { form });
  },

  assignDevice: (id: string, serial_no: string) =>
    req<JobOut>("POST", `/jobs/${id}/device`, { body: { serial_no } }),

  escalateToReplacement: (id: string, body: EscalateToReplacementBody) =>
    req<EscalateToReplacementResult>("POST", `/jobs/${id}/escalate-to-replacement`, { body }),

  export: (p?: { query?: string; type?: string; status?: string; bank?: string; date_from?: string; date_to?: string; date_field?: string }) =>
    reqBlob("GET", "/jobs/export", { params: p }),

  slaList: () => req<JobSlaMap>("GET", "/settings/sla"),
  slaUpdate: (job_type_slug: string, from_stage: string, to_stage: string, body: { warning_days?: number; breach_days?: number }) =>
    req<JobSlaTransition>("PATCH", `/jobs/sla/${job_type_slug}`, { body: { from_stage, to_stage, ...body } }),
};

// ─── SIM Cards ────────────────────────────────────────────────────────────────

export interface SimCardOut {
  id: string;
  iccid: string;
  msisdn: string;
  carrier: string;
  plan: string;
  data_allowance: string;
  status: string;
  terminal_serial: string | null;
  terminal: { serial: string; brand: string; model: string } | null;
}

export interface SimCardCreate {
  iccid: string;
  msisdn: string;
  carrier: string;
  plan: string;
  data_allowance: string;
}

export interface SimCardUpdate {
  msisdn?: string | null;
  carrier?: string | null;
  plan?: string | null;
  data_allowance?: string | null;
  terminal_serial?: string;
  status?: string | null;
}

export interface SimCardListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
}

export interface SimCardPage {
  items: SimCardOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SimCardDetails {
  total_sims: number;
  total_active: number;
  total_in_storage: number;
  total_suspended: number;
  total_retired: number;
}

export const simCards = {
  list: (p?: SimCardListParams) => req<SimCardPage>("GET", "/simcards", { params: p }),
  get: (id: string) => req<SimCardOut>("GET", `/simcards/${id}`),
  create: (body: SimCardCreate) => req<SimCardOut>("POST", "/simcards", { body }),
  update: (id: string, body: SimCardUpdate) =>
    req<SimCardOut>("PATCH", `/simcards/${id}`, { body }),
  remove: (id: string) => req<void>("DELETE", `/simcards/${id}`),
  details: () => req<SimCardDetails>("GET", "/simcards/details"),
};

// ─── Paper Rolls ──────────────────────────────────────────────────────────────

export interface PaperRollOut {
  id: string;
  type: string;
  quantity: number;
  reference: string;
  note: string;
  date: string;
  created_by: string;
}

export interface PaperRollCreate {
  type: string;
  quantity: number;
  reference: string;
  note?: string;
  date: string;
}

export interface PaperRollListParams {
  page?: number;
  size?: number;
  type?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaperRollDetails {
  current_stock: number;
  total_received: number;
  total_issued: number;
}

export interface PaperRollBillingRow {
  job_id: string;
  stage: string;
  merchant_id: string;
  merchant_name: string;
  bank: string;
  quantity: number;
  payment_target: string;
  invoice_party: string;
  invoice_required: boolean;
  invoice_status: string;
  accounting_handling: string;
  billing_reference: string;
  completed_at: string;
}

export const paperRolls = {
  list: (p?: PaperRollListParams) => req<PaperRollOut[]>("GET", "/paper-rolls", { params: p }),
  create: (body: PaperRollCreate) => req<PaperRollOut>("POST", "/paper-rolls/update", { body }),
  details: () => req<PaperRollDetails>("GET", "/paper-rolls/details"),
  billingReport: (invoice_status?: string) =>
    req<PaperRollBillingRow[]>("GET", "/paper-rolls/billing", { params: invoice_status ? { invoice_status } : undefined }),
  exportBillingReport: (invoice_status?: string) =>
    reqBlob("GET", "/paper-rolls/billing/export", { params: invoice_status ? { invoice_status } : undefined }),
};

// ─── Rentals ──────────────────────────────────────────────────────────────────

export interface RentalOut {
  id: string;
  customer: { id: string; name: string; tin: string };
  merchant: { id: string; name: string; mid: string };
  terminal: { serial: string; brand: string; model: string; tid: string | null };
  plan: string;
  rental_plan_id: string | null;
  plan_period: string | null;
  monthly_rate: number;
  deposit: number;
  start_date: string;
  end_date: string | null;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  discount_type: string | null;
  discount_value: number | null;
  invoice_issued: string | null;
  einvoice_issued: string | null;
}

export interface RentalCreate {
  customer_id: string;
  merchant_id: string;
  terminal_serial: string;
  plan: string;
  monthly_rate: number;
  deposit: number;
  start_date: string;
  end_date?: string | null;
}

export interface RentalUpdate {
  status?: string | null;
  plan?: string | null;
  monthly_rate?: number | null;
  end_date?: string | null;
}



export interface RentalListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
}

export const rentals = {
  list: (p?: RentalListParams) => req<Page<RentalOut>>("GET", "/rentals", { params: p }),
  get: (id: string) => req<RentalOut>("GET", `/rentals/${id}`),
  create: (body: RentalCreate) => req<RentalOut>("POST", "/rentals", { body }),
  update: (id: string, body: RentalUpdate) => req<RentalOut>("PATCH", `/rentals/${id}`, { body }),
  invoice: (id: string) => reqBlob("GET", `/rentals/${id}/invoice`),
  einvoice: (id: string) => reqBlob("GET", `/rentals/${id}/einvoice`),
  export: (p?: { query?: string; status?: string; bank?: string; date_from?: string; date_to?: string; date_field?: string }) =>
    reqBlob("GET", "/rentals/export", { params: p }),
};

// ─── Payouts ──────────────────────────────────────────────────────────────────

export interface PayoutException {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface PayoutCheck {
  code: string;
  severity: "info" | "error" | "warning";
  passed: boolean;
  message: string;
}

export interface PayoutOut {
  id: string;
  merchant: { id: string; name: string };
  mid: string;
  bank: string;
  gross: number;
  fee: number;
  net: number;
  txns: number;
  period_start: string;
  period_end: string;
  status: string;
  exceptions?: PayoutException[];
  checks?: PayoutCheck[];
  einvoice: boolean;
  issued: string | null;
  payment_method: string;
  payment_proof: string | null;
}

export interface BulkCreateResult {
  created: number;
  failed: string[];
}

export interface PayoutTransaction {
  id: string;
  merchant_name: string;
  amount: number;
  payment_method: string;
  txn_date: string;
}

export interface PayoutDetails {
  net_this_cycle: number;
  total_paid_out: number;
  total_pending: number;
  pending_count: number;
}

export interface PayoutListParams {
  page?: number;
  per_page?: number;
  query?: string;
  status?: string;
}

export const payouts = {
  list: (p?: PayoutListParams) => req<Page<PayoutOut>>("GET", "/payouts", { params: p }),
  details: () => req<PayoutDetails>("GET", "/payouts/details"),
  get: (id: string) => req<PayoutOut>("GET", `/payouts/${id}`),

  create: (fields: {
    customer_id: string;
    merchant_id: string;
    period_start: string;
    period_end: string;
    payment_method: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append("customer_id", fields.customer_id);
    form.append("merchant_id", fields.merchant_id);
    form.append("period_start", fields.period_start);
    form.append("period_end", fields.period_end);
    form.append("payment_method", fields.payment_method);
    form.append("file", fields.file);
    return req<PayoutOut>("POST", "/payouts", { form });
  },

  upload: (file: File, period_start?: string, period_end?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (period_start) form.append("period_start", period_start);
    if (period_end) form.append("period_end", period_end);
    return req<BulkCreateResult>("POST", "/payouts/upload", { form });
  },

  update: (
    id: string,
    fields: {
      status?: string;
      payment_method?: string;
      issued_date?: string;
      payment_proof?: File;
    }
  ) => {
    const form = new FormData();
    if (fields.status) form.append("status", fields.status);
    if (fields.payment_method) form.append("payment_method", fields.payment_method);
    if (fields.issued_date) form.append("issued_date", fields.issued_date);
    if (fields.payment_proof) form.append("payment_proof", fields.payment_proof);
    return req<PayoutOut>("PATCH", `/payouts/${id}`, { form });
  },

  remove: (id: string) => req<void>("DELETE", `/payouts/${id}`),
  transactions: (payout_id: string) => req<PayoutTransaction[]>("GET", `/payouts/${payout_id}/transactions`),
};

// ─── Referral Bonuses ────────────────────────────────────────────────────────

export interface ReferralUserRef {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface ReferralMerchantRef {
  id: string;
  name: string;
  mid?: string | null;
}

export interface ReferralAttachmentOut {
  id: string | number;
  filename: string;
  path?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
  url?: string | null;
}

export interface ReferralOut {
  id: string;
  lead_type: string;
  merchant_name: string;
  business_reg_no?: string | null;
  merchant_bank?: string | null;
  referral_source_bank?: string | null;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string | null;
  referrer?: ReferralUserRef | null;
  processor?: ReferralUserRef | null;
  processor_user_id?: string | null;
  lead_status: string;
  status: string;
  commission_status: string;
  submitted_at?: string | null;
  is_bank_referred?: boolean | null;
  is_existing_or_former_merchant?: boolean | null;
  processing_status?: string | null;
  document_submission_date?: string | null;
  bank_submission_reference?: string | null;
  next_follow_up_date?: string | null;
  merchant_id?: string | null;
  merchant?: ReferralMerchantRef | null;
  activation_date?: string | null;
  terminal_serial?: string | null;
  terminal_tid?: string | null;
  first_transaction_date?: string | null;
  first_transaction_reference?: string | null;
  eligibility_date?: string | null;
  reversal_required?: boolean | null;
  reversal_reason?: string | null;
  reversed_at?: string | null;
  reversal_line_created?: boolean | null;
  attachments?: ReferralAttachmentOut[];
  activity_log?: ActivityOut[];
}

export interface ReferralCreate {
  lead_type?: string;
  merchant_name: string;
  business_reg_no?: string | null;
  merchant_bank?: string | null;
  referral_source_bank?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface ReferralUpdate {
  merchant_name?: string | null;
  business_reg_no?: string | null;
  merchant_bank?: string | null;
  referral_source_bank?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_bank_referred?: boolean | null;
  is_existing_or_former_merchant?: boolean | null;
  lead_status?: string | null;
}

export interface ReferralProcessingUpdate {
  lead_status?: string;
  processing_status?: string;
  notes?: string | null;
  document_submission_date?: string | null;
  bank_submission_reference?: string | null;
  next_follow_up_date?: string | null;
}

export interface ReferralListParams {
  page?: number;
  per_page?: number;
  query?: string | null;
  status?: string | null;
  bank?: string | null;
  referrer_user_id?: string | null;
}

export interface ReferralPage {
  items: ReferralOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ReferralBonusLineOut {
  id: string;
  line_id?: string;
  line_type?: string;
  commission_role: string;
  amount: number;
  staff_user_id: string;
  staff_name: string;
  staff_email?: string | null;
  referral_id: string;
  merchant_id?: string | null;
  merchant_name: string;
  reason?: string | null;
}

export interface ReferralBonusBatchOut {
  id: string;
  year: number;
  quarter: number;
  status: string;
  total_amount?: number;
  line_count?: number;
  generated_at?: string | null;
  paid_date?: string | null;
  payment_proof_filename?: string | null;
  lines?: ReferralBonusLineOut[];
}

export interface ReferralBonusBatchListParams {
  page?: number;
  per_page?: number;
  year?: number;
  quarter?: number;
  status?: string;
}

export interface ReferralBonusBatchPage {
  items: ReferralBonusBatchOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ReferralBankReportRow {
  bank: string;
  total: number;
  linked: number;
  qualified: number;
  paid: number;
  reversed: number;
}

export const referrals = {
  list: (p?: ReferralListParams) => req<ReferralPage>("GET", "/referrals", { params: p }),
  bankReport: () => req<ReferralBankReportRow[]>("GET", "/referrals/bank-report"),
  get: (id: string) => req<ReferralOut>("GET", `/referrals/${id}`),
  create: (body: ReferralCreate) => req<ReferralOut>("POST", "/referrals", { body }),
  update: (id: string, body: ReferralUpdate) => req<ReferralOut>("PATCH", `/referrals/${id}`, { body }),
  assignProcessor: (id: string, processor_user_id: string) =>
    req<ReferralOut>("POST", `/referrals/${id}/assign-processor`, { body: { processor_user_id } }),
  updateProcessing: (id: string, body: ReferralProcessingUpdate) =>
    req<ReferralOut>("PATCH", `/referrals/${id}/processing`, { body }),
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<ReferralAttachmentOut>("POST", `/referrals/${id}/attachments`, { form });
  },
  linkMerchant: (id: string, merchant_id: string) =>
    req<ReferralOut>("POST", `/referrals/${id}/link-merchant`, { body: { merchant_id } }),
  cancel: (id: string, reason: string) =>
    req<ReferralOut>("POST", `/referrals/${id}/cancel`, { body: { reason } }),
  confirm: (id: string, body: { first_transaction_date: string; first_transaction_reference?: string | null }) =>
    req<ReferralOut>("POST", `/referrals/${id}/confirm`, { body }),
};

export const referralBonusBatches = {
  list: (p?: ReferralBonusBatchListParams) =>
    req<ReferralBonusBatchPage>("GET", "/referral-bonus-batches", { params: p }),
  get: (id: string) => req<ReferralBonusBatchOut>("GET", `/referral-bonus-batches/${id}`),
  create: (body: { year: number; quarter: number }) =>
    req<ReferralBonusBatchOut>("POST", "/referral-bonus-batches", { body }),
  export: (id: string) => reqBlob("GET", `/referral-bonus-batches/${id}/export`),
  markPaid: (id: string, paid_date: string, payment_proof: File) => {
    const form = new FormData();
    form.append("status", "Paid");
    form.append("paid_date", paid_date);
    form.append("payment_proof", payment_proof);
    return req<ReferralBonusBatchOut>("PATCH", `/referral-bonus-batches/${id}`, { form });
  },
};

export interface ReferralBonusRuleOut {
  id: string;
  name: string;
  observation_days: number;
  bonus_amount: number;
  lead_generator_amount: number;
  processor_amount: number;
  min_txn_count: number;
  min_txn_amount: number;
  require_active_rental: boolean;
  require_installed_terminal: boolean;
  active: boolean;
}

export interface ReferralBonusRuleUpdate {
  observation_days?: number | null;
  bonus_amount?: number | null;
  lead_generator_amount?: number | null;
  processor_amount?: number | null;
  min_txn_count?: number | null;
  min_txn_amount?: number | null;
  require_active_rental?: boolean | null;
  require_installed_terminal?: boolean | null;
  active?: boolean | null;
}

export const referralBonusRules = {
  getActive: () => req<ReferralBonusRuleOut>("GET", "/referral-bonus-rules/active"),
  updateActive: (body: ReferralBonusRuleUpdate) =>
    req<ReferralBonusRuleOut>("PATCH", "/referral-bonus-rules/active", { body }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserOut {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  last_active: string | null;
  jobs: number;
}

export interface UserCreate {
  name: string;
  email: string;
  role_id: string;
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role_id?: string;
  status?: string;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  query?: string;
  role?: string;
  status?: string;
}

export interface UserPage {
  items: UserOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const users = {
  list: (p?: UserListParams) => req<UserPage>("GET", "/users", { params: p }),
  get: (id: string) => req<UserOut>("GET", `/users/${id}`),
  create: (body: UserCreate) => req<UserOut>("POST", "/users", { body }),
  update: (id: string, body: UserUpdate) => req<UserOut>("PATCH", `/users/${id}`, { body }),
  remove: (id: string) => req<void>("DELETE", `/users/${id}`),
  resetPassword: (id: string, password: string) =>
    req<UserOut>("PATCH", `/users/${id}/password`, { body: { password } }),
};

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface RoleOut {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  user_count: number;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permissions?: string[];
}

export const roles = {
  list: () => req<RoleOut[]>("GET", "/roles"),
  get: (id: string) => req<RoleOut>("GET", `/roles/${id}`),
  update: (id: string, body: RoleUpdate) => req<RoleOut>("PATCH", `/roles/${id}`, { body }),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditUserRef {
  id: string | null;
  name: string;
  role: string;
}

export interface AuditLogOut {
  id: number;
  action_at: string;
  user: AuditUserRef;
  description: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface AuditLogListParams {
  page?: number;
  size?: number;
  query?: string;
  type?: string;
  entity_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditLogPage {
  items: AuditLogOut[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const auditLogs = {
  list: (p?: AuditLogListParams) => req<AuditLogPage>("GET", "/logs", { params: p }),
};

// ─── MDR Rates ────────────────────────────────────────────────────────────────

export interface MdrOut {
  id: string;
  type: string;
  rate: number;
  category: string;
  network: string;
}

export interface MdrCreate {
  type: string;
  rate: number;
  category: string;
  network: string;
}

export interface MdrUpdate {
  type?: string;
  rate?: number;
  category?: string;
  network?: string;
}

export const mdr = {
  list: () => req<MdrOut[]>("GET", "/mdr"),
  create: (body: MdrCreate) => req<MdrOut>("POST", "/mdr", { body }),
  update: (rate_id: string, body: MdrUpdate) => req<MdrOut>("PATCH", `/mdr/${rate_id}`, { body }),
};

// ─── Rental Plans ─────────────────────────────────────────────────────────────

export interface RentalPlanOut {
  id: string;
  name: string;
  plan_period: string;
  monthly_rate: number;
  deposit: number;
  setup_fee: number;
  active: boolean;
}

export interface RentalPlanCreate {
  name: string;
  plan_period?: string;
  monthly_rate: number;
  deposit?: number;
  setup_fee?: number;
  active?: boolean;
}

export interface RentalPlanUpdate {
  name?: string;
  plan_period?: string;
  monthly_rate?: number;
  deposit?: number;
  setup_fee?: number;
  active?: boolean;
}

export const rentalPlans = {
  list: (params?: { active?: boolean }) => req<RentalPlanOut[]>("GET", "/settings/rental-plans", { params }),
  create: (body: RentalPlanCreate) => req<RentalPlanOut>("POST", "/settings/rental-plans", { body }),
  update: (plan_id: string, body: RentalPlanUpdate) => req<RentalPlanOut>("PATCH", `/settings/rental-plans/${plan_id}`, { body }),
  deactivate: (plan_id: string) => req<RentalPlanOut>("DELETE", `/settings/rental-plans/${plan_id}`),
};

// ─── Unified export ───────────────────────────────────────────────────────────

export const api = {
  auth,
  dashboard,
  customers,
  merchants,
  termSettings,
  terminals,
  jobs,
  simCards,
  paperRolls,
  rentals,
  payouts,
  referrals,
  referralBonusBatches,
  referralBonusRules,
  users,
  roles,
  auditLogs,
  mdr,
  rentalPlans,
};
