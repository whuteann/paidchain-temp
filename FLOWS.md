# PaidChain Flow Map

This document maps the implemented flows in the app based on the existing screens, routes, and in-memory context state. It is a product and workflow map of the current build, not an aspirational requirements document.

---

## 1. Flow Index

| # | Flow | Entry point |
|---|---|---|
| 4.1 | Onboard new customer | `/customers` |
| 4.2 | Add merchant to customer | `/customers/[id]` |
| 5.1 | Create terminal setting (model template) | `/settings` → Terminal Settings tab |
| 5.2 | Register new terminal device | `/settings` → Terminal Settings → Register from setting |
| 5.3 | Manage terminal (status, SIM, timeline) | `/terminals/[id]` |
| 5.4 | Add SIM card | `/simcards` |
| 5.5 | Manage SIM card | `/simcards/[id]` |
| 6.1 | Create rental | `/rentals` |
| 6.2 | View rental and issue invoice / eInvoice | `/rentals/[id]` |
| 7.1 | Job: Installation | `/jobs` |
| 7.2 | Job: Repair / Maintenance | `/jobs` |
| 7.3 | Job: Replacement | `/jobs` |
| 7.4 | Job: Paper Roll Request | `/jobs` |
| 7.5 | Job: Remote Support | `/jobs` |
| 8.1 | Configure Job SLA thresholds | `/settings` → Job SLA Settings tab |
| 9.1 | Manage paper roll stock | `/paper-rolls` |
| 10.1 | Create payout | `/payouts` |
| 10.2 | Upload transactions and auto-generate payouts | `/payouts` |
| 10.3 | View payout and confirm payment | `/payouts/[id]` |
| 11.1 | Configure MDR rates | `/mdr` |
| 12.1 | Manage users and roles | `/users` |

---

## 2. Route Map

- `/dashboard`
- `/customers`
- `/customers/[id]`
- `/merchants`
- `/merchants/[id]`
- `/terminals`
- `/terminals/[id]`
- `/simcards`
- `/simcards/[id]`
- `/jobs`
- `/jobs/[id]`
- `/rentals`
- `/rentals/[id]`
- `/paper-rolls`
- `/payouts`
- `/payouts/[id]`
- `/mdr`
- `/settings`
- `/users`

---

## 3. System Overview

The app is organized around these main entities:

- `Customer` — billing entity
- `Merchant` — operating outlet/site under a customer
- `Terminal` — device inventory item
- `SIM Card` — connectivity asset that can be linked to a terminal
- `TermSetting` — brand/model template used to register terminal devices
- `Rental` — commercial record linking customer + merchant + terminal
- `Job` — operational workflow record
- `PaperRollEntry` — stock movement log
- `Payout` — settlement/disbursement record
- `Transaction` — payout line/source record
- `MDRRate` — merchant discount rate reference table
- `User` — operator directory / roles

Core relationship rules:

- One customer can have many merchants. A merchant belongs to exactly one customer.
- A merchant cannot be created without a parent customer.
- A terminal must be created from an existing terminal setting.
- A SIM card may or may not be linked to one terminal.
- A rental records `customer + merchant + terminal`.
- A job records `customer + merchant` and may also reference a terminal.
- Payout gross is derived from uploaded transaction totals, not entered manually.
- MDR fee rates are configured in the MDR settings and applied when calculating payouts.

---

## 4. Customer and Merchant Flows

### 4.1 Onboard New Customer

Entry point: `/customers` → `Create Customer`

Steps:

1. Admin fills in customer profile: name, type, registration number, TIN, contact details, address.
2. Customer is created with status `Active`.
3. Admin is prompted: add a merchant now, or do it later.

Side effects:

- New `Customer` record created.
- If the admin chooses to add a merchant immediately, flow continues into 4.2.

### 4.2 Add Merchant to Customer

Entry point: `/customers/[id]` → `Add Merchant`

Rules:

- A merchant can only be created from within a customer detail page.
- If no customer exists yet, the Admin must create one first (see 4.1).
- There is no standalone "add merchant" entry on `/merchants` — that page is read-only listing.

Steps:

1. Admin opens a customer record.
2. Admin clicks `Add Merchant`.
3. Customer is pre-filled and locked.
4. Admin fills merchant details: name, type, MID, bank, MDR plan, contact, bank account details.
5. Merchant is created under that customer.

Side effects:

- New `Merchant` record created with `customerId` set.
- Merchant starts with status `Onboarding`.

---

## 5. Terminal and SIM Flows

### 5.1 Create Terminal Setting (Model Template)

Entry point: `/settings` → `Terminal Settings` tab → `Add Setting`

Steps:

1. Admin selects brand and model.
2. Admin sets rental rate (RM/month), deposit fee, and setup fee.
3. Admin sets category (Countertop / Portable) and target bank.
4. Setting is created as active.

Side effects:

- New `TermSetting` record created.
- Available as a selectable template when registering new terminal devices.

### 5.2 Register New Terminal Device

Entry point: `/terminals` → `Register Device` (requires an existing terminal setting)

Rules:

- A terminal setting must be selected — brand, model, and rental rates are inherited from it.
- A terminal cannot be registered without a parent terminal setting.

Steps:

1. User selects an existing terminal setting. Brand, model, category, and rental rates populate from the setting.
2. User selects initial location.
3. Serial number is auto-generated.
4. Optionally, user links a SIM card from `In Storage` inventory.
5. Device is registered.

Side effects:

- New `Terminal` record created with `termSettingId` set, status `In Stock`.
- If a SIM is linked: SIM status → `Active`; terminal connectivity → `4G + WiFi`.
- If SIM is skipped: terminal connectivity → `WiFi only`.

### 5.3 Manage Terminal Device

Entry point: `/terminals/[id]`

Supported actions:

- Update terminal status (logged to movement timeline).
- Link SIM card from storage.
- Replace existing SIM card.
- Unlink SIM card (returns SIM to `In Storage`).
- View linked jobs.
- View movement timeline.
- View linked terminal setting.

### 5.4 Add SIM Card

Entry point: `/simcards` → `Add SIM Card`

Steps:

1. User fills SIM details: ICCID, MSISDN, carrier, plan, data allowance.
2. SIM is created as `In Storage`, unlinked.

### 5.5 Manage SIM Card

Entry point: `/simcards/[id]`

Supported actions:

- Edit SIM metadata.
- Change SIM status.
- Link to a terminal (SIM → `Active`; terminal connectivity → `4G + WiFi`).
- Unlink from terminal (SIM → `In Storage`; terminal connectivity → `WiFi only`).
- If target terminal already has a SIM, the existing SIM is unlinked first.

---

## 6. Rental Flows

### 6.1 View Rental and Issue Invoice / eInvoice

Entry point: `/rentals/[id]`

Displayed information:

- Customer, merchant, terminal, billing terms, invoice status.

Supported actions:

- Issue invoice.
- Issue eInvoice — only available if the linked customer has a TIN number.

---

## 7. Job Flows

### Job System Overview

Every job contains:

- Job type, customer, merchant, optional terminal reference.
- Stage and stage history with timestamps.
- SLA tracking per stage transition.
- Evidence uploads per stage.
- Notification log entries (representing emails).
- Priority and assignee.

SLA tracking:

- Duration between each stage transition is calculated from history timestamps.
- Each current transition is flagged as `On Track`, `Due Soon`, `Breached`, or `Met`.
- SLA thresholds are configurable per job type and per transition in Settings (see 8.1).

### 7.1 Job: Installation

Created by: Admin

Creation steps:

1. Admin selects existing customer and merchant.
2. Admin selects a terminal device from inventory.
3. Job type: `Installation`. Status: `Pending`.
4. Notification sent to Warehouse Manager.

Workflow:

1. Warehouse Manager marks `Device Prepared`. Notification sent to Operations.
2. Operations completes on-site work, marks `Job Done` with evidence. Notification sent to Admin.
3. Admin signs off and marks `Completed` with proof.

Completion side effects:

- `Rental` record created with customer, merchant, and selected terminal.
- Terminal status → `Installed` at `Merchant Site`.
- Terminal activity timeline updated.

### 7.2 Job: Repair / Maintenance

Created by: Helpdesk

Creation steps:

1. Helpdesk selects existing customer and merchant.
2. Job type: `Repair/Maintenance`. Status: `Pending`.
3. Existing deployed terminal for the merchant is inferred.
4. Notification sent to Operations.

Workflow:

1. Operations completes maintenance and uploads form, marks `Job Done` with evidence. Notification sent to Helpdesk and Admin.
2. Admin or Helpdesk marks `Completed` with proof.

Completion side effects:

- Linked terminal activity timeline updated.
- Terminal returned to `Installed` at `Merchant Site`.

### 7.3 Job: Replacement

Created by: Helpdesk

Creation steps:

1. Helpdesk selects existing customer and merchant.
2. Helpdesk selects replacement terminal device from inventory.
3. Job type: `Replacement`. Status: `Pending`.
4. Existing deployed merchant terminal is inferred as the previous device.
5. Notification sent to Warehouse Manager.
6. Replacement terminal is reserved.

Workflow:

1. Warehouse Manager marks `Device Prepared`. Notification sent to Operations.
2. Operations completes swap, marks `Job Done` with evidence. Notification sent to Helpdesk and Admin.
3. Admin or Helpdesk marks `Completed` with proof.
4. A prompt is displayed asking for the previous terminal's new inventory status.

Completion side effects:

- Previous terminal: merchant link cleared, status updated per user input, timeline updated.
- New terminal: status → `Installed` at `Merchant Site`, timeline updated.
- Active rental terminal updated to the new device. If no active rental exists, a new rental is created.

### 7.4 Job: Paper Roll Request

Created by: Admin

Creation steps:

1. Admin selects existing customer and merchant.
2. Job type: `Paper Roll Request`.
3. Admin enters quantity and sets payment target: `Merchant` or `Bank`.
4. Status: `Pending`. Notification sent to Warehouse Manager.

Workflow:

1. Warehouse Manager prepares rolls and marks `Stock Prepared`. Notification sent to Operations.
2. Operations delivers rolls, marks `Job Done` with evidence. Notification sent to Admin.
3. Admin confirms payment and marks `Completed`.

Completion side effects:

- Paper roll stock updated: `Issued` entry posted with negative quantity.

### 7.5 Job: Remote Support

Created by: Helpdesk

Creation steps:

1. Helpdesk selects existing customer and merchant.
2. Job type: `Remote Support`. Status: `Pending`.
3. Notification sent to Admin.

Workflow:

1. Helpdesk resolves the issue and marks `Completed` with evidence.

Completion side effects:

- If a deployed terminal is linked to the merchant, its activity timeline is updated.

---

## 8. Settings Flows

### 8.1 Configure Job SLA Thresholds

Entry point: `/settings` → `Job SLA Settings` tab

Admin can configure warning and breach day thresholds for each stage transition within each job type.

Example:

- Replacement — `Pending → Device Prepared`: warning 3 days, breach 7 days.
- Each transition is configured independently.

These values drive the `On Track` / `Due Soon` / `Breached` / `Met` SLA flags shown on every job.

---

## 9. Paper Roll Stock Flow

Entry point: `/paper-rolls`

Supported actions:

- Record stock in (received).
- Record stock out (issued).
- Record stock adjustment.
- Monitor running balance and history.

Running balance is calculated from all movement entries. Low and critical stock states are surfaced. Job-driven paper roll completion also writes here automatically.

---

## 10. Payout Flows

### 10.1 Create Payout

Entry point: `/payouts` → `Create Payout`

Steps:

1. User selects existing customer.
2. User selects merchant under that customer.
3. User sets settlement period and payment method.
4. User uploads a transactions file (Excel or CSV).
5. File is parsed; transaction rows are displayed with totals.
6. Gross is derived by summing all transaction amounts.
7. MDR fee is auto-calculated (default 1.8%).
8. User optionally checks `Generate eInvoice` to issue an invoice on creation.
9. User confirms to create the payout.

Side effects:

- `Payout` record created as `Pending`.
- `Transaction` records created and linked to the payout.
- If eInvoice was selected: `einvoice = true` and `issued` date set.

### 10.2 Upload Transactions and Auto-Generate Payouts (Batch)

Entry point: `/payouts` → `Upload Transactions`

Steps:

1. User selects settlement period.
2. User uploads a CSV/Excel file containing transactions for multiple merchants.
3. File is parsed and transactions are grouped by merchant.
4. Preview table shows: merchant, transaction count, gross, MDR fee, net payout per group.
5. User confirms processing.

Side effects:

- One `Payout` record created per merchant group, all as `Pending`.
- `Transaction` records created and linked to their respective payouts.

### 10.3 View Payout and Confirm Payment

Entry point: `/payouts/[id]`

Supported actions:

- View payout summary (merchant, period, gross, fee, net).
- View transaction breakdown.
- Mark as paid — requires uploading a proof-of-payment file.

Side effects on mark as paid:

- `paymentProof` set to uploaded file name.
- `einvoice = true`, `issued` date set.

---

## 11. MDR Rate Settings

Entry point: `/mdr`

Purpose:

- Configure merchant discount rates by payment type and network.
- These rates are the reference for MDR fee calculations applied to payouts.

Supported actions:

- View all rate entries.
- Edit rate values per payment type (e.g. Visa Domestic Debit, DuitNow QR, American Express).

Rate structure: each entry has a payment type label, a network, a category (Debit / Credit / QR), and a percentage rate.

---

## 12. User Management

Entry point: `/users`

Supported actions:

- View operator directory with roles and activity.
- Invite or create a new user.
- Assign or change roles.

Roles: `Admin` · `Operations` · `Warehouse` · `Finance` · `Viewer`

Current limitation: roles are descriptive only. There is no enforced RBAC or permission engine in the current build.

---

## 13. Cross-Module Side Effects

| Trigger | Side effects |
|---|---|
| Create Terminal + link SIM | SIM → `Active`; terminal connectivity → `4G + WiFi` |
| Unlink/replace SIM on Terminal | Old SIM → `In Storage`; connectivity updated |
| Installation Job → Completed | Terminal → `Installed` at Merchant Site; Rental created |
| Replacement Job → Completed | Old terminal cleared; new terminal → `Installed`; active Rental device updated |
| Paper Roll Request Job → Completed | `PaperRollEntry` Issued record posted with negative quantity |
| Upload transactions for payout | `Transaction` records created and linked via `payoutId` |
| Payout → Mark as Paid | `paymentProof` set; `einvoice = true`; `issued` date set |
| Rental eInvoice | Only issuable if `customer.tin` is non-empty |

---

## 14. Implementation Notes

- Context providers keep all records in memory for the current session only.
- Job notifications are stored as log entries — there is no real outbound email integration.
- Transaction file parsing is simulated — there is no real spreadsheet parser.
- There is no enforced RBAC; the current build behaves as a full-access admin demo session.
