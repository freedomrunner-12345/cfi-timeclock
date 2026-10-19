# CFI Time Clock

Mobile-first, installable time clock for CFI Tire Service.

**Pilot:** real punches and PTO for one administrator, not a demo. Staff accounts are not enabled in this initial release.

## Deployment
Cloudflare Workers with built-in static assets and SQLite-backed Durable Objects (no separate database setup).
The project deploys using `npx wrangler deploy`.

**Required before first sign-in:** add a Cloudflare Worker secret named `BOOTSTRAP_SECRET` with a unique random value. In the Workers dashboard: Settings → Variables and Secrets → Add → Secret. Redeploy if prompted. Do not place the secret in GitHub.

Then open the deployed URL and enter the setup code, your Paychex ID, name, and a six-digit PIN. After setup the ID+PIN signs in on phone/tablet.

**Payroll policy:** store exact server timestamps; round total completed weekly worked time to 0.25 hours; one 30-minute paid lunch credit for the first completed out/in break each day; additional breaks up to 20 minutes are considered paid rest time unless explicitly classified otherwise by the administrator; PTO separately; overtime on hours worked >40. Check the weekly review before payroll. Incomplete/abnormal records require review.

Do not enter actual payroll until you have verified punch sequences and company wage-and-hour policies. Real records persist in Cloudflare Durable Objects. Internet connectivity is required to record a punch.

## Install
Android Chrome: menu → Install app / Add to Home screen.
iPhone/iPad Safari: Share → Add to Home Screen.

## Architecture
`src/index.js`: Worker API and durable SQLite storage.
`public/`: zero-build installable PWA.
`wrangler.jsonc`: Worker + static assets + storage binding.
