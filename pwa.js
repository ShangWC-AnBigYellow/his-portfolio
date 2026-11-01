/* Registers the service worker for both the portfolio root and demo-map/ subpages.
   The worker URL is resolved against THIS script, so nested pages get root scope. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') return;

  // Resolve against this script, so a page at /demo-map/ still registers the root worker.
  var here = document.currentScript ? document.currentScript.src : location.href;
  var swUrl = new URL('sw.js', new URL('.', here)).href;

  function chip(text, tone) {
    var el = document.getElementById('offline-chip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offline-chip';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:9999;font:12px/1.6 "PingFang SC","Microsoft YaHei",system-ui,sans-serif;'
        + 'padding:7px 12px;border-radius:5px;border:1px solid #183d3155;background:#f8f5ecf2;color:#183d31;'
        + 'box-shadow:0 3px 14px #183d3122;max-width:min(340px,80vw);pointer-events:none;transition:opacity .4s';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.borderColor = tone === 'warn' ? '#a8712f88' : '#183d3155';
    el.style.color = tone === 'warn' ? '#7d4d12' : '#183d31';
    el.style.opacity = '1';
    clearTimeout(el.__t);
    el.__t = setTimeout(function () { el.style.opacity = '0'; }, 4200);
  }

  navigator.serviceWorker.register(swUrl, { scope: new URL('.', swUrl).pathname }).then(function (reg) {
    if (navigator.serviceWorker.controller) return;
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          chip('网站已更新 · 刷新后生效', 'warn');
        }
      });
    });
  }).catch(function () { /* offline-caching is a bonus, never a blocker */ });

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', function () { /* silent */ });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.ready.then(function () {
      chip('已缓存 · 断网也可浏览', 'ok');
    }).catch(function () {});
  });

  window.addEventListener('offline', function () { chip('当前离线 · 主要页面仍可浏览', 'warn'); });
})();
