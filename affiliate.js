/* 3초식단 제휴 — 가입 없이, 기록 화면에 광고 배너는 넣지 않는다.
 *
 * 수익을 켜려면:
 *  1) https://partners.coupang.com 가입, 채널에 https://3cho.kr 등록
 *  2) 대시보드에서 상품 숏링크를 만들어 아래 url 칸에 붙여넣기
 *  3) 또는 lptag 만 넣으면 검색 링크에 트래킹이 붙습니다
 *
 * lptag / url 이 비어 있으면 일반 쿠팡 검색으로만 열립니다 (수수료 없음).
 */
window.AFFILIATE = {
  lptag: 'AF2421382',
  subid: '3cho'
};

window.FILL_ITEMS = [
  { id:'chicken', q:'훈제 닭가슴살 한끼통살', name:'훈제 닭가슴살', why:'단 23g · 110kcal', p:23, k:110, emoji:'🍗', url:'' },
  { id:'shake',   q:'프로틴 음료 RTD',         name:'프로틴 음료',   why:'단 20g · 180kcal', p:20, k:180, emoji:'🥛', url:'' },
  { id:'yogurt',  q:'그릭요거트 무가당',       name:'그릭요거트',    why:'단 12g · 130kcal', p:12, k:130, emoji:'🥣', url:'' },
  { id:'egg',     q:'훈제란 삶은계란',         name:'훈제란',        why:'단 6g · 78kcal',   p:6,  k:78,  emoji:'🥚', url:'' },
  { id:'oats',    q:'오트밀 단백질',           name:'오트밀',        why:'끼니 대체 150kcal', p:5,  k:150, emoji:'🌾', url:'' }
];

window.FOOD_SHOP = {
  '닭가슴살': ['chicken'], '훈제닭가슴살': ['chicken'], '닭가슴살샐러드': ['chicken','yogurt'],
  '프로틴쉐이크': ['shake'], '프로틴음료': ['shake'],
  '그릭요거트': ['yogurt'], '오트밀': ['oats'], '샐러드': ['chicken','yogurt'],
  '계란': ['egg'], '삶은계란': ['egg'], '스크램블': ['egg'], '계란후라이': ['egg'],
  '라면': ['chicken','egg'], '신라면': ['chicken'], '컵라면': ['chicken','egg'],
  '삼각김밥': ['egg','chicken'], '참치김밥': ['egg'], '김밥': ['egg'],
  '편의점도시락': ['chicken'], '흰쌀밥': ['chicken'], '제로콜라': ['shake']
};

function coupangUrl(item){
  if(item && item.url) return item.url;
  const q = (item && item.q) || item || '';
  const land = 'https://www.coupang.com/np/search?q=' + encodeURIComponent(q);
  const tag = (window.AFFILIATE && AFFILIATE.lptag) || '';
  if(!tag) return land;
  return 'https://link.coupang.com/re/AFFSDP?lptag=' + encodeURIComponent(tag)
    + '&subid=' + encodeURIComponent((AFFILIATE.subid||'3cho'))
    + '&landing_url=' + encodeURIComponent(land);
}
function affiliateOn(){ return !!(window.AFFILIATE && AFFILIATE.lptag); }
function affiliateNote(){
  return affiliateOn()
    ? '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
    : '';
}
function shopItemsFor(food){
  const ids = window.FOOD_SHOP[food] || ['chicken','shake'];
  return ids.map(id => (window.FILL_ITEMS||[]).find(x=>x.id===id)).filter(Boolean);
}
function shopCardsHtml(items, extraClass){
  const note = affiliateNote();
  return `<div class="fill-row ${extraClass||''}">${items.map(it=>`
    <a class="fill-item" href="${coupangUrl(it)}" target="_blank" rel="noopener sponsored nofollow">
      <span class="fi-e">${it.emoji}</span>
      <span class="fi-n">${it.name}</span>
      <span class="fi-w">${it.why}</span>
      <span class="fi-g">쿠팡에서 보기 →</span>
    </a>`).join('')}</div>` + (note ? `<div class="fill-note">${note}</div>` : '');
}
function shopBlockFor(food){
  const items = shopItemsFor(food);
  if(!items.length) return '';
  return `<h2>단백질로 바꾸려면</h2>
    <p class="fill-lead">칼로리만 보고 끊기보다, 같은 끼니에서 단백질을 채우는 쪽이 덜 배고픕니다.</p>
    ${shopCardsHtml(items)}`;
}
