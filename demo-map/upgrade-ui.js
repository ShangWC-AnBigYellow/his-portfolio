(function(){'use strict';
const base=window.WARMAP_BASEMAP;const back=document.querySelector('.wm-back');if(back)back.href=window.WARMAP_CONFIG.portfolioHref;
const installed=new WeakSet();
const dialog=document.createElement('dialog');dialog.id='wm-dialog';dialog.setAttribute('aria-label','地图说明与设置');document.body.append(dialog);
const closeDetails=document.createElement('button');closeDetails.className='wm-details-close';closeDetails.setAttribute('aria-label','关闭战役资料');closeDetails.textContent='关闭资料 ×';document.body.append(closeDetails);closeDetails.onclick=()=>document.body.classList.remove('wm-show-details');
function closeDialog(){dialog.close();}
function openDialog(mode){
 const controls=mode==='settings';
 dialog.innerHTML='<div class="wm-dialog-head"><span>'+ (controls?'地图设置':'课程项目与地图说明') +'</span><button type="button" aria-label="关闭地图说明">×</button></div>'+ (controls?'<h2>按当前网络条件查看</h2><label class="wm-switch"><input type="checkbox" id="wm-marker-switch" '+(!document.body.classList.contains('wm-hide-markers')?'checked':'')+'> 显示原型参考点</label><p>原坐标保持不变，只控制显示。参考点不是经过本次史学核验的精确战场坐标。</p><div class="wm-dialog-actions"><button id="wm-offline">使用离线底图</button><button id="wm-reconnect">重新连接在线底图</button></div><p class="wm-secondary">离线底图来自 Natural Earth 公共领域矢量数据，断网时仍可缩放、拖动并保留参考点；在线瓦片按 OpenStreetMap 使用政策不打包、不批量缓存。没有网络时会自动切换。</p>':'<span class="wm-kicker">原型与本次升级分开说明</span><h2>在真实地理上浏览原有战役</h2><p><b>Kimi原始版本：</b>战争分区、阶段时间线、战役列表、详情、兵力图和参考点联动。</p><p><b>Codex升级（v002）：</b>接入真实现代底图、加载与离线反馈、地图优先布局、触控与返回入口；修复跨阶段过期选择。</p><p><b>DSH后续修改（v003）：</b>新增 Natural Earth 公共领域离线底图，断网时保持缩放、拖动与参考点；在线瓦片仍不打包、不批量缓存。原67条记录与坐标未改。</p><p>保留67条原型战役记录和坐标，不新画行军路线。坐标、兵力及叙述仍需历史资料核验；现代道路和国界不表示当时的道路和疆界。</p>')+'<div class="wm-source-links"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">底图与署名</a><a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noopener">服务使用说明</a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth 离线底图条款</a><a href="basemap/BASEMAP_SOURCE.json" target="_blank" rel="noopener">离线底图数据清单</a></div>';
 dialog.querySelector('.wm-dialog-head button').onclick=closeDialog;
 dialog.querySelector('#wm-marker-switch')?.addEventListener('change',e=>document.body.classList.toggle('wm-hide-markers',!e.target.checked));
 dialog.querySelector('#wm-offline')?.addEventListener('click',()=>{base.offline();closeDialog();});
 dialog.querySelector('#wm-reconnect')?.addEventListener('click',()=>{base.retry();closeDialog();});
 dialog.showModal();dialog.querySelector('.wm-dialog-head button').focus();
}
function fullMap(){const on=document.body.classList.toggle('wm-immersive');document.querySelectorAll('[data-wm-fullscreen]').forEach(b=>{b.textContent=on?'退出':'全屏';b.setAttribute('aria-label',on?'退出地图全屏':'地图全屏');b.title=on?'退出地图全屏':'地图全屏';});base.resize();}
function toggleDetails(){if(innerWidth<=850||document.body.classList.contains('wm-immersive'))document.body.classList.toggle('wm-show-details');else document.body.classList.toggle('wm-hide-details');base.resize();}
function install({L,map}){
 if(installed.has(map))return;installed.add(map);
 const c=L.control({position:'topright'});c.onAdd=function(){const group=L.DomUtil.create('div','wm-map-tools');group.setAttribute('aria-label','地图操作');
 for(const [label,title,action] of [['战区','回到当前战区',()=>base.home()],['全屏','地图全屏',fullMap],['资料','显示或隐藏战役资料',toggleDetails]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);if(label==='全屏')b.dataset.wmFullscreen='true';b.onclick=action;group.append(b);}L.DomEvent.disableClickPropagation(group);L.DomEvent.disableScrollPropagation(group);return group;};c.addTo(map);
}
document.addEventListener('warmap:attached',e=>install(e.detail));
const ready=base.uiContext();if(ready)install(ready);
document.addEventListener('warmap:context',e=>{const warIds=['anti_japanese','civil_war','korean_war'];document.querySelectorAll('[code-path="src/sections/Header.tsx:48:11"]').forEach((b,i)=>b.setAttribute('aria-pressed',warIds[i]===e.detail.warId));if(e.detail.selected&&innerWidth<=850)document.body.classList.add('wm-show-details');});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.matches('[code-path="src/sections/Header.tsx:99:9"]'))fullMap();if(b.matches('[code-path="src/sections/Header.tsx:112:9"]'))openDialog('settings');if(b.matches('[code-path="src/sections/Header.tsx:125:9"]'))openDialog('help');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.body.classList.contains('wm-immersive'))fullMap();document.body.classList.remove('wm-show-details');}});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();});
})();
