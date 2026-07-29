// 3초식단 Service Worker — 오프라인 + 데이터 보존(iOS 설치 PWA)
const CACHE = 'sikdan-v7';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // 하나가 실패해도 설치는 성공시킨다 (fooddb.js 미업로드 대비)
      Promise.all(['./', './fooddb.js'].map(u => c.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // 음식 DB(2.5MB)는 캐시 우선 — 앱 열 때마다 다시 받지 않게.
  // 백그라운드로만 갱신해서 다음 실행에 반영한다.
  if (e.request.url.indexOf('fooddb.js') >= 0) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(hit => {
        const net = fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // 나머지는 네트워크 우선(항상 최신 버전) → 실패 시 캐시(오프라인)
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
