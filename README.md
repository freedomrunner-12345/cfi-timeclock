# CFI Time Clock

Real, persistent pilot for Paychex ID **194** (one administrator). No demo mode; no employee roster visible.

## Deployment
Cloudflare Workers + Static Assets + SQLite Durable Objects. Connect the GitHub repository and deploy with `npx wrangler deploy`. Leave the build command blank.

**Important:** After deployment, configure a Worker secret called `BOOTSTRAP_SECRET` with a long random value (at least 20 characters) under Settings → Variables and Secrets. Do not commit this value or share it publicly. Then open the app, enter the setup code, Paychex ID 194, your name, and create a 6–8 digit PIN. Setup is allowed only once; later visits use ID and PIN. If your Cloudflare project was created before these files were committed, trigger a fresh deployment to build the application.

## Install
- Android: Chrome → Install app / Add to Home screen.
- iPhone/iPad: Safari → Share → Add to Home Screen.
An internet connection is required to submit punches; the app never fabricates offline punch timestamps.

## Pilot rules and limitations
- Server-recorded punch times and 30-day sign-in sessions.
- First completed out/in gap on a day qualifies for a 30-minute paid lunch credit. No out/in pair means no lunch credit.
- Later out/in gaps are deducted from worked hours *in this initial implementation*. **Important:** Ordinary short rest breaks (generally 5–20 minutes) may be compensable and must not be automatically deducted when legally paid; review and classify before actual payroll. The first-break lunch assumption also requires review for unusual punches.
- Exact completed work segments are accumulated for the Monday–Sunday week, then rounded to the nearest 15 minutes once on the weekly worked total. Overtime is worked hours above 40. PTO is independent of worked hours.
- Current week punch correction (same date only), PTO requests + approvals, and payroll CSV export.
- An incomplete active interval is excluded from finalized weekly totals until clock-out. Review warnings before processing payroll.
- This is a one-employee pilot. No self-service onboarding, historical week navigation, manual addition of missing punches, or robust multi-employee manager features yet. Do not rely on this as your sole payroll record before verification.

The app is designed for Central time (`America/Chicago`). Data is stored in the Cloudflare Durable Object (not browser local storage).