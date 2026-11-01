(function(){'use strict';
const cfg=window.WARMAP_CONFIG;
const geo=window.WARMAP_BASEMAP_GEO;
let active=null;
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
// Leaflet binds tile load/error handlers with addEventListener, so removing a layer cannot stop
// callbacks that are already queued: they then run against a layer whose _map is null and throw
// (_tileReady reading _fadeAnimated, _resetView reading getCenter). A detached layer has nothing
// left to do, so make those internals no-ops once _map is gone.
function guardLeaflet(L){
 const protos=[L.GridLayer&&L.GridLayer.prototype,L.TileLayer&&L.TileLayer.prototype].filter(Boolean);
 let patched=0;
 for(const proto of protos){
  if(proto.__dshGuarded)continue;
  for(const name of ['_tileReady','_resetView','_setView','_resetGrid','_update','_updateLevels','_pruneTiles','_animateZoom']){
   const orig=proto[name];
   if(typeof orig!=='function')continue;
   proto[name]=function(){if(!this._map)return;return orig.apply(this,arguments);};
   patched++;
  }
  proto.__dshGuarded=true;
 }
 return patched;
}
function attach(L,map,war){
 guardLeaflet(L);
 const s={L,map,war,phase:null,selected:null,layer:null,mode:'loading',loaded:0,errors:0,timer:null,stopped:false,context:war};
 active=s;
 const container=map.getContainer();container.classList.add('wm-map');
 const status=make('div','wm-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');container.append(status);
 const unavailable=make('div','wm-unavailable');unavailable.hidden=true;
 unavailable.innerHTML='<div class="wm-unavailable-card"><span class="wm-kicker">地图底板当前不可用</span><h2>离线继续查看战役资料</h2><p>离线底图数据未能载入。本区域不展示伪地图，也暂时隐藏无底板的参考点。战争分区、阶段、战役列表与详情仍可使用。</p><button type="button" class="wm-retry">重试在线底图</button></div>';
 container.append(unavailable);unavailable.querySelector('button').onclick=()=>load(s);
 const info=make('div','wm-map-note','现代地理参照 · 原型参考点未经历史定位核验');container.append(info);
 const metrics=make('div','wm-map-metrics');container.append(metrics);
 s.status=status;s.unavailable=unavailable;s.metrics=metrics;s.info=info;
 L.control.scale({position:'bottomleft',metric:true,imperial:false,maxWidth:100}).addTo(map);
 function update(){if(s.stopped||!map._loaded)return;const c=map.getCenter();container.dataset.centerLat=c.lat.toFixed(5);container.dataset.centerLng=c.lng.toFixed(5);container.dataset.zoom=String(Math.round(map.getZoom()*100)/100);let markers=0;map.eachLayer(l=>{if(l instanceof L.Marker)markers++;});container.dataset.markerCount=String(markers);metrics.textContent=(s.mode==='offline-basemap'?'离线底图 · 原型参考点 '+markers:(s.mode==='offline'||s.mode==='failed')?'地图停用 · 资料可用':'缩放 '+(Math.round(map.getZoom()*10)/10)+' · 原型参考点 '+markers);}
 s.update=update;s.resizeObserver=new ResizeObserver(()=>requestAnimationFrame(()=>{if(!s.stopped&&map._loaded)map.invalidateSize({pan:false});}));s.resizeObserver.observe(container);map.on('moveend zoomend layeradd layerremove',update);
 const onOffline=()=>useOffline(s,'offline','网络已断开 · 已切换离线底图');
 const onOnline=()=>{if(s.mode==='offline'||s.mode==='failed'||s.mode==='offline-basemap'){status.textContent='网络连接已恢复 · 点击「重连」取回在线底图';unavailable.querySelector('button').disabled=false;}};
 window.addEventListener('offline',onOffline);window.addEventListener('online',onOnline);
 map.on('unload',()=>{s.stopped=true;s.resizeObserver.disconnect();clearTimeout(s.timer);window.removeEventListener('offline',onOffline);window.removeEventListener('online',onOnline);status.remove();unavailable.remove();info.remove();metrics.remove();if(active===s)active=null;});
 map.on('layeradd',e=>{if(!(e.layer instanceof L.Marker))return;requestAnimationFrame(()=>{const el=e.layer.getElement();if(el){el.setAttribute('aria-label','原型参考点：'+(e.layer.options.title||'战役'));el.setAttribute('role','button');}e.layer.on('click',()=>e.layer.openTooltip());update();});});
 if(navigator.onLine===false)useOffline(s,'offline','当前离线 · 使用离线底图');else load(s);
 update();document.dispatchEvent(new CustomEvent('warmap:attached',{detail:{L,map}}));return s;
}
// ---- offline basemap: Natural Earth public-domain vectors, no tile downloads ----
// Styled for the course page's dark chrome so the reference map reads as a map, not a void.
const NE_STYLE={
  land:{color:'#4a6b56',weight:.7,opacity:.85,fillColor:'#1d3227',fillOpacity:1},
  world:{color:'#54735f',weight:.8,opacity:.85},
  coast:{color:'#86ab90',weight:1.3,opacity:1},
  border:{color:'#b09a6b',weight:1.1,opacity:.9,dashArray:'5 4'},
  river:{color:'#6f9fbd',weight:1,opacity:.85},
  lake:{color:'#5b93ab',weight:.8,opacity:.9,fillColor:'#0f2630',fillOpacity:1}
};
function offlineAvailable(){return !!(geo&&geo.regional&&geo.regional.length&&geo.world&&geo.world.length);}
// Basemap data is stored as GeoJSON [lng, lat]; Leaflet wants [lat, lng].
const toLL=(pts)=>pts.map(p=>[p[1],p[0]]);
function buildOffline(s){
 const L=s.L;
 const land=L.layerGroup();
 for(const ring of geo.land||[])land.addLayer(L.polygon(toLL(ring),Object.assign({interactive:false},NE_STYLE.land)));
 for(const line of geo.world)land.addLayer(L.polyline(toLL(line),Object.assign({interactive:false},NE_STYLE.world)));
 for(const seg of geo.regional){const st=NE_STYLE[seg.k]||NE_STYLE.coast;
  if(seg.k==='lake')land.addLayer(L.polygon(toLL(seg.c),Object.assign({interactive:false},NE_STYLE.lake)));
  else land.addLayer(L.polyline(toLL(seg.c),Object.assign({interactive:false},st)));
 }
 const major=L.layerGroup(),minor=L.layerGroup();
 for(const c of geo.cities||[]){
  (c.r<=2?major:minor).addLayer(L.circleMarker([c.y,c.x],{radius:c.r<=1?3.6:2.6,color:'#e9dfc6',weight:1.1,fillColor:'#cfc4a4',fillOpacity:1,interactive:true}).bindTooltip(c.n,{permanent:c.r<=1,direction:'right',className:'wm-offline-label',offset:[4,0]}));
 }
 s.offlineLand=land;s.offlineMajor=major;s.offlineMinor=minor;
 const group=L.layerGroup([land,major]);
 group.__parts={land,major,minor};
 return group;
}
function offlineZoom(s){
 if(!s.offline||s.mode!=='offline-basemap')return;
 const z=s.map.getZoom();const parts=s.offline.__parts;
 if(z>=5){if(!s.map.hasLayer(parts.minor))parts.minor.addTo(s.map);}
 else if(s.map.hasLayer(parts.minor))s.map.removeLayer(parts.minor);
}
// Detach a tile layer without leaving in-flight tile callbacks pointing at a dead layer:
// Leaflet's tile load/error handlers touch this._map, which is null after removal.
function dropLayer(s){
 const old=s.layer;if(!old)return null;
 s.layer=null;
 // Leaflet's _abortLoading only touches tiles at OTHER zoom levels, so current-zoom tiles
 // keep live onload/onerror handlers that then call into a layer whose _map is already null.
 try{const tiles=old._tiles||{};for(const k in tiles){const el=tiles[k]&&tiles[k].el;if(el){el.onload=null;el.onerror=null;}}}catch(e){}
 try{if(old._abortLoading)old._abortLoading();}catch(e){}
 old.off();
 try{if(s.map.hasLayer(old))s.map.removeLayer(old);}catch(e){}
 return old;
}
function useOffline(s,why,text){
 if(!s||s.stopped)return;
 clearTimeout(s.timer);
 dropLayer(s);
 if(!offlineAvailable()){disable(s,why==='offline'?'offline':'failed',text||'离线底图不可用');return;}
 if(!s.offline)s.offline=buildOffline(s);
 if(!s.map.hasLayer(s.offline))s.offline.addTo(s.map);
 s.mode='offline-basemap';
 const c=s.map.getContainer();
 c.dataset.mapState='offline-basemap';c.dataset.markersVisible='true';c.dataset.basemap='natural-earth';
 c.classList.remove('wm-map-unavailable');
 s.unavailable.hidden=true;
 s.status.textContent=text||'离线底图 · Natural Earth 公共领域数据';
 s.info.textContent='离线底图 Natural Earth 1:50m · 仅作现代地理参照 · 非历史疆界';
 interaction(s,true);offlineZoom(s);s.update();
}
function setContext(map,war,phase,selected){if(!active||active.map!==map)return;active.war=war;active.phase=phase;active.selected=selected;const el=map.getContainer();el.dataset.war=war.id;el.dataset.phase=phase||'';el.dataset.selected=selected||'';document.dispatchEvent(new CustomEvent('warmap:context',{detail:{warId:war.id,selected}}));active.update();}
function interaction(s,enabled){for(const k of ['dragging','scrollWheelZoom','doubleClickZoom','touchZoom','boxZoom','keyboard'])if(s.map[k])s.map[k][enabled?'enable':'disable']();}
function disable(s,mode,text){if(!s||s.stopped)return;clearTimeout(s.timer);dropLayer(s);if(s.offline&&s.map.hasLayer(s.offline))s.map.removeLayer(s.offline);s.mode=mode;s.map.getContainer().dataset.markersVisible='false';s.map.getContainer().dataset.mapState=mode;s.map.getContainer().classList.add('wm-map-unavailable');s.status.textContent=text;s.unavailable.hidden=false;interaction(s,false);s.update();}
function load(s){if(!s||s.stopped)return;if(navigator.onLine===false){useOffline(s,'offline','当前离线 · 使用离线底图');return;}clearTimeout(s.timer);if(s.offline&&s.map.hasLayer(s.offline))s.map.removeLayer(s.offline);dropLayer(s);s.mode='loading';s.map.getContainer().dataset.markersVisible='true';s.map.getContainer().dataset.tilesFailed='0';s.map.getContainer().dataset.tilesLoaded='0';s.loaded=0;s.errors=0;s.map.getContainer().dataset.mapState='loading';s.map.getContainer().classList.remove('wm-map-unavailable');s.unavailable.hidden=true;s.status.textContent='正在加载真实地图底板…';s.info.textContent='现代地理参照 · 原型参考点未经历史定位核验';interaction(s,true);
 const layer=s.L.tileLayer(cfg.tileUrl,{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',minZoom:3,maxZoom:cfg.maxZoom,detectRetina:false,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,crossOrigin:false});s.layer=layer;
 const deadline=()=>{clearTimeout(s.timer);s.timer=setTimeout(()=>{if(s.layer!==layer)return;if(s.loaded===0)useOffline(s,'failed','底图响应超时 · 已切换离线底图');else{s.mode='partial';s.map.getContainer().dataset.mapState='partial';s.status.textContent='部分底图响应超时 · 可在设置中重试';}},cfg.loadTimeout);};
 layer.on('loading',()=>{s.loaded=0;s.errors=0;s.mode='loading';s.map.getContainer().dataset.mapState='loading';s.map.getContainer().dataset.tilesLoaded='0';s.map.getContainer().dataset.tilesFailed='0';s.status.textContent='正在加载当前视野…';deadline();});
 layer.on('tileload',()=>{if(s.layer!==layer)return;s.loaded++;s.map.getContainer().dataset.tilesLoaded=String(s.loaded);});
 layer.on('tileerror',()=>{if(s.layer!==layer)return;s.errors++;s.map.getContainer().dataset.tilesFailed=String(s.errors);});
 layer.on('load',()=>{if(s.layer!==layer)return;clearTimeout(s.timer);if(s.loaded===0&&s.errors>0){useOffline(s,'failed','在线底图加载失败 · 已切换离线底图');return;}if(s.errors>0){s.mode='partial';s.map.getContainer().dataset.mapState='partial';s.status.textContent='部分底图未加载 · 可在设置中重试';}else if(s.loaded>0){s.mode='ready';s.map.getContainer().dataset.mapState='ready';s.status.textContent='真实底图已加载 · OpenStreetMap';}});
 layer.addTo(s.map);if(!s.timer)deadline();
}
window.WARMAP_BASEMAP={attach,setContext,retry:()=>load(active),offline:()=>useOffline(active,'offline','离线底图 · 手动切换'),offlineAvailable,home:()=>{if(active&&active.war&&active.map._loaded)active.map.flyTo(active.war.center,active.war.zoom,{duration:.7});},resize:()=>{if(active&&active.map._loaded)active.map.invalidateSize({pan:false});},uiContext:()=>active?{L:active.L,map:active.map}:null,state:()=>active?.mode};
document.addEventListener('warmap:attached',e=>{const s=active;if(s&&s.map)e.detail.map.on('zoomend',()=>offlineZoom(s));});
})();
