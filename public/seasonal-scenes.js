/* Shared, decorative holiday scenes for Admin preview and idle kiosk clock.
   All illustration assets are licensed SVGs stored locally. No network/timers. */
(function(){
 const decorative=(n,kind)=>Array.from({length:n},(_,i)=>{
  const x=(i*47+13)%98;
  const delay=-((i*7)%24)*.9;
  const seconds=11+(i*5)%15;
  const size=12+(i*7)%16;
  const drift=-28+(i*13)%56;
  return '<i class="scene-particle '+kind+' tone-'+(i%5)+'" style="--x:'+x+'%;--delay:'+delay+'s;--speed:'+seconds+'s;--flake-size:'+size+'px;--drift:'+drift+'px"></i>';
 }).join('');
 const lights='<span class="holiday-light-string">'+Array.from({length:13},(_,i)=>'<i class="holiday-light light-'+(i+1)+'"></i>').join('')+'</span>';
 const glints='<span class="holiday-glints">'+Array.from({length:4},(_,i)=>'<i class="holiday-glint glint-'+(i+1)+'"></i>').join('')+'</span>';
 const scene={
  classic:'',
  thanksgiving:'<span class="holiday-leaf-glow"></span><span class="holiday-turkey"></span>'+decorative(15,'scene-leaf'),
  christmas:'<span class="holiday-snowbank"></span><span class="holiday-tree tree-left"></span><span class="holiday-tree tree-right"></span>'+lights+decorative(21,'scene-snow'),
  newyear:'<span class="holiday-champagne-glow"></span><span class="holiday-party-popper"></span>'+glints+decorative(16,'scene-confetti'),
  fourth:'<span class="holiday-flag"></span><span class="holiday-flag-halo"></span>'+glints+decorative(11,'scene-star')
 };
 window.CFIThemeScene={
  ids:Object.keys(scene),
  markup(name){
   const theme=Object.prototype.hasOwnProperty.call(scene,name)?name:'classic';
   return '<span class="season-scene" aria-hidden="true">'+scene[theme]+'</span>';
  }
 };
})();
