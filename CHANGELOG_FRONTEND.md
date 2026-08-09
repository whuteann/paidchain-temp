# Changelog Frontend

Source: chat implementation history and current local git records on `small-fixes`.

## Jobs & Workflows

- Added the `Retrieval` job type.
  - Retrieval jobs select customer, merchant, and one or more merchant-linked devices.
  - Retrieval submits selected devices through `service_terminals`.
  - Retrieval stages are `Pending -> Device Returned -> Completed`.
  - `Device Returned` and `Completed` require evidence upload.
- Updated the `Replacement` workflow.
  - Replacement stages are now `Pending -> Device Prepared -> Job Done -> Device Returned -> Completed`.
  - `Device Returned` requires evidence upload.
- Expanded multi-device job support.
  - Installation supports multiple terminal lines.
  - Replacement, Repair/Maintenance, Remote Support, and Retrieval use service terminal rows.
  - Job detail displays `job_terminals` with selected devices, assigned devices, TID, MID, MDR, and assignment status.
- Updated device assignment.
  - Assignment supports `job_terminal_id`.
  - Each pending terminal row can open assignment for that exact job terminal.
  - Legacy single-device assignment remains supported.
- Job creation assignee dropdown now lists `Operations` users instead of `Admin` users.
- Job detail now prefers backend `stage_sequence` when available.
- Added parcel tracking support on job detail.
  - Add/change tracking number.
  - Refresh parcel tracking status.
  - Display shipment tracking metadata.
- Added document actions for jobs.
  - Installation Form generation.
  - Delivery Order generation.
- Added frontend API support for job export/document blob endpoints.

## Merchants & TIDs

- Expanded Merchant Detail `Terminal IDs (TIDs)` card into a TID management surface.
  - Add/edit TID.
  - Deactivate/reactivate TID.
  - Open MID history modal.
  - Add/edit MID slots under each TID.
  - Deactivate/reactivate MID slots.
  - Capture MID change reason on edit.
- Added bank-scoped TID support.
  - TID create and edit include required `Bank`.
  - Merchant creation initial TID rows include `Bank`.
  - TID cards display the TID bank.
- Added merchant TID endpoint usage.
  - `POST /merchants/{merchant_id}/tids`
  - `PATCH /merchants/{merchant_id}/tids/{tid_id}`
  - TID lifecycle endpoints under `/terminal-tids`.
  - MID slot endpoints under `/terminal-tids/{tid_id}/mids`.
- Merchant detail TID terminal serial now links to terminal detail.
- Merchant detail TID SIM card ID now links to SIM card detail.
- Merchant detail shows enriched SIM context for TIDs when returned by backend.

## Merchant Creation

- Merchant list now has a `Create Merchant` action.
  - Opens customer picker first.
  - Merchant modal opens only after a customer is selected.
- Merchant create/edit supports optional `mcc_code`.
- Merchant create/edit uses structured address payloads.
  - UI remains a single-address form.
  - Payload sends `addresses: [address]`.
- Creating a merchant from customer context pre-fills address from the selected customer's structured address.

## Customers

- Customer create/edit updated for structured address support.
  - Removed customer `type`.
  - `reg_no` is optional/nullable.
  - Address fields submit through `addresses`.
- Customer detail displays structured address from `addresses[0]`.
  - Legacy `address` is not used for display.
- Customer onboarding can proceed directly into merchant creation with customer context preserved.

## Terminals

- Removed terminal-level `bank` from terminal create/edit flows where backend removed it.
- Terminal detail header now avoids rendering `undefined` values.
  - Subtitle includes only available brand, model, SIM, and merchant context.
- Terminal detail `Connected TID` card updated.
  - Treats connected TID as one-to-one.
  - Can link a TID to an installed terminal.
  - If terminal is not installed, user sees `Tid can only be assigned to installed device`.
- Added TID assignment endpoint usage.
  - `POST /terminal-tids/{tid_id}/terminal`
- Added terminal merchant assignment with TID selection.
  - Uses `POST /terminals/{serial}/merchant`.
  - Body includes `merchant_id` and `terminal_tid_id`.
  - Modal uses the same merchant dropdown style as job creation.
- Terminal detail now categorizes richer context into cards.
  - Assigned Merchant
  - Billing Customer
- Terminal detail displays richer merchant and customer fields from backend.
- Terminal detail SIM card card links to SIM detail.

## SIM Cards

- SIM card detail updated to display richer connected terminal, merchant, and customer context where returned.
- Merchant and terminal screens now link SIM card IDs to SIM detail.

## Users, Permissions & Bank Scope

- User model now supports `banks`.
- Auth user model now supports `banks`.
- Create/edit user modal includes a Bank dropdown.
  - Submit sends `banks: [selectedBank]`.
- Frontend models now align with backend bank-scoped responsibility rules.
- Existing role permission checks remain intact.

## API Model Updates

- Added shared address models.
  - `AddressOut`
  - `AddressIn`
- Updated customer models.
  - Removed `type`.
  - Made `reg_no` nullable.
  - Added structured `addresses`.
- Updated merchant models.
  - Added `mcc_code`.
  - Added structured `addresses`.
  - Added richer TID and terminal context.
- Updated terminal models.
  - Added richer merchant/customer refs.
  - Added SIM context.
  - Added TID context.
- Updated TID models.
  - Added bank-scoped TIDs.
  - Added MID slots.
  - Added MID history.
  - Added status/reactivation flows.
- Updated job models.
  - Added `job_terminals`.
  - Added `service_terminals`.
  - Added `stage_sequence`.
  - Added shipment tracking.
  - Added generated document endpoints.
- Updated user models.
  - Added `banks`.

## Verification

- Latest frontend type check passed:

```bash
./node_modules/.bin/tsc --noEmit
```
