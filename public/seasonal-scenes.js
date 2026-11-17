/* Shared decorative scene markup for the kiosk and admin previews.
   Pure markup only: no API requests, timers, storage, or employee data. */
(function(){
 const items=(count,kind)=>Array.from({length:count},(_,i)=>{
  // Stable spread with varied size, speed, and lateral drift. No polling or timers.
  const x=(i*37+17)%100,delay=-(i*7%23)*.8,speed=10+(i*5)%15;
  const size=8+(i*7)%13,sway=-20+(i*11)%41;
  return '<i class="scene-particle '+kind+'" style="--x:'+x+'%;--delay:'+delay+'s;--speed:'+speed+'s;--flake-size:'+size+'px;--sway:'+sway+'px"></i>';
 }).join('');
 const pines=()=>'<span class="scene-forest">'
  +Array.from({length:6},(_,i)=>'<i class="scene-forest-tree forest-'+(i+1)+'"></i>').join('')
  +'</span>';
 const lights=Array.from({length:13},(_,i)=>'<i class="scene-bulb bulb-'+(i+1)+'"></i>').join('');
 const burst=Array.from({length:7},(_,i)=>'<i class="scene-burst burst-'+(i+1)+'"><b></b><b></b><b></b><b></b></i>').join('');
 const scenes={
  classic:'',
  winter:'<span class="scene-snowbank"></span>'+pines()+items(22,'scene-snow'),
  winterlights:'<span class="scene-snowbank"></span>'+pines()+'<span class="scene-lights">'+lights+'</span>'+items(19,'scene-snow')+items(6,'scene-gold'),
  thanksgiving:'<span class="scene-hills"></span><span class="scene-harvest"><i></i><i></i><i></i></span>'+items(14,'scene-leaf'),
  autumn:'<span class="scene-hills"></span>'+items(13,'scene-leaf'),
  newyear:'<span class="scene-skyline"></span>'+burst+items(12,'scene-gold'),
  spring:'<span class="scene-branch"></span>'+items(17,'scene-petal'),
  summer:'<span class="scene-sunset"></span><span class="scene-hills"></span>'+items(15,'scene-firefly'),
  halloween:'<span class="scene-moon"></span><span class="scene-hills"></span><span class="scene-bats"><i></i><i></i><i></i></span>'+items(7,'scene-mist'),
  patriotic:'<span class="scene-skyline"></span>'+burst+items(11,'scene-star')
 };
 const allowed=Object.keys(scenes);
 window.CFIThemeScene={
  ids:allowed,
  markup(theme){
   const selected=allowed.includes(theme)?theme:'classic';
   return '<span class="season-scene" aria-hidden="true">'+scenes[selected]+'</span>';
  }
 };
})();
