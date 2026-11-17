// Theme settings are isolated from payroll tables and punch history.
export const WELCOME_THEMES = Object.freeze([
 'classic','winter','spring','summer','autumn','thanksgiving','halloween','winterlights','newyear','patriotic'
]);
export const DEFAULT_WELCOME_THEME = 'classic';
export function validatedWelcomeTheme(value){
 return typeof value==='string' && WELCOME_THEMES.includes(value) ? value : DEFAULT_WELCOME_THEME;
}
export function normalizeWelcomeSettings(raw){
 return {mode:raw?.mode==='automatic'?'automatic':'manual',theme:validatedWelcomeTheme(raw?.theme)};
}
export function scheduledWelcomeTheme(date){
 // US holiday calendar, evaluated in Central Time. No background jobs.
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const year=Number(p.year),month=Number(p.month),day=Number(p.day);
 if(month===12)return 'winterlights'; // Festive, nonreligious December theme.
 if(month===1&&day<=7)return 'newyear';
 if(month===7&&day<=7)return 'patriotic';
 if(month===10)return 'halloween';
 if(month===11){
  const firstWeekday=new Date(Date.UTC(year,10,1)).getUTCDay();
  const fourthThursday=1+((4-firstWeekday+7)%7)+21;
  return day>=Math.max(1,fourthThursday-3)?'thanksgiving':'autumn';
 }
 if(month===1||month===2)return 'winter';
 if(month>=3&&month<=5)return 'spring';
 if(month>=6&&month<=8)return 'summer';
 return 'autumn';
}
export function activeWelcomeTheme(settings,date=new Date()){
 const s=normalizeWelcomeSettings(settings);
 return s.mode==='automatic'?scheduledWelcomeTheme(date):s.theme;
}
