# Referral Feature File Changes

This document lists the files added or changed for the referral lead management and referral bonus batch feature.

## Added

- `components/screen-referrals.tsx`
  - Adds referral lead list and detail screens.
  - Adds create referral, review lead, assign processor, update processing, link merchant, upload attachment, cancel referral, and confirm first transaction modals.
  - Adds referral bonus batch list and detail screens.
  - Adds generate batch, export CSV, and mark paid flows.

- `pages/referrals/index.tsx`
  - Adds the `/referrals` route.

- `pages/referrals/[id].tsx`
  - Adds the `/referrals/[id]` detail route.

- `pages/referral-bonus-batches/index.tsx`
  - Adds the `/referral-bonus-batches` route.

- `pages/referral-bonus-batches/[id].tsx`
  - Adds the `/referral-bonus-batches/[id]` detail route.

## Changed

- `lib/api.ts`
  - Adds typed referral API models and client calls for:
    - `GET /referrals`
    - `GET /referrals/{id}`
    - `POST /referrals`
    - `PATCH /referrals/{id}`
    - `POST /referrals/{id}/assign-processor`
    - `PATCH /referrals/{id}/processing`
    - `POST /referrals/{id}/attachments`
    - `POST /referrals/{id}/link-merchant`
    - `POST /referrals/{id}/cancel`
    - `POST /referrals/{id}/confirm`
  - Adds typed referral bonus batch API models and client calls for:
    - `POST /referral-bonus-batches`
    - `GET /referral-bonus-batches`
    - `GET /referral-bonus-batches/{id}`
    - `GET /referral-bonus-batches/{id}/export`
    - `PATCH /referral-bonus-batches/{id}`
  - Adds `referrals` and `referralBonusBatches` to the unified `api` export.

- `components/shell.tsx`
  - Adds `referrals`, `referral-detail`, `referral-bonus-batches`, and `referral-bonus-batch-detail` route types.
  - Adds sidebar navigation entries for Referrals and Referral Bonuses.
  - Adds route path mapping, active route detection, breadcrumbs, and programmatic navigation for the new pages.

## Validation

- `npx eslint` on the changed referral files passed.
- `npm run build` passed after rerunning outside the sandbox because Turbopack attempted to bind to a local port during build.
- Full `npm run lint` still fails due to existing lint errors in unrelated files, mainly `react-hooks/set-state-in-effect` violations.
