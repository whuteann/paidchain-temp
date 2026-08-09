# Rapid Fire API Update Tasks

Source report: `/Users/mistermistermakmak/.codex/attachments/77f0892b-3f1d-4ac6-9304-5b5ca941286e/pasted-text.txt`

Date captured: 2026-08-07

## Objective

Update the frontend API client in `lib/api.ts` so its TypeScript models and endpoint helpers match the recent backend schema and route changes. After `api.ts` is aligned, update affected screens to stop sending removed fields, display new structured data, and use the new Terminal ID lifecycle endpoints.

## Backend Change Summary

- Customer and merchant free-text addresses were moved into structured address tables.
- `customers.type` was removed.
- `customers.reg_no` is now nullable.
- `merchants.mcc_code` was added.
- `terminals.bank` was removed from terminal create, update, list, detail, bulk, upload, and template flows.
- Terminal IDs now have lifecycle `status` values: `Active` and `Inactive`.
- Terminal ID MID changes can be recorded with `reason` and exposed through MID history.
- Merchant and job search now also match terminal serials, TIDs, and MIDs.
- Terminal, SIM card, merchant, and job detail responses include richer connected-object context.

## `api.ts` Model Updates

### Shared Address Models

Add reusable structured address models near shared types:

```ts
export interface AddressOut {
  id: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AddressIn {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}
```

### Customers

- Remove required `type` from `CustomerOut`, `CustomerCreate`, and `CustomerUpdate`.
- Make `reg_no` nullable in `CustomerOut`.
- Make `reg_no` optional and nullable in `CustomerCreate`.
- Keep legacy `address?: string | null` in create/update for compatibility, but do not require it.
- Add `addresses?: AddressOut[]` to `CustomerOut`.
- Add `addresses?: AddressIn[]` to `CustomerCreate` and `CustomerUpdate`.
- Allow direct address fields in create/update for backend compatibility:
  - `address_line_1?: string | null`
  - `address_line_2?: string | null`
  - `city?: string | null`
  - `state?: string | null`
  - `postcode?: string | null`

### Merchants

- Add `mcc_code?: string | null` to `MerchantOut`, `MerchantCreate`, and `MerchantUpdate`.
- Add `addresses?: AddressOut[]` to `MerchantOut`.
- Add `addresses?: AddressIn[]` to `MerchantCreate` and `MerchantUpdate`.
- Keep legacy `address?: string | null` in create/update for compatibility, but do not require it.
- Allow direct address fields in create/update for backend compatibility.
- Confirm `MerchantOut.tids` uses `TerminalTidOut[]` so TID `status` is available.
- Confirm connected terminal entries can safely model optional SIM/card context from merchant detail responses.

### Terminal IDs

- Update `TerminalTidOut.status` to a concrete lifecycle union where practical:

```ts
export type TerminalTidStatus = "Active" | "Inactive";
```

- Use `status?: TerminalTidStatus | null` in `TerminalTidOut`.
- Add `reason?: string | null` to `TerminalTidUpdate`.
- Remove legacy `bank` from `TerminalTidCreate`, `TerminalTidUpdate`, and `TerminalTidOut` unless old UI still needs to tolerate it during rollout.
- Add MID history response model:

```ts
export interface TerminalTidMidHistoryOut {
  id: string;
  terminal_tid_id: string;
  old_mid: string | null;
  new_mid: string | null;
  changed_by_user_id: string | null;
  changed_at: string;
  reason: string | null;
}
```

### Terminals

- Remove `bank` from `TerminalOut`, `TerminalCreate`, `TerminalBulkCreate`, and any terminal update body.
- Remove `bank` from terminal list/filter params if present.
- Keep response fields optional where older code may still read them during migration, but new form payloads must not send `bank`.
- Add richer terminal detail context:
  - `customer?: { id: string; name: string } | null`
  - `merchant?: { id: string; name: string } | null`
  - `tids?: TerminalTidOut[]`
  - `simcard?: SimCardOut | null`
  - `installation_status?: string | null`
- Add request body model for terminal merchant assignment:

```ts
export interface TerminalMerchantAssign {
  merchant_id: string;
}
```

### SIM Cards

- Extend `SimCardOut` connected context:
  - `terminal?: { serial: string; serial_no?: string; brand?: string; model?: string; merchant?: MerchantRef | null } | null`
  - `merchant?: MerchantRef | null`
  - `customer?: CustomerRef | null`
- Add small shared refs if useful:

```ts
export interface CustomerRef {
  id: string;
  name: string;
}

export interface MerchantRef {
  id: string;
  name: string;
}
```

### Jobs

- Existing job search params can stay as-is because expanded search is backend-side.
- Ensure `JobOut.job_terminals` and `JobTerminalOut` remain present for detail responses and open jobs connected through `job_terminals`.
- Review terminal refs in `JobOut`, `MerchantJobOut`, and terminal detail `open_jobs` for optional connected fields returned by the backend.

## `api.ts` Endpoint Helper Updates

### Customers

- Keep existing endpoints:
  - `customers.list`
  - `customers.get`
  - `customers.create`
  - `customers.update`
- Update only their model signatures to support structured addresses and removed `type`.

### Merchants

- Keep existing endpoints:
  - `merchants.list`
  - `merchants.get`
  - `merchants.create`
  - `merchants.update`
  - `merchants.listTids`
  - `merchants.createTid`
  - `merchants.updateTid`
- Update model signatures for `mcc_code`, structured addresses, and TID `status`.
- Ensure `merchants.updateTid` accepts `reason` through `TerminalTidUpdate`.

### Terminal IDs

Add lifecycle endpoints:

```ts
deleteTid: (tidId: string) =>
  req<TerminalTidOut>("DELETE", `/terminal-tids/${tidId}`),

reactivateTid: (tidId: string) =>
  req<TerminalTidOut>("POST", `/terminal-tids/${tidId}/reactivate`),

tidMidHistory: (tidId: string) =>
  req<TerminalTidMidHistoryOut[]>("GET", `/terminal-tids/${tidId}/mid-history`),
```

These can live under `terminals` with the existing `assignTid` and `updateTid` helpers, or under a new `terminalTids` export if the UI will manage TIDs independently from terminals.

### Terminals

- Keep existing endpoints:
  - `terminals.list`
  - `terminals.get`
  - `terminals.create`
  - `terminals.bulkCreate`
  - `terminals.update`
  - `terminals.simCard`
  - `terminals.linkSim`
  - `terminals.unlinkSim`
  - `terminals.assignTid`
- Add merchant assignment endpoint:

```ts
assignMerchant: (serial: string, body: TerminalMerchantAssign) =>
  req<TerminalOut>("POST", `/terminals/${serial}/merchant`, { body }),
```

- Remove `bank` from terminal create, update, bulk create, CSV template expectations, and list filters.

### SIM Cards

- Keep existing endpoints and update response models only.

### Jobs

- No new helper is required for expanded search; existing `jobs.list` and `jobs.export` query params should continue to work.
- Ensure UI search examples and labels can mention serial, TID, and MID search if needed.

## Frontend Follow-Up Tasks

### Customer Screens

- Remove customer `type` from create/edit forms, detail views, tables, filters, and validation.
- Make `reg_no` optional in create/edit validation.
- Replace single address entry with structured address fields or an address-row editor.
- Continue reading `address` as a compatibility display fallback when `addresses` is empty.

### Merchant Screens

- Add `mcc_code` to create/edit forms and detail display.
- Replace single address entry with structured address fields or an address-row editor.
- Continue reading `address` as a compatibility display fallback when `addresses` is empty.
- Update Terminal IDs card to show `status`.
- Add deactivate/reactivate actions if product flow requires lifecycle management.
- Add optional MID-change `reason` when editing a TID MID.

### Terminal Screens

- Remove terminal `bank` fields from create/edit/bulk upload UI.
- Update CSV template/import instructions to omit `bank`.
- Show richer assigned customer, merchant, SIM card, and connected TID context on terminal detail.
- Add terminal-to-merchant assignment UI if operations needs to manually install a terminal at a merchant.

### SIM Card Screens

- Show connected terminal, merchant, and customer context where available.
- Treat all connected context as optional.

### Job Screens

- Keep current multi-device job-terminal UI.
- Update search placeholder/help text to include terminal serial, TID, and MID if search UI exposes examples.
- Ensure job detail open terminal references handle rows from `job_terminals`.

## Verification Checklist

- Run TypeScript checks after `api.ts` changes.
- Search the frontend for removed fields before finalizing:
  - `customers.type`
  - `CustomerCreate` required `type`
  - `terminals.bank`
  - terminal create/update/bulk payloads containing `bank`
- Verify customer create/update sends `addresses` or direct structured address fields.
- Verify merchant create/update sends `mcc_code` and structured addresses.
- Verify TID edit can send `reason` and receives `status`.
- Verify TID delete/reactivate and MID history helpers work against the backend.
- Verify terminal create/bulk/upload flows no longer include `bank`.
- Verify terminal detail renders when connected customer, merchant, SIM card, or TID context is missing.

## Implementation Notes

- Prefer optional fields in response models for connected-object context because backend includes them only when loaded.
- Keep legacy `address` fields readable during rollout, but make new write flows prefer `addresses`.
- Avoid sending removed fields in request bodies even if response types temporarily tolerate them.
- If introducing a new `terminalTids` API export, migrate call sites consistently instead of splitting lifecycle helpers across unrelated modules.
