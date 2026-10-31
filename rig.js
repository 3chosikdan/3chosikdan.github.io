/* 3초식단 동작 리그 — 옆에서 본 관절 키프레임 하나로 2D(SVG)와 3D(three.js)를 같이 그린다.
   좌표: x = 앞(+), y = 위(+), 단위 cm. 각도는 +x 기준 반시계(도).
   키프레임 A(시작) ↔ B(끝)를 왕복. bad = 흔한 실수 버전에서 덮어쓸 값. */
(function(){
'use strict';
const L = { tor:50, ua:29, fa:27, th:43, sh:43, ft:20, neck:19 };
const rad = d=>d*Math.PI/180;
const dir = d=>[Math.cos(rad(d)), Math.sin(rad(d))];
const add = (a,b,k)=>[a[0]+b[0]*(k==null?1:k), a[1]+b[1]*(k==null?1:k)];
const dist = (a,b)=>Math.hypot(a[0]-b[0], a[1]-b[1]);
function ik(root, target, l1, l2, bend){
  let d = dist(root,target); const maxd = l1+l2-0.01, mind = Math.abs(l1-l2)+0.01;
  const base = Math.atan2(target[1]-root[1], target[0]-root[0]);
  d = Math.max(mind, Math.min(maxd, d));
  const a = Math.acos((l1*l1 + d*d - l2*l2)/(2*l1*d));
  const ang = base + (bend>=0 ? a : -a);
  return [root[0]+l1*Math.cos(ang), root[1]+l1*Math.sin(ang)];
}
const SEAT = { at:'O', c:[2,-6], len:42, th:8, ang:0 };
const backPad = (d,side,len)=>({ at:'P', along:'tor', d:d||28, side:side==null?11:side, len:len||56, th:7 });
// 동작별 리그
const RIGS = {
  chest_press: {
    A:{ P:[0,0], tor:100, H:[4,45], th:5, sh:-92 }, B:{ H:[54,47] },
    bad:{ B:{ tor:80, H:[60,44] } }, eb:-1, hold:'H',
    props:[ SEAT, backPad(), { lever:[-12,96] } ], cam:[1,0.25]
  },
  incline_press: {
    A:{ P:[0,0], tor:122, H:[-14,52], th:12, sh:-80 }, B:{ H:[16,92] },
    bad:{ B:{ P:[3,8], tor:112 } }, eb:-1, hold:'H',
    props:[ SEAT, backPad(26,11,62), { lever:[-62,8] } ], cam:[1,0.3]
  },
  lat_pulldown: {
    A:{ P:[0,0], tor:98, H:[-4,106], th:4, sh:-96 }, B:{ H:[-6,47] },
    bad:{ B:{ tor:128, H:[-14,50] } }, eb:1, hold:'H',
    props:[ SEAT, { at:'O', c:[33,15], len:16, th:6, ang:0 }, { cable:[-4,150] } ], cam:[0.9,0.2], bar:true
  },
  seated_row: {
    A:{ P:[0,0], tor:92, H:[57,42], th:4, sh:-96 }, B:{ H:[1,40] },
    bad:{ A:{ tor:74 }, B:{ tor:116, H:[-18,38] } }, epick:'back', eb:-1, hold:'H',
    props:[ SEAT, { at:'O', c:[15,38], len:30, th:6, ang:90 }, { lever:[62,92] } ], cam:[1,0.2]
  },
  high_row: {
    A:{ P:[0,0], tor:92, H:[44,88], th:4, sh:-96 }, B:{ H:[-8,57] },
    bad:{ B:{ tor:114, H:[-16,58] } }, epick:'back', eb:-1, hold:'H',
    props:[ SEAT, { at:'O', c:[15,38], len:30, th:6, ang:90 }, { lever:[18,128] } ], cam:[1,0.25]
  },
  shoulder_press: {
    A:{ P:[0,0], tor:95, H:[2,56], th:5, sh:-92 }, B:{ H:[-2,106] },
    bad:{ B:{ tor:114, P:[4,0], H:[8,104] } }, eb:-1, hold:'H',
    props:[ SEAT, backPad(30,11,60), { lever:[-40,112] } ], cam:[1,0.25]
  },
  leg_press: {
    A:{ P:[0,0], tor:132, F:[34,26], H:[8,-4] }, B:{ F:[68,48] },
    bad:{ A:{ F:[25,19], P:[3,6], tor:142 } }, kpick:'y', legIK:true, hold:'H',
    props:[ { at:'O', c:[-2,-6], len:34, th:8, ang:0 }, backPad(26,11,60), { plate:true } ], cam:[1,0.3]
  },
  hack_squat: {
    A:{ P:[0,0], tor:104, F:[11,-84], H:'S+8,-6' }, B:{ P:[11,-42], F:[11,-84] },
    bad:{ B:{ P:[18,-40], tor:82 } }, kpick:'x', legIK:true, hold:'H',
    props:[ { at:'P', along:104, d:24, side:11, len:60, th:7, rail:true }, { at:'O', c:[16,-90], len:42, th:5, ang:18 } ], cam:[1,0.3]
  },
  leg_ext: {
    A:{ P:[0,0], tor:95, th:2, sh:-96, H:[10,-7] }, B:{ sh:4 },
    bad:{ B:{ P:[0,6], tor:112 } }, eb:-1, hold:'H',
    props:[ SEAT, backPad(26,11,52), { roller:'A', side:1 } ], cam:[1,0.25]
  },
  leg_curl_lying: {
    A:{ P:[0,0], tor:180, th:-4, sh:-2, ft:-90, H:[-62,-14] }, B:{ sh:106 },
    bad:{ B:{ P:[2,9], th:-24 } }, eb:1, hold:'H',
    props:[ { at:'O', c:[-22,-10], len:104, th:6, ang:0 }, { roller:'A', side:1 } ], cam:[0.6,0.6]
  }
};
const SEG_MUSCLE = { tor:['chest','lats','uppertrap','erector','abs','obliques','frontdelt','sidedelt','reardelt'], ua:['biceps','triceps','frontdelt','sidedelt','reardelt'], fa:['forearm'], th:['quads','hams','glutes','adductors','glutemed'], sh:['calves'] };

function parseRel(v, J){ if(typeof v!=='string') return v; const m = v.match(/^([A-Z])\+(-?[\d.]+),(-?[\d.]+)$/); return m ? [J[m[1]][0]+ +m[2], J[m[1]][1]+ +m[3]] : [0,0]; }
function lerp(a,b,t){ if(Array.isArray(a)) return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; if(typeof a==='number') return a+(b-a)*t; return t<0.5?a:b; }
function keyframes(id, bad){
  const R = RIGS[id]; const A = Object.assign({}, R.A); const B = Object.assign({}, R.A, R.B);
  if(bad && R.bad){ Object.assign(A, R.bad.A||{}); Object.assign(B, R.bad.B||{}); }
  return [A,B];
}
function pose(id, t, bad){
  const R = RIGS[id]; const [A,B] = keyframes(id, bad);
  const k = {}; Object.keys(B).forEach(n=>{ k[n] = (A[n]!==undefined && typeof A[n]!=='string') ? lerp(A[n], B[n], t) : B[n]; });
  const J = {}; J.P = k.P; J.S = add(J.P, dir(k.tor), L.tor); J.Hd = add(J.S, dir(k.tor), L.neck);
  if(R.legIK){ J.A = k.F; const k1 = ik(J.P, J.A, L.th, L.sh, 1), k2 = ik(J.P, J.A, L.th, L.sh, -1); const ax = R.kpick==='x' ? 0 : 1; J.K = k1[ax] >= k2[ax] ? k1 : k2; }
  else { J.K = add(J.P, dir(k.th), L.th); J.A = add(J.K, dir(k.sh), L.sh); }
  const shAng = Math.atan2(J.A[1]-J.K[1], J.A[0]-J.K[0])*180/Math.PI;
  J.T = add(J.A, dir(shAng + (k.ft!=null ? k.ft : 90)), L.ft);
  const H = parseRel(k.H, J); J.W = H; { const e1 = ik(J.S, H, L.ua, L.fa, 1), e2 = ik(J.S, H, L.ua, L.fa, -1); J.E = R.epick==='back' ? (e1[0] <= e2[0] ? e1 : e2) : (e1[1] <= e2[1] ? e1 : e2); }
  J._sh = shAng; J._tor = k.tor; return J;
}
function propsAt(id, J){
  const R = RIGS[id]; const out = [];
  R.props.forEach(p=>{
    if(p.lever){ out.push({ kind:'line', a:p.lever, b:J.W, w:3 }); return; }
    if(p.cable){ out.push({ kind:'line', a:p.cable, b:J.W, w:1.5, thin:true }); out.push({ kind:'dot', c:p.cable, r:4 }); return; }
    if(p.plate){ const ang = Math.atan2(J.A[1]-J.P[1], J.A[0]-J.P[0])*180/Math.PI; out.push({ kind:'rect', c:add(J.A, dir(ang), 3), len:44, th:5, ang:ang+90 }); return; }
    if(p.roller){ const base = J[p.roller]; const c = add(base, dir(J._sh + 90*p.side), 8); out.push({ kind:'dot', c, r:6, pad:true }); out.push({ kind:'line', a:J.K, b:c, w:2.5 }); return; }
    if(p.at==='O'){ out.push({ kind:'rect', c:p.c, len:p.len, th:p.th, ang:p.ang }); return; }
    const ang = typeof p.along==='number' ? p.along : J._tor;
    const base = J[p.at]; const c = add(add(base, dir(ang), p.d), dir(ang+90), p.side);
    out.push({ kind:'rect', c, len:p.len, th:p.th, ang });
  });
  return out;
}
const ease = t=>0.5-0.5*Math.cos(Math.PI*t);
function phase(ms){ // 0.4s 멈춤, 1.2s 수축, 0.4s 멈춤, 1.8s 이완
  const T = 3800, x = ms % T;
  if(x<400) return 0; if(x<1600) return ease((x-400)/1200); if(x<2000) return 1; return 1-ease((x-2000)/1800);
}
function segColor(seg, mov, base){
  if(!mov || !SEG_MUSCLE[seg]) return base;
  if((mov.p||[]).some(m=>SEG_MUSCLE[seg].indexOf(m)>=0)) return '#30d158';
  if((mov.s||[]).some(m=>SEG_MUSCLE[seg].indexOf(m)>=0)) return '#a8e6b8';
  return base;
}
function bounds(id){
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  [false,true].forEach(bad=>{ for(let i=0;i<=10;i++){ const J = pose(id,i/10,bad);
    const pts = [J.P,J.S,J.Hd,J.E,J.W,J.K,J.A,J.T];
    propsAt(id,J).forEach(p=>{ if(p.a) pts.push(p.a); if(p.b) pts.push(p.b); if(p.c){ pts.push(add(p.c,dir(p.ang||0),(p.len||0)/2)); pts.push(add(p.c,dir(p.ang||0),-(p.len||0)/2)); } });
    pts.forEach(q=>{ mnx=Math.min(mnx,q[0]); mny=Math.min(mny,q[1]); mxx=Math.max(mxx,q[0]); mxy=Math.max(mxy,q[1]); });
  }});
  const pad = 14; return [mnx-pad, mny-pad, mxx-mnx+pad*2, mxy-mny+pad*2];
}

/* ---------- 2D ---------- */
function rig2D(el, id, opts){
  opts = opts||{}; const mov = opts.move; const dark = !!opts.dark;
  const NS = 'http://www.w3.org/2000/svg';
  const [bx,by,bw,bh] = bounds(id);
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox', `${bx} ${-(by+bh)} ${bw} ${bh}`); svg.setAttribute('class','rig2d');
  svg.setAttribute('role','img'); svg.setAttribute('aria-label', (opts.bad?'흔한 실수':'바른 동작')+' 애니메이션');
  el.innerHTML=''; el.appendChild(svg);
  const mk = (tag, a)=>{ const n=document.createElementNS(NS,tag); Object.keys(a||{}).forEach(k=>n.setAttribute(k,a[k])); svg.appendChild(n); return n; };
  const propCol = dark ? '#48484a' : '#d1d1d6', bodyCol = dark ? '#8e8e93' : '#3a3a3c';
  const propLayer = []; const F = p=>[p[0], -p[1]];
  const segs = { tor:mk('line',{'stroke-linecap':'round','stroke-width':17}), ua:mk('line',{'stroke-linecap':'round','stroke-width':8}), fa:mk('line',{'stroke-linecap':'round','stroke-width':7}),
    th:mk('line',{'stroke-linecap':'round','stroke-width':13}), sh:mk('line',{'stroke-linecap':'round','stroke-width':9}), ft:mk('line',{'stroke-linecap':'round','stroke-width':6}) };
  const head = mk('circle',{r:9.5}); const neck = mk('line',{'stroke-linecap':'round','stroke-width':7});
  Object.keys(segs).forEach(s=>segs[s].setAttribute('stroke', segColor(s==='ft'?'sh':s, mov, bodyCol)));
  neck.setAttribute('stroke', bodyCol); head.setAttribute('fill', bodyCol);
  const P0 = propsAt(id, pose(id,0,opts.bad));
  P0.forEach(()=>{ const n = document.createElementNS(NS,'g'); svg.insertBefore(n, svg.firstChild); propLayer.push(n); });
  const setL = (n,a,b)=>{ const A=F(a),B=F(b); n.setAttribute('x1',A[0]); n.setAttribute('y1',A[1]); n.setAttribute('x2',B[0]); n.setAttribute('y2',B[1]); };
  let raf = 0, t0 = performance.now();
  function frame(now){
    const J = pose(id, opts.fixedT!=null ? opts.fixedT : phase(now - t0), opts.bad);
    setL(segs.tor, J.P, add(J.S, dir(J._tor), 3)); setL(neck, J.S, add(J.S, dir(J._tor), 10)); const h=F(J.Hd); head.setAttribute('cx',h[0]); head.setAttribute('cy',h[1]);
    setL(segs.ua, J.S, J.E); setL(segs.fa, J.E, J.W); setL(segs.th, J.P, J.K); setL(segs.sh, J.K, J.A); setL(segs.ft, J.A, J.T);
    propsAt(id, J).forEach((p,i)=>{
      const g = propLayer[i]; if(!g) return;
      if(p.kind==='rect'){ const d=dir(p.ang), n=dir(p.ang+90); const c=p.c, hl=p.len/2, ht=p.th/2;
        const pts=[add(add(c,d,hl),n,ht),add(add(c,d,-hl),n,ht),add(add(c,d,-hl),n,-ht),add(add(c,d,hl),n,-ht)].map(F).map(q=>q.join(',')).join(' ');
        g.innerHTML = `<polygon points="${pts}" fill="${propCol}" rx="2"/>`; }
      else if(p.kind==='line'){ const A=F(p.a),B=F(p.b); g.innerHTML=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${propCol}" stroke-width="${p.w}" stroke-linecap="round"${p.thin?' stroke-dasharray="3 3"':''}/>`; }
      else if(p.kind==='dot'){ const C=F(p.c); g.innerHTML=`<circle cx="${C[0]}" cy="${C[1]}" r="${p.r}" fill="${propCol}"/>`; }
    });
    const hc=F(J.W); if(!svg._hand){ svg._hand = mk('circle',{r:3.6}); } svg._hand.setAttribute('cx',hc[0]); svg._hand.setAttribute('cy',hc[1]); svg._hand.setAttribute('fill', dark?'#f2f2f7':'#111');
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop(){ cancelAnimationFrame(raf); } };
}

/* ---------- 3D ---------- */
function rig3D(el, id, opts){
  opts = opts||{}; const THREE = window.THREE; if(!THREE) return null;
  const mov = opts.move; const dark = !!opts.dark;
  const w = el.clientWidth || 320, h = el.clientHeight || Math.round(w*0.8);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1)); renderer.setSize(w,h);
  el.innerHTML=''; el.appendChild(renderer.domElement); renderer.domElement.style.touchAction='none';
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, w/h, 1, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, dark?0x222222:0x999999, 0.95));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(80,160,120); scene.add(dl);
  const [bx,by,bw,bh] = bounds(id); const cx = bx+bw/2, cy = by+bh/2;
  const root = new THREE.Group(); root.position.set(-cx, -cy, 0); scene.add(root);
  const hex = s=>parseInt(s.slice(1),16);
  const bodyMat = s=>new THREE.MeshStandardMaterial({ color: hex(segColor(s, mov, dark?'#8e8e93':'#aeaeb2')), roughness:0.7 });
  const propMat = new THREE.MeshStandardMaterial({ color: dark?0x3a3a3c:0x2c2c2e, roughness:0.55, metalness:0.2 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness:0.9 });
  const up = new THREE.Vector3(0,1,0);
  function limb(r, mat){ const g = new THREE.Group(); const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,14), mat); const s1 = new THREE.Mesh(new THREE.SphereGeometry(r,14,10), mat); const s2 = s1.clone(); g.add(cyl,s1,s2); g.userData={cyl,s1,s2}; root.add(g); return g; }
  function place(g, a, b, z){ const A = new THREE.Vector3(a[0],a[1],z), B = new THREE.Vector3(b[0],b[1],z); const d = B.clone().sub(A); const len = Math.max(0.01, d.length());
    const u=g.userData; u.cyl.scale.set(1,len,1); u.cyl.position.copy(A.clone().add(B).multiplyScalar(0.5)); u.cyl.quaternion.setFromUnitVectors(up, d.normalize()); u.s1.position.copy(A); u.s2.position.copy(B); }
  const SW = 19, HW = 10;
  const parts = { torso: new THREE.Mesh(new THREE.BoxGeometry(1,1,34), bodyMat('tor')), head: new THREE.Mesh(new THREE.SphereGeometry(10,18,14), bodyMat('none')) };
  root.add(parts.torso, parts.head);
  const limbs = {}; [['ua',4.6],['fa',4],['th',7],['sh',5],['ft',3.2]].forEach(([s,r])=>{ limbs[s]=[limb(r,bodyMat(s==='ft'?'sh':s)), limb(r,bodyMat(s==='ft'?'sh':s))]; });
  const propMeshes = [];
  function setProps(J){
    const P = propsAt(id, J);
    while(propMeshes.length < P.length){ const m = new THREE.Group(); root.add(m); propMeshes.push(m); }
    P.forEach((p,i)=>{
      const g = propMeshes[i]; while(g.children.length) g.remove(g.children[0]);
      if(p.kind==='rect'){ const m = new THREE.Mesh(new THREE.BoxGeometry(p.len,p.th,44), padMat); m.position.set(p.c[0],p.c[1],0); m.rotation.z = rad(p.ang); g.add(m); }
      else if(p.kind==='line'){ [-SW,SW].forEach(z=>{ const l = limb(p.w*0.9, propMat); root.remove(l); g.add(l); place(l, p.a, p.b, z); }); }
      else if(p.kind==='dot'){ const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r,p.r,p.pad?40:46,16), p.pad?padMat:propMat); m.rotation.x = Math.PI/2; m.position.set(p.c[0],p.c[1],0); g.add(m); }
    });
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,RIGS[id].bar?90:2*SW+10,12), propMat); handle.rotation.x = Math.PI/2; root.add(handle);
  let az = id==='leg_curl_lying' ? 0.75 : 0.55, el2 = id==='leg_curl_lying' ? 0.55 : 0.28, dragging=false, lx=0, ly=0;
  const R = Math.max(bw,bh)*1.55;
  function setCam(){ cam.position.set(R*Math.sin(az)*Math.cos(el2), R*Math.sin(el2), R*Math.cos(az)*Math.cos(el2)); cam.lookAt(0,0,0); }
  setCam();
  const cvs = renderer.domElement;
  cvs.addEventListener('pointerdown', e=>{ dragging=true; lx=e.clientX; ly=e.clientY; cvs.setPointerCapture(e.pointerId); });
  cvs.addEventListener('pointermove', e=>{ if(!dragging) return; az -= (e.clientX-lx)*0.01; el2 = Math.max(-0.2, Math.min(1.2, el2 + (e.clientY-ly)*0.006)); lx=e.clientX; ly=e.clientY; setCam(); });
  cvs.addEventListener('pointerup', ()=>{ dragging=false; });
  let raf=0, t0=performance.now(), auto=true;
  cvs.addEventListener('pointerdown', ()=>{ auto=false; });
  function frame(now){
    const J = pose(id, opts.fixedT!=null ? opts.fixedT : phase(now-t0), opts.bad);
    const d = [J.S[0]-J.P[0], J.S[1]-J.P[1]]; const len = Math.hypot(d[0],d[1]);
    parts.torso.scale.set(len, 18, 1); parts.torso.position.set((J.P[0]+J.S[0])/2, (J.P[1]+J.S[1])/2, 0); parts.torso.rotation.z = Math.atan2(d[1],d[0]);
    parts.head.position.set(J.Hd[0], J.Hd[1], 0);
    [-1,1].forEach((s,i)=>{ place(limbs.ua[i], J.S, J.E, s*SW); place(limbs.fa[i], J.E, J.W, s*SW); place(limbs.th[i], J.P, J.K, s*HW); place(limbs.sh[i], J.K, J.A, s*HW); place(limbs.ft[i], J.A, J.T, s*HW); });
    handle.position.set(J.W[0], J.W[1], 0);
    setProps(J);
    if(auto){ az = (id==='leg_curl_lying'?0.75:0.55) + Math.sin((now-t0)/4000)*0.5; setCam(); }
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop(){ cancelAnimationFrame(raf); renderer.dispose(); } };
}
window.RIG = { ids:Object.keys(RIGS), has:id=>!!RIGS[id], rig2D, rig3D };
})();
