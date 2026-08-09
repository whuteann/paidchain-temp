# Bank-Scoped Access Integration

This change makes bank assignment part of authorization and makes each Terminal TID bank-scoped.

The frontend should treat normal role permissions and assigned banks as two separate gates:

1. The user must have the required permission, such as `Merchants.View`.
2. For bank-scoped resources, the user must also be assigned to the relevant bank.

Admin users bypass bank filtering.

## Data Model

### User Bank Assignments

New table: `user_bank_assignments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `String(20)` | Primary key |
| `user_id` | `String(20)` | Foreign key to `users.id` |
| `bank` | `String(50)` | Assigned bank name |
| `created_at` | `DateTime(timezone=True)` | Created timestamp |

Constraint:

| Constraint | Notes |
| --- | --- |
| `uq_user_bank_assignment` | One assignment per user per bank |

### Terminal TID Bank

Updated table: `terminal_tids`

| Column | Type | Notes |
| --- | --- | --- |
| `bank` | `String(50)` | Required bank owner/scope of the TID |

This is independent from `merchants.bank`. A merchant can belong to one bank, while a linked TID can belong to another bank.

## Access Rules

### Admin

If `user.role_id === "admin"`, the user can view and modify all bank-scoped records as long as they have the required permission.

### RM, Operations, Helpdesk, Finance

Non-admin users are filtered by their assigned banks.

The backend returns only records that match the user bank scope. The frontend does not need to add bank filters manually for access control, but it should use the user's `banks` field to drive available bank dropdown options.

## Visibility Logic

### Merchant Visibility

A non-admin user can view a merchant if either condition is true:

1. `merchant.bank` is in `currentUser.banks`.
2. The merchant has at least one linked `TerminalTid` where `terminal_tids.bank` is in `currentUser.banks`.

This means a user assigned to `Maybank` can see a merchant whose own bank is `CIMB` if that merchant has a linked Maybank TID.

### Customer Visibility

A non-admin user can view a customer if the customer has at least one visible merchant.

A visible merchant means:

1. The merchant bank is assigned to the user, or
2. The merchant has an attached TID whose bank is assigned to the user.

### Job Visibility

A non-admin user can view a job if either condition is true:

1. `job.bank` is in `currentUser.banks`.
2. The job's merchant has at least one linked `TerminalTid` where `terminal_tids.bank` is in `currentUser.banks`.

### Terminal TID Visibility

A non-admin user can view or modify a TID only if:

```text
terminal_tids.bank in currentUser.banks
```

## User API Changes

### Create User

Endpoint:

```http
POST /api/users
```

Request:

```json
{
  "name": "Retail Manager",
  "email": "rm@example.com",
  "role_id": "rm",
  "password": "optional-password",
  "banks": ["Maybank", "CIMB"]
}
```

Response now includes `banks`:

```json
{
  "id": "USR-00001",
  "name": "Retail Manager",
  "email": "rm@example.com",
  "role": "RM",
  "role_id": "rm",
  "permissions": ["Customers.View", "Merchants.View"],
  "status": "Active",
  "last_active": null,
  "open_jobs_count": 0,
  "banks": ["CIMB", "Maybank"]
}
```

### Update User Banks

Endpoint:

```http
PATCH /api/users/{user_id}
```

Request:

```json
{
  "banks": ["Maybank", "RHB"]
}
```

Important behavior:

| Request shape | Behavior |
| --- | --- |
| `banks` omitted | Existing bank assignments are unchanged |
| `"banks": []` | Clears all bank assignments |
| `"banks": ["Maybank"]` | Replaces existing assignments with exactly this list |

## Terminal TID API Changes

### Create Merchant TID

Endpoint:

```http
POST /api/merchants/{merchant_id}/tids
```

Request:

```json
{
  "tid": "TID123456",
  "bank": "Maybank",
  "mid": "MID123456",
  "mdr_rate_id": "MDR-001"
}
```

Rules:

1. Non-admin user must be assigned to `bank`.
2. Non-admin user must be allowed to access the merchant.
3. `bank` is required.

Response:

```json
{
  "id": "TTID-00001",
  "terminal_serial": null,
  "tid": "TID123456",
  "bank": "Maybank",
  "merchant_id": "M1001",
  "status": "Active",
  "created_at": "2026-08-09T10:00:00Z",
  "mids": [],
  "sim_card": null
}
```

### Update Merchant TID

Endpoint:

```http
PATCH /api/merchants/{merchant_id}/tids/{tid_id}
```

Request:

```json
{
  "tid": "TID654321",
  "bank": "CIMB",
  "merchant_id": "M1001"
}
```

Rules:

1. User must be able to access the existing TID bank.
2. If changing `bank`, user must also be assigned to the new bank.
3. User must be able to access the merchant.

### Direct Terminal TID Update

Endpoint:

```http
PATCH /api/terminal-tids/{tid_id}
```

Request:

```json
{
  "tid": "TID654321",
  "bank": "CIMB",
  "merchant_id": "M1001"
}
```

Rules are the same as merchant TID update.

## Merchant API Changes

### Create Merchant With TIDs

Endpoint:

```http
POST /api/merchants/create
```

Relevant request fields:

```json
{
  "customer_id": "CUST-001",
  "name": "Merchant Name",
  "type": "Retail",
  "bank": "Maybank",
  "mcc_code": "5411",
  "contact": "Contact Person",
  "phone": "60123456789",
  "email": "merchant@example.com",
  "bank_account_name": "Merchant Name",
  "bank_account_number": "1234567890",
  "bank_account_type": "Current",
  "tids": [
    {
      "tid": "TID001",
      "bank": "Maybank",
      "mid": "MID001"
    },
    {
      "tid": "TID002",
      "bank": "CIMB",
      "mid": null
    }
  ]
}
```

Rules:

1. Non-admin user must be assigned to `merchant.bank`.
2. For each `tids[]`, non-admin user must be assigned to `tids[].bank`.
3. `tids[].bank` is required.

### Get Merchant Detail

Endpoint:

```http
GET /api/merchants/{merchant_id}
```

Response behavior:

1. Returns the merchant only if it passes bank-scoped visibility.
2. `tids` contains only TIDs whose bank the user can access.
3. `terminals[].tids` is also filtered by accessible TID banks.
4. Admin sees all nested TIDs.

## Terminal API Changes

### Create Terminal With TID

Endpoint:

```http
POST /api/terminals
```

Request:

```json
{
  "term_setting_id": "TS-001",
  "serial": "SN123456",
  "tid": "TID123456",
  "tid_bank": "Maybank",
  "initial_location": "KL Warehouse",
  "sim_type": "4G",
  "condition_note": null
}
```

Rules:

1. `tid_bank` is required when `tid` is provided.
2. Non-admin user must be assigned to `tid_bank`.

### Bulk Create Terminals

Endpoint:

```http
POST /api/terminals/bulk
```

Option A:

```json
{
  "term_setting_id": "TS-001",
  "serial_numbers": ["SN001", "SN002"],
  "tids": ["TID001", "TID002"],
  "tid_banks": ["Maybank", "CIMB"],
  "initial_location": "KL Warehouse"
}
```

Option B:

```json
{
  "term_setting_id": "TS-001",
  "terminals": [
    {
      "serial": "SN001",
      "tid": "TID001",
      "tid_bank": "Maybank"
    },
    {
      "serial": "SN002",
      "tid": "TID002",
      "tid_bank": "CIMB"
    }
  ],
  "initial_location": "KL Warehouse"
}
```

Rules:

1. If `tids` is supplied with `serial_numbers`, `tid_banks` must align by array index.
2. If using `terminals[]`, use `terminals[].tid_bank`.
3. Non-admin user must be assigned to every provided TID bank.

### Update Terminal With TID

Endpoint:

```http
PATCH /api/terminals/{serial}
```

Relevant request:

```json
{
  "tid": "TID123456",
  "tid_bank": "Maybank"
}
```

Rules:

1. `tid_bank` is required when a new TID is being created through this endpoint.
2. Non-admin user must be assigned to `tid_bank`.

## Job API Behavior

### List Jobs

Endpoint:

```http
GET /api/jobs?page=1&per_page=20
```

Bank filtering is automatic.

Non-admin users see jobs where:

1. `job.bank` is assigned to them, or
2. The job merchant has a TID assigned to one of their banks.

### Create Job

Endpoint:

```http
POST /api/jobs
```

Rules:

1. User must be able to access the selected merchant.
2. If the job references installation `terminals[].terminal_tid_id`, user must be able to access each selected TID's bank.

## Expected Frontend Integration

### Current User State

Store the current user's assigned banks from the login/session user response:

```ts
type CurrentUser = {
  id: string;
  role_id: string;
  permissions: string[];
  banks: string[];
};
```

### Bank Dropdowns

For non-admin users:

1. Restrict selectable banks to `currentUser.banks`.
2. Use the selected value for:
   - merchant `bank`
   - TID `bank`
   - terminal `tid_bank`
   - user bank assignments, if editing users

For admin users:

1. Admin may select any bank.
2. Frontend may use the full bank list from config/constants if available.

### Handling 403

A `403` means either:

1. The user has the permission but is not assigned to the relevant bank, or
2. The selected merchant/customer/job/TID is outside their bank scope.

Recommended frontend behavior:

```ts
if (error.status === 403) {
  showError("You are not assigned to the bank for this record.");
}
```

### Handling 422

Common new validation errors:

| Error | Frontend fix |
| --- | --- |
| `bank is required` | Include `bank` when creating/updating a TID |
| `tid_bank is required when tid is provided` | Include `tid_bank` when creating a terminal TID through terminal endpoints |
| `Not assigned to bank: <bank>` | Prevent selecting banks outside `currentUser.banks` |

## Migration And Startup Commands

Run the backend and apply migrations:

```bash
docker compose --env-file .env.production \
  -f docker-compose.production.yml \
  -f docker-compose.local.yml \
  up -d --build api

docker compose --env-file .env.production \
  -f docker-compose.production.yml \
  -f docker-compose.local.yml \
  exec api alembic upgrade head

docker compose --env-file .env.production \
  -f docker-compose.production.yml \
  -f docker-compose.local.yml \
  exec api python seed.py
```

Verify:

```bash
curl http://127.0.0.1:8099/ready
```

Expected response:

```json
{
  "status": "ready",
  "service": "PaidChain Merchant Operations API"
}
```

