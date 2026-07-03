/* ============================================================
   앱 로직입니다. 데이터는 js/data.js 에서 가져오고,
   이 파일은 보통 건드리실 필요 없어요.
============================================================ */

const TRPG = TRPG_CURATED.concat(typeof DUMMY_TRPG !== 'undefined' ? DUMMY_TRPG : []);

/* ================= 설정 ================= */
const CONFIG = {
  windowTitle: "내 TRPG 시나리오 서고.exe",
  address: "local://trpg-library/index.html",
  brandTitle: "내 TRPG 시나리오 서고",
  brandSub: "플레이한(할) 시나리오를 시스템과 태그로 빠르게 찾기 위한 곳",
  data: TRPG
};

/* ================= 상태 ================= */
let searchTerm = "";
let sortMode = "recent";
let tagState = {};
let currentPage = 1;
let pageSize = 50;
let openKey = null;

function rebuildTagState(){
  tagState = {};
  const tags = [...new Set(CONFIG.data.flatMap(f => f.tags))].sort((a,b) => a.localeCompare(b, 'ko'));
  tags.forEach(t => tagState[t] = 0);
  return tags;
}
let allTags = rebuildTagState();

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

document.getElementById('clearFilters').addEventListener('click', () => {
  searchTerm = "";
  document.getElementById('searchInput').value = "";
  sortMode = "recent";
  document.getElementById('sortSelect').value = "recent";
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
      title: 'title',
      category: 'title',
      extra: 'metric-desc'
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
  let list = CONFIG.data.filter(f => {
    if(searchTerm && !f.title.toLowerCase().includes(searchTerm)) return false;
    for(const tag in tagState){
      const s = tagState[tag];
      if(s === 1 && !f.tags.includes(tag)) return false;
      if(s === -1 && f.tags.includes(tag)) return false;
    }
    return true;
  });

  switch(sortMode){
    case 'title':
      list.sort((a,b) => a.title.localeCompare(b.title, 'ko'));
      break;
    case 'metric-desc':
      list.sort((a,b) => extractLeadingNumber(b.playerCount) - extractLeadingNumber(a.playerCount));
      break;
    default:
      break;
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
  for(let p = currentPage - 1; p <= currentPage + 1; p++){
    if(p >= 1 && p <= totalPages) add(p);
  }
  pages.sort((a,b) => a - b);

  let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">이전</button>`;
  let prev = 0;
  pages.forEach(p => {
    if(p - prev > 1) html += `<span class="ellipsis">...</span>`;
    html += `<button class="${p === currentPage ? 'current' : ''}" data-page="${p}">${p}</button>`;
    prev = p;
  });
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">다음</button>`;
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
  const filtered = getFiltered();
  const totalItems = filtered.length;
  renderPagination(totalItems);

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById('statTotal').textContent = CONFIG.data.length;
  const rangeStart = totalItems === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + pageSize, totalItems);
  document.getElementById('resultCount').textContent = `${totalItems}개 중 ${rangeStart}~${rangeEnd} 표시`;
  document.getElementById('taskbarCount').textContent = `표시 중 ${totalItems} / 총 ${CONFIG.data.length}개`;

  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');

  if(pageItems.length === 0){
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  // 컬럼 수: 제목 + 시스템 + 인원 + 태그 = 4
  const colspan = 4;

  tbody.innerHTML = pageItems.map((f) => {
    const key = `trpg::${f.title}`;
    const tagsHtml = f.tags.map(t => `<span class="mini-tag">${t}</span>`).join('');
    const isOpen = openKey === key;
    const descHtml = (f.memo || '시나리오 설명 없음').replace(/\n/g, '<br>');

    let rowHtml = `
      <tr class="data-row ${isOpen ? 'open' : ''}" data-key="${key}">
        <td class="col-title">${f.title}</td>
        <td class="col-cat">${f.category}</td>
        <td class="col-extra">${f.playerCount}</td>
        <td><div class="col-tags">${tagsHtml}</div></td>
      </tr>`;

    if(isOpen){
      rowHtml += `
      <tr class="memo-row">
        <td colspan="${colspan}"><span class="memo-label">시나리오 설명</span>${descHtml}</td>
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

/* 초기 렌더 */
render();
