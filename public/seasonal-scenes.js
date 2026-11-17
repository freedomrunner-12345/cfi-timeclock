/* Shared holiday visuals for admin previews and idle kiosk welcome screen.
   No polling, cookies, external assets, timers or employee data. */
(function(){
 const items=(count,kind)=>Array.from({length:count},(_,i)=>{
  const x=(i*37+17)%100,delay=-(i*7%23)*.8,speed=10+(i*5)%15;
  const size=10+(i*7)%12,sway=-20+(i*11)%41;
  return '<i class="scene-particle '+kind+' tone-'+i%5+'" style="--x:'+x+'%;--delay:'+delay+'s;--speed:'+speed+'s;--flake-size:'+size+'px;--sway:'+sway+'px"></i>';
 }).join('');
 const pines=()=>'<span class="scene-forest">'+Array.from({length:6},(_,i)=>'<i class="scene-forest-tree forest-'+(i+1)+'"></i>').join('')+'</span>';
 const lights='<span class="scene-lights">'+Array.from({length:13},(_,i)=>'<i class="scene-bulb bulb-'+(i+1)+'"></i>').join('')+'</span>';
 const sparks='<span class="holiday-bursts">'+Array.from({length:5},(_,i)=>'<i class="holiday-burst burst-'+(i+1)+'"></i>').join('')+'</span>';
 const scenes={
  classic:'',
  thanksgiving:'<span class="holiday-thanksgiving-land"></span><span class="holiday-turkey"></span>'+items(18,'scene-leaf'),
  christmas:'<span class="scene-snowbank"></span>'+pines()+lights+items(25,'scene-snow'),
  newyear:'<span class="holiday-city-haze"></span>'+sparks+'<span class="holiday-gold-dust"></span>'+items(15,'scene-gold'),
  fourth:'<span class="holiday-bunting bunting-left"></span><span class="holiday-bunting bunting-right"></span><span class="holiday-flag-stars"></span>'+sparks+items(12,'scene-star')
 };
 window.CFIThemeScene={
  ids:Object.keys(scenes),
  markup(theme){
   const selected=Object.prototype.hasOwnProperty.call(scenes,theme)?theme:'classic';
   return '<span class="season-scene" aria-hidden="true">'+scenes[selected]+'</span>';
  }
 };
})();
