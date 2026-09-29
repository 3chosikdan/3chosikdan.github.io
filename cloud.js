/* ============ 구글 로그인 · 서버 보관 (선택) ============
   - 로그인 안 하면 아무것도 안 함. 지금처럼 폰에만 저장.
   - 로그인하면 기록을 Firestore users/{uid}/d/{docId} 에 조각내 보관.
     docId: g|people · g|done · {pid}|S · {pid}|m|날짜(식단) · {pid}|w|날짜(운동) · {pid}|k|키
     날짜 단위로 쪼개서 사진이 붙어도 1MB 문서 한도에 안 걸리고, 바뀐 날만 올라감.
   - 지운 건 v:null 로 남겨서(tombstone) 다른 기기도 지운 걸 알게 함.
   - 두 기기에서 같은 날을 동시에 고치면 합친다(식단·운동은 합집합).
*/
(function(){
'use strict';
const CFG = {
  apiKey: "AIzaSyD17qEFamnJnI6QareudsE6_Cy7hoQ7THg",
  authDomain: "chosikdan.firebaseapp.com",
  projectId: "chosikdan",
  storageBucket: "chosikdan.firebasestorage.app",
  messagingSenderId: "225285373999",
  appId: "1:225285373999:web:3c06f1188ec7c98f2006da"
};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const K_UID = '3cho:cloud:uid', K_EMAIL = '3cho:cloud:email', K_HASH = '3cho:cloud:hash',
      K_PULL = '3cho:cloud:pullT', K_REDIR = '3cho:cloud:redirect', K_LAST = '3cho:cloud:lastPush';

let fb = null, uid = null, ready = false, busy = false, again = false, timer = null, applying = false;

function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(_){} }
function getH(){ try{ return JSON.parse(lsGet(K_HASH)||'{}')||{}; }catch(_){ return {}; } }
function setH(h){ lsSet(K_HASH, JSON.stringify(h)); }
function hash(s){ // cyrb53
  if(s==null) return null;
  let h1=0xdeadbeef, h2=0x41c6ce57;
  for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)+':'+s.length;
}
function say(m){ try{ toast(m); }catch(_){} }

async function loadFb(){
  if(fb) return fb;
  const [appM, authM, fsM] = await Promise.all([
    import(SDK+'firebase-app.js'), import(SDK+'firebase-auth.js'), import(SDK+'firebase-firestore.js')
  ]);
  const app = appM.initializeApp(CFG);
  const auth = authM.getAuth(app);
  try{ await authM.setPersistence(auth, authM.browserLocalPersistence); }catch(_){}
  const db = fsM.getFirestore(app);
  fb = { app, auth, authM, fs: fsM, db };
  return fb;
}

/* ---------- 로컬 → 문서 조각 ---------- */
function pids(){
  let list = [];
  try{ list = JSON.parse(lsGet('3cho:people')||'[]')||[]; }catch(_){}
  if(!list.length) list = [{id:'p_me', name:'나'}];
  return list.map(p=>p.id);
}
function localDocs(){
  try{ if(typeof snapshotPerson==='function') snapshotPerson(); }catch(_){}
  const out = {};
  const people = lsGet('3cho:people'); if(people!=null) out['g|people'] = people;
  const done = lsGet('3cho:workout:done'); if(done!=null) out['g|done'] = done;
  const keys = (typeof LIVE_KEYS!=='undefined') ? LIVE_KEYS : [];
  pids().forEach(pid=>{
    keys.forEach(k=>{
      const raw = lsGet(k+'::'+pid); if(raw==null) return;
      if(k==='foodspot'){
        let o; try{ o = JSON.parse(raw)||{}; }catch(_){ return; }
        const meals = o.meals||{}; const rest = Object.assign({}, o); delete rest.meals;
        out[pid+'|S'] = JSON.stringify(rest);
        Object.keys(meals).forEach(d=>{ const a = meals[d]; if(Array.isArray(a) && a.length) out[pid+'|m|'+d] = JSON.stringify(a); });
      } else if(k==='3cho:workout:log'){
        let o; try{ o = JSON.parse(raw)||{}; }catch(_){ return; }
        Object.keys(o).forEach(d=>{ if(o[d]!=null) out[pid+'|w|'+d] = JSON.stringify(o[d]); });
      } else {
        out[pid+'|k|'+k] = raw;
      }
    });
  });
  return out;
}

/* ---------- 문서 조각 → 로컬 ---------- */
function applyDocs(docs){
  const byPid = {};
  Object.keys(docs).forEach(id=>{
    const v = docs[id];
    if(id==='g|people'){ lsSet('3cho:people', v); return; }
    if(id==='g|done'){ lsSet('3cho:workout:done', v); return; }
    const pid = id.split('|')[0];
    (byPid[pid] = byPid[pid] || []).push(id);
  });
  Object.keys(byPid).forEach(pid=>{
    let S0 = null, L0 = null;
    const getS = ()=>{ if(!S0){ try{ S0 = JSON.parse(lsGet('foodspot::'+pid)||'{}')||{}; }catch(_){ S0 = {}; } } return S0; };
    const getL = ()=>{ if(!L0){ try{ L0 = JSON.parse(lsGet('3cho:workout:log::'+pid)||'{}')||{}; }catch(_){ L0 = {}; } } return L0; };
    byPid[pid].forEach(id=>{
      const v = docs[id]; const parts = id.split('|'); const kind = parts[1];
      if(kind==='k'){
      const key = id.split('|').slice(2).join('|');
      if(key==='3cho:workout:exercises' || key==='3cho:workout:routines' || key==='3cho:myfoods'){
        // 목록은 id로 합친다 — 한쪽 기기에만 있던 종목·루틴·내 음식이 사라지지 않게
        const a = JSON.parse(lv)||[], b = JSON.parse(rv)||[];
        const m = new Map();
        b.forEach(x=>{ if(x) m.set(x.id||x.name, x); });
        a.forEach(x=>{ if(!x) return; const k = x.id||x.name; const o = m.get(k);
          if(o && x.restored && !o.restored) return;           // 되살린 빈 이름은 진짜 이름을 못 덮음
          if(o && Array.isArray(o.exerciseIds) && Array.isArray(x.exerciseIds)){
            const ids = x.exerciseIds.slice(); o.exerciseIds.forEach(i=>{ if(ids.indexOf(i)<0) ids.push(i); });
            m.set(k, Object.assign({}, o, x, { exerciseIds: ids })); return;
          }
          m.set(k, x);
        });
        return JSON.stringify([...m.values()]);
      }
      if(key==='3cho:foodstats' || key==='3cho:workout:settings'){
        return JSON.stringify(Object.assign({}, JSON.parse(rv)||{}, JSON.parse(lv)||{}));
      }
    }
    if(kind==='S'){
        const s = getS(); const meals = s.meals;
        let r = {}; try{ r = v==null ? {} : (JSON.parse(v)||{}); }catch(_){}
        Object.keys(s).forEach(k=>delete s[k]); Object.assign(s, r); s.meals = meals || {};
      } else if(kind==='m'){
        const s = getS(); s.meals = s.meals || {};
        if(v==null) delete s.meals[parts[2]]; else { try{ s.meals[parts[2]] = JSON.parse(v); }catch(_){} }
      } else if(kind==='w'){
        const l = getL();
        if(v==null) delete l[parts[2]]; else { try{ l[parts[2]] = JSON.parse(v); }catch(_){} }
      } else if(kind==='k'){
        lsSet(parts.slice(2).join('|')+'::'+pid, v);
      }
    });
    if(S0) lsSet('foodspot::'+pid, JSON.stringify(S0));
    if(L0) lsSet('3cho:workout:log::'+pid, JSON.stringify(L0));
  });
  try{
    let cur = lsGet('3cho:activePerson') || 'p_me';
    const ids = pids(); if(ids.indexOf(cur)<0){ cur = ids[0]; lsSet('3cho:activePerson', cur); }
    if(typeof loadPersonStores==='function') loadPersonStores(cur);
  }catch(_){}
}

/* ---------- 충돌 합치기 (양쪽 다 바뀐 조각) ---------- */
function mergeDoc(id, lv, rv){
  if(lv==null) return rv;          // 이 기기에서 지웠는데 저쪽이 고침 → 고친 쪽
  if(rv==null) return lv;          // 저쪽이 지웠는데 이 기기가 고침 → 고친 쪽
  try{
    const kind = id.split('|')[1];
    if(id==='g|people'){
      const a = JSON.parse(lv)||[], b = JSON.parse(rv)||[];
      const m = new Map(); b.forEach(x=>m.set(x.id,x)); a.forEach(x=>m.set(x.id,x));
      return JSON.stringify([...m.values()]);
    }
    if(kind==='m'){
      const a = JSON.parse(lv)||[], b = JSON.parse(rv)||[];
      const key = x=>String(x.name)+'|'+Math.round(x.kcal||0)+'|'+(x.slot||'')+'|'+(x.time||'');
      const seen = new Set(a.map(key)); const out = a.slice();
      b.forEach(x=>{ const k = key(x); if(!seen.has(k)){ seen.add(k); out.push(x); } });
      return JSON.stringify(out);
    }
    if(kind==='w'){
      const L = JSON.parse(lv)||{}, R = JSON.parse(rv)||{};
      const byEx = new Map();
      (R.entries||[]).forEach(e=>byEx.set(e.exId||e.name, e));
      (L.entries||[]).forEach(e=>byEx.set(e.exId||e.name, e));
      return JSON.stringify(Object.assign({}, R, L, { entries:[...byEx.values()] }));
    }
    if(kind==='k'){
      const key = id.split('|').slice(2).join('|');
      if(key==='3cho:workout:exercises' || key==='3cho:workout:routines' || key==='3cho:myfoods'){
        // 목록은 id로 합친다 — 한쪽 기기에만 있던 종목·루틴·내 음식이 사라지지 않게
        const a = JSON.parse(lv)||[], b = JSON.parse(rv)||[];
        const m = new Map();
        b.forEach(x=>{ if(x) m.set(x.id||x.name, x); });
        a.forEach(x=>{ if(!x) return; const k = x.id||x.name; const o = m.get(k);
          if(o && x.restored && !o.restored) return;           // 되살린 빈 이름은 진짜 이름을 못 덮음
          if(o && Array.isArray(o.exerciseIds) && Array.isArray(x.exerciseIds)){
            const ids = x.exerciseIds.slice(); o.exerciseIds.forEach(i=>{ if(ids.indexOf(i)<0) ids.push(i); });
            m.set(k, Object.assign({}, o, x, { exerciseIds: ids })); return;
          }
          m.set(k, x);
        });
        return JSON.stringify([...m.values()]);
      }
      if(key==='3cho:foodstats' || key==='3cho:workout:settings'){
        return JSON.stringify(Object.assign({}, JSON.parse(rv)||{}, JSON.parse(lv)||{}));
      }
    }
    if(kind==='S'){
      const L = JSON.parse(lv)||{}, R = JSON.parse(rv)||{};
      const out = Object.assign({}, R, L);
      ['weights','bodyfat','condition','train','custom','sets','carbG','dayMacro'].forEach(k=>{
        if(L[k] || R[k]) out[k] = Object.assign({}, R[k]||{}, L[k]||{});
      });
      return JSON.stringify(out);
    }
  }catch(_){}
  return lv; // 나머지(루틴·종목·설정 등)는 지금 손에 든 기기 우선
}

/* ---------- 서버에서 받기 ---------- */
async function pull(){
  const { fs, db } = fb;
  const since = +(lsGet(K_PULL)||0);
  const col = fs.collection(db, 'users', uid, 'd');
  const q = since ? fs.query(col, fs.where('t', '>', fs.Timestamp.fromMillis(since - 120000))) : col;
  const snap = await fs.getDocs(q);
  const remote = {}; let maxT = since;
  snap.forEach(d=>{
    const x = d.data()||{};
    remote[d.id] = (x.v==null) ? null : String(x.v);
    const t = x.t && x.t.toMillis ? x.t.toMillis() : 0;
    if(t>maxT) maxT = t;
  });
  const cur = localDocs(); const H = getH(); const apply = {}; let n = 0;
  Object.keys(remote).forEach(id=>{
    const rv = remote[id], lv = (id in cur) ? cur[id] : null;
    const rh = hash(rv), lh = hash(lv);
    if(rh===lh){ if(rh==null) delete H[id]; else H[id] = rh; return; }
    const base = (id in H) ? H[id] : null;
    if(base===lh){                 // 이 기기는 그대로 → 서버 것 받기
      apply[id] = rv; n++;
      if(rh==null) delete H[id]; else H[id] = rh;
    } else if(base===rh){           // 서버는 그대로, 이 기기가 고침 → 나중에 올림
    } else {                        // 둘 다 고침 → 합치고 나중에 올림
      const m = mergeDoc(id, lv, rv);
      if(hash(m)!==lh){ apply[id] = m; n++; }
      if(rh==null) delete H[id]; else H[id] = rh;
    }
  });
  if(n){ applying = true; applyDocs(apply); }
  setH(H); if(maxT) lsSet(K_PULL, String(maxT)); // 서버 시각 기준만 저장 (기기 시계 오차 무시)
  return n;
}

/* ---------- 서버로 올리기 ---------- */
async function push(){
  if(!uid || !ready || applying) return;
  if(busy){ again = true; return; }
  busy = true;
  try{
    const { fs, db } = fb;
    const cur = localDocs(); const H = getH(); const ops = [];
    Object.keys(cur).forEach(id=>{ const h = hash(cur[id]); if(H[id]!==h) ops.push([id, cur[id], h]); });
    Object.keys(H).forEach(id=>{ if(!(id in cur)) ops.push([id, null, null]); });
    for(let i=0;i<ops.length;i+=300){
      const b = fs.writeBatch(db);
      ops.slice(i,i+300).forEach(([id,v])=>{
        b.set(fs.doc(db,'users',uid,'d',id), { v: v, t: fs.serverTimestamp() });
      });
      await b.commit();
      ops.slice(i,i+300).forEach(([id,,h])=>{ if(h==null) delete H[id]; else H[id] = h; });
      setH(H);
    }
    if(ops.length) lsSet(K_LAST, String(Date.now()));
    setBadge(ops.length ? 'saved' : null);
  }catch(e){
    console.warn('[3cho cloud] push', e);
    setBadge('err');
  }finally{
    busy = false;
    if(again){ again = false; schedule(1500); }
  }
}
function schedule(ms){
  if(!uid) return;
  clearTimeout(timer);
  timer = setTimeout(push, ms==null ? 1500 : ms);
}

/* ---------- 로그인 / 로그아웃 ---------- */
async function afterLogin(user, fresh){
  const prev = lsGet(K_UID);
  if(prev && prev!==user.uid){ lsSet(K_HASH, null); lsSet(K_PULL, null); } // 다른 계정 → 처음부터 맞추기
  uid = user.uid;
  lsSet(K_UID, uid); lsSet(K_EMAIL, user.email||'');
  renderCloud();
  let n = 0;
  try{ n = await pull(); }
  catch(e){ console.warn('[3cho cloud] pull', e); setBadge('err'); if(fresh) say('서버 연결이 안 됩니다. 잠시 뒤 다시 열어주세요'); return; }
  ready = true;
  await push();
  if(fresh) say(n ? '구글 계정의 기록을 불러왔습니다' : '이제 기록이 구글 계정에 저장됩니다');
  if(n){ setTimeout(()=>location.reload(), fresh ? 700 : 0); }
}

async function cloudLogin(){
  let f;
  try{ f = await loadFb(); }catch(e){ say('로그인 모듈을 못 불러왔습니다. 인터넷을 확인해주세요'); return; }
  const p = new f.authM.GoogleAuthProvider();
  p.setCustomParameters({ prompt:'select_account' });
  try{
    const r = await f.authM.signInWithPopup(f.auth, p);
    await afterLogin(r.user, true);
  }catch(e){
    const c = (e && e.code) || '';
    if(c==='auth/popup-closed-by-user' || c==='auth/cancelled-popup-request') return;
    if(c==='auth/popup-blocked' || c==='auth/operation-not-supported-in-this-environment' || c==='auth/web-storage-unsupported'){
      lsSet(K_REDIR, '1');
      try{ await f.authM.signInWithRedirect(f.auth, p); return; }catch(_){}
    }
    console.warn('[3cho cloud] login', e);
    say('로그인 실패 ('+c.replace('auth/','')+')');
  }
}
async function cloudLogout(){
  if(!confirm('로그아웃할까요?\n이 기기의 기록은 그대로 남고, 서버 저장만 멈춥니다.')) return;
  try{ await push(); }catch(_){}
  try{ const f = await loadFb(); await f.authM.signOut(f.auth); }catch(_){}
  uid = null; ready = false;
  [K_UID,K_EMAIL,K_HASH,K_PULL,K_LAST].forEach(k=>lsSet(k,null));
  renderCloud(); say('로그아웃했습니다');
}
async function cloudSyncNow(){
  if(!uid || !ready) return;
  try{
    const n = await pull();
    await push();
    if(n){ say('다른 기기 기록을 불러왔습니다'); setTimeout(()=>location.reload(), 500); }
    else say('서버와 맞춰져 있습니다');
  }catch(e){ console.warn(e); say('서버 연결이 안 됩니다'); }
}

/* ---------- 화면 ---------- */
let badge = null;
function setBadge(s){ if(s) badge = s; renderCloud(); }
function lastText(){
  const t = +(lsGet(K_LAST)||0); if(!t) return '';
  const m = Math.round((Date.now()-t)/60000);
  return m<1 ? '방금 저장' : m<60 ? m+'분 전 저장' : Math.round(m/60)<24 ? Math.round(m/60)+'시간 전 저장' : Math.round(m/1440)+'일 전 저장';
}
function renderCloud(){
  const on = !!lsGet(K_UID);
  const email = lsGet(K_EMAIL)||'';
  const b = document.getElementById('cloudBtn');
  if(b){
    b.textContent = on ? (badge==='err' ? '⚠︎ 저장' : '☁︎') : '로그인';
    b.setAttribute('aria-label', on ? '구글 계정 저장 상태' : '구글 로그인');
  }
  const box = document.getElementById('cloudBox');
  if(box){
    box.innerHTML = on
      ? `<div style="font-size:13px;line-height:1.55;margin-bottom:8px;"><b>${email.replace(/[<>&"]/g,'')}</b> 계정에 자동 저장 중입니다. 다른 폰·컴퓨터에서 같은 구글로 로그인하면 같은 기록이 보여요.${badge==='err'?'<br><span style="color:#ff3b30;">마지막 저장이 실패했습니다. 인터넷 연결 후 다시 시도합니다.</span>':''}<br><span style="color:#8e8e93;font-size:11.5px;">${lastText()}</span></div>
         <div class="frow"><button type="button" class="mini-btn" style="background:#f2f2f7;color:#111;" onclick="cloudSyncNow()">지금 맞추기</button>
         <button type="button" class="mini-btn" style="background:#f2f2f7;color:#111;" onclick="cloudLogout()">로그아웃</button></div>`
      : `<div style="font-size:13px;line-height:1.55;margin-bottom:8px;">구글로 로그인하면 지금까지 적은 식단·몸무게·운동 루틴이 계정에 저장되고, 폰을 바꾸거나 브라우저 기록이 지워져도 그대로 돌아옵니다.</div>
         <button type="button" class="mini-btn gbtn" onclick="cloudLogin()"><span class="g-ico">G</span> 구글로 로그인</button>`;
  }
  const t = document.getElementById('cloudTitle');
  if(t) t.textContent = on ? '구글 계정에 저장 중' : '구글 계정에 저장';
  try{ if(typeof renderSyncBar==='function') renderSyncBar(); }catch(_){}
}
function cloudOpen(){
  try{ openSettings(); }catch(_){}
  setTimeout(()=>{ const el = document.getElementById('cloudBox'); if(el) el.scrollIntoView({block:'center', behavior:'smooth'}); }, 250);
}

/* ---------- 앱과 연결 ---------- */
window.cloudLogin = cloudLogin;
window.cloudLogout = cloudLogout;
window.cloudSyncNow = cloudSyncNow;
window.cloudOpen = cloudOpen;
window.cloudOn = ()=>!!lsGet(K_UID);
window.cloudDirty = ()=>{ if(uid && ready && !applying) schedule(1500); };
window.cloudBlocking = ()=>applying;

document.addEventListener('visibilitychange', ()=>{
  if(!uid || !ready) return;
  if(document.visibilityState==='hidden'){ clearTimeout(timer); push(); }
  else {
    pull().then(n=>{ if(n){ say('다른 기기 기록을 불러왔습니다'); setTimeout(()=>location.reload(), 500); } else push(); })
          .catch(()=>{});
  }
});

renderCloud();
(async function boot(){
  const had = lsGet(K_UID), redir = lsGet(K_REDIR);
  if(!had && !redir) return;          // 로그인 안 한 사람은 SDK 자체를 안 받음
  try{
    const f = await loadFb();
    if(redir){
      lsSet(K_REDIR, null);
      try{ const r = await f.authM.getRedirectResult(f.auth); if(r && r.user){ await afterLogin(r.user, true); return; } }
      catch(e){ console.warn('[3cho cloud] redirect', e); }
    }
    const user = await new Promise(res=>{ const off = f.authM.onAuthStateChanged(f.auth, u=>{ off(); res(u); }); });
    if(user) await afterLogin(user, false);
    else if(had){ lsSet(K_UID, null); renderCloud(); }
  }catch(e){ console.warn('[3cho cloud] boot', e); setBadge('err'); }
})();
})();
