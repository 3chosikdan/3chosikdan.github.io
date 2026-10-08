// 3초식단 Service Worker — 오프라인 + 데이터 보존(iOS 설치 PWA)
const CACHE = 'sikdan-v83';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // 하나가 실패해도 설치는 성공시킨다 (fooddb.js 미업로드 대비)
      Promise.all(['./', './fooddb.js', './privacy.html', './food.html', './calc.html', './micro.html', './hypert.html', './shop.html', './affiliate.js', './cloud.js', './manifest.json', './favicon.ico', './icon-192.png'].map(u => c.add(u).catch(() => {})))
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
  // 다른 도메인(구글 로그인·Firestore·통계)은 건드리지 않는다 — 스트리밍 응답을 캐시하면 동기화가 깨짐
  if (new URL(e.request.url).origin !== self.location.origin) return;

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

  // 나머지는 네트워크가 0.8초 안에 오면 최신본, 느리면 캐시로 먼저 연다.
  e.respondWith(raceCache(e.request, 800));
});

function raceCache(req, ms){
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then(hit => {
        if(!done && hit){ done = true; resolve(hit); }
      });
    }, ms);
    // 브라우저 HTTP 캐시(깃허브 10분)를 건너뛰고 서버에 새 버전 확인 — 배포가 바로 보이게
    fetch(req, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      if(!done){ done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true }).then(hit => {
        if(!done){ done = true; resolve(hit || new Response('', { status: 504 })); }
      });
    });
  });
}
