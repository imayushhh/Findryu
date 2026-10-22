# FindrYU

Lost and found for York University's Keele campus. Students report found items, search for lost ones, and claim them with a hidden detail. Staff receive items, review claims, and hand them over after checking photo ID.

Live site: [https://www.findryu.live](https://www.findryu.live)

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server and local scripts only, never in the browser)
   - `RESEND_API_KEY`
   - `RESEND_FROM` (for example `FindrYU <notifications@findryu.live>`)
3. Run the SQL files in `supabase/migrations/` in numeric order in the Supabase SQL editor.
4. Start the app: `npm run dev`

Sign-in emails are sent by Supabase through Resend SMTP (`smtp.resend.com`, port `465`, username `resend`). In Supabase, set the Site URL to `https://www.findryu.live` and allow `https://www.findryu.live/**`, `https://findryu.live/**`, and `http://localhost:3000/**`.

## Make yourself an admin

Sign in once with your York email, then run `supabase/seed_admin.sql` in the SQL editor after putting your email in the script. Open `/admin` to manage people, desks, buildings, categories, settings, archived items, and the audit log.

## Demo script

1. Sign in as a student and report a found item. Note the reference number and drop it off at the chosen desk.
2. Sign in as staff at that desk. Receive the item and record a hidden detail.
3. As another student, search by building, open the item, and claim it. Answer the hidden detail and add proof, or choose no proof and leave a phone number.
4. As staff, open the claim from the desk queue. Read the answer, reveal the hidden detail, approve, then hand the item over with the photo ID box checked.
5. For a no-proof claim, set **No-proof hold** to `0` under Admin, Settings, approve it, then set the hold back to `7`.
6. Register a lost item. When a matching item is received, the owner gets an email and sees the match on My items.

## Requirements

| # | Status | Notes |
| --- | --- | --- |
| 1 | Implemented | Sign-in accepts only `@yorku.ca` and `@my.yorku.ca`. |
| 2 | Implemented | New accounts are users. |
| 3 | Implemented | Admins assign staff and a desk at `/admin/users`. |
| 4 | Implemented | Staff act on items at their own desk. Admins can act at every desk. |
| 5 | Implemented | EN/FR switch is in the header on every page. Navigation, home, and sign-in follow the choice. Other screens stay in English. |
| 6 | Implemented | Found item form. |
| 7 | Implemented | One JPEG or PNG photo, up to 10 MB. GPS data is stripped in the browser. |
| 8 | Implemented | Empty required fields are named and focus moves to the first one. |
| 9 | Implemented | Finder chooses an active drop-off desk. |
| 10 | Implemented | Success page shows the reference number and desk hours. |
| 11 | Implemented | Staff walk-in intake. |
| 12 | Implemented | Staff mark an item received. |
| 13 | Implemented | Hidden detail is stored apart from the public listing. |
| 14 | Implemented | Transfers record the reason and update the current desk. |
| 15 | Implemented | YU-cards and passports show a special-handling banner. |
| 16 | Implemented | Search starts with the building. |
| 17 | Implemented | Received and in-transit items are listed. Reported and archived items are hidden. |
| 18 | Implemented | Keyword search and category, building, and date filters. |
| 19 | Implemented | Suggested matches ranked by category, building, and date. |
| 20 | Implemented | Register a lost item, with an optional photo. |
| 21 | Implemented | Matching owners are emailed through Resend when an item is received. |
| 22 | Implemented | Edit or cancel a lost report. Cancelling deletes its photo. |
| 23 | Implemented | A signed-in user can claim a received item. |
| 24 | Implemented | The claim requires a hidden-detail answer. |
| 25 | Implemented | Proof files, up to 3. |
| 26 | Implemented | No proof requires a phone number or address and starts a hold. |
| 27 | Implemented | One claim per person per item. |
| 28 | Implemented | Statuses show on My items. |
| 29 | Implemented | Staff queue is oldest first. |
| 30 | Implemented | The answer is on the page. The hidden detail loads only after Reveal. |
| 31 | Implemented | Only staff can approve or reject. The database enforces this too. |
| 32 | Implemented | Reject requires a reason. |
| 33 | Implemented | Approve is blocked during the hold, including a direct database update. |
| 34 | Implemented | Items with more than one open claim are highlighted. |
| 35 | Implemented | Handover stores staff, desk, time, and that photo ID was checked. The ID number is not stored. |
| 36 | Implemented | Reopen as contested shows the previous owner's contact details. |
| 37 | Implemented | After-hours pickup asks staff to move the item to Security Services first. |
| 38 | Implemented | Past holding period list, default 30 days. |
| 39 | Implemented | Archive as donated or disposed deletes photos and hides the item. |
| 40 | Implemented | Admins restore an archived item with a new photo. |
| 41 | Implemented | Admins edit the holding period, no-proof hold, retention, and desks. |
| 42 | Implemented | Audit log records item and claim status changes. |
| 43 | Not built | A campus map of drop-off points was optional and is not included. |

Security rules from the build spec are in place: row level security on the tables, status changes through server actions, and the service-role key kept out of browser code.
