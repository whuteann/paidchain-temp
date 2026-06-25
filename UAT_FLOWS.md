# PaidChain UAT Flow Inventory

Source reviewed: `pages/`, `components/screen-*.tsx`, `components/*-context.tsx`, `components/data.ts`, `lib/api.ts`, and the existing `FLOWS.md`.

Role notes:
- Roles are assigned from the role/permission matrix supplied for UAT planning.
- The current frontend exposes some buttons regardless of role; UAT should still execute each flow using the role(s) listed below.
- Referral lead management and referral bonus batch flows are grouped under Admin and Finance because the supplied matrix includes Referral Bonuses permissions but does not define a separate Referrals permission module.

test flow (name): Access protected page without authentication
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Clear the current session token and dev mode state.
2. Open any protected route, such as `/dashboard`.
3. Verify the app redirects to `/login`.

test flow (name): Sign in with credentials
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Open `/login`.
2. Enter a valid email address.
3. Enter a valid password.
4. Click `Sign in`.
5. Verify the app stores the authenticated user session and opens `/dashboard`.

test flow (name): Sign in failure
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Open `/login`.
2. Enter an invalid email or password.
3. Click `Sign in`.
4. Verify the login page remains visible.
5. Verify the API error message is shown.

test flow (name): Enter dev mode
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Open `/login`.
2. Click `Enter dev mode (skip auth)`.
3. Verify the app opens `/dashboard`.
4. Verify the `Dev Mode` badge is displayed.

test flow (name): Exit dev mode
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Start in dev mode.
2. Click the close button on the `Dev Mode` badge.
3. Open a protected page.
4. Verify the app redirects to `/login`.

test flow (name): Log out
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Sign in or enter dev mode.
2. Open the sidebar.
3. Click `Log out`.
4. Verify the session is cleared.
5. Verify the app opens `/login`.

test flow (name): Navigate main application shell
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Sign in and open `/dashboard`.
2. Use the sidebar to open Dashboard, Customers, Merchants, Referrals, Jobs, Terminals, SIM Cards, Paper Rolls, Rentals, Referral Bonuses, MDR Rates, Settings, Users & Roles, and Audit Logs as permitted by role.
3. Verify the active sidebar item and breadcrumb update for each route.
4. Use the mobile drawer toggle on a narrow viewport and verify navigation closes after route change.

test flow (name): View operations dashboard
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Open `/dashboard`.
2. Review Active Merchants, Terminals Deployed, Open Jobs, and Net Payouts stat cards.
3. Review Terminal Inventory by Status and Open Jobs by Type charts.
4. Review Recent Jobs and Needs Attention lists.

test flow (name): Navigate from dashboard widgets
user role(s): Admin, Finance, Operations, Warehouse, Viewer
steps taken:
1. Open `/dashboard`.
2. Click `Inventory` on Terminal Inventory by Status.
3. Verify `/terminals` opens.
4. Return to `/dashboard`.
5. Click `All Jobs` or `View all` on job widgets.
6. Verify `/jobs` opens.
7. Return to `/dashboard`.
8. Click a recent job row.
9. Verify the matching job detail page opens.

test flow (name): View and filter customers
user role(s): Admin, Finance, Operations, Viewer
steps taken:
1. Open `/customers`.
2. Review customer summary cards.
3. Search by customer name, registration number, or contact.
4. Filter by status.
5. Change pages if multiple pages are available.
6. Open a customer row and verify the customer detail page loads.

test flow (name): Export customers
user role(s): Admin
steps taken:
1. Open `/customers`.
2. Click `Export`.
3. Verify the customer export action is available for the role.

test flow (name): Create customer
user role(s): Admin
steps taken:
1. Open `/customers`.
2. Click `Create Customer`.
3. Enter company or customer name.
4. Select customer type.
5. Enter registration number and optional TIN.
6. Enter primary contact name, phone, email, and address.
7. Click `Create Customer`.
8. Verify the new customer appears and the onboarding prompt opens.

test flow (name): Skip customer onboarding merchant setup
user role(s): Admin
steps taken:
1. Complete the Create Customer flow.
2. On the Customer Onboarding prompt, click `Skip for now`.
3. Verify the app opens the created customer detail page.
4. Verify no first merchant is created from the onboarding prompt.

test flow (name): Create first merchant during customer onboarding
user role(s): Admin
steps taken:
1. Complete the Create Customer flow.
2. On the Customer Onboarding prompt, click `Create First Merchant`.
3. Enter merchant name and business type.
4. Select bank and MDR plan.
5. Enter contact, phone, email, and address.
6. Click `Create Merchant`.
7. Verify the app opens the customer detail page.
8. Verify the merchant is associated with the customer.

test flow (name): View customer detail and linked merchants
user role(s): Admin, Finance, Operations, Viewer
steps taken:
1. Open `/customers`.
2. Select a customer.
3. Review Company Details and Primary Contact cards.
4. Review linked merchant rows.
5. Click a linked merchant.
6. Verify the merchant detail page opens.

test flow (name): Add merchant from customer detail
user role(s): Admin
steps taken:
1. Open a customer detail page.
2. Click `Add Merchant`.
3. Verify the customer field is prefilled and locked.
4. Enter merchant name, type, MID, bank, MDR plan, contact, address, and bank account details.
5. Click `Create Merchant`.
6. Verify the new merchant appears in the customer's merchant list.

test flow (name): View and filter merchants
user role(s): Admin, Finance, Operations, Viewer
steps taken:
1. Open `/merchants`.
2. Search by merchant name, MID, bank, or merchant ID.
3. Filter by merchant status.
4. Filter by bank.
5. Open a merchant row.
6. Verify the merchant detail page loads.

test flow (name): Export merchants
user role(s): Admin
steps taken:
1. Open `/merchants`.
2. Click `Export`.
3. Verify the merchant export action is available for the role.

test flow (name): View merchant detail tabs
user role(s): Admin, Finance, Operations, Viewer
steps taken:
1. Open a merchant detail page.
2. Review the overview tab for business details, finance readiness, bank details, and primary contact.
3. Open the `Linked Terminals` tab.
4. Click a linked terminal and verify terminal detail opens.
5. Return to the merchant and open the `Job History` tab.
6. Click a job and verify job detail opens.

test flow (name): Edit merchant
user role(s): Admin
steps taken:
1. Open a merchant detail page.
2. Click `Edit`.
3. Update merchant profile, contact, bank account, or MDR plan fields.
4. Click `Save Changes`.
5. Verify the merchant detail page reflects the updated values.

test flow (name): Create job from merchant detail
user role(s): Admin, Operations
steps taken:
1. Open a merchant detail page.
2. Click `New Job`.
3. Verify the customer and merchant fields are prefilled.
4. Select the job workflow type.
5. Complete all required job fields for the selected type.
6. Click `Create Job`.
7. Verify the app opens the created job detail page.

test flow (name): View and filter terminal inventory
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open `/terminals`.
2. Keep the `Inventory` tab selected.
3. Use quick filters for All, Rented, In Stock, Maintenance, and Faulty.
4. Search by serial, model, or merchant.
5. Filter by status and brand.
6. Open a terminal row.
7. Verify terminal detail opens.

test flow (name): Export terminals
user role(s): Admin
steps taken:
1. Open `/terminals`.
2. Click `Export`.
3. Verify the terminal export action is available for the role.

test flow (name): Register terminal without SIM
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click `Register Device`.
3. Select a terminal setting.
4. Select an initial location.
5. Enter a serial number.
6. Click `Create Device`.
7. Click `Skip - No SIM`.
8. Verify the device is registered with WiFi-only connectivity.

test flow (name): Register terminal with SIM
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click `Register Device`.
3. Select a terminal setting.
4. Select an initial location.
5. Enter a serial number.
6. Click `Create Device`.
7. Select a SIM card from In Storage inventory.
8. Click `Register Device`.
9. Verify the terminal is created and the selected SIM is linked as active.

test flow (name): Bulk upload terminals
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click `Bulk Upload`.
3. Select a terminal setting.
4. Select the initial location.
5. Upload a one-column CSV file with a header row and serial numbers.
6. Verify the detected serial count is shown.
7. Click `Create Terminals`.
8. Verify the completion summary shows created and failed counts.

test flow (name): View terminal settings
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click the `Terminal Settings` tab.
3. Search by brand or model.
4. Review brand, model, bank, category, rental, deposit, setup fee, units, and active status.

test flow (name): Create terminal setting
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click the `Terminal Settings` tab.
3. Click `New Terminal Setting`.
4. Select brand, category, and bank.
5. Enter model name, monthly rental, deposit, and setup fee.
6. Set active availability.
7. Click `Create Setting`.
8. Verify the setting appears in the table.

test flow (name): Edit terminal setting
user role(s): Admin, Warehouse
steps taken:
1. Open `/terminals`.
2. Click the `Terminal Settings` tab.
3. Click the edit icon for a setting.
4. Update rental rate, deposit, setup fee, category, bank, or active status.
5. Click `Save Changes`.
6. Verify the updated values appear in the table.

test flow (name): Delete terminal setting
user role(s): Admin
steps taken:
1. Open `/terminals`.
2. Click the `Terminal Settings` tab.
3. Click the remove icon for a setting.
4. Click `Confirm`.
5. Verify the setting is removed or the API error is shown if deletion is blocked.

test flow (name): View terminal detail
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open a terminal detail page.
2. Review movement timeline and linked jobs.
3. Review device details, terminal setting, SIM card, rental setup, and replacement history.
4. Click `View merchant` when a merchant is linked.
5. Verify merchant detail opens.

test flow (name): Update terminal status
user role(s): Admin, Warehouse
steps taken:
1. Open a terminal detail page.
2. Click `Update Status`.
3. Select the target status.
4. Optionally enter a note.
5. Click `Apply Status`.
6. Verify the terminal status updates and a movement entry is logged.

test flow (name): Link SIM to terminal
user role(s): Admin, Warehouse
steps taken:
1. Open a terminal detail page with no linked SIM.
2. Click `Link SIM Card`.
3. Select an In Storage SIM.
4. Click `Link SIM`.
5. Verify the SIM card card shows the selected SIM and terminal connectivity updates.

test flow (name): Replace terminal SIM
user role(s): Admin, Warehouse
steps taken:
1. Open a terminal detail page with a linked SIM.
2. Click `Replace SIM Card`.
3. Select an In Storage SIM.
4. Click `Replace SIM`.
5. Verify the old SIM is unlinked and the new SIM is linked.

test flow (name): Unlink terminal SIM
user role(s): Admin, Warehouse
steps taken:
1. Open a terminal detail page with a linked SIM.
2. Click `Unlink SIM`.
3. Verify the SIM is moved to storage.
4. Verify terminal connectivity returns to WiFi-only.

test flow (name): View and filter SIM cards
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open `/simcards`.
2. Review total, active, in storage, and suspended summary cards.
3. Search by ICCID, MSISDN, carrier, or terminal.
4. Filter by status.
5. Click `View` on a SIM row.
6. Verify SIM detail opens.

test flow (name): Export SIM cards
user role(s): Admin
steps taken:
1. Open `/simcards`.
2. Click `Export`.
3. Verify the SIM card export action is available for the role.

test flow (name): Add SIM card
user role(s): Admin, Warehouse
steps taken:
1. Open `/simcards`.
2. Click `Add SIM Card`.
3. Enter ICCID.
4. Enter optional MSISDN.
5. Select carrier, plan, and data allowance.
6. Click `Add SIM Card`.
7. Verify the SIM card is added to inventory in storage.

test flow (name): Edit SIM card
user role(s): Admin, Warehouse
steps taken:
1. Open a SIM card detail page.
2. Click `Edit`.
3. Update ICCID, MSISDN, carrier, plan, data allowance, status, or linked terminal.
4. Click `Save Changes`.
5. Verify the SIM card detail reflects the updated values.

test flow (name): Quick link SIM to terminal
user role(s): Admin, Warehouse
steps taken:
1. Open a SIM card detail page for an In Storage SIM.
2. In the Linked Terminal card, select a terminal.
3. Verify the SIM is linked and set to Active.
4. Verify the terminal connectivity is updated.

test flow (name): Quick unlink SIM from terminal
user role(s): Admin, Warehouse
steps taken:
1. Open a SIM card detail page for an Active SIM.
2. Click `Unlink Terminal`.
3. Verify the SIM status becomes In Storage.
4. Verify the old terminal connectivity returns to WiFi-only.

test flow (name): Delete SIM card
user role(s): Admin
steps taken:
1. Open a SIM card detail page.
2. Click `Delete`.
3. Verify the app returns to the SIM card listing after successful deletion.
4. Verify an API error is shown if deletion is blocked.

test flow (name): View and filter jobs
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open `/jobs`.
2. Search by job ID, customer, merchant, or assignee.
3. Filter by job type.
4. Filter by Open or Completed status.
5. Filter by SLA status.
6. Open a job row.
7. Verify job detail opens.

test flow (name): Export jobs
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Export`.
3. Verify the job export action is available for the role.

test flow (name): Create installation job
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Create Job`.
3. Select `Installation`.
4. Search and select customer.
5. Search and select merchant under that customer.
6. Select terminal model.
7. Select assignee, priority, and due date.
8. Enter optional instructions.
9. Click `Create Job`.
10. Verify the job detail opens with stages Pending, Device Prepared, Job Done, and Completed.

test flow (name): Create repair or maintenance job
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Create Job`.
3. Select `Repair/Maintenance`.
4. Search and select customer.
5. Search and select merchant.
6. Select affected terminal from linked merchant terminals.
7. Select assignee, priority, and due date.
8. Enter optional instructions.
9. Click `Create Job`.
10. Verify the job detail opens with stages Pending, Job Done, and Completed.

test flow (name): Create replacement job
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Create Job`.
3. Select `Replacement`.
4. Search and select customer.
5. Search and select merchant.
6. Select the device to be replaced.
7. Select replacement terminal model.
8. Select assignee, priority, and due date.
9. Enter optional instructions.
10. Click `Create Job`.
11. Verify the job detail opens with the previous device and replacement request visible.

test flow (name): Create paper roll request job
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Create Job`.
3. Select `Paper Roll Request`.
4. Search and select customer.
5. Search and select merchant.
6. Enter paper roll quantity.
7. Select payment target as Merchant or Bank.
8. Select assignee, priority, and due date.
9. Click `Create Job`.
10. Verify the job detail opens with the paper roll request details.

test flow (name): Create remote support job
user role(s): Admin, Operations
steps taken:
1. Open `/jobs`.
2. Click `Create Job`.
3. Select `Remote Support`.
4. Search and select customer.
5. Search and select merchant.
6. Select affected terminal if available.
7. Select assignee, priority, and due date.
8. Enter optional instructions.
9. Click `Create Job`.
10. Verify the job detail opens with stages Pending and Completed.

test flow (name): Assign device to installation or replacement job
user role(s): Admin, Warehouse
steps taken:
1. Open an Installation or Replacement job that has no assigned device and is not completed.
2. In the Device card, click `Assign Device from Inventory`.
3. Search available in-stock terminals.
4. Select a matching or alternative device.
5. Click `Assign Device`.
6. Verify the job detail shows the assigned terminal.

test flow (name): Add requested terminal from job assignment
user role(s): Admin, Warehouse
steps taken:
1. Open an Installation or Replacement job that requests a terminal model.
2. Click `Assign Device from Inventory`.
3. Click `Add Requested Terminal`.
4. Verify `/terminals` opens with the register device modal started for the requested terminal setting.
5. Complete terminal registration.

test flow (name): Advance job stage without evidence
user role(s): Admin, Operations, Warehouse
steps taken:
1. Open a job detail page where the next stage does not require evidence.
2. Click `Advance to <next stage>`.
3. Verify the job stage updates.
4. Verify status timeline and SLA tracking update.

test flow (name): Advance job stage with evidence
user role(s): Admin, Operations
steps taken:
1. Open a job detail page where the next stage requires evidence, such as Job Done or Completed.
2. Click `Record <next stage>`.
3. Enter an optional transition note.
4. Upload proof, forms, photos, or signed documents.
5. Click `Confirm`.
6. Verify the stage updates and evidence appears in Evidence & Notes.

test flow (name): Complete replacement job with previous terminal status
user role(s): Admin, Operations
steps taken:
1. Open a Replacement job at the final completion step.
2. Click `Record Completed`.
3. Select previous terminal status, such as Faulty, Maintenance, Returned, Retired, or In Stock.
4. Enter an optional transition note.
5. Upload required proof.
6. Click `Confirm`.
7. Verify the replacement job is completed and the previous terminal status is captured.

test flow (name): View job evidence
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open a job detail page with uploaded evidence.
2. Expand Evidence & Notes.
3. Click `Open` on a file.
4. Click `Download` on a file.
5. Verify image evidence renders in the preview frame when applicable.

test flow (name): Export job detail
user role(s): Admin, Operations
steps taken:
1. Open an exportable job detail page.
2. Click `Export Details`.
3. Select export format.
4. Select included sections.
5. Click `Download`.
6. Verify the export confirmation is shown.

test flow (name): View and filter rentals
user role(s): Admin, Finance, Operations, Viewer
steps taken:
1. Open `/rentals`.
2. Review total rentals, active rentals, monthly revenue, and ended counts.
3. Search by rental ID, customer, merchant, or terminal serial.
4. Filter by status.
5. Open a rental row.
6. Verify rental detail opens.

test flow (name): Export rentals
user role(s): Admin, Finance
steps taken:
1. Open `/rentals`.
2. Click `Export`.
3. Verify the rental export action is available for the role.

test flow (name): Create rental
user role(s): Admin, Finance
steps taken:
1. Open `/rentals`.
2. Click `Create Rental`.
3. Select merchant.
4. Select terminal.
5. Select rental plan.
6. Enter monthly rate, deposit, and start date.
7. Click `Create Rental`.
8. Verify the rental appears in the listing.

test flow (name): Generate rental invoice
user role(s): Admin, Finance
steps taken:
1. Open a rental detail page.
2. Click `Generate Invoice` or `Regenerate Invoice`.
3. Verify the PDF document opens in a new browser window.
4. Verify the invoice issued date is updated.

test flow (name): Generate rental eInvoice
user role(s): Admin, Finance
steps taken:
1. Open a rental detail page for a customer with a TIN.
2. Click `Generate eInvoice` or `Regenerate eInvoice`.
3. Verify the document opens in a new browser window.
4. Verify the eInvoice issued date is updated.

test flow (name): Block rental eInvoice without customer TIN
user role(s): Admin, Finance
steps taken:
1. Open a rental detail page for a customer without a TIN.
2. Review the Billing Documents card.
3. Verify the eInvoice action is disabled.
4. Verify the page states that a customer TIN number is required.

test flow (name): View and filter payouts
user role(s): Admin, Finance, Viewer
steps taken:
1. Open `/payouts`.
2. Review net this cycle, paid out, pending count, and pending net summary cards.
3. Search by payout ID, merchant, or MID.
4. Filter by Pending or Paid status.
5. Open a payout row.
6. Verify payout detail opens.

test flow (name): Export payouts
user role(s): Admin, Finance
steps taken:
1. Open `/payouts`.
2. Click `Export`.
3. Verify the payout export action is available for the role.

test flow (name): Create payout from merchant transaction file
user role(s): Admin, Finance
steps taken:
1. Open `/payouts`.
2. Click `Create Payout`.
3. Search and select customer.
4. Search and select merchant.
5. Enter period start and period end.
6. Select payment method.
7. Click `Next`.
8. Upload an Excel or CSV transaction file.
9. Click `Create Payout`.
10. Verify the payout is created and appears in the listing.

test flow (name): Upload transactions to auto-generate payouts
user role(s): Admin, Finance
steps taken:
1. Open `/payouts`.
2. Click `Upload Transactions`.
3. Optionally enter period start and period end.
4. Upload an Excel or CSV file containing transactions for multiple merchants.
5. Click `Process File`.
6. Verify the completion message shows the number of payouts created and any failures.

test flow (name): Review payout detail and exception checks
user role(s): Admin, Finance, Viewer
steps taken:
1. Open a payout detail page.
2. Review payout summary, payment proof status, and financials.
3. Review Exception Checks.
4. Search linked transactions by transaction ID, merchant, or payment method.
5. Verify method breakdown and transaction rows are displayed.

test flow (name): Mark payout as paid
user role(s): Admin, Finance
steps taken:
1. Open a Pending payout detail page.
2. Click `Mark as Paid`.
3. Upload a proof-of-payment file.
4. Click `Confirm Payment`.
5. Verify payout status changes to Paid.
6. Verify payment proof and issued date are stored.

test flow (name): View paper roll inventory
user role(s): Admin, Operations, Warehouse, Viewer
steps taken:
1. Open `/paper-rolls`.
2. Review current inventory, total received, and total issued.
3. Verify low or critical stock indicators appear based on current stock.
4. Search by reference, note, or creator.
5. Filter by Received, Issued, or Adjustment.

test flow (name): Export paper roll inventory
user role(s): Admin
steps taken:
1. Open `/paper-rolls`.
2. Click `Export`.
3. Verify the paper roll export action is available for the role.

test flow (name): Record paper roll stock received
user role(s): Admin, Warehouse
steps taken:
1. Open `/paper-rolls`.
2. Click `Update Stock`.
3. Select `Stock In - Received`.
4. Enter quantity and date.
5. Enter reference and optional note.
6. Click `Save Entry`.
7. Verify the received movement appears and inventory balance increases.

test flow (name): Record paper roll stock issued
user role(s): Admin, Warehouse
steps taken:
1. Open `/paper-rolls`.
2. Click `Update Stock`.
3. Select `Stock Out - Issued`.
4. Select type `Issued`.
5. Enter quantity and date.
6. Enter reference and optional note.
7. Click `Save Entry`.
8. Verify the issued movement appears and inventory balance decreases.

test flow (name): Record paper roll adjustment
user role(s): Admin, Warehouse
steps taken:
1. Open `/paper-rolls`.
2. Click `Update Stock`.
3. Select `Stock Out - Issued`.
4. Select type `Adjustment`.
5. Enter quantity and date.
6. Enter reference and optional note.
7. Click `Save Entry`.
8. Verify the adjustment movement appears and inventory balance decreases.

test flow (name): View MDR rates
user role(s): Admin, Finance
steps taken:
1. Open `/mdr`.
2. Review payment type, network, category, and MDR percentage.
3. Verify debit, credit, and QR categories are labeled.

test flow (name): Export MDR rates
user role(s): Admin, Finance
steps taken:
1. Open `/mdr`.
2. Click `Export`.
3. Verify the MDR export action is available for the role.

test flow (name): Add MDR rate
user role(s): Admin, Finance
steps taken:
1. Open `/mdr`.
2. Click `Add Rate`.
3. Enter payment type.
4. Enter network.
5. Select category.
6. Enter MDR rate percentage.
7. Click `Add Rate`.
8. Verify the rate appears in the table.

test flow (name): Edit MDR rate
user role(s): Admin, Finance
steps taken:
1. Open `/mdr`.
2. Click the edit icon for a rate.
3. Update payment type, network, category, or MDR percentage.
4. Click `Save Changes`.
5. Verify the updated rate appears in the table.

test flow (name): View and update job SLA settings
user role(s): Admin
steps taken:
1. Open `/settings`.
2. Review Job SLA Thresholds by job type and stage transition.
3. Update warning days and breach days for one or more rows.
4. Verify the Save Changes button appears.
5. Click `Save Changes`.
6. Verify the save confirmation is shown.

test flow (name): Validate invalid SLA setting
user role(s): Admin
steps taken:
1. Open `/settings`.
2. Set warning days greater than breach days for any stage transition.
3. Verify the validation warning appears.
4. Verify `Save Changes` is disabled until the invalid row is fixed.

test flow (name): View and filter users
user role(s): Admin
steps taken:
1. Open `/users`.
2. Keep the `Users` tab selected.
3. Search by name or email.
4. Filter by role.
5. Change page size.
6. Change pages if multiple pages are available.

test flow (name): Invite user
user role(s): Admin
steps taken:
1. Open `/users`.
2. Click `Invite User`.
3. Enter full name.
4. Enter email address.
5. Enter temporary password.
6. Select role.
7. Click `Create User`.
8. Verify the user appears in the user list.

test flow (name): Edit user
user role(s): Admin
steps taken:
1. Open `/users`.
2. Click the edit icon for a user.
3. Update full name, email, or role.
4. Click `Save Changes`.
5. Verify the user list reflects the update.

test flow (name): Reset user password
user role(s): Admin
steps taken:
1. Open `/users`.
2. Click the edit icon for an existing user.
3. Enter a new password in the Reset Password section.
4. Click `Reset`.
5. Verify the success message is shown.

test flow (name): Suspend user
user role(s): Admin
steps taken:
1. Open `/users`.
2. Locate an Active user.
3. Click the suspend action.
4. Verify the user status changes to Suspended.

test flow (name): Activate suspended user
user role(s): Admin
steps taken:
1. Open `/users`.
2. Locate a Suspended user.
3. Click the activate action.
4. Verify the user status changes to Active.

test flow (name): View roles and permissions
user role(s): Admin
steps taken:
1. Open `/users`.
2. Click the `Roles & Permissions` tab.
3. Review each role description, user count, and permission count.

test flow (name): Edit role permissions
user role(s): Admin
steps taken:
1. Open `/users`.
2. Click the `Roles & Permissions` tab.
3. Click `Edit Permissions` for a role.
4. Toggle permission checkboxes by module.
5. Click `Save Changes`.
6. Verify the role permission count updates and the save confirmation is shown.

test flow (name): View and filter audit logs
user role(s): Admin, Finance
steps taken:
1. Open `/audit-logs`.
2. Search by user, description, or entity ID.
3. Filter by event type: Create, Update, Delete, Auth, Export, or System.
4. Change pages if multiple pages are available.
5. Verify audit rows show ID, timestamp, user, description, entity reference, and type.

test flow (name): Export audit logs
user role(s): Admin
steps taken:
1. Open `/audit-logs`.
2. Click `Export`.
3. Verify the audit log export action is available for the role.

test flow (name): View and filter referrals
user role(s): Admin, Finance
steps taken:
1. Open `/referrals`.
2. Search by referral, merchant, or contact.
3. Filter by lead progress.
4. Filter by record status.
5. Filter by commission status.
6. Open a referral row.
7. Verify referral detail opens.

test flow (name): Create referral
user role(s): Admin, Finance
steps taken:
1. Open `/referrals`.
2. Click `Add Referral`.
3. Select lead type.
4. Enter merchant name.
5. Enter business registration number if available.
6. Enter contact name, phone, email, address, and notes.
7. Click `Create Referral`.
8. Verify the referral detail page opens.

test flow (name): View referral detail
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Review Lead Information.
3. Review Processing Progress.
4. Review Merchant Link & Activation.
5. Review First Transaction & Commission.
6. Review People, Review Flags, Reversal, and Attachments cards.

test flow (name): Assign referral processor
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Click `Assign Processor`.
3. Search active users.
4. Select a processor.
5. Click `Assign`.
6. Verify the referral processor updates.

test flow (name): Update referral processing progress
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. In Processing Progress, click `Update`.
3. Select lead progress.
4. Enter processing status.
5. Enter document submission date, next follow-up date, bank submission reference, and notes as needed.
6. Click `Save Progress`.
7. Verify the processing fields update.

test flow (name): Link referral to merchant
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Click `Link Existing Merchant` or the Merchant Link card `Link` action.
3. Search merchant, MID, or bank.
4. Select an existing merchant.
5. Click `Link Merchant`.
6. Verify the referral shows the linked merchant ID and merchant name.

test flow (name): Confirm referral first transaction
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Click `Confirm`.
3. Enter first transaction date.
4. Enter optional transaction reference.
5. Click `Confirm`.
6. Verify first transaction and commission eligibility fields update.

test flow (name): Upload referral attachment
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Click `Attachment` or the Attachments card `Upload` action.
3. Upload a merchant document, bank proof, or internal note file.
4. Click `Upload`.
5. Verify the attachment appears in the Attachments card.

test flow (name): View or download referral attachment
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page with attachments.
2. Click the view icon for an attachment.
3. Verify the attachment opens when a path is available.
4. Click the download icon.
5. Verify the attachment downloads when a path is available.

test flow (name): Close referral
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page.
2. Click `Close Referral`.
3. Select a closure reason.
4. Click `Close Referral`.
5. Verify the referral status updates to a closed or cancelled state.

test flow (name): Open linked merchant from referral
user role(s): Admin, Finance
steps taken:
1. Open a referral detail page with a linked merchant.
2. Click `Open Merchant`.
3. Verify the linked merchant detail page opens.

test flow (name): View and filter referral bonus batches
user role(s): Admin, Finance
steps taken:
1. Open `/referral-bonus-batches`.
2. Filter by year.
3. Filter by quarter.
4. Filter by Draft or Paid status.
5. Open a batch row.
6. Verify batch detail opens.

test flow (name): Generate referral bonus batch
user role(s): Admin, Finance
steps taken:
1. Open `/referral-bonus-batches`.
2. Click `Generate Batch`.
3. Enter year.
4. Select quarter.
5. Click `Generate`.
6. Verify the generated batch detail page opens.

test flow (name): View referral bonus batch detail
user role(s): Admin, Finance
steps taken:
1. Open a referral bonus batch detail page.
2. Review batch status, commission line count, total amount, and paid date.
3. Review commission lines by role, staff, merchant, referral, amount, and reason.

test flow (name): Export referral bonus batch CSV
user role(s): Admin, Finance
steps taken:
1. Open a referral bonus batch detail page.
2. Click `Export CSV`.
3. Verify the CSV download is generated for the batch.

test flow (name): Mark referral bonus batch paid
user role(s): Admin, Finance
steps taken:
1. Open a Draft referral bonus batch detail page.
2. Click `Mark Paid`.
3. Enter paid date.
4. Upload payment proof.
5. Click `Mark Paid`.
6. Verify the batch status changes to Paid and paid date is shown.
