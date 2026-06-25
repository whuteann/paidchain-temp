# Mobile Optimization Plan

The current UI is desktop-first. Mobile optimization should be handled as an app-wide responsive redesign, not as isolated page patches. The work should start with shared shell, layout, table, modal, and form behavior, then move page by page.

## Phase 1: Global App Shell

### Sidebar

- Convert the desktop sidebar into a mobile drawer.
- Add a mobile menu button in the topbar.
- Drawer should cover most of the screen width.
- Add backdrop tap-to-close behavior.
- Preserve navigation grouping.
- Reduce secondary text and badges where needed.
- Keep active navigation state visible in drawer mode.

### Topbar

- Replace the desktop breadcrumb/search/user layout with a compact mobile header.
- Show:
  - menu button
  - current page title or breadcrumb tail
  - key action icon if needed
- Hide or collapse global search on mobile.
- Move user profile/logout access into the drawer.
- Avoid long breadcrumb chains on mobile.

### Page Container

- Reduce page padding on mobile.
- Use approximately `16px` horizontal padding on phones.
- Prevent horizontal page overflow globally.
- Standardize vertical spacing between sections.
- Ensure all pages fit within viewport width.

### Page Headers

- Stack title, subtitle, and actions vertically.
- Convert multiple actions into:
  - primary full-width button plus secondary icon buttons, or
  - overflow menu for lower-priority actions.
- Allow long titles to wrap safely.
- Avoid forcing horizontal scroll from page actions.

### Tables

- Keep desktop table layout on larger screens.
- Convert tables into stacked card rows on mobile.
- Each mobile row should show:
  - primary entity/title
  - main status chip
  - 2-4 key metadata rows
  - chevron or action affordance
- Avoid horizontal scrolling as the primary mobile solution.

### Cards And Grids

- Convert side-by-side layouts to single-column on phones.
- Convert `.detail-grid` to one column.
- Convert `.stat-grid` to:
  - two columns where space allows
  - one column for dense screens
- Prevent cards inside cards unless they are repeated list items.

### Forms And Modals

- Mobile modals should behave like bottom sheets or near-fullscreen panels.
- Stack `.field-row` fields vertically.
- Ensure dropdowns and search selects are not clipped.
- Make modal footers responsive.
- Use full-width footer buttons where useful.
- Keep inputs at least 40-44px tall.

### Tabs

- Make tab bars horizontally scrollable on mobile.
- Prevent long tab labels from wrapping awkwardly.
- Consider accordions or section anchors for complex detail pages.

### Typography

- Reduce desktop title sizes slightly on mobile.
- Allow entity names, IDs, and references to wrap safely.
- Keep monospace IDs readable but avoid overflow.
- Do not use viewport-width font scaling.

## Phase 2: Shared Components To Update

### `components/shell.tsx`

- Add mobile drawer state.
- Add mobile topbar layout.
- Add route-aware mobile page title.
- Keep desktop shell behavior unchanged above breakpoint.
- Move user/logout controls into mobile drawer.

### `styles/globals.css`

- Add responsive breakpoints.
- Update:
  - `.app`
  - `.sidebar`
  - `.topbar`
  - `.page-inner`
  - `.page-head`
  - `.page-head-actions`
  - `.toolbar`
  - `.field-row`
  - `.detail-grid`
  - `.stat-grid`
  - `.tabs`
  - `.modal`
  - `.modal-body`
  - `.modal-foot`
- Add mobile table/card-list helpers.
- Add text wrapping utilities for IDs and long values.

### `components/components.tsx`

- Improve `PageHead` for stacked mobile layout.
- Improve `Toolbar` mobile wrapping.
- Consider adding a reusable `MobileListItem` or `ResponsiveTable` pattern.
- Make `Pagination` compact on mobile.
- Make `Modal` support mobile sheet/fullscreen behavior.

## Phase 3: Page-By-Page Breakdown

## Dashboard

- Convert stat grid to 1-2 columns.
- Convert recent jobs and alerts into mobile cards.
- Stack charts and summary rows.
- Keep top KPIs first.
- Make alert rows easy to scan and tap.

## Customers

### List

- Convert customer table into mobile cards.
- Show:
  - customer name
  - status
  - type
  - merchant count
  - contact
- Stack search and filters.

### Detail

- Stack business/customer info cards.
- Convert linked merchants table into cards.
- Move actions under title or into overflow.
- Ensure registration numbers and contact values wrap.

## Merchants

### List

- Convert merchant table into mobile cards.
- Show:
  - merchant name
  - MID
  - bank
  - status
  - finance readiness
- Stack filters below search.

### Detail

- Stack stat cards.
- Convert overview, bank, and contact sections to single-column.
- Convert linked terminals and jobs tables into cards.
- Ensure MID, account number, and address fields wrap safely.

## Referrals

### List

- Convert referral table into mobile cards.
- Show:
  - merchant name
  - referral ID
  - referrer
  - processor
  - lead status
  - commission status
- Stack lead, record, and commission filters.

### Detail

- Stack lifecycle stat cards.
- Stack:
  - lead information
  - processing progress
  - merchant link and activation
  - first transaction and commission
  - people
  - review flags
  - reversal
  - attachments
- Group the many actions:
  - Review
  - Assign
  - Progress
  - Attachment
  - Confirm
  - Close
- Keep attachment view/download controls compact.

## Jobs

### List

- Convert job table into mobile cards.
- Show:
  - job type
  - merchant
  - status/stage
  - SLA
  - assignee
  - due date

### Detail

- Convert horizontal stepper into a mobile-friendly vertical timeline.
- Stack evidence and history sections.
- Make transition/action buttons full-width or sticky near the bottom.
- Ensure long notes and evidence filenames wrap.

## Terminals

### List

- Convert terminal table into mobile cards.
- Show:
  - serial number
  - brand/model
  - status
  - merchant
  - TID

### Detail

- Stack terminal identity, assignment, SIM, rental, and movement/history sections.
- Ensure serial numbers and TIDs wrap or shrink cleanly.
- Make bulk upload modal mobile-safe.

## SIM Cards

### List

- Convert SIM table into mobile cards.
- Show:
  - SIM ID or ICCID
  - carrier
  - plan
  - status
  - linked terminal

### Detail

- Stack detail cards.
- Ensure long identifiers wrap safely.

## Paper Rolls

- Convert inventory/request table into mobile cards.
- Show:
  - merchant/customer
  - quantity
  - status
  - request date
- Stack toolbar controls.

## Rentals

### List

- Convert rental table into mobile cards.
- Show:
  - merchant
  - terminal
  - status
  - amount
  - next billing or period

### Detail

- Stack invoice and e-invoice sections.
- Keep invoice/e-invoice actions compact.
- Stack payment and status sections.

## Payouts

### List

- Convert payout table into mobile cards.
- Show:
  - payout ID
  - merchant/customer
  - status
  - amount
  - period

### Modals

- Convert upload/create payout modals into mobile sheets.
- Stack customer, merchant, period, payment method, and upload controls.

### Detail

- Convert exception checks to compact stacked layout.
- Convert transaction table into mobile cards.
- Keep horizontal scroll only as fallback.
- Stack payment proof upload controls.

## Referral Bonus Batches

### List

- Convert batch table into mobile cards.
- Show:
  - year/quarter
  - status
  - line count
  - total amount
  - paid date

### Detail

- Convert commission lines table into cards.
- Stack Export CSV and Mark Paid actions.
- Make Mark Paid modal mobile-friendly.

## MDR Rates

- Convert MDR table into mobile cards.
- Show:
  - type
  - rate
  - network
  - category
- Stack create/edit forms.

## Users And Roles

### Users

- Convert user table into mobile cards.
- Show:
  - name
  - email
  - role
  - status
  - last active

### Roles And Permissions

- Convert role/permission tables into grouped mobile sections.
- Permission matrix may need accordion groups by module.

## Settings

- Stack all settings panels.
- Make save buttons full-width on mobile where forms are long.
- Avoid horizontal layout dependencies.

## Audit Logs

- Convert audit table into timeline-style cards.
- Show:
  - action
  - user
  - entity
  - timestamp
- Stack filters.
- Make date range inputs full-width.

## Implementation Order

1. Add global responsive shell, topbar, page spacing, modal, form, grid, and tab behavior.
2. Add reusable mobile list/card pattern.
3. Convert high-traffic list pages first:
   - Dashboard
   - Merchants
   - Jobs
   - Referrals
4. Convert complex detail pages:
   - Merchant Detail
   - Job Detail
   - Referral Detail
   - Payout Detail
5. Convert finance and configuration pages.
6. Run mobile viewport checks page by page.
7. Fix overflow, clipped dropdowns, long IDs, and modal footers.

## Validation Checklist

- No horizontal page overflow at phone widths.
- Sidebar is usable as a drawer.
- Topbar remains compact and readable.
- Page actions remain reachable.
- Tables are usable as mobile cards.
- Forms stack correctly.
- Modals fit mobile viewport.
- Dropdowns are not clipped.
- Long IDs and filenames wrap safely.
- Touch targets are at least 40-44px tall.
- Pages remain usable at common widths:
  - 360px
  - 390px
  - 430px
  - 768px
