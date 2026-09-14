/* 3초식단 제휴 — 기록 화면 배너는 넣지 않는다.
 * 상품 URL은 쿠팡 파트너스 lptag로 감싼다. */
window.AFFILIATE = {
  lptag: 'AF2421382',
  subid: '3cho'
};

window.FILL_ITEMS = [
  { id:'chicken', name:'한끼통살 닭가슴살', why:'100g · 단백질 23g', p:23, k:110, emoji:'🍗',
    product:'https://www.coupang.com/vp/products/9151670974' },
  { id:'shake',   name:'셀렉스 프로틴 오리지널', why:'125ml · 단백질 20g', p:20, k:180, emoji:'🥛',
    product:'https://www.coupang.com/vp/products/9334640009' },
  { id:'yogurt',  name:'그릭데이 시그니처', why:'100g · 단백질 12g', p:12, k:130, emoji:'🥣',
    product:'https://www.coupang.com/vp/products/5463245022' },
  { id:'egg',     name:'곰곰 동물복지 반숙란', why:'1개 · 단백질 6g', p:6, k:78, emoji:'🥚',
    product:'https://www.coupang.com/vp/products/6586318474' },
  { id:'oats',    name:'냉장고쏙 롤드 오트', why:'아침 한 그릇 · 150kcal', p:5, k:150, emoji:'🌾',
    product:'https://www.coupang.com/vp/products/6386799209' }
];

window.FOOD_SHOP = {
  '닭가슴살': ['chicken'], '훈제닭가슴살': ['chicken'], '닭가슴살샐러드': ['chicken','yogurt'],
  '프로틴쉐이크': ['shake'], '프로틴음료': ['shake'],
  '그릭요거트': ['yogurt'], '오트밀': ['oats'], '샐러드': ['chicken','yogurt'],
  '계란': ['egg'], '삶은계란': ['egg'], '스크램블': ['egg'], '계란후라이': ['egg']
};

function coupangUrl(item){
  if(item && item.url) return item.url;
  const land = (item && item.product)
    || ('https://www.coupang.com/np/search?q=' + encodeURIComponent((item && item.q) || item || ''));
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
      <span class="fi-g">쿠팡에서 이 상품 보기 →</span>
    </a>`).join('')}</div>` + (note ? `<div class="fill-note">${note}</div>` : '');
}
function shopBlockFor(food){
  const items = shopItemsFor(food);
  if(!items.length) return '';
  return `<h2>단백질로 바꾸려면</h2>
    <p class="fill-lead">칼로리만 보고 끊기보다, 같은 끼니에서 단백질을 채우는 쪽이 덜 배고픕니다.</p>
    ${shopCardsHtml(items)}`;
}
