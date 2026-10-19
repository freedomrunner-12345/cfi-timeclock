
const ZONE = 'America/Chicago';
const ADMIN_ID = '194';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);
const pad = n => String(n).padStart(2, '0');
const localDate = iso => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return obj.year + '-' + obj.month + '-' + obj.day;
};
const weekOf = date => {
  const d = new Date(date + 'T12:00:00Z');
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};
const endOfWeek = monday => {
  const d = new Date(monday + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
};
const uid = () => crypto.randomUUID();
const hex = b => Array.from(new Uint8Array(b)).map(v => v.toString(16).padStart(2, '0')).join('');
const sha = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const pinHash = async (pin, salt) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 170000, hash: 'SHA-256' }, key, 256));
};
const same = (a, b) => a.length === b.length && [...a].reduce((v, c, i) => v | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const cookie = (token, clear = false) => 'cfi_session=' + (clear ? '' : token) + '; Path=/; HttpOnly; Secure; SameSite=Strict' + (clear ? '; Max-Age=0' : '; Max-Age=2592000');
function compute(punches, monday, today) {
  const grouped = {};
  for (const p of punches) {
    const day = localDate(p.at);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(p);
  }
  const days = [];
  let weeklyMinutes = 0, warnings = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(monday + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    const day = d.toISOString().slice(0, 10);
    const entries = (grouped[day] || []).sort((a, b) => a.at.localeCompare(b.at));
    let totalMs = 0, gaps = [], needsReview = false, clockIn = null, lastOut = null;
    for (let i = 0; i < entries.length; i++) {
      const p = entries[i];
      if (p.kind === 'IN') {
        if (clockIn !== null) needsReview = true;
        clockIn = p.at;
        if (lastOut !== null) {
          const gapMs = new Date(p.at) - new Date(lastOut);
          if (gapMs < 0) needsReview = true;
          else gaps.push(gapMs);
          lastOut = null;
        }
      } else {
        if (clockIn === null) needsReview = true;
        else {
          const ms = new Date(p.at) - new Date(clockIn);
          if (ms < 0) needsReview = true;
          else totalMs += ms;
        }
        clockIn = null;
        lastOut = p.at;
      }
    }
    if (clockIn !== null) needsReview = true;
    // Every second work interval confirms an intervening first lunch break.
    // Award 30 minutes once per day only when the first out/in gap is completed.
    const lunchCredit = gaps.length ? 30 : 0;
    const minutes = Math.max(0, totalMs / 60000 + lunchCredit);
    weeklyMinutes += minutes;
    if (needsReview) warnings.push(day);
    days.push({ date: day, minutes: Math.round(minutes * 100) / 100, lunchCredit, breaks: gaps.map(ms => Math.round(ms / 60000)), punches: entries, needsReview });
  }
  const roundedHours = Math.round(weeklyMinutes / 15) / 4;
  return { days, weeklyMinutes: Math.round(weeklyMinutes * 100) / 100, workedHours: roundedHours, regularHours: Math.min(40, roundedHours), overtimeHours: Math.max(0, roundedHours - 40), warnings };
}
export class Timeclock {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.db = ctx.storage.sql;
    this.db.exec('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, pin_hash TEXT NOT NULL, created_at TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS punches (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, created_at TEXT NOT NULL, corrected_at TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS pto (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, hours REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL)');
    this.db.exec('CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, at TEXT NOT NULL)');
  }
  one(sql, ...args) { return [...this.db.exec(sql, ...args)][0] || null; }
  all(sql, ...args) { return [...this.db.exec(sql, ...args)]; }
  audit(action, detail) { this.db.exec('INSERT INTO audit (id,user_id,action,detail,at) VALUES (?,?,?,?,?)', uid(), ADMIN_ID, action, JSON.stringify(detail), new Date().toISOString()); }
  async session(req) {
    const token = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)cfi_session=([^;]+)/)?.[1];
    if (!token) return null;
    const now = new Date().toISOString();
    return this.one('SELECT users.id, users.name FROM sessions JOIN users ON sessions.user_id = users.id WHERE token_hash=? AND expires_at>?', await sha(token), now);
  }
  async fetch(req) {
    try {
      const url = new URL(req.url);
      const route = url.pathname;
      if (!route.startsWith('/api/')) return fail('Not found', 404);
      if (req.method === 'POST') {
        const origin = req.headers.get('Origin');
        if (origin && origin !== url.origin) return fail('Invalid origin', 403);
      }
      if (route === '/api/config') return json({ setupRequired: false, pilot: true });
      if (route === '/api/login' && req.method === 'POST') {
        const data = await req.json();
        const id = String(data.id || '').trim();
        if (id !== ADMIN_ID) return fail('Employee ID not enabled for the pilot', 403);
        let user = this.one('SELECT id,name FROM users WHERE id=?', ADMIN_ID);
        if (!user) {
          this.db.exec('INSERT INTO users (id,name,salt,pin_hash,created_at) VALUES (?,?,?,?,?)', ADMIN_ID, 'Travis Nunn', '', '', new Date().toISOString());
          user = this.one('SELECT id,name FROM users WHERE id=?', ADMIN_ID);
        }
        return await this.newSession(user.id);
      }
      if (route === '/api/logout' && req.method === 'POST') {
        const token = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)cfi_session=([^;]+)/)?.[1];
        if (token) this.db.exec('DELETE FROM sessions WHERE token_hash=?', await sha(token));
        const out = json({ ok: true }); out.headers.set('Set-Cookie', cookie('', true)); return out;
      }
      const user = await this.session(req);
      if (!user) return fail('Please sign in', 401);
      const today = localDate(new Date().toISOString()), monday = weekOf(today), sunday = endOfWeek(monday);
      const thisWeek = () => this.all('SELECT id,kind,at,created_at,corrected_at FROM punches WHERE user_id=? ORDER BY at ASC', user.id).filter(p => localDate(p.at) >= monday && localDate(p.at) <= sunday);
      if (route === '/api/state' && req.method === 'GET') {
        const punches = thisWeek();
        const totals = compute(punches, monday, today);
        const requests = this.all('SELECT id,date,hours,status,created_at FROM pto WHERE user_id=? AND date>=? AND date<=? ORDER BY date', user.id, monday, sunday);
        const last = this.one('SELECT id,kind,at FROM punches WHERE user_id=? ORDER BY at DESC LIMIT 1', user.id);
        const worked = totals.workedHours;
        return json({ user: { id: user.id, name: user.name }, monday, sunday, today, punches, totals, requests, isClockedIn: last?.kind === 'IN', lastPunch: last, ptoHours: requests.filter(r => r.status === 'APPROVED').reduce((v,r) => v + r.hours, 0), worked });
      }
      if (route === '/api/punch' && req.method === 'POST') {
        const data = await req.json();
        const kind = data.kind;
        if (kind !== 'IN' && kind !== 'OUT') return fail('Invalid action');
        const last = this.one('SELECT kind,at FROM punches WHERE user_id=? ORDER BY at DESC LIMIT 1', user.id);
        if ((last?.kind === 'IN') === (kind === 'IN')) return fail(kind === 'IN' ? 'Already clocked in' : 'Already clocked out', 409);
        if (last && Date.now() - new Date(last.at).getTime() < 5000) return fail('Please wait a moment between punches', 409);
        const now = new Date().toISOString();
        const id = uid();
        this.db.exec('INSERT INTO punches (id,user_id,kind,at,created_at) VALUES (?,?,?,?,?)', id, user.id, kind, now, now);
        this.audit('punch', { id, kind, at: now });
        return json({ ok: true, kind, at: now });
      }
      if (route === '/api/pto' && req.method === 'POST') {
        const data = await req.json();
        const date = String(data.date || ''), hours = Number(data.hours);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < monday || date > sunday || date !== localDate(date + 'T12:00:00Z')) return fail('Select a day in the current payroll week');
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24 || Math.round(hours * 4) !== hours * 4) return fail('Hours must be in quarter-hour increments, up to 24');
        if (this.one("SELECT id FROM pto WHERE user_id=? AND date=? AND status!='DENIED'", user.id, date)) return fail('A request already exists for that day', 409);
        const id = uid();
        this.db.exec('INSERT INTO pto (id,user_id,date,hours,status,created_at) VALUES (?,?,?,?,?,?)', id, user.id, date, hours, 'PENDING', new Date().toISOString());
        this.audit('pto-request', { id, date, hours });
        return json({ ok: true });
      }
      // Administrative operation disabled during ID-only pilot.
      if (route === '/api/pto-review') return fail('Admin actions require verified sign-in', 403);
      if (route === '/api/pto-review' && req.method === 'POST') {
        const data = await req.json(), status = String(data.status || '');
        if (!['APPROVED','DENIED'].includes(status)) return fail('Invalid status');
        const reqrow = this.one('SELECT * FROM pto WHERE id=? AND user_id=?', String(data.id || ''), user.id);
        if (!reqrow) return fail('Request not found', 404);
        this.db.exec('UPDATE pto SET status=?,reviewed_at=? WHERE id=?', status, new Date().toISOString(), reqrow.id);
        this.audit('pto-reviewed', { id: reqrow.id, status });
        return json({ ok: true });
      }
      // Administrative operation disabled during ID-only pilot.
      if (route === '/api/punch-edit') return fail('Admin actions require verified sign-in', 403);
      if (route === '/api/punch-edit' && req.method === 'POST') {
        const data = await req.json();
        const target = this.one('SELECT * FROM punches WHERE id=? AND user_id=?', String(data.id || ''), user.id);
        if (!target) return fail('Punch not found', 404);
        const parsed = new Date(String(data.at || ''));
        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() || weekOf(localDate(parsed.toISOString())) !== monday || localDate(target.at) !== localDate(parsed.toISOString())) return fail('Correction must stay on the original date in this payroll week');
        const all = this.all('SELECT id,kind,at FROM punches WHERE user_id=? ORDER BY at ASC', user.id).map(p => p.id === target.id ? { ...p, at: parsed.toISOString() } : p).sort((a,b) => a.at.localeCompare(b.at));
        for (let i=0; i<all.length; i++) if ((i > 0 && all[i].kind === all[i-1].kind) || (i===0 && all[i].kind!=='IN') || (i>0 && all[i].at <= all[i-1].at)) return fail('Correction would create overlapping or out-of-order punches');
        const was = target.at;
        this.db.exec('UPDATE punches SET at=?, corrected_at=? WHERE id=?', parsed.toISOString(), new Date().toISOString(), target.id);
        this.audit('punch-corrected', { id: target.id, from: was, to: parsed.toISOString() });
        return json({ ok: true });
      }
      // Administrative operation disabled during ID-only pilot.
      if (route === '/api/export') return fail('Admin actions require verified sign-in', 403);
      if (route === '/api/export' && req.method === 'GET') {
        const data = compute(thisWeek(), monday, today);
        const pto = this.all("SELECT hours FROM pto WHERE user_id=? AND date>=? AND date<=? AND status='APPROVED'", user.id, monday, sunday).reduce((a,x)=>a+x.hours,0);
        const csv = ['Employee ID,Employee,Week Start,Regular Hours,Overtime Hours,Approved PTO,Worked Hours','"' + user.id + '","' + user.name.replaceAll('"','""') + '",' + monday + ',' + data.regularHours.toFixed(2) + ',' + data.overtimeHours.toFixed(2) + ',' + pto.toFixed(2) + ',' + data.workedHours.toFixed(2)].join('\r\n');
        return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cfi-timeclock-' + monday + '.csv"','Cache-Control':'no-store'}});
      }
      return fail('Not found', 404);
    } catch (e) { console.error(e); return fail('Unexpected error. Please try again.', 500); }
  }
  async newSession(id) {
    const token = uid() + uid();
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    this.db.exec('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', await sha(token), id, expires);
    const out = json({ ok: true });
    out.headers.set('Set-Cookie', cookie(token));
    return out;
  }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.CLOCK.idFromName('cfi-production');
      return env.CLOCK.get(id).fetch(req);
    }
    return env.ASSETS.fetch(req);
  }
};