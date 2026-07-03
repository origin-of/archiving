/* ============================================================
   앱 로직입니다. 데이터는 js/data.js 에서 가져오고,
   이 파일은 보통 건드리실 필요 없어요.
============================================================ */

// dummy-data.js가 로드되어 있으면 그걸 합치고, 없으면 실제 데이터만 사용
const FICS = FICS_CURATED.concat(typeof DUMMY_FICS !== 'undefined' ? DUMMY_FICS : []);
const TRPG = TRPG_CURATED.concat(typeof DUMMY_TRPG !== 'undefined' ? DUMMY_TRPG : []);

/* ================= 타입별 설정 ================= */
const CONFIG = {
  fanfic: {
    windowTitle: "내 팬픽 서재.exe",
    address: "local://fanfic-library/index.html",
    brandTitle: "내 팬픽 서재",
    brandSub: "읽은 글을 잊기 전에, 태그로 빠르게 다시 찾기 위한 곳",
    categoryLabel: "장르",
    metricLabel: "챕터",
    sortMetricLabel: "진행분량 많은순",
    statusLabel: "상태",
    doneLabel: "완결",
    ongoingLabel: "연재중",
    hasExtraColumn: false,
    hasSpoilerColumn: false,
    data: FICS
  },
  trpg: {
    windowTitle: "내 TRPG 시나리오 서고.exe",
    address: "local://trpg-library/index.html",
    brandTitle: "내 TRPG 시나리오 서고",
    brandSub: "플레이한(할) 시나리오를 시스템과 태그로 빠르게 찾기 위한 곳",
    categoryLabel: "시스템",
    extraLabel: "인원",
    metricLabel: "플레이타임",
    sortMetricLabel: "인원 많은순",
    statusLabel: "상태",
    doneLabel: "보유중",
    ongoingLabel: "위시",
    hasExtraColumn: true,
    hasSpoilerColumn: true,
    data: TRPG
  }
};

/* ================= 상태 ================= */
let activeType = "trpg";
let searchTerm = "";
let sortMode = "recent";
let statusFilter = "all";
let spoilerFilter = "all";
let minRating = 0;
let tagState = {};
let currentPage = 1;
let pageSize = 50;
let openKey = null;

function currentConfig(){ return CONFIG[activeType]; }

function rebuildTagState(){
  tagState = {};
  // 태그 목록은 고정 마스터가 아니라 실제 데이터에 입력된 tags에서 매번 추출됩니다.
  const tags = [...new Set(currentConfig().data.flatMap(f => f.tags))].sort((a,b)=>a.localeCompare(b,'ko'));
  tags.forEach(t => tagState[t] = 0);
  return tags;
}
let allTags = rebuildTagState();

/* ================= 타입 전환 ================= */
document.querySelectorAll('.type-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if(btn.dataset.type === activeType) return;
    activeType = btn.dataset.type;
    document.querySelectorAll('.type-tab').forEach(b => b.classList.toggle('active', b === btn));

    const cfg = currentConfig();
    document.getElementById('windowTitle').textContent = cfg.windowTitle;
    document.getElementById('addressBar').textContent = cfg.address;
    document.getElementById('brandTitle').textContent = cfg.brandTitle;
    document.getElementById('brandSub').textContent = cfg.brandSub;
    document.getElementById('thCategory').firstChild.textContent = cfg.categoryLabel + " ";
    document.getElementById('thMetric').firstChild.textContent = cfg.metricLabel + " ";
    document.getElementById('thStatus').firstChild.textContent = cfg.statusLabel + " ";
    document.getElementById('sortMetricOpt').textContent = cfg.sortMetricLabel;
    document.getElementById('statusDoneBtn').textContent = cfg.doneLabel;
    document.getElementById('statusOngoingBtn').textContent = cfg.ongoingLabel;
    document.getElementById('taskbarStart').textContent = activeType === 'fanfic' ? '팬픽 서재' : 'TRPG 서고';

    document.getElementById('thExtra').style.display = cfg.hasExtraColumn ? '' : 'none';
    if(cfg.hasExtraColumn) document.getElementById('thExtra').firstChild.textContent = cfg.extraLabel + " ";
    document.getElementById('thSpoiler').style.display = cfg.hasSpoilerColumn ? '' : 'none';
    document.getElementById('subTabs').classList.toggle('show', cfg.hasSpoilerColumn);

    searchTerm = ""; document.getElementById('searchInput').value = "";
    statusFilter = "all";
    document.querySelectorAll('#statusToggle button').forEach(b => b.classList.toggle('active', b.dataset.status === 'all'));
    spoilerFilter = "all";
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.spoiler === 'all'));
    minRating = 0; renderRatingFilter();
    sortMode = "recent"; document.getElementById('sortSelect').value = "recent";
    currentPage = 1;
    allTags = rebuildTagState();
    renderTagCloud();
    render();
  });
});

document.getElementById('subTabs').addEventListener('click', e => {
  const btn = e.target.closest('.sub-tab');
  if(!btn) return;
  spoilerFilter = btn.dataset.spoiler;
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b === btn));
  currentPage = 1;
  render();
});

/* ================= 태그 클라우드 ================= */
const tagCloudEl = document.getElementById('tagCloud');
function renderTagCloud(){
  tagCloudEl.innerHTML = allTags.map(t => {
    const s = tagState[t];
    const cls = s === 1 ? 'include' : s === -1 ? 'exclude' : '';
    const mark = s === 1 ? '<span class="mark">✓</span>' : s === -1 ? '<span class="mark">✕</span>' : '';
    return `<button class="tag-chip ${cls}" data-tag="${t}">${mark}${t}</button>`;
  }).join('');
}
renderTagCloud();

tagCloudEl.addEventListener('click', e => {
  const btn = e.target.closest('.tag-chip');
  if(!btn) return;
  const t = btn.dataset.tag;
  tagState[t] = tagState[t] === 0 ? 1 : tagState[t] === 1 ? -1 : 0;
  currentPage = 1;
  renderTagCloud();
  render();
});

/* ================= 필터 컨트롤 ================= */
document.getElementById('searchInput').addEventListener('input', e => {
  searchTerm = e.target.value.trim().toLowerCase();
  currentPage = 1;
  render();
});
document.getElementById('sortSelect').addEventListener('change', e => {
  sortMode = e.target.value;
  render();
});
document.getElementById('statusToggle').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if(!btn) return;
  statusFilter = btn.dataset.status;
  document.querySelectorAll('#statusToggle button').forEach(b => b.classList.toggle('active', b === btn));
  currentPage = 1;
  render();
});
document.getElementById('ratingFilter').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const val = Number(btn.dataset.star);
  minRating = (minRating === val) ? 0 : val;
  renderRatingFilter();
  currentPage = 1;
  render();
});
function renderRatingFilter(){
  document.querySelectorAll('#ratingFilter button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.star) <= minRating);
  });
}
document.getElementById('clearFilters').addEventListener('click', () => {
  searchTerm = ""; document.getElementById('searchInput').value = "";
  statusFilter = "all";
  document.querySelectorAll('#statusToggle button').forEach(b => b.classList.toggle('active', b.dataset.status === 'all'));
  spoilerFilter = "all";
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.spoiler === 'all'));
  minRating = 0; renderRatingFilter();
  sortMode = "recent"; document.getElementById('sortSelect').value = "recent";
  allTags.forEach(t => tagState[t] = 0);
  renderTagCloud();
  currentPage = 1;
  render();
});
document.getElementById('pageSizeSelect').addEventListener('change', e => {
  pageSize = Number(e.target.value);
  currentPage = 1;
  render();
});

document.querySelectorAll('thead th[data-key]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    const map = {
      rating: sortMode === 'rating-desc' ? 'rating-asc' : 'rating-desc',
      title: 'title',
      category: 'title',
      extra: 'metric-desc',
      metric: 'metric-desc',
      completed: 'metric-desc'
    };
    sortMode = map[key] || 'recent';
    document.getElementById('sortSelect').value = sortMode;
    render();
  });
});

/* ================= 필터링 + 정렬 ================= */
function extractLeadingNumber(str){
  if(!str) return 0;
  const m = String(str).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function getFiltered(){
  const cfg = currentConfig();
  let list = cfg.data.filter(f => {
    if(searchTerm && !f.title.toLowerCase().includes(searchTerm)) return false;
    if(statusFilter === 'done' && !f.completed) return false;
    if(statusFilter === 'ongoing' && f.completed) return false;
    if(cfg.hasSpoilerColumn && spoilerFilter !== 'all' && f.spoiler !== spoilerFilter) return false;
    if(f.rating < minRating) return false;
    for(const tag in tagState){
      const s = tagState[tag];
      if(s === 1 && !f.tags.includes(tag)) return false;
      if(s === -1 && f.tags.includes(tag)) return false;
    }
    return true;
  });

  switch(sortMode){
    case 'rating-desc': list.sort((a,b)=>b.rating-a.rating); break;
    case 'rating-asc': list.sort((a,b)=>a.rating-b.rating); break;
    case 'title': list.sort((a,b)=>a.title.localeCompare(b.title,'ko')); break;
    case 'metric-desc':
      if(activeType === 'fanfic') list.sort((a,b)=>b.metricCurrent-a.metricCurrent);
      else list.sort((a,b)=>extractLeadingNumber(b.playerCount)-extractLeadingNumber(a.playerCount));
      break;
    default: break;
  }
  return list;
}

/* ================= 페이지네이션 UI ================= */
function renderPagination(totalItems){
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  const nav = document.getElementById('pageNav');

  const pages = [];
  const add = p => { if(!pages.includes(p)) pages.push(p); };
  add(1); add(totalPages);
  for(let p = currentPage-1; p <= currentPage+1; p++){ if(p>=1 && p<=totalPages) add(p); }
  pages.sort((a,b)=>a-b);

  let html = `<button ${currentPage===1?'disabled':''} data-page="${currentPage-1}">‹ 이전</button>`;
  let prev = 0;
  pages.forEach(p => {
    if(p - prev > 1) html += `<span class="ellipsis">…</span>`;
    html += `<button class="${p===currentPage?'current':''}" data-page="${p}">${p}</button>`;
    prev = p;
  });
  html += `<button ${currentPage===totalPages?'disabled':''} data-page="${currentPage+1}">다음 ›</button>`;
  nav.innerHTML = html;

  nav.querySelectorAll('button[data-page]').forEach(b => {
    b.addEventListener('click', () => {
      currentPage = Number(b.dataset.page);
      render();
    });
  });
  return totalPages;
}

/* ================= 메인 렌더 ================= */
function render(){
  const cfg = currentConfig();
  const filtered = getFiltered();
  const totalItems = filtered.length;
  renderPagination(totalItems);

  const start = (currentPage-1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById('statTotal').textContent = cfg.data.length;
  const rangeStart = totalItems === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + pageSize, totalItems);
  document.getElementById('resultCount').textContent = `${totalItems}개 중 ${rangeStart}–${rangeEnd} 표시`;
  document.getElementById('taskbarCount').textContent = `표시 중 ${totalItems} / 총 ${cfg.data.length}개`;

  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if(pageItems.length === 0){
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = pageItems.map((f) => {
    const key = `${activeType}::${f.title}`;
    const stars = f.rating > 0 ? ("★".repeat(f.rating) + "☆".repeat(5 - f.rating)) : "미평가";
    const metricLabel = activeType === 'fanfic'
      ? (f.metricTotal ? `${f.metricCurrent}/${f.metricTotal}` : `${f.metricCurrent}/?`)
      : f.playtime;
    const extraCell = cfg.hasExtraColumn ? `<td class="col-extra">${f.playerCount}</td>` : '';
    const spoilerCell = cfg.hasSpoilerColumn
      ? `<td class="col-spoiler">${f.spoiler === 'known' ? '🧠' : '🙈'}</td>` : '';
    const statusHtml = f.completed
      ? `<span class="status-pill done">${cfg.doneLabel}</span>`
      : `<span class="status-pill ongoing">${cfg.ongoingLabel}</span>`;
    const tagsHtml = f.tags.map(t => `<span class="mini-tag">${t}</span>`).join('');
    const isOpen = openKey === key;
    const colspan = 5 + (cfg.hasExtraColumn?1:0) + (cfg.hasSpoilerColumn?1:0) + 2;

    let rowHtml = `
      <tr class="data-row ${isOpen ? 'open' : ''}" data-key="${key}">
        <td class="col-link"><a class="link-btn" href="${f.link}" target="_blank" rel="noopener" title="원문 바로가기" onclick="event.stopPropagation()">↗</a></td>
        <td class="col-rating">${stars}</td>
        <td class="col-title">${f.title}</td>
        <td class="col-cat">${f.category}</td>
        ${extraCell}
        <td class="col-metric">${metricLabel}</td>
        <td>${statusHtml}</td>
        ${spoilerCell}
        <td><div class="col-tags">${tagsHtml}</div></td>
      </tr>`;

    if(isOpen){
      rowHtml += `
      <tr class="memo-row">
        <td colspan="${colspan}"><span class="memo-label">메모</span>${f.memo || '메모 없음'}</td>
      </tr>`;
    }
    return rowHtml;
  }).join('');

  tbody.querySelectorAll('tr.data-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const key = tr.dataset.key;
      openKey = (openKey === key) ? null : key;
      render();
    });
  });
}

/* ================= 시계 (장식용) ================= */
function tickClock(){
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clock').textContent = `${h}:${m}`;
}
tickClock();
setInterval(tickClock, 30000);

/* ================= 배경 장식 ================= */
const deco = document.getElementById('bgDeco');
const decoSymbols = ['✦','✧','☁'];
for(let i=0;i<10;i++){
  const s = document.createElement('span');
  s.textContent = decoSymbols[i % decoSymbols.length];
  s.style.left = Math.random()*100 + '%';
  s.style.top = Math.random()*90 + '%';
  s.style.fontSize = (10 + Math.random()*10) + 'px';
  s.style.opacity = 0.25 + Math.random()*0.35;
  deco.appendChild(s);
}
document.querySelectorAll('.type-tab[data-type="fanfic"]').forEach(el => el.style.display = 'none');
/* 초기 렌더 */
renderRatingFilter();
render();

