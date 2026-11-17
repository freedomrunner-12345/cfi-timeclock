// Holiday-only welcome screen theme settings, isolated from payroll.
export const WELCOME_THEMES = Object.freeze(['classic','thanksgiving','christmas','newyear','fourth']);
export const DEFAULT_WELCOME_THEME = 'classic';
// Migrate old visual selections safely without writing to Durable Object storage.
export function validatedWelcomeTheme(value){
 if(value==='winter'||value==='winterlights')return 'christmas';
 if(value==='patriotic')return 'fourth';
 return typeof value==='string'&&WELCOME_THEMES.includes(value)?value:DEFAULT_WELCOME_THEME;
}
export function normalizeWelcomeSettings(raw){
 return {mode:raw?.mode==='automatic'?'automatic':'manual',theme:validatedWelcomeTheme(raw?.theme)};
}
export function scheduledWelcomeTheme(date){
 // Date-based only; no polling or cron. Central Time for both locations.
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const year=Number(p.year),month=Number(p.month),day=Number(p.day);
 if(month===12)return 'christmas'; // All of December.
 if(month===1&&day<=7)return 'newyear';
 if(month===7&&day<=7)return 'fourth';
 if(month===11){
  const firstWeekday=new Date(Date.UTC(year,10,1)).getUTCDay();
  const fourthThursday=1+((4-firstWeekday+7)%7)+21;
  if(day>=fourthThursday-3&&day<=fourthThursday+3)return 'thanksgiving';
 }
 return 'classic'; // No generic spring/summer/autumn/winter/Halloween theme.
}
export function activeWelcomeTheme(settings,date=new Date()){
 const s=normalizeWelcomeSettings(settings);
 return s.mode==='automatic'?scheduledWelcomeTheme(date):s.theme;
}
