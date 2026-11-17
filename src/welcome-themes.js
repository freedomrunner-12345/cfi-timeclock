// Allow-listed visual themes. Names are shared by public and admin endpoints.
export const WELCOME_THEMES = Object.freeze([
 'classic','winter','spring','summer','autumn','halloween','christmas','newyear','patriotic'
]);
export const DEFAULT_WELCOME_THEME = 'classic';
export function validatedWelcomeTheme(value){
 return typeof value === 'string' && WELCOME_THEMES.includes(value) ? value : DEFAULT_WELCOME_THEME;
}
