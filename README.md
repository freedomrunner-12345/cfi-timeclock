# CFI Time Clock

Mobile-first, installable time clock for CFI Tire Service, hosted on Cloudflare Workers with SQLite Durable Object storage. Uses real timestamps and persistent records. **Not a demo.**

## Getting started

1. Deploy using `npx wrangler deploy` from the GitHub-connected Cloudflare Worker. Leave Build Command blank.
2. In Cloudflare Workers & Pages → **cfi-timeclock** → Settings → Variables and Secrets, add a **Secret** named `ADMIN_PASSWORD` with a unique password at least 12 characters long. Do not add this value to GitHub. Once the Worker redeploys, open `https://YOUR-WORKER-URL/admin/` and sign in using that password. There is no public administrator account setup.
3. Within **Employees**, upload the supplied `CFI_Time_Clock_Employee_Roster.tsv` using **Import employee roster**. It contains all 20 original employee records, with only the testing account enabled. You can enable other employees later using the Employee access controls. Employee IDs and names are not baked into the public repository.
4. Open the standard app URL on your phone or tablet. Enter your employee ID and tap **Continue**. The app displays your first name, current clock status, and today's punch times. It automatically signs out and reloads after 60 seconds of inactivity.
5. Install from Android Chrome → **Install app**, or iPhone/iPad Safari → **Share → Add to Home Screen**.

### Security and onboarding

Employee sign-in uses **ID only**, exactly as requested. This is convenient but does not verify identity: someone with another employee's ID could access their timecard or submit punches under their name. Only enable employees when you are comfortable with this trade-off and consider stronger verification before a wider rollout.

The administrator has a **separate password-protected session** on `/admin`; employee ID login does not grant admin access. Admins can add/disable employees, review and correct punches, approve/deny PTO, and export weekly payroll CSV files. The admin password can be changed in Cloudflare's Worker secrets; store it safely.

**Admin credential:** `/admin` uses the Cloudflare `ADMIN_PASSWORD` Worker secret directly. Changing that secret revokes existing admin sessions. If the secret is missing or shorter than 12 characters, admin sign-in is disabled until it is corrected.

The GitHub repository was originally public; earlier commit history may contain an employee ID even after its removal from current source. Consider making the repository private, and if necessary rewriting history to remove previously committed identifiers.

## Payroll logic

- Server timestamps stored exactly in Central time context.
- Two punch buttons (In and Out); first completed out/in break each day receives a 30-minute paid lunch credit.
- Additional breaks are deducted by the initial spreadsheet rule. Ordinary short breaks (often 5–20 minutes) can legally be paid work time. **Review break handling before relying on the totals for real payroll.**
- Weekly hours worked are rounded once to the nearest 0.25 hour. Regular hours up to 40, overtime for hours worked over 40. PTO is recorded separately, may be retroactive within the current Monday–Sunday pay week, and must be approved by the administrator.
- The employee timecard lists only clock-in and clock-out timestamps for days with punches, without daily or weekly hour totals. Admin payroll reporting still calculates hours.
- Employee sessions expire after 60 seconds of inactivity; they use a browser-session cookie and are not remembered long-term. A visible countdown and prominent Sign Out control support shared tablets.
- Exact punch time history, admin audit trail, and corrections restricted to the original workday.
- Incomplete shifts are marked for review. There is no offline punch recording.
- This pilot is not yet a complete payroll system. Compare its results against the existing spreadsheet before processing payroll.

The employee interface is optimized for phones and tablets with large text and CFI red branding.

## Administrator timecard corrections

Use **Admin → Timecards → View** for an employee. **Add Missed Punch** creates a dated Clock In or Clock Out; **Edit** corrects the time of a particular punch; **Delete** removes just that one punch after the administrator types `DELETE`. The broad week-clear action has been removed. Punch changes are audit-logged with original values and the employee's active kiosk sessions are invalidated after manual additions/deletions. Review any incomplete or nonalternating punch sequences before payroll.

Under **Admin → Employees → Preferred Name**, set the name shown on employee clock-in screens and confirmations. The Paychex name remains intact for exports and payroll. Leave Preferred Name blank to default to the first name parsed from the Paychex name.
