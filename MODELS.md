# PaidChain — Data Models & Relationships

This document is the canonical reference for every model in the system, their fields, and how they relate to each other. It reflects the current in-code definitions in `components/data.ts`.

---

## Entity Overview

| Model | Role |
|---|---|
| `Customer` | Billing/contracting entity. Parent of all merchants. |
| `Merchant` | Operating outlet or site. Child of one customer. |
| `Terminal` | Physical POS device. May be linked to a merchant. |
| `SimCard` | Connectivity asset. May be linked to one terminal. |
| `Rental` | Billing record linking a customer, merchant, and terminal. |
| `Job` | Operational workflow record. Always tied to a merchant. |
| `Payout` | Settlement/disbursement record. Tied to one merchant. |
| `Transaction` | Line-level transaction. Rolls up into one payout. |
| `PaperRollEntry` | Stock movement log. Standalone — not linked to other records. |
| `TermSetting` | Terminal model/plan master template. Used during device registration. |
| `MDRRate` | Merchant Discount Rate configuration. Standalone reference table. |
| `User` | Operator directory and role assignments. |

---

## Relationship Map

```
Customer ──< Merchant ──< Job
                │          └── Terminal (optional ref)
                │          └── previousTerminal (optional ref)
                │
                ├──< Rental ──── Terminal
                │
                └──< Payout ──< Transaction

Terminal >── TermSetting  (each Terminal must reference one TermSetting)
Terminal ──── SimCard (0..1)
Terminal ──< Job (via terminal or previousTerminal ref)

MDRRate        (no FK relations — fee reference table)
PaperRollEntry (no FK relations — append-only log)
User           (no FK relations — operator directory)
```

---

## Models

### Customer

The top-level billing entity. All merchants must belong to a customer.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `CUST-001` |
| `name` | `string` | Company name |
| `type` | `string` | `Corporate` · `SME` · `Partnership` |
| `regNo` | `string` | Company registration number |
| `tin` | `string` | Tax identification number — required for eInvoice on rentals |
| `contact` | `string` | Primary contact person |
| `phone` | `string` | |
| `email` | `string` | |
| `address` | `string` | |
| `status` | `string` | `Active` · `Inactive` · `Suspended` |
| `onboarded` | `string` | ISO date |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

---

### Merchant

An operating outlet or site. Always belongs to one customer.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `M1042` |
| `name` | `string` | |
| `type` | `string` | F&B · Retail · Healthcare · etc. |
| `mid` | `string` | Merchant ID as issued by the acquiring bank |
| `bank` | `string` | Acquiring bank |
| `status` | `string` | `Active` · `Onboarding` · `Suspended` · `Inactive` |
| `finance` | `string` | `Ready` · `Pending Docs` · `Not Ready` |
| `terminals` | `number` | Count of linked terminals |
| `openJobs` | `number` | Count of open jobs |
| `contact` | `string` | |
| `phone` | `string` | |
| `email` | `string` | |
| `address` | `string` | |
| `onboarded` | `string` | ISO date |
| `mdrPlan` | `string` | MDR plan label (descriptive) |
| `bankAccountName` | `string` | Bank account name for payout settlement |
| `bankAccountNumber` | `string` | |
| `bankAccountType` | `string` | `Current` · `Savings` |
| `customerId` | `string` | FK → `Customer.id` |
| `customerName` | `string` | Denormalised display name |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

---

### Terminal

A physical POS terminal in the device inventory.

| Field | Type | Notes |
|---|---|---|
| `serial` | `string` | Primary key. e.g. `SNIN480012` |
| `brand` | `string` | Ingenico · PAX · Verifone |
| `model` | `string` | e.g. `Move/5000` |
| `status` | `string` | See terminal status enum below |
| `tid` | `string \| null` | Terminal ID — present when linked to a merchant |
| `merchant` | `{ id, name } \| null` | FK → `Merchant.id`. Null when undeployed |
| `location` | `string` | `Merchant Site` · `KL Warehouse` · `Repair Center` · `In Transit` · `Returns Bay` |
| `lastMovement` | `string` | ISO date of last status change |
| `rentalRate` | `number` | Monthly RM rate |
| `rentalPlan` | `string` | Plan label |
| `sim` | `string` | `4G + WiFi` (SIM linked) · `WiFi only` |
| `conditionNote` | `string` | Free text condition description |
| `termSettingId` | `string` | FK → `TermSetting.id`. Required — set at registration, never null |
| `activityLog` | `TimelineEntry[]?` | Movement/event history |

**Terminal status enum:** `In Stock` · `Reserved` · `Assigned` · `Installed` · `Maintenance` · `Replacement Out` · `Returned` · `Faulty` · `Retired`

---

### SimCard

A SIM card that can be linked to at most one terminal.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `SIM-1001` |
| `iccid` | `string` | |
| `msisdn` | `string` | Phone number |
| `carrier` | `string` | Maxis · Celcom · Digi · U Mobile · Yes 4G |
| `plan` | `string` | |
| `dataAllowance` | `string` | |
| `status` | `string` | `Active` · `In Storage` · `Suspended` · `Retired` |
| `terminalSerial` | `string \| null` | FK → `Terminal.serial`. Null when unlinked |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

**SIM ↔ Terminal rules:**
- A terminal can have at most one SIM. A SIM can be in at most one terminal.
- Linking a SIM sets its status to `Active` and sets `Terminal.sim = "4G + WiFi"`.
- Unlinking a SIM sets its status to `In Storage` and sets `Terminal.sim = "WiFi only"`.
- Replacing a SIM automatically unlinks the existing one first.

---

### Job

An operational workflow record. Always tied to a customer and merchant.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `JOB-24080` |
| `type` | `string` | See job type enum below |
| `stage` | `string` | Current workflow stage label |
| `stageIndex` | `number` | Index within the job type's stage list |
| `status` | `string` | Mirrors `stage` — used for status chip display |
| `sla` | `string` | `On Track` · `Due Soon` · `Breached` · `Met` |
| `assignee` | `string` | Staff name |
| `bank` | `string` | Denormalised from merchant |
| `customer` | `{ id, name } \| null` | FK → `Customer.id` |
| `merchant` | `{ id, name }` | FK → `Merchant.id` |
| `terminal` | `{ serial, brand, model } \| null` | FK → `Terminal.serial`. New/replacement device |
| `previousTerminal` | `{ serial, brand, model } \| null` | FK → `Terminal.serial`. Replaced device (Replacement jobs only) |
| `created` | `string` | ISO date |
| `due` | `string` | ISO date |
| `priority` | `string` | `Normal` · `High` · `Urgent` · `Low` |
| `escalatedTo` | `string \| null` | Staff name if escalated |
| `desc` | `string` | Free text description |
| `createdByRole` | `string` | Role of creator |
| `createdByName` | `string` | Name of creator |
| `history` | `JobHistoryEntry[]` | Ordered list of stage transitions |
| `notifications` | `JobNotification[]` | Log of email notification events |
| `paperRollRequest` | `{ quantity, paymentTarget } \| null` | Present only on `Paper Roll Request` jobs |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

**Job type enum:** `Installation` · `Repair/Maintenance` · `Replacement` · `Paper Roll Request` · `Remote Support`

**JobHistoryEntry:** `{ stage, at, actor, actorRole, note?, evidence? }`

**JobNotification:** `{ at, to[], subject }`

---

### Rental

A commercial record linking a customer, merchant, and terminal for a billing period.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `RNT-4001` |
| `customer` | `{ id, name, tin }` | FK → `Customer.id` |
| `merchant` | `{ id, name, mid }` | FK → `Merchant.id` |
| `terminal` | `{ serial, brand, model, tid }` | FK → `Terminal.serial` |
| `plan` | `string` | e.g. `Monthly Rental` · `12-mo Contract` |
| `monthlyRate` | `number` | RM |
| `deposit` | `number` | RM |
| `startDate` | `string` | ISO date |
| `endDate` | `string \| null` | ISO date — null if active |
| `status` | `string` | `Active` · `Suspended` · `Ended` |
| `invoiceIssued` | `string \| null` | ISO date |
| `einvoiceIssued` | `string \| null` | ISO date — only set if customer has TIN |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

**Creation rules:**
- Rentals are created on `Installation` job completion.
- Rentals can also be created manually from `/rentals`.
- The linked terminal is updated when a `Replacement` job completes.
- eInvoice can only be issued if `customer.tin` is non-empty.

---

### Payout

A settlement/disbursement record for one merchant covering a defined period.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `PO-90210` |
| `merchant` | `{ id, name }` | FK → `Merchant.id` |
| `mid` | `string` | Denormalised MID |
| `bank` | `string` | Denormalised bank |
| `gross` | `number` | Total transaction value in RM |
| `fee` | `number` | MDR fee in RM (typically 1.8% of gross) |
| `net` | `number` | `gross − fee` |
| `txns` | `number` | Count of linked transactions |
| `period` | `string` | Settlement period label e.g. `2026-05-16 – 31` |
| `status` | `string` | `Pending` · `Paid` |
| `exception` | `string \| null` | Exception flag description |
| `checks` | `string` | Validation check summary |
| `einvoice` | `boolean` | Whether an eInvoice has been issued |
| `issued` | `string \| null` | ISO date invoice was issued |
| `paymentMethod` | `string` | e.g. `Visa` · `DuitNow QR` · `Multi-Method` |
| `paymentProof` | `string \| null` | File name of uploaded proof of payment |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

**Creation methods:**
1. **Manual** — user picks a customer and merchant, uploads a transactions file, totals are derived from the parsed rows, and an eInvoice can be generated at creation.
2. **Batch upload** — a file is uploaded and parsed; payouts are auto-generated grouped by merchant across the file.

**State transition:** `Pending → Paid` requires a proof-of-payment file upload.

---

### Transaction

A single payment event. Always linked to one payout.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `TXN-100000` |
| `merchantName` | `string` | Denormalised from payout's merchant |
| `amount` | `number` | RM |
| `paymentMethod` | `string` | e.g. `Visa Credit` · `DuitNow QR` |
| `date` | `string` | ISO-like date string |
| `payoutId` | `string \| null` | FK → `Payout.id` |

---

### PaperRollEntry

An append-only stock movement log. Not linked to any other entity by FK.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `PR-001` |
| `type` | `"Received" \| "Issued" \| "Adjustment"` | |
| `quantity` | `number` | Positive for received, negative for issued/adjustment |
| `reference` | `string` | Free text — PO number or merchant name |
| `note` | `string` | Free text |
| `date` | `string` | ISO date |
| `createdBy` | `string` | Staff name |
| `isNew` | `boolean?` | UI badge flag — ephemeral |

**Running balance** is derived by summing `quantity` across all entries in order.

---

### TermSetting

A master template for a terminal brand/model. Must be selected when registering a new device — the resulting `Terminal` stores a FK back to this record.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `ING-100` |
| `brand` | `string` | |
| `model` | `string` | |
| `category` | `string` | `Countertop` · `Portable` |
| `bank` | `string` | Target acquiring bank |
| `monthly` | `number` | Default monthly rental rate (RM) |
| `deposit` | `number` | Default deposit (RM) |
| `setup` | `number` | Default setup fee (RM) |
| `units` | `number` | Available stock count |
| `active` | `boolean` | Whether this setting is available for use |

---

### MDRRate

A rate entry in the Merchant Discount Rate table. Standalone reference — not FK-linked to any entity.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `MDR-01` |
| `type` | `string` | Description e.g. `Visa — Domestic Credit` |
| `rate` | `number` | Percentage e.g. `1.10` |
| `cat` | `string` | `Debit` · `Credit` · `QR` |
| `network` | `string` | Visa · Mastercard · DuitNow · etc. |

---

### User

An operator directory entry. Not linked to other entities by FK in the current build.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | e.g. `U201` |
| `name` | `string` | |
| `email` | `string` | |
| `role` | `string` | `Admin` · `Operations` · `Warehouse` · `Finance` · `Viewer` |
| `status` | `string` | `Active` · `Invited` · `Suspended` |
| `lastActive` | `string` | Human-readable e.g. `2 hours ago` |
| `jobs` | `number` | Open jobs count (Operations and Warehouse roles only) |

---

## Key Cross-Entity Rules Summary

| Trigger | Side effects |
|---|---|
| Create Terminal + link SIM | SIM → `Active`; terminal connectivity → `4G + WiFi` |
| Unlink SIM from Terminal | SIM → `In Storage`; terminal connectivity → `WiFi only` |
| Installation Job → Completed | Terminal → `Installed` at `Merchant Site`; Rental created |
| Replacement Job → Completed | Old terminal cleared and status updated; new terminal → `Installed`; active Rental device updated (or new Rental created) |
| Paper Roll Request Job → Completed | `PaperRollEntry` `Issued` record posted with negative quantity |
| Payout created (manual or upload) | `Transaction` records created and linked via `payoutId` |
| Payout → Mark as Paid | `paymentProof` set; `einvoice = true`; `issued` date set |
| Rental invoice → eInvoice issued | Only allowed if `customer.tin` is non-empty |
