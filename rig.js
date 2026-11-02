/* 3초식단 동작 리그 v2 — 관절 키프레임 하나로 2D(SVG)와 3D(three.js)를 같이 그린다.
   좌표: x = 앞(+), y = 위(+), z = 오른쪽(+), 단위 cm. 각도는 +x 기준 반시계(도).
   기본은 옆에서 본 평면(x,y). 옆으로 벌리는 동작은 hz(손 너비)·ab(다리 벌림)·ty(몸통 회전)로 z를 쓴다.
   키프레임 A(시작) ↔ B(끝)를 왕복. bad = 흔한 실수 버전에서 덮어쓸 값. */
(function(){
'use strict';
const L = { tor:50, ua:29, fa:27, th:43, sh:43, ft:20, neck:19 };
const SW = 19, HW = 10;
const rad = d=>d*Math.PI/180;
const dir = d=>[Math.cos(rad(d)), Math.sin(rad(d))];
const add = (a,b,k)=>[a[0]+b[0]*(k==null?1:k), a[1]+b[1]*(k==null?1:k)];
const dist = (a,b)=>Math.hypot(a[0]-b[0], a[1]-b[1]);
const v3 = { add:(a,b,k)=>[a[0]+b[0]*(k==null?1:k), a[1]+b[1]*(k==null?1:k), a[2]+b[2]*(k==null?1:k)],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], len:a=>Math.hypot(a[0],a[1],a[2]),
  norm:a=>{ const l = Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; } };
function ik(root, target, l1, l2, bend){
  let d = dist(root,target); const maxd = l1+l2-0.01, mind = Math.abs(l1-l2)+0.01;
  const base = Math.atan2(target[1]-root[1], target[0]-root[0]);
  d = Math.max(mind, Math.min(maxd, d));
  const a = Math.acos((l1*l1 + d*d - l2*l2)/(2*l1*d));
  const ang = base + (bend>=0 ? a : -a);
  return [root[0]+l1*Math.cos(ang), root[1]+l1*Math.sin(ang)];
}
function ik3(S, W, l1, l2, pole){ // 3D 두 마디: 팔꿈치는 pole 쪽으로
  let u = v3.sub(W,S); let d = v3.len(u); u = v3.norm(u);
  d = Math.max(Math.abs(l1-l2)+0.01, Math.min(l1+l2-0.01, d));
  const a = Math.acos((l1*l1 + d*d - l2*l2)/(2*l1*d));
  let p = v3.sub(pole, v3.add([0,0,0], u, v3.dot(pole,u)));
  if(v3.len(p) < 1e-4) p = Math.abs(u[1])<0.9 ? [0,-1,0] : [-1,0,0];
  p = v3.norm(v3.sub(p, v3.add([0,0,0], u, v3.dot(p,u))));
  return v3.add(v3.add(S, u, l1*Math.cos(a)), p, l1*Math.sin(a));
}
const SEAT = { at:'O', c:[2,-6], len:42, th:8, ang:0 };
const backPad = (d,side,len)=>({ at:'P', along:'tor', d:d||28, side:side==null?11:side, len:len||56, th:7 });
const STAND = { at:'O', c:[6,-90], len:56, th:4, ang:0 };
// 동작별 리그 — view: 2D 시점(side·front·oblique), az: 3D 처음 각도, badIdx: 실수 문구 번호
const RIGS = {
  chest_press: {
    A:{ P:[0,0], tor:100, H:[4,45], th:5, sh:-92 }, B:{ H:[54,47] },
    bad:{ B:{ tor:80, H:[60,44] } }, hold:'H',
    props:[ SEAT, backPad(), { lever:[-12,96] } ]
  },
  incline_press: {
    A:{ P:[0,0], tor:122, H:[-14,52], th:12, sh:-80 }, B:{ H:[16,92] },
    bad:{ B:{ P:[3,8], tor:112 } }, hold:'H',
    props:[ SEAT, backPad(26,11,62), { lever:[-62,8] } ]
  },
  lat_pulldown: {
    A:{ P:[0,0], tor:98, H:[-4,106], th:4, sh:-96 }, B:{ H:[-6,47] },
    bad:{ B:{ tor:128, H:[-14,50] } }, hold:'H',
    props:[ SEAT, { at:'O', c:[33,15], len:16, th:6, ang:0 }, { cable:[-4,150] } ], bar:true
  },
  seated_row: {
    A:{ P:[0,0], tor:92, H:[57,42], th:4, sh:-96 }, B:{ H:[1,40] },
    bad:{ A:{ tor:74 }, B:{ tor:116, H:[-18,38] } }, epick:'back', hold:'H',
    props:[ SEAT, { at:'O', c:[15,38], len:30, th:6, ang:90 }, { lever:[62,92] } ]
  },
  high_row: {
    A:{ P:[0,0], tor:92, H:[44,88], th:4, sh:-96 }, B:{ H:[-8,57] },
    bad:{ B:{ tor:114, H:[-16,58] } }, epick:'back', hold:'H',
    props:[ SEAT, { at:'O', c:[15,38], len:30, th:6, ang:90 }, { lever:[18,128] } ]
  },
  shoulder_press: {
    A:{ P:[0,0], tor:95, H:[2,56], th:5, sh:-92 }, B:{ H:[-2,106] },
    bad:{ B:{ tor:114, P:[4,0], H:[8,104] } }, hold:'H',
    props:[ SEAT, backPad(30,11,60), { lever:[-40,112] } ]
  },
  leg_press: {
    A:{ P:[0,0], tor:132, F:[34,26], H:[8,-4] }, B:{ F:[68,48] },
    bad:{ A:{ F:[25,19], P:[3,6], tor:142 } }, kpick:'y', legIK:true, hold:'H',
    props:[ { at:'O', c:[-2,-6], len:34, th:8, ang:0 }, backPad(26,11,60), { plate:true } ]
  },
  hack_squat: {
    A:{ P:[0,0], tor:104, F:[11,-84], H:'S+8,-6' }, B:{ P:[11,-42], F:[11,-84] },
    bad:{ B:{ P:[18,-40], tor:82 } }, kpick:'x', legIK:true, hold:'H',
    props:[ { at:'P', along:104, d:24, side:11, len:60, th:7, rail:true }, { at:'O', c:[16,-90], len:42, th:5, ang:18 } ]
  },
  leg_ext: {
    A:{ P:[0,0], tor:95, th:2, sh:-96, H:[10,-7] }, B:{ sh:4 },
    bad:{ B:{ P:[0,6], tor:112 } }, hold:'H',
    props:[ SEAT, backPad(26,11,52), { roller:'A', side:1 } ]
  },
  leg_curl_lying: {
    A:{ P:[0,0], tor:180, th:-4, sh:-2, ft:-90, H:[-62,-14] }, B:{ sh:106 },
    bad:{ B:{ P:[2,9], th:-24 } }, hold:'H', az:0.75, el:0.55,
    props:[ { at:'O', c:[-22,-10], len:104, th:6, ang:0 }, { roller:'A', side:1 } ]
  },
  // ── 가슴 ──
  decline_press: {
    A:{ P:[0,0], tor:100, H:[4,40], th:5, sh:-92 }, B:{ H:[52,22] },
    bad:{ A:{ H:[22,32] }, fast:true }, badIdx:1, hold:'H',
    props:[ SEAT, backPad(), { lever:[-14,92] } ]
  },
  pec_fly: {
    A:{ P:[0,0], tor:92, th:3, sh:-92, H:[8,46], hz:64 }, B:{ H:[40,46], hz:7 },
    bad:{ B:{ tor:78, sx:6, H:[44,40], hz:10 } }, pole:[-0.6,-0.4,0.7], view:'front',
    props:[ SEAT, backPad(28,11,58), { lever:[-2,96], z:24 } ]
  },
  cable_fly: {
    A:{ P:[0,0], tor:84, th:-90, sh:-90, ft:90, H:[14,54], hz:72 }, B:{ H:[40,26], hz:6 },
    bad:{ B:{ H:[26,36], hz:9 } }, pole:[-0.4,-0.5,0.8], view:'front',
    props:[ { cable3:[-4,104,88] }, { post:[-4,10,92], h:200 }, { at:'O', c:[6,-90], len:50, th:3, ang:0, depth:200 } ]
  },
  dip: {
    A:{ P:[0,0], tor:95, th:3, sh:-92, H:[4,30] }, B:{ H:[8,2] },
    bad:{ A:{ tor:74, H:[18,26] }, B:{ tor:80, H:[16,0] } }, epick:'back', hold:'H',
    props:[ SEAT, backPad(26,11,52), { lever:[44,20] } ]
  },
  // ── 등 ──
  tbar_row: {
    A:{ P:[0,0], tor:45, F:[8,-82], fta:0, H:[40,-16] }, B:{ H:[16,10] },
    bad:{ B:{ tor:72, H:[8,22] } }, badIdx:1, legIK:true, kpick:'x', epick:'back', hold:'H',
    props:[ { at:'P', along:'tor', d:30, side:-12, len:38, th:7 }, { lever:[96,-58] }, { at:'O', c:[10,-89], len:44, th:5, ang:0 } ]
  },
  pullover: {
    A:{ P:[0,0], tor:95, th:3, sh:-92, H:[-8,97], Ep:[-21,74] }, B:{ H:[31,32], Ep:[6,22] },
    bad:{ B:{ H:[-4,48], Ep:[6,22] } }, hold:'H',
    props:[ SEAT, backPad(28,11,56), { pad:'E', off:[0,0,5], size:[9,9,10] }, { lever:[-4,52] } ]
  },
  assist_pullup: {
    A:{ P:[0,0], tor:92, th:-95, sh:185, ft:-90, H:[4,104] }, B:{ P:[0,40] },
    bad:{ A:{ P:[0,22] } }, hold:'H',
    props:[ { at:'K', off:[-16,-6], len:34, th:6, ang:0 }, { at:'O', c:[4,108], len:8, th:5, ang:0, depth:70 }, { post:[-30,40,36], h:170, w:5 } ]
  },
  back_ext: {
    A:{ P:[0,0], tor:58, th:3, sh:-92, H:'S+8,-14' }, B:{ tor:98 },
    bad:{ B:{ tor:124 } }, hold:'none', noHandle:true,
    props:[ SEAT, backPad(40,11,22), { at:'O', c:[26,10], len:22, th:6, ang:0 } ]
  },
  shrug: {
    A:{ P:[0,0], tor:90, th:-90, sh:-90, ft:90, H:'S+2,-54' }, B:{ sy:8 },
    bad:{ B:{ sy:4, H:'S+6,-34' } }, badIdx:1, hold:'H',
    props:[ { cable:[2,-88] }, { at:'O', c:[6,-89], len:50, th:4, ang:0 } ]
  },
  // ── 어깨 ──
  lateral_raise: {
    A:{ P:[0,0], tor:90, th:3, sh:-92, H:[6,8], hz:30 }, B:{ H:[6,48], hz:70 },
    bad:{ B:{ sy:8, H:[6,58], hz:66 } }, pole:[-0.5,-0.6,0.6], view:'front', noHandle:true,
    props:[ SEAT, backPad(28,11,56), { pad:'E', off:[0,5,0], size:[9,8,9] }, { lever:[-6,50], z:24 } ]
  },
  rear_delt: {
    A:{ P:[0,0], tor:90, th:3, sh:-92, H:[40,46], hz:8 }, B:{ H:[4,48], hz:66 },
    bad:{ B:{ H:[8,44], hz:34 } }, badIdx:1, pole:[-0.3,-0.3,0.9], view:'front',
    props:[ SEAT, { at:'P', along:'tor', d:32, side:-13, len:40, th:7 }, { lever:[12,96], z:24 } ]
  },
  // ── 팔 ──
  biceps_curl: {
    A:{ P:[0,0], tor:95, th:3, sh:-92, H:[38,15], Ep:[21,35] }, B:{ H:[28,61] },
    bad:{ B:{ tor:114, H:[22,64] } }, hold:'H',
    props:[ SEAT, { at:'O', c:[6,37], len:32, th:6, ang:-30 }, { lever:[21,33] } ]
  },
  triceps_ext: {
    A:{ P:[0,0], tor:95, th:3, sh:-92, H:[19,69], Ep:[24,42] }, B:{ H:[48,31] },
    bad:{ B:{ tor:84, H:[50,46], Ep:[30,52] } }, hold:'H',
    props:[ SEAT, backPad(28,11,52), { at:'O', c:[12,36], len:30, th:6, ang:-15 }, { lever:[24,40] } ]
  },
  // ── 하체 ──
  lunge: {
    A:{ P:[0,-4], tor:92, F:[30,-84], F2:[-38,-80], fta:0, fta2:-50, H:'S+4,6' }, B:{ P:[-2,-40] },
    bad:{ B:{ kz:13 } }, legIK:true, kpick:'x', kpick2:'x', bar:true, view:'oblique', az:0.85, hold:'H',
    props:[ { at:'O', c:[-4,-89], len:110, th:4, ang:0, depth:70 } ]
  },
  leg_curl_seated: {
    A:{ P:[0,0], tor:100, th:2, sh:-8, H:[14,2] }, B:{ sh:-112 },
    bad:{ B:{ P:[3,8], tor:90 } }, hold:'H',
    props:[ SEAT, backPad(26,11,52), { at:'O', c:[24,10], len:22, th:6, ang:0 }, { roller:'A', side:-1 } ]
  },
  hip_thrust: {
    A:{ P:[0,0], tor:159, F:[34,-26], fta:0, H:'P+2,10' }, B:{ P:[2,22], tor:185 },
    bad:{ B:{ P:[3,27], tor:190, tor2:204 } }, legIK:true, kpick:'y', hold:'H', az:0.6,
    props:[ { at:'O', c:[-50,5], len:30, th:8, ang:0 }, { at:'P', off:[0,10], len:24, th:6, ang:0 }, { at:'O', c:[16,-30], len:90, th:3, ang:0 } ]
  },
  glute_kick: {
    A:{ P:[0,0], tor:50, th:-95, sh:-88, th2:-90, sh2:-90, ft:90, ft2:90, H:'S+14,-8' }, B:{ th:-158, sh:-170 },
    bad:{ B:{ th:-182, sh:-192, tor2:66 } }, hold:'H',
    props:[ { at:'P', along:'tor', d:28, side:-12, len:34, th:7 }, { pad:'A', only:1, off:[0,0,0], size:[16,8,10] }, { at:'O', c:[2,-89], len:40, th:4, ang:0 } ]
  },
  abduction: {
    A:{ P:[0,0], tor:100, th:2, sh:-92, ab:4, H:[8,-2], hz:28 }, B:{ ab:34 },
    bad:{ A:{ ab:0 }, B:{ ab:40 }, fast:true }, view:'front', noHandle:true,
    props:[ SEAT, backPad(26,11,52), { pad:'K', off:[0,0,8], size:[12,14,6] } ]
  },
  adduction: {
    A:{ P:[0,0], tor:100, th:2, sh:-92, ab:36, H:[8,-2], hz:28 }, B:{ ab:3 },
    bad:{ A:{ ab:40 }, B:{ ab:0 }, fast:true }, badIdx:1, view:'front', noHandle:true,
    props:[ SEAT, backPad(26,11,52), { pad:'K', off:[0,0,-8], size:[12,14,6] } ]
  },
  calf: {
    A:{ P:[0,0], tor:90, th:-90, sh:-90, ft:90, H:'S+8,6' }, B:{ P:[0,9], ft:63 },
    bad:{ B:{ P:[0,5], th:-78, sh:-102, ft:80 } }, badIdx:1, hold:'H',
    props:[ { at:'S', off:[0,8], len:22, th:7, ang:0 }, { at:'O', c:[16,-89], len:14, th:6, ang:0 } ]
  },
  // ── 복부 ──
  ab_crunch: {
    A:{ P:[0,0], tor:95, tor2:95, th:4, sh:-92, H:'S+6,6' }, B:{ tor2:38 },
    bad:{ B:{ tor:52, tor2:52 } }, badIdx:1, hold:'H',
    props:[ SEAT, { at:'S', off:[12,-6], len:6, th:22, ang:0 } ]
  },
  torso_rot: {
    A:{ P:[0,0], tor:90, th:3, sh:-92, ty:-35, handT:[16,-14,10] }, B:{ ty:35 },
    bad:{ A:{ ty:-55 }, B:{ ty:55 }, fast:true }, handT:true, pole:[0,-1,0.3], view:'front', az:1.15, el:0.7, noHandle:true,
    props:[ SEAT, { at:'O', c:[40,8], len:8, th:10, ang:0, depth:40 } ]
  },
};
const SEG_MUSCLE = { tor:['chest','lats','uppertrap','erector','abs','obliques','frontdelt','sidedelt','reardelt'], ua:['biceps','triceps','frontdelt','sidedelt','reardelt'], fa:['forearm'], th:['quads','hams','glutes','adductors','glutemed'], sh:['calves'] };

function parseRel(v, J){ if(typeof v!=='string') return v; const m = v.match(/^([A-Z][a-z]?)\+(-?[\d.]+),(-?[\d.]+)$/); return m ? [J[m[1]][0]+ +m[2], J[m[1]][1]+ +m[3]] : [0,0]; }
function lerp(a,b,t){ if(Array.isArray(a)) return a.map((v,i)=>v+(b[i]-v)*t); if(typeof a==='number') return a+(b-a)*t; return t<0.5?a:b; }
function keyframes(id, bad){
  const R = RIGS[id]; const A = Object.assign({}, R.A); const B = Object.assign({}, R.A, R.B);
  if(bad && R.bad){ Object.assign(A, R.bad.A||{}); Object.assign(B, R.bad.B||{}); }
  return [A,B];
}
function leg2D(R, k, P, s){ // s: 1 = 오른다리(앞), -1 = 왼다리. th2·sh2·F2가 있으면 왼다리만 다르게
  const alt = s<0 && (k.F2!=null || k.th2!=null);
  const th = alt && k.th2!=null ? k.th2 : k.th, sh = alt && k.sh2!=null ? k.sh2 : k.sh, ft = alt && k.ft2!=null ? k.ft2 : k.ft;
  const F = alt && k.F2!=null ? k.F2 : k.F; const fta = alt ? (k.fta2!=null ? k.fta2 : k.fta) : k.fta;
  const o = {};
  if(R.legIK){ o.A = F; const k1 = ik(P, o.A, L.th, L.sh, 1), k2 = ik(P, o.A, L.th, L.sh, -1); const kp = (alt && R.kpick2) || R.kpick; const ax = kp==='x' ? 0 : 1; o.K = k1[ax] >= k2[ax] ? k1 : k2; }
  else { o.K = add(P, dir(th), L.th); o.A = add(o.K, dir(sh), L.sh); }
  o.sh = Math.atan2(o.A[1]-o.K[1], o.A[0]-o.K[0])*180/Math.PI;
  o.T = fta!=null ? add(o.A, dir(fta), L.ft) : add(o.A, dir(o.sh + (ft!=null ? ft : 90)), L.ft);
  return o;
}
function pose(id, t, bad){
  const R = RIGS[id]; const [A,B] = keyframes(id, bad);
  const DEF = { tor2:A.tor, sx:0, sy:0, kz:0, ty:0, ab:0 };
  const k = {}, rel = {}; Object.keys(B).forEach(n=>{ const a = A[n]!==undefined ? A[n] : DEF[n];
    if(typeof B[n]==='string' || typeof a==='string'){ rel[n] = [a===undefined ? B[n] : a, B[n]]; k[n] = B[n]; }
    else k[n] = a!==undefined ? lerp(a, B[n], t) : B[n]; });
  const J = {}; J.P = k.P;
  const tor2 = k.tor2!=null ? k.tor2 : k.tor;
  J.M = add(J.P, dir(k.tor), L.tor/2);
  const S0 = add(J.M, dir(tor2), L.tor/2);
  J.Hd = add(S0, dir(tor2), L.neck);
  J.S = [S0[0] + (k.sx||0), S0[1] + (k.sy||0)];
  const ty = rad(k.ty||0);
  // 다리
  const leg = { 1: leg2D(R, k, J.P, 1), '-1': leg2D(R, k, J.P, -1) };
  J.K = leg[1].K; J.A = leg[1].A; J.T = leg[1].T; J._sh = leg[1].sh; J._tor = k.tor; J._tor2 = tor2;
  // 팔 (옆 평면 기본)
  const H = rel.H ? lerp(parseRel(rel.H[0], J), parseRel(rel.H[1], J), t) : parseRel(k.H, J); J.W = H;
  const flat = k.hz==null && !R.pole && !k.ty && !R.handT;
  if(flat){ const e1 = ik(J.S, H, L.ua, L.fa, 1), e2 = ik(J.S, H, L.ua, L.fa, -1); J.E = k.Ep ? (dist(e1,k.Ep) <= dist(e2,k.Ep) ? e1 : e2) : R.epick==='back' ? (e1[0] <= e2[0] ? e1 : e2) : R.epick==='front' ? (e1[0] >= e2[0] ? e1 : e2) : R.epick==='up' ? (e1[1] >= e2[1] ? e1 : e2) : (e1[1] <= e2[1] ? e1 : e2); }
  // 좌우 3D 관절
  J.side = {};
  [1,-1].forEach(s=>{
    const o = {};
    o.S = [J.S[0] + s*SW*Math.sin(ty), J.S[1], s*SW*Math.cos(ty)];
    if(R.handT){ const h = k.handT; o.W = [J.S[0] + h[0]*Math.cos(ty) + s*h[2]*Math.sin(ty), J.S[1] + h[1], -h[0]*Math.sin(ty) + s*h[2]*Math.cos(ty)]; }
    else o.W = [H[0], H[1], s*(k.hz!=null ? k.hz : SW)];
    if(flat) o.E = [J.E[0], J.E[1], s*SW];
    else { const pl = R.pole || [0,-1,0]; o.E = ik3(o.S, o.W, L.ua, L.fa, [pl[0], pl[1], s*pl[2]]); }
    const lg = leg[s]; const ab = rad((k.ab||0) * (s>0 || !R.abOne ? 1 : 0));
    const hip = [J.P[0], J.P[1], s*HW];
    const yaw = p=>{ const dx = p[0]-J.P[0]; return [J.P[0] + dx*Math.cos(ab), p[1], s*HW + s*dx*Math.sin(ab)]; };
    o.Hp = hip; o.K = yaw(lg.K); o.A = yaw(lg.A); o.T = yaw(lg.T);
    if(s>0 && k.kz){ o.K = [o.K[0], o.K[1], o.K[2] - k.kz]; }
    J.side[s] = o;
  });
  if(!flat){ J.E = [J.side[1].E[0], J.side[1].E[1]]; J.W = [J.side[1].W[0], J.side[1].W[1]]; }
  return J;
}
// 소품: 3D 상자·선·원통으로 만든다(2D는 투영)
function propsAt(id, J){
  const R = RIGS[id]; const out = [];
  const box = (c, len, th, ang, depth, z)=>out.push({ kind:'box', c:[c[0],c[1],z||0], len, th, ang:ang||0, depth:depth||44 });
  R.props.forEach(p=>{
    if(p.lever){ [1,-1].forEach(s=>out.push({ kind:'line', a:[p.lever[0], p.lever[1], s*(p.z!=null?p.z:SW)], b:J.side[s].W, w:3 })); return; }
    if(p.cable){ [1,-1].forEach(s=>out.push({ kind:'line', a:[p.cable[0], p.cable[1], s*(p.z!=null?p.z:SW)], b:J.side[s].W, w:1.5, thin:true })); out.push({ kind:'cyl', c:[p.cable[0],p.cable[1],0], r:4, len:2*SW+8 }); return; }
    if(p.cable3){ [1,-1].forEach(s=>{ const a = [p.cable3[0], p.cable3[1], s*p.cable3[2]]; out.push({ kind:'line', a, b:J.side[s].W, w:1.5, thin:true }); out.push({ kind:'box', c:[a[0],a[1],a[2]], len:8, th:8, ang:0, depth:8 }); }); return; }
    if(p.post){ [1,-1].forEach(s=>out.push({ kind:'box', c:[p.post[0], p.post[1], s*p.post[2]], len:p.w||6, th:p.h, ang:0, depth:p.w||6 })); return; }
    if(p.plate){ const ang = Math.atan2(J.A[1]-J.P[1], J.A[0]-J.P[0])*180/Math.PI; box(add(J.A, dir(ang), 3), 44, 5, ang+90); return; }
    if(p.roller){ const base = J[p.roller]; const c = add(base, dir(J._sh + 90*p.side), 8); out.push({ kind:'cyl', c:[c[0],c[1],0], r:6, len:40, pad:true }); [1,-1].forEach(s=>out.push({ kind:'line', a:[J.K[0],J.K[1],s*21], b:[c[0],c[1],s*21], w:2.5 })); return; }
    if(p.pad){ // 관절에 붙는 좌우 패드: { pad:'K'|'E'|'A', off:[x,y,z], size:[x,y,z] }
      [1,-1].forEach(s=>{ if(p.only && p.only!==s) return; const b = J.side[s][p.pad]; out.push({ kind:'box3', c:[b[0]+p.off[0], b[1]+p.off[1], b[2]+s*p.off[2]], size:p.size }); }); return; }
    if(p.at==='O'){ box(p.c, p.len, p.th, p.ang, p.depth); return; }
    if(p.off){ const b = J[p.at]; box([b[0]+p.off[0], b[1]+p.off[1]], p.len, p.th, p.ang, p.depth); return; }
    const ang = typeof p.along==='number' ? p.along : (p.along==='tor2' ? J._tor2 : J._tor);
    const base = J[p.at]; const c = add(add(base, dir(ang), p.d), dir(ang+90), p.side);
    box(c, p.len, p.th, ang, p.depth);
  });
  return out;
}
function boxCorners(p){
  if(p.kind==='box3'){ const [c,s] = [p.c,p.size]; const out=[]; [-1,1].forEach(a=>[-1,1].forEach(b=>[-1,1].forEach(d=>out.push([c[0]+a*s[0]/2, c[1]+b*s[1]/2, c[2]+d*s[2]/2])))); return out; }
  if(p.kind==='cyl'){ const out=[]; [-1,1].forEach(a=>[-1,1].forEach(b=>[-1,1].forEach(d=>out.push([p.c[0]+a*p.r, p.c[1]+b*p.r, p.c[2]+d*p.len/2])))); return out; }
  const d = dir(p.ang), n = dir(p.ang+90), out = [];
  [-1,1].forEach(a=>[-1,1].forEach(b=>[-1,1].forEach(z=>{ const q = add(add(p.c, d, a*p.len/2), n, b*p.th/2); out.push([q[0], q[1], p.c[2] + z*p.depth/2]); })));
  return out;
}
const ease = t=>0.5-0.5*Math.cos(Math.PI*t);
function phase(ms, fast){ // 0.4s 멈춤, 1.2s 수축, 0.4s 멈춤, 1.8s 이완 · 반동(fast)은 쉼 없이 1.1초
  if(fast){ const T = 1100, x = ms % T; return x < 450 ? ease(x/450) : 1-ease((x-450)/650); }
  const T = 3800, x = ms % T;
  if(x<400) return 0; if(x<1600) return ease((x-400)/1200); if(x<2000) return 1; return 1-ease((x-2000)/1800);
}
function segColor(seg, mov, base){
  if(!mov || !SEG_MUSCLE[seg]) return base;
  if((mov.p||[]).some(m=>SEG_MUSCLE[seg].indexOf(m)>=0)) return '#30d158';
  if((mov.s||[]).some(m=>SEG_MUSCLE[seg].indexOf(m)>=0)) return '#a8e6b8';
  return base;
}
function projector(R){
  const v = R.view || 'side';
  if(v==='front') return q=>[q[2], q[1]];
  if(v==='oblique') return q=>[q[0] + q[2]*0.42, q[1] + q[2]*0.16];
  if(v==='top') return q=>[q[2], -q[0]];
  return q=>[q[0], q[1]];
}
function allPoints(id, J){
  const pts = [[J.Hd[0],J.Hd[1],0],[J.M[0],J.M[1],0],[J.P[0],J.P[1],0]];
  [1,-1].forEach(s=>{ const o = J.side[s]; ['S','E','W','Hp','K','A','T'].forEach(n=>pts.push(o[n])); });
  propsAt(id,J).forEach(p=>{ if(p.kind==='line'){ pts.push(p.a, p.b); } else boxCorners(p).forEach(q=>pts.push(q)); });
  return pts;
}
function bounds(id, proj){
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  [false,true].forEach(bad=>{ for(let i=0;i<=10;i++){ const J = pose(id,i/10,bad);
    allPoints(id,J).forEach(q3=>{ const q = proj ? proj(q3) : q3; mnx=Math.min(mnx,q[0]); mny=Math.min(mny,q[1]); mxx=Math.max(mxx,q[0]); mxy=Math.max(mxy,q[1]); });
  }});
  const pad = 14; return [mnx-pad, mny-pad, mxx-mnx+pad*2, mxy-mny+pad*2];
}
function bounds3(id){
  const m = [1e9,1e9,1e9], M = [-1e9,-1e9,-1e9];
  [false,true].forEach(bad=>{ for(let i=0;i<=10;i++){ allPoints(id, pose(id,i/10,bad)).forEach(q=>{ for(let j=0;j<3;j++){ m[j]=Math.min(m[j],q[j]); M[j]=Math.max(M[j],q[j]); } }); } });
  return { c:[(m[0]+M[0])/2, (m[1]+M[1])/2, (m[2]+M[2])/2], size:Math.max(M[0]-m[0], M[1]-m[1], M[2]-m[2]) + 20 };
}
function hull(pts){
  pts = pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr = (o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[], up=[];
  pts.forEach(p=>{ while(lo.length>=2 && cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); });
  for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(up.length>=2 && cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}

/* ---------- 2D ---------- */
function rig2D(el, id, opts){
  opts = opts||{}; const mov = opts.move; const dark = !!opts.dark; const R = RIGS[id];
  const NS = 'http://www.w3.org/2000/svg';
  const proj = projector(R);
  const [bx,by,bw,bh] = bounds(id, proj);
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox', `${bx} ${-(by+bh)} ${bw} ${bh}`); svg.setAttribute('class','rig2d');
  svg.setAttribute('role','img'); svg.setAttribute('aria-label', (opts.bad?'흔한 실수':'바른 동작')+' 애니메이션');
  el.innerHTML=''; el.appendChild(svg);
  const propCol = dark ? '#48484a' : '#d1d1d6', bodyCol = dark ? '#8e8e93' : '#3a3a3c', farCol = dark ? '#5a5a5e' : '#8e8e93';
  const F = q=>{ const p = proj(q.length===3 ? q : [q[0],q[1],0]); return [p[0], -p[1]]; };
  const front = (R.view==='front' || R.view==='top');
  const fast = !!(opts.bad && R.bad && R.bad.fast);
  let raf = 0, t0 = performance.now();
  const L2 = (a,b,col,w,extra)=>{ const A=F(a),B=F(b); return `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${extra||''}/>`; };
  function frame(now){
    const J = pose(id, opts.fixedT!=null ? opts.fixedT : phase(now - t0, fast), opts.bad);
    let h = '';
    propsAt(id, J).forEach(p=>{
      if(p.kind==='line') h += L2(p.a, p.b, propCol, p.w, p.thin?' stroke-dasharray="3 3"':'');
      else if(p.kind==='cyl' && !front && R.view!=='oblique'){ const c = F(p.c); h += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${p.r}" fill="${propCol}"/>`; }
      else { const pts = hull(boxCorners(p).map(F)); h += `<polygon points="${pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}" fill="${propCol}"/>`; }
    });
    const col = s=>segColor(s, mov, bodyCol);
    const limbs = (s, far)=>{ const o = J.side[s]; const c = far ? (()=>farCol) : col; let x = '';
      x += L2(o.Hp, o.K, c('th'), 13) + L2(o.K, o.A, c('sh'), 9) + L2(o.A, o.T, c('sh'), 6);
      return x; };
    const arms = (s, far)=>{ const o = J.side[s]; const c = far ? (()=>farCol) : col; return L2(o.S, o.E, c('ua'), 8) + L2(o.E, o.W, c('fa'), 7); };
    const nearS = front ? 1 : 1, farS = -1;
    // 뒤쪽 팔다리 → 몸통 → 앞쪽 팔다리
    if(!front){ h += limbs(farS, true) + arms(farS, true); }
    const tc = col('tor');
    if(front){
      const a = J.side[1], b = J.side[-1];
      const quad = [a.S, b.S, b.Hp, a.Hp].map(F);
      h += `<polygon points="${quad.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}" fill="${tc}" stroke="${tc}" stroke-width="10" stroke-linejoin="round"/>`;
      h += limbs(1, R.view==='top') + limbs(-1, R.view==='top');
    } else {
      h += `<polyline points="${[J.P, J.M, add(J.S, dir(J._tor2), 3)].map(q=>F(q)).map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}" fill="none" stroke="${tc}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>`;
      h += limbs(nearS);
    }
    h += L2(J.S, add(J.S, dir(J._tor2), 10), bodyCol, 7);
    const hd = F(J.Hd); h += `<circle cx="${hd[0].toFixed(1)}" cy="${hd[1].toFixed(1)}" r="9.5" fill="${bodyCol}"/>`;
    if(front){ h += arms(1) + arms(-1); } else h += arms(nearS);
    const hand = s=>{ const c = F(J.side[s].W); return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.6" fill="${dark?'#f2f2f7':'#111'}"/>`; };
    h += hand(1); if(front || R.view==='oblique') h += hand(-1);
    svg.innerHTML = h;
    if(opts.fixedT==null) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop(){ cancelAnimationFrame(raf); } };
}

/* ---------- 3D ---------- */
function rig3D(el, id, opts){
  opts = opts||{}; const THREE = window.THREE; if(!THREE) return null; const R = RIGS[id];
  const mov = opts.move; const dark = !!opts.dark;
  const fast = !!(opts.bad && R.bad && R.bad.fast);
  const w = el.clientWidth || 320, h = el.clientHeight || Math.round(w*0.8);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1)); renderer.setSize(w,h);
  el.innerHTML=''; el.appendChild(renderer.domElement); renderer.domElement.style.touchAction='none';
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, w/h, 1, 3000);
  scene.add(new THREE.HemisphereLight(0xffffff, dark?0x222222:0x999999, 0.95));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(80,160,120); scene.add(dl);
  const B3 = bounds3(id);
  const root = new THREE.Group(); root.position.set(-B3.c[0], -B3.c[1], -B3.c[2]); scene.add(root);
  const hex = s=>parseInt(s.slice(1),16);
  const bodyMat = s=>new THREE.MeshStandardMaterial({ color: hex(segColor(s, mov, dark?'#8e8e93':'#aeaeb2')), roughness:0.7 });
  const propMat = new THREE.MeshStandardMaterial({ color: dark?0x3a3a3c:0x2c2c2e, roughness:0.55, metalness:0.2 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness:0.9 });
  const up = new THREE.Vector3(0,1,0);
  function limb(r, mat, parent){ const g = new THREE.Group(); const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,14), mat); const s1 = new THREE.Mesh(new THREE.SphereGeometry(r,14,10), mat); const s2 = s1.clone(); g.add(cyl,s1,s2); g.userData={cyl,s1,s2}; (parent||root).add(g); return g; }
  function place(g, a, b){ const A = new THREE.Vector3(a[0],a[1],a[2]||0), B = new THREE.Vector3(b[0],b[1],b[2]||0); const d = B.clone().sub(A); const len = Math.max(0.01, d.length());
    const u=g.userData; u.cyl.scale.set(1,len,1); u.cyl.position.copy(A.clone().add(B).multiplyScalar(0.5)); u.cyl.quaternion.setFromUnitVectors(up, d.normalize()); u.s1.position.copy(A); u.s2.position.copy(B); }
  const torMat = bodyMat('tor');
  const parts = { lo: new THREE.Mesh(new THREE.BoxGeometry(1,1,1), torMat), hi: new THREE.Mesh(new THREE.BoxGeometry(1,1,1), torMat), head: new THREE.Mesh(new THREE.SphereGeometry(10,18,14), bodyMat('none')) };
  parts.lo.rotation.order = parts.hi.rotation.order = 'YXZ';
  root.add(parts.lo, parts.hi, parts.head);
  const limbs = {}; [['ua',4.6],['fa',4],['th',7],['sh',5],['ft',3.2]].forEach(([s,r])=>{ limbs[s]=[limb(r,bodyMat(s==='ft'?'sh':s)), limb(r,bodyMat(s==='ft'?'sh':s))]; });
  const propG = new THREE.Group(); root.add(propG);
  function setProps(J){
    while(propG.children.length) propG.remove(propG.children[0]);
    propsAt(id, J).forEach(p=>{
      if(p.kind==='box'){ const m = new THREE.Mesh(new THREE.BoxGeometry(p.len,p.th,p.depth), padMat); m.position.set(p.c[0],p.c[1],p.c[2]); m.rotation.z = rad(p.ang); propG.add(m); }
      else if(p.kind==='box3'){ const m = new THREE.Mesh(new THREE.BoxGeometry(p.size[0],p.size[1],p.size[2]), padMat); m.position.set(p.c[0],p.c[1],p.c[2]); propG.add(m); }
      else if(p.kind==='line'){ const l = limb(p.w*0.9, propMat, propG); place(l, p.a, p.b); }
      else if(p.kind==='cyl'){ const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r,p.r,p.len,16), p.pad?padMat:propMat); m.rotation.x = Math.PI/2; m.position.set(p.c[0],p.c[1],p.c[2]); propG.add(m); }
    });
  }
  const wide = RIGS[id].A.hz!=null || R.pole || R.handT;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,R.bar?90:2*SW+10,12), propMat); handle.rotation.x = Math.PI/2; if(!wide && !R.noHandle) root.add(handle);
  const grips = [1,-1].map(()=>{ const m = new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,12,10), propMat); if(wide && !R.noHandle) root.add(m); return m; });
  const az0 = R.az!=null ? R.az : (R.view==='front' ? 1.15 : 0.55), el0 = R.el!=null ? R.el : 0.28;
  let az = az0, el2 = el0, dragging=false, lx=0, ly=0;
  const RR = B3.size*1.5;
  function setCam(){ cam.position.set(RR*Math.sin(az)*Math.cos(el2), RR*Math.sin(el2), RR*Math.cos(az)*Math.cos(el2)); cam.lookAt(0,0,0); }
  setCam();
  const cvs = renderer.domElement;
  cvs.addEventListener('pointerdown', e=>{ dragging=true; lx=e.clientX; ly=e.clientY; cvs.setPointerCapture(e.pointerId); });
  cvs.addEventListener('pointermove', e=>{ if(!dragging) return; az -= (e.clientX-lx)*0.01; el2 = Math.max(-0.2, Math.min(1.3, el2 + (e.clientY-ly)*0.006)); lx=e.clientX; ly=e.clientY; setCam(); });
  cvs.addEventListener('pointerup', ()=>{ dragging=false; });
  let raf=0, t0=performance.now(), auto=true;
  cvs.addEventListener('pointerdown', ()=>{ auto=false; });
  const torBox = (m, a, b, ty, wid)=>{ const d=[b[0]-a[0], b[1]-a[1]]; const len=Math.hypot(d[0],d[1]); m.scale.set(len+4, 18, wid); m.position.set((a[0]+b[0])/2, (a[1]+b[1])/2, 0); m.rotation.set(0, ty, Math.atan2(d[1],d[0])); };
  function frame(now){
    const J = pose(id, opts.fixedT!=null ? opts.fixedT : phase(now-t0, fast), opts.bad);
    const ty = Math.atan2(J.side[1].S[0]-J.S[0], J.side[1].S[2]);
    torBox(parts.lo, J.P, J.M, 0, 30); torBox(parts.hi, J.M, J.S, ty, 36);
    parts.head.position.set(J.Hd[0], J.Hd[1], 0);
    [1,-1].forEach((s,i)=>{ const o = J.side[s]; place(limbs.ua[i], o.S, o.E); place(limbs.fa[i], o.E, o.W); place(limbs.th[i], o.Hp, o.K); place(limbs.sh[i], o.K, o.A); place(limbs.ft[i], o.A, o.T);
      grips[i].position.set(o.W[0], o.W[1], o.W[2]); });
    handle.position.set(J.W[0], J.W[1], 0);
    setProps(J);
    if(auto){ az = az0 + Math.sin((now-t0)/4000)*0.5; setCam(); }
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop(){ cancelAnimationFrame(raf); renderer.dispose(); } };
}
window.RIG = { ids:Object.keys(RIGS), has:id=>!!RIGS[id], badIdx:id=>(RIGS[id]&&RIGS[id].badIdx)||0, rig2D, rig3D, _pose:pose };
})();
