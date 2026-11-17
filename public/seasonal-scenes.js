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
  winter:'<span class="scene-snowbank"></span>'+pines(3)+items(22,'scene-snow'),
  winterlights:'<span class="scene-snowbank"></span>'+pines(3)+'<span class="scene-lights">'+lights+'</span>'+items(19,'scene-snow')+items(6,'scene-gold'),
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
