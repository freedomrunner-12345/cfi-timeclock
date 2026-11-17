/* Shared decorative scene markup for the kiosk and admin previews.
   Pure markup only: no API requests, timers, storage, or employee data. */
(function(){
 const items=(count,kind)=>Array.from({length:count},(_,i)=>{
  const x=(i*37+17)%100,delay=((i*7)%19)/-2,speed=8+(i*3)%12;
  return '<i class="scene-particle '+kind+'" style="--x:'+x+'%;--delay:'+delay+'s;--speed:'+speed+'s"></i>';
 }).join('');
 const pines=(n)=>Array.from({length:n},(_,i)=>
  '<i class="scene-pine pine-'+(i+1)+'"><i></i><i></i><i></i><b></b></i>').join('');
 const lights=Array.from({length:13},(_,i)=>'<i class="scene-bulb bulb-'+(i+1)+'"></i>').join('');
 const burst=Array.from({length:7},(_,i)=>'<i class="scene-burst burst-'+(i+1)+'"><b></b><b></b><b></b><b></b></i>').join('');
 const scenes={
  classic:'',
  winter:'<div class="scene-snowbank"></div>'+pines(3)+items(22,'scene-snow'),
  winterlights:'<div class="scene-snowbank"></div>'+pines(3)+'<div class="scene-lights">'+lights+'</div>'+items(19,'scene-snow')+items(6,'scene-gold'),
  thanksgiving:'<div class="scene-hills"></div><div class="scene-harvest"><i></i><i></i><i></i></div>'+items(14,'scene-leaf'),
  autumn:'<div class="scene-hills"></div>'+items(13,'scene-leaf'),
  newyear:'<div class="scene-skyline"></div>'+burst+items(12,'scene-gold'),
  spring:'<div class="scene-branch"></div>'+items(17,'scene-petal'),
  summer:'<div class="scene-sunset"></div><div class="scene-hills"></div>'+items(15,'scene-firefly'),
  halloween:'<div class="scene-moon"></div><div class="scene-hills"></div><div class="scene-bats"><i></i><i></i><i></i></div>'+items(7,'scene-mist'),
  patriotic:'<div class="scene-skyline"></div>'+burst+items(11,'scene-star')
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
