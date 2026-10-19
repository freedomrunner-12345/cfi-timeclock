# CFI Time Clock

Mobile-first, installable time clock for CFI Tire Service, hosted on Cloudflare Workers with SQLite Durable Object storage. Uses real timestamps and persistent records. **Not a demo.**

## Getting started

1. Deploy using `npx wrangler deploy` from the GitHub-connected Cloudflare Worker. Leave Build Command blank.
2. In Cloudflare Workers & Pages → **cfi-timeclock** → Settings → Variables and Secrets, add a **Secret** named `ADMIN_PASSWORD` with a unique password at least 12 characters long. Do not add this value to GitHub. Once the Worker redeploys, open `https://YOUR-WORKER-URL/admin/` and sign in using that password. There is no public administrator account setup.
3. Within **Employees**, add your own Paychex employee ID and name. No ID or employee name is hardcoded into current source files.
4. Open the standard app URL on your phone or tablet. Enter your employee ID and tap **Continue**. The app greets you by your name and remembers your session.
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
- Exact punch time history, admin audit trail, and corrections restricted to the original workday.
- Incomplete shifts are marked for review. There is no offline punch recording.
- This pilot is not yet a complete payroll system. Compare its results against the existing spreadsheet before processing payroll.

The employee interface is optimized for phones and tablets with large text and CFI red branding.
