/* 商机管家 Service Worker
   导航请求：网络优先（避免部署后一直看到旧版），失败回退缓存；
   静态资源：缓存优先，后台更新。 */
'use strict';
const CACHE_VERSION = '__BUILD_ID__';
const CACHE_NAME = 'shangji-crm-' + CACHE_VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(ASSETS.map(function(url){
        return cache.add(url).catch(function(){ /* 单文件部署时缺失的资源忽略 */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k.indexOf('shangji-crm-') === 0 && k !== CACHE_NAME;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put('./index.html', copy); });
        }
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(hit){
          return hit || caches.match('./') || new Response(
            '<!doctype html><meta charset="utf-8"><title>离线</title><p style="font-family:sans-serif;padding:24px">当前离线，且本机还没有缓存应用页面。请联网打开一次后再使用离线模式。</p>',
            {headers:{'Content-Type':'text/html; charset=utf-8'}}
          );
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
