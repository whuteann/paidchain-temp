# PaidChain Flow Map

This document maps the current implemented flows in the app based on the existing screens, routes, and in-memory context state.

It is a product and workflow map of the current build, not an aspirational requirements document.

## 1. System Overview

The app is organized around these main entities:

- `Customer`: billing entity
- `Merchant`: operating outlet/site under a customer
- `Terminal`: device inventory item
- `SIM Card`: connectivity asset that can be linked to a terminal
- `Rental`: commercial relationship linking customer + merchant + terminal
- `Job`: operational workflow record
- `Paper Roll Entry`: stock movement record
- `Payout`: settlement/payment record
- `Transaction`: payout line/source record
- `Terminal Setting`: master template used to register devices
- `Job SLA Rule`: per-job-type threshold rules by transition
- `User`: display-level user directory / roles

Core relationship model:

- One customer can have many merchants.
- One merchant belongs to one customer.
- A terminal may or may not be linked to a merchant.
- A SIM card may or may not be linked to a terminal.
- A rental records `customer + merchant + terminal`.
- A job records `customer + merchant` and may also reference:
  - a replacement or installation inventory terminal
  - an existing deployed merchant terminal
  - a previous terminal in replacement flow
- Jobs can create or update rentals, terminals, and paper roll stock.

## 2. Route Map

Primary routes currently exposed in the app:

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

## 3. Navigation-Level Flow

### Dashboard

Purpose:

- Summary view of fleet, jobs, payouts, and operational alerts.

Current behavior:

- Shows operational metrics and recent jobs.
- Links users deeper into jobs and other modules.
- Does not create or mutate records directly.

## 4. Customer and Merchant Flows

### 4.1 Create Customer

Entry point:

- `/customers`
- Action: `Create Customer`

Steps:

1. User enters customer details.
2. TIN can be captured here.
3. Customer is created as the billing entity.
4. On success, onboarding prompt appears.

Side effects:

- Adds a new `Customer` record.
- Customer starts as `Active`.

### 4.2 Customer Onboarding

Entry point:

- Immediately after customer creation.

Steps:

1. User can skip onboarding.
2. Or user can create the first merchant under the new customer.

Outcome:

- Optional creation of a first merchant tied to the customer.

### 4.3 Add Merchant

Entry points:

- `/merchants`
- `/customers/[id]`

Steps:

1. User selects or inherits an existing customer.
2. User fills merchant details, bank, MDR plan, contact info.
3. Merchant is created under the chosen customer.

Side effects:

- Adds a `Merchant` record.
- Merchant starts in `Onboarding`.
- No manual device-linking to merchant exists anymore.

### 4.4 Merchant Detail

Purpose:

- Read/view merchant profile, linked terminals, and related jobs.

Current behavior:

- Linked terminals are derived from terminal ownership data.
- Merchant jobs are shown as related history.
- There is a `New Job` button in UI, but the main implemented job creation flow is the jobs module.

## 5. Terminal and SIM Inventory Flows

### 5.1 Register Device

Entry point:

- `/terminals`
- Action: `Register Device`

Steps:

1. User selects an existing `Terminal Setting`.
2. Brand/model/category/rental metadata come from that setting.
3. User selects initial location.
4. User is prompted to optionally link a SIM card from `In Storage`.
5. User can skip SIM linking.

Outcome:

- Terminal is created in inventory.
- Serial is auto-generated.

Side effects:

- Adds a `Terminal` record.
- If SIM is selected:
  - SIM becomes `Active`
  - SIM is linked to the terminal
  - terminal connectivity becomes `4G + WiFi`
- If SIM is skipped:
  - terminal connectivity stays `WiFi only`

### 5.2 Terminal Detail

Entry point:

- `/terminals/[id]`

Supported actions:

- Update terminal status
- Link SIM card
- Replace SIM card
- Unlink SIM card
- View linked jobs
- View movement timeline

SIM behavior:

- Replacing a SIM unlinks the current SIM first.
- Unlinked SIM is moved back to `In Storage`.
- Newly linked SIM becomes `Active`.
- Terminal connectivity updates accordingly.

Job behavior:

- Terminal detail can show jobs related to that terminal.

### 5.3 Add SIM Card

Entry point:

- `/simcards`
- Action: `Add SIM Card`

Steps:

1. User completes SIM form.
2. User submits.

Outcome:

- SIM card is created directly into inventory.

Side effects:

- New SIM is created as `In Storage`.
- It is not linked at creation time.

### 5.4 SIM Card Detail

Entry point:

- `/simcards/[id]`

Supported actions:

- Edit SIM metadata
- Change SIM status
- Link terminal
- Unlink terminal
- Move SIM back to storage

Cross-entity behavior:

- Linking a SIM to a terminal sets SIM status to `Active`.
- Clearing a linked terminal moves SIM to `In Storage`.
- If a target terminal already has another SIM, the existing SIM is unlinked first.
- Terminal connectivity flips between `4G + WiFi` and `WiFi only`.

## 6. Rental Flows

### 6.1 Create Rental

Entry point:

- `/rentals`
- Action: `Create Rental`

Steps:

1. User selects merchant.
2. Customer is inferred from the merchant.
3. User selects terminal.
4. User chooses plan, rate, deposit, and start date.
5. User submits.

Outcome:

- Rental record is created with:
  - customer
  - merchant
  - terminal

### 6.2 Rental Detail

Entry point:

- `/rentals/[id]`

Purpose:

- View billing and device relationship details.
- Generate invoice and eInvoice.

Current rules:

- Invoice generation is available from rental detail.
- eInvoice is only available if the linked customer has a TIN number.

Displayed information:

- Customer
- Merchant
- Terminal
- Billing document state
- Rental terms

### 6.3 Rental Creation via Jobs

Rental records can also be created or updated indirectly:

- `Installation` job completion creates a rental.
- `Replacement` job completion updates the active rental terminal.

## 7. Overarching Job System

### 7.1 Core Job Model

Entry points:

- `/jobs`
- `/jobs/[id]`

Each job contains:

- job type
- customer
- merchant
- optional terminal reference
- optional previous terminal reference
- stage and stage index
- priority
- assignee
- history entries
- evidence files
- notification log
- SLA state

### 7.2 SLA Tracking

Current implementation:

- SLA is tracked per transition, not just per overall job.
- Each history entry has a timestamp.
- Elapsed time between status transitions is calculated.
- Current transition state is flagged:
  - `On Track`
  - `Due Soon`
  - `Breached`
  - `Met`

### 7.3 SLA Settings

Entry point:

- `/settings`
- Tab: `Job SLA Settings`

Admin can configure:

- warning days per transition
- breach days per transition
- by job type / flow

Example:

- Replacement
  - `Pending -> Device Prepared`
  - warning `3` days
  - breach `7` days

### 7.4 Notifications

Current implementation:

- Email events are represented as notification log entries on the job.
- They are not real outbound email integrations yet.

### 7.5 Evidence

Current implementation:

- `Job Done` transitions require evidence.
- `Completed` transitions require evidence.
- Remote support completion also requires evidence.

## 8. Job-Type Flows

### 8.1 Installation Job

Creation:

1. Admin creates job.
2. User selects:
   - customer
   - merchant
   - inventory terminal
   - type `Installation`
3. Job starts as `Pending`.
4. Notification log entry is created for Warehouse Manager.
5. Selected terminal is reserved.

Workflow:

1. Warehouse Manager marks `Device Prepared`.
2. Notification log entry is created for Operations.
3. Operations marks `Job Done` with evidence.
4. Notification log entry is created for Admin.
5. Admin marks `Completed` with evidence.

Completion side effects:

- Rental record is created.
- Terminal status becomes `Installed`.
- Terminal is linked to merchant.
- Terminal location becomes `Merchant Site`.
- Terminal activity timeline is updated.

### 8.2 Repair / Maintenance Job

Creation:

1. Helpdesk creates job.
2. User selects:
   - customer
   - merchant
   - type `Repair/Maintenance`
3. Existing deployed merchant terminal is inferred.
4. Job starts as `Pending`.
5. Notification log entry is created for Operations.

Workflow:

1. Operations marks `Job Done` with evidence.
2. Notification log entry is created for Helpdesk and Admin.
3. Admin marks `Completed` with evidence.

Completion side effects:

- Linked terminal activity timeline is updated.
- Terminal is returned to `Installed` at `Merchant Site`.

Note:

- The code currently sets the final actor role for completion to `Admin`.
- The original requirement said `Admin or Helpdesk`.

### 8.3 Replacement Job

Creation:

1. Helpdesk creates job.
2. User selects:
   - customer
   - merchant
   - type `Replacement`
   - new inventory terminal
3. Existing deployed merchant terminal is inferred as previous device.
4. Job starts as `Pending`.
5. Notification log entry is created for Warehouse Manager.
6. New inventory terminal is reserved.

Workflow:

1. Warehouse Manager marks `Device Prepared`.
2. Notification log entry is created for Operations.
3. Operations marks `Job Done` with evidence.
4. Notification log entry is created for Helpdesk and Admin.
5. Helpdesk marks `Completed` with evidence.
6. User is prompted to set the previous terminal inventory status.

Completion side effects:

- Previous terminal status is updated.
- Previous terminal merchant link is cleared.
- Previous terminal timeline is updated.
- New terminal becomes `Installed`.
- New terminal is linked to merchant.
- New terminal timeline is updated.
- Active rental terminal is updated to the new device.
- If no active rental exists, a new rental is created.

### 8.4 Paper Roll Request Job

Creation:

1. Admin creates job.
2. User selects:
   - customer
   - merchant
   - type `Paper Roll Request`
   - roll quantity
   - payment target `Merchant` or `Bank`
3. Job starts as `Pending`.
4. Notification log entry is created for Warehouse Manager.

Workflow:

1. Warehouse Manager marks `Stock Prepared`.
2. Notification log entry is created for Operations.
3. Operations marks `Job Done` with evidence.
4. Notification log entry is created for Admin.
5. Admin marks `Completed` with evidence.

Completion side effects:

- Paper roll stock movement is posted as an `Issued` entry with negative quantity.

### 8.5 Remote Support Job

Creation:

1. Helpdesk creates job.
2. User selects:
   - customer
   - merchant
   - type `Remote Support`
3. Existing deployed merchant terminal is inferred.
4. Job starts as `Pending`.
5. Notification log entry is created for Admin.

Workflow:

1. Helpdesk marks `Completed` with evidence.

Completion side effects:

- Linked terminal activity timeline is updated if a deployed merchant terminal exists.

## 9. Paper Roll Inventory Flow

Entry point:

- `/paper-rolls`

Purpose:

- Manage stock levels independent of job flow.

Supported actions:

- Manual `Update Stock`
- Record:
  - stock in / received
  - stock out / issued
  - stock adjustment

Behavior:

- Running balance is calculated from movement history.
- Low and critical stock states are surfaced.
- Job-driven paper roll completion also writes here.

## 10. Payout and Transaction Flows

### 10.1 Create Payout Manually

Entry point:

- `/payouts`
- Action: `Create Payout`

Steps:

1. User selects merchant.
2. User selects settlement period.
3. User chooses payment method.
4. User enters gross amount.
5. MDR fee is auto-derived at `1.8%` unless overridden.
6. User submits.

Outcome:

- Payout is created in `Pending`.

### 10.2 Upload Transactions and Auto-Generate Payouts

Entry point:

- `/payouts`
- Action: `Upload Transactions`

Steps:

1. User selects settlement period.
2. User uploads CSV/Excel transaction file.
3. App parses file and groups transactions by merchant.
4. App shows preview:
   - merchant
   - transaction count
   - gross
   - MDR fee
   - net payout
5. User confirms processing.

Outcome:

- Multiple payouts are created.
- Related transaction records are created and linked to payouts.

Note:

- The current parser is simulated, not a real spreadsheet parser.

### 10.3 Payout Detail and Payment Confirmation

Entry point:

- `/payouts/[id]`

Supported actions:

- View payout summary
- View transaction breakdown
- Mark payout as paid
- Upload proof of payment

Behavior:

- `Mark as Paid` requires a proof file in the UI flow.
- Payment proof is displayed on the payout.

## 11. Settings and Configuration Flows

### 11.1 Settings

Entry point:

- `/settings`

Current tabs:

- `Terminal Settings`
- `Job SLA Settings`

Terminal settings:

- Create and maintain brand/model/category/rental templates used during device registration.

Job SLA settings:

- Configure warning and breach thresholds by flow and stage transition.

### 11.2 Users & Roles

Entry point:

- `/users`

Current behavior:

- User directory UI
- Invite/create user UI
- Role assignment UI

Current limitation:

- Roles are descriptive only.
- There is no enforced RBAC or permission engine in the app yet.

## 12. Cross-Module Side Effects

These are the most important record mutations across modules:

- Creating a terminal can optionally activate and link a SIM.
- Replacing/unlinking a SIM updates both SIM status and terminal connectivity.
- Installation job completion creates a rental and activates terminal deployment state.
- Replacement job completion updates both old and new terminal timelines and updates the active rental device.
- Remote support and repair jobs append terminal activity.
- Paper roll request completion posts stock movement.
- Rental detail invoice actions update invoice/eInvoice fields on the rental.

## 13. Current Role / Permission Reality

The app currently displays the signed-in header user as `Arif Rahman` with role `Administrator`.

Important implementation note:

- There is no actual `SuperAdmin` role implemented.
- There is no enforced permission system.
- The current build behaves like a full-access admin demo session rather than a role-restricted app.

## 14. Known Implementation Notes

- Context providers keep records in memory for the current app session.
- Job notifications are stored as log entries, not sent as real emails.
- Payout upload uses simulated parsing logic.
- Merchant detail still reads some related jobs and terminals from static data instead of being fully context-driven everywhere.

