import { cases, modules, caseLibraryMeta } from './data.js';
import { createUniverse, createDnaScene } from './scene.js';
import { theme as dnaTheme, describeNode } from './dna-theme.js';
import { filterCases, resolveCanvasNodes, safeSourceUrl, readWorkspace, saveWorkspace } from './case-experience.js';
import { buildCaseMap, buildNodeMap } from './asset-map.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const navRoots = document.querySelectorAll('[data-nav]');

const navigation = [
  { id: 'home', label: '星球', icon: 'orbit' },
  { id: 'cases', label: '案例', icon: 'library' },
  { id: 'ai', label: '案例演示', icon: 'sparkles' },
  { id: 'canvas', label: '画布', icon: 'nodes' },
  { id: 'profile', label: '我的', icon: 'user' },
];

const state = {
  activeTab: 'home',
  caseFilter: '全部',
  caseAccess: 'all',
  caseKeyword: '',
  savedOnly: false,
  favorites: [],
  recentCases: [],
  detailCase: null,
  selectedNode: null,
  canvasNodes: ['exposure', 'traffic', 'conversion', 'transaction', 'delivery', 'risk'],
  savedStages: [],
  demoStatus: 'idle',
  demoCaseId: cases[0]?.id || '',
  validationOpen: false,
  validationChecks: [false, false, false, false, false, false, false],
  validationNotes: ['', '', '', '', '', '', ''],
  validationDecision: 'pending',
};

try {
  Object.assign(state, readWorkspace(
    localStorage,
    new Set(cases.map(item => item.id)),
    new Set([...modules.map(item => item.id), ...cases.flatMap(item => item.nodes.map(node => node.id))]),
    new Set(cases.flatMap(item => item.businessNodes.map(node => node.id))),
  ));
} catch { /* Browsing remains available when storage is disabled. */ }

function persist() {
  try { if (saveWorkspace(localStorage, state)) return true; } catch { /* Private mode can deny storage access. */ }
  showToast('浏览器存储不可用，本次更改仅在当前页面保留');
  return false;
}

let cleanup = () => {};
let activeDna = null;
let timers = [];
let toastTimer = 0;

const freeCases = cases.filter((item) => !item.locked);
const featuredCase = freeCases[0] || cases[0];
const caseFilters = ['全部', ...new Set(cases.flatMap(item => item.tags))];

function bookmarkMarkup(item) {
  const saved = state.favorites.includes(item.id);
  return `<button class="icon-button ${saved ? 'is-saved' : ''}" data-action="bookmark" aria-pressed="${saved}" aria-label="${saved ? '取消收藏' : '收藏案例'}">${icon('bookmark')}</button>`;
}

function sourcesMarkup(item) {
  const sources = item.proofSources.map(source => ({ ...source, safeUrl: safeSourceUrl(source.url) })).filter(source => source.safeUrl);
  return `<section class="source-panel" aria-label="这条案例的公开证据"><div class="source-panel-head"><h2>这条案例的公开证据</h2><span>${escapeHtml(item.sourceStatusLabel)} · ${escapeHtml(item.evidenceCheckedOn)}</span></div><p><strong>当时核对到：</strong>${escapeHtml(item.originalEvidence)}</p><div class="proof-list">${sources.map((source, index) => `<div class="proof-source"><strong>来源 ${index + 1}：${escapeHtml(source.label)}</strong><small>${escapeHtml(source.publisher)} · ${escapeHtml(source.access)} · ${escapeHtml(source.checkedOn)}</small><a href="${escapeHtml(source.safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.safeUrl)} ↗</a></div>`).join('') || '<p>暂无可打开的来源链接，请先补充依据。</p>'}</div><p class="proof-boundary">证明范围：公开页面可见的产品或服务信息；不等于独立审计过的成交、利润或复购。购买动机与七关是编辑分析。索引线索不等同于已直接打开官方页面。</p></section>`;
}

function businessBriefMarkup(item) {
  return `<section class="business-brief" aria-label="一眼看懂这笔生意"><h2>这到底是一门什么生意？</h2><dl><div><dt>卖什么</dt><dd>${escapeHtml(item.offer)}</dd></div><div><dt>谁付钱</dt><dd>${escapeHtml(item.payer)}</dd></div><div class="buying-reason"><dt>买点：为什么愿意付钱 <small>分析，不是成交证明</small></dt><dd>${escapeHtml(item.purchaseReason)}</dd></div></dl></section>`;
}

function icon(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function assetMapMarkup(map, interactive = false) {
  const root = map.root;
  const mode = interactive ? 'case' : 'node';
  return `<div class="connected-map connected-map--${mode}${interactive ? '' : ' asset-card-detail'}" data-asset-map="${mode}" role="group" aria-label="${escapeHtml(root.title)}的资产关系导图">
    <div class="connected-map-root" style="--asset-color:${escapeHtml(root.color)}"><span>${interactive ? '案例根节点' : '阶段根节点'}</span><strong>${escapeHtml(root.title)}</strong>${root.subtitle ? `<p>${escapeHtml(root.subtitle)}</p>` : ''}</div>
    <ol class="connected-map-branches" aria-label="${interactive ? '按顺序展开的阶段资产卡' : '阶段内容与可复用资产'}">${map.branches.map(branch => {
      const heading = `<span class="connected-map-card-heading">${branch.number ? `<span class="connected-map-number">${escapeHtml(branch.number)}</span>` : ''}<strong>${escapeHtml(branch.title)}</strong>${interactive ? '<span class="connected-map-open" aria-hidden="true">↗</span>' : ''}</span>`;
      const summary = branch.summary ? `<span class="connected-map-summary">${escapeHtml(branch.summary)}</span>` : '';
      const values = Array.isArray(branch.items) ? branch.items : [];
      const items = values.length ? interactive
        ? `<span class="connected-map-items" role="list" aria-label="${escapeHtml(branch.title)}的资产类别">${values.map(value => `<span role="listitem">${escapeHtml(value)}</span>`).join('')}</span>`
        : `<ul class="connected-map-items" aria-label="${escapeHtml(branch.title)}的具体内容">${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '';
      return `<li class="connected-map-branch" style="--asset-color:${escapeHtml(branch.color)}"><span class="connected-map-wire" aria-hidden="true"></span>${interactive ? `<button class="connected-map-card" data-node-id="${escapeHtml(branch.id)}" aria-label="查看第${escapeHtml(branch.number)}阶段：${escapeHtml(branch.title)}">${heading}${summary}${items}</button>` : `<div class="connected-map-card">${heading}${summary}${items}</div>`}</li>`;
    }).join('')}</ol>
  </div>`;
}

function clearRuntime() {
  cleanup();
  cleanup = () => {};
  timers.forEach(clearTimeout);
  timers = [];
  toast.classList.remove('show');
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function navMarkup() {
  return navigation.map((item) => `
    <button class="nav-item ${state.activeTab === item.id ? 'active' : ''}" data-tab="${item.id}" aria-current="${state.activeTab === item.id ? 'page' : 'false'}">
      ${icon(item.icon)}<span>${item.label}</span>
    </button>
  `).join('');
}

function syncNav() {
  navRoots.forEach((root) => { root.innerHTML = navMarkup(); });
}

function pageHeader(title, subtitle, action = '') {
  return `
    <header class="page-header">
      <div><p class="eyebrow">QINGCHUANG / LAB</p><h1>${title}</h1><p>${subtitle}</p></div>
      ${action || `<button class="icon-button" data-action="notify" aria-label="通知">${icon('bell')}<span class="notification-dot"></span></button>`}
    </header>
  `;
}

function renderHome() {
  app.innerHTML = `
    <section class="page home-page">
      ${pageHeader('轻创拼拼', '看懂商业项目，从卖点到交付收款')}
      <div class="home-stage">
        <section class="hero-thesis" aria-label="项目探索入口">
          <p class="eyebrow">普通人 · 低成本起步优先</p>
          <h2>一门生意如何运转？<br /><span>先把交易链路看明白</span></h2>
          <p class="hero-summary">卖什么、谁愿意买、为什么买，最后怎么交付、怎么收钱。</p>
          <div class="hero-audience"><span>${caseLibraryMeta.total} 个已收录目录</span><span>${caseLibraryMeta.free} 个免费完整案例</span></div>
          <div class="hero-actions">
            <button class="primary-button" data-action="starter-cases">低成本项目优先 ${icon('chevron-right')}</button>
            <button class="hero-secondary" data-case-id="${featuredCase.id}">打开一个完整案例</button>
          </div>
          <p class="home-scope">当前样本偏数字产品，尚未覆盖全行业。收录表示有公开经营资料，不等于已核实盈利。</p>
          <div class="home-reading-guide"><h3>每个案例先回答</h3><p>① 卖什么给谁<br />② 对方为什么付钱<br />③ 去哪里找到买家<br />④ 交付什么、钱如何到账</p><button class="quiet-action" data-tab="cases">浏览全部目录 →</button></div>
        </section>
        <div class="universe-stage product-hero">
          <canvas id="universe-canvas" aria-label="固定区域内的${caseLibraryMeta.total}案例星球，全部免费阅读全文"></canvas>
          <div class="universe-controls" role="group" aria-label="案例星球视图控制">
            <button type="button" data-universe-control="pause" aria-pressed="false">暂停公转</button>
            <button type="button" data-universe-control="reset">恢复视角</button>
          </div>
          <div class="hero-live"><span><i class="pulse-dot"></i>每颗小星球 = 1 个案例</span><span>${caseLibraryMeta.free} 个案例全部免费阅读</span><span>拖动旋转 · 点击案例 · 星球区域不会随页面上下滚动</span></div>
        </div>
      </div>
    </section>
  `;
  const canvas = document.querySelector('#universe-canvas');
  const universe = createUniverse(canvas, cases, caseId => caseId === 'core' ? switchTab('cases') : openCase(caseId));
  const pauseButton = document.querySelector('[data-universe-control="pause"]');
  const resetButton = document.querySelector('[data-universe-control="reset"]');
  if (!pauseButton || !resetButton) { cleanup = universe; return; }
  const reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const syncPauseButton = () => {
    const paused = universe.isPaused();
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.textContent = reduced ? '静态浏览' : paused ? '继续公转' : '暂停公转';
    pauseButton.disabled = reduced;
    if (reduced) pauseButton.title = '已跟随系统设置减少动态，仍可拖动查看星球';
  };
  const togglePause = () => {
    universe.setPaused(!universe.isPaused());
    syncPauseButton();
  };
  const resetView = () => { universe.resetView(); showToast('已恢复初始视角'); };
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', resetView);
  syncPauseButton();
  cleanup = () => {
    pauseButton.removeEventListener('click', togglePause);
    resetButton.removeEventListener('click', resetView);
    universe();
  };
}

function renderCases() {
  // Old paid/free selections must not hide content after the free-first migration.
  state.caseAccess = 'all';
  const filtered = filterCases(cases, { keyword: state.caseKeyword, access: state.caseAccess, tag: state.caseFilter, savedOnly: state.savedOnly, favorites: state.favorites });
  const showFeature = !state.caseKeyword.trim() && state.caseAccess === 'all' && state.caseFilter === '全部' && !state.savedOnly;
  app.innerHTML = `
    <section class="page cases-page">
      ${pageHeader('商业项目案例库', `${caseLibraryMeta.total}个目录 · 看清买家、卖点、交付和收款`)}
      <button class="filter-chip" data-action="starter-cases">低成本试做优先</button>
      <p class="case-access-note">当前 ${caseLibraryMeta.free} 个案例全部免费；${caseLibraryMeta.officialPageCount} 条有官方公开页面记录，${caseLibraryMeta.indexOnlyCount} 条仅有官方页面索引线索。详情可查原始来源；经营结果未经独立审计。</p>
      <div class="case-search"><label for="case-search">搜索名称、行业或价值主张<input id="case-search" type="search" value="${escapeHtml(state.caseKeyword)}" placeholder="例如：内容、社区、工具" autocomplete="off" /></label><button class="quiet-action" data-action="reset-cases">重置筛选</button></div>
      <div class="filter-bar" role="group" aria-label="收藏筛选">
        <button class="filter-chip ${state.savedOnly ? 'active' : ''}" data-action="saved-cases" aria-pressed="${state.savedOnly}">我的收藏 (${state.favorites.length})</button>
      </div>
      <div class="filter-bar" role="group" aria-label="案例标签">
        ${caseFilters.map((filter) => `<button class="filter-chip ${filter === state.caseFilter ? 'active' : ''}" data-filter="${filter}" aria-pressed="${filter === state.caseFilter}">${filter}</button>`).join('')}
      </div>
      ${showFeature ? `<div class="case-feature">
        <div class="case-feature-visual">
          <span class="case-number">01</span>
          <div class="case-orbit-art"><i></i><i></i><i></i><b></b><em></em><em></em><em></em></div>
        </div>
        <div class="case-feature-copy">
          <p class="eyebrow">FREE CASE / SEVEN-STAGE DNA</p>
          <h2>${featuredCase.title}</h2>
          <p>${featuredCase.value}</p>
          <div class="tag-row"><span>${featuredCase.industry}</span><span>${featuredCase.accessLabel}</span><span>${escapeHtml(featuredCase.sourceStatusLabel)} · ${escapeHtml(featuredCase.evidenceCheckedOn)}</span></div>
          <button class="primary-button" data-case-id="${featuredCase.id}">查看七关 DNA ${icon('chevron-right')}</button>
        </div>
        <div class="score-seal"><strong>${caseLibraryMeta.free}</strong><small>免费全文</small></div>
      </div>` : ''}
      <section class="content-section">
        <div class="section-heading"><div><p class="eyebrow">CASE INDEX</p><h2>${state.savedOnly ? '我的收藏' : state.caseFilter + '案例'}</h2></div><span class="case-results" role="status">找到 ${filtered.length} / ${cases.length} 个案例</span></div>
        <div class="case-grid">
          ${filtered.length ? '' : '<div class="empty-state"><strong>没有匹配的案例</strong><p>试试缩短关键词，或清除标签与收藏筛选。</p><button class="secondary-button" data-action="reset-cases">查看全部案例</button></div>'}
          ${filtered.map((item, index) => `
            <button class="case-card is-free" data-case-id="${item.id}" aria-label="${escapeHtml(item.title)}，免费全文">
              <span class="case-card-index">${String(index + 1).padStart(2, '0')}</span>
              <div class="case-card-head"><span>${item.industry}</span><strong>免费全文</strong></div>
              <h3>${item.title}</h3>
              <span class="case-evidence ${item.sourceTier === 'official_index' ? 'is-index' : ''}">${escapeHtml(item.sourceStatusLabel)} · ${escapeHtml(item.evidenceCheckedOn)}</span>
              <p class="case-offer"><b>卖什么</b> ${escapeHtml(item.offer)}</p>
              <p class="case-payer"><b>谁付钱</b> ${escapeHtml(item.payer)}</p>
              <div class="case-card-foot"><span>查看七关拆解</span><span>${item.difficultyLabel.split('：')[0]}</span>${icon('chevron-right')}</div>
            </button>
          `).join('')}
        </div>
      </section>
    </section>
  `;
  document.querySelector('#case-search')?.addEventListener('input', event => {
    if (event.isComposing) return;
    const input = event.currentTarget;
    const position = input.selectionStart;
    state.caseKeyword = input.value;
    renderCases();
    const replacement = document.querySelector('#case-search');
    replacement.focus({ preventScroll: true });
    try { replacement.setSelectionRange(position, position); } catch { /* Some search inputs do not expose a caret. */ }
  });
  document.querySelector('#case-search')?.addEventListener('compositionend', event => event.currentTarget.dispatchEvent(new Event('input')));
}

function openCase(caseId) {
  const item = cases.find((entry) => entry.id === caseId);
  if (!item) { showToast('案例不存在，请返回案例库选择'); return; }
  state.detailCase = item;
  state.recentCases = [state.detailCase.id, ...state.recentCases.filter(id => id !== state.detailCase.id)].slice(0, 12);
  persist();
  state.selectedNode = null;
  clearRuntime();
  renderCaseDetail();
  app.scrollTop = 0;
  app.focus({ preventScroll: true });
}

function renderCaseDetail() {
  const item = state.detailCase || cases[0];
  if (!item.nodes.length) {
    app.innerHTML = `
      <section class="page case-detail-page">
        <header class="detail-header">
          <button class="icon-button" data-action="close-case" aria-label="返回案例库">${icon('arrow-left')}</button>
          <div><p class="eyebrow">CASE / ${item.id.toUpperCase()}</p><h1>${item.title}</h1></div>
          ${bookmarkMarkup(item)}
        </header>
        <section class="empty-state" role="status"><h2>案例正文暂不可用</h2><p>这不是付费限制，请返回案例库选择其他案例。</p><button class="primary-button" data-action="free-cases">返回案例库</button></section>
      </section>
    `;
    activeDna = null;
    cleanup = () => {};
    return;
  }

  const editorialNodes = item.nodes;
  const nodes = item.businessNodes?.length ? item.businessNodes : editorialNodes;
  app.innerHTML = `
    <section class="page case-detail-page" style="--dna-a:${dnaTheme.chains.A.color};--dna-b:${dnaTheme.chains.B.color}">
      <header class="detail-header">
        <button class="icon-button" data-action="close-case" aria-label="返回案例库">${icon('arrow-left')}</button>
        <div><p class="eyebrow">CASE / ${item.id.toUpperCase()}</p><h1>${item.title}</h1></div>
        ${bookmarkMarkup(item)}
      </header>
      ${sourcesMarkup(item)}
      ${businessBriefMarkup(item)}
      <section class="trade-summary" aria-label="交付与收钱"><h2>最后交付什么，钱怎么收？</h2><dl><div><dt>交付物</dt><dd>${escapeHtml(item.delivery)}</dd></div><div><dt>收费方式</dt><dd>${escapeHtml(item.chargingModel)}</dd></div><div><dt>钱的去向</dt><dd>${escapeHtml(item.moneyFlow)}</dd></div><div><dt>起步需要的能力</dt><dd>${escapeHtml(item.entryRequirements)}</dd></div></dl><p>低成本不等于零技能。以下是经营结构分析；收款时点、实际到账与净利润应以原企业账目为准。</p></section>
      <section class="transaction-story" aria-label="从卖点到收款的完整过程"><h2>从卖点到交付、收款</h2><ol>${editorialNodes.map(node => `<li><h3>${escapeHtml(node.name)}</h3><p>${escapeHtml(node.method)}</p></li>`).join('')}</ol></section>
      <h2 class="dna-heading">商业 DNA · 辅助理解，不代替案例正文</h2>
      <div class="dna-layout">
        <section class="dna-stage">
          <canvas id="dna-canvas" aria-label="可旋转缩放并点击节点的商业 DNA 双螺旋"></canvas>
          <div class="dna-axis"><span>${dnaTheme.chains.A.label}</span><i></i><span>${dnaTheme.chains.B.label}</span></div>
          <div class="dna-controls" aria-label="DNA视图控制">
            <button class="icon-button" data-dna="reset" aria-label="复位视图" title="复位视图">${icon('rotate')}</button>
            <button class="icon-button" data-dna="in" aria-label="放大" title="放大">${icon('zoom-in')}</button>
            <button class="icon-button" data-dna="out" aria-label="缩小" title="缩小">${icon('zoom-out')}</button>
          </div>
          <div class="dna-score"><span>公开资料</span><strong>${escapeHtml(item.sourceStatusLabel)}</strong><small>经营结果以实际账目为准</small></div>
        </section>
        <aside class="case-intel">
          <p class="eyebrow">SEVEN-STAGE BUSINESS SEQUENCE</p>
          <h2>七阶段商业链路</h2>
          <p class="case-value">${item.value}</p>
          <div class="chain-flow">${nodes.map((node, index) => `<button data-node-id="${node.id}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${node.name}</strong><small>${node.method}</small></span></button>`).join('')}</div>
          <div class="compliance-note">${icon('shield')}<div><strong>合规边界</strong><p>${item.compliance}</p></div></div>
        </aside>
      </div>
      <div class="dna-stage-legend" aria-label="创业阶段配色">${Object.entries(dnaTheme.stages).map(([id, stage]) => `<span data-stage-color="${id}"><i style="background:${stage.color}"></i>${stage.label}</span>`).join('')}</div>
      <section class="node-index">
        <div class="section-heading"><div><p class="eyebrow">CONNECTED ASSET MAP</p><h2>阶段资产导图</h2></div><span class="result-count">沿导线查看七阶段，点击卡片展开资产</span></div>
        ${assetMapMarkup(buildCaseMap(item.title, nodes), true)}
      </section>
      <div class="detail-next"><button class="primary-button" data-action="case-to-canvas">把这份案例的七关加入画布 ${icon('nodes')}</button><button class="secondary-button" data-tab="canvas">查看我的画布</button></div>
      <div id="node-sheet"></div>
    </section>
  `;
  const dnaApi = createDnaScene(document.querySelector('#dna-canvas'), nodes, openNode);
  activeDna = dnaApi;
  cleanup = () => { dnaApi.destroy(); activeDna = null; };
  document.querySelectorAll('[data-dna]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.dna === 'in') dnaApi.zoom(-1.5);
      if (button.dataset.dna === 'out') dnaApi.zoom(1.5);
      if (button.dataset.dna === 'reset') dnaApi.reset();
    });
  });
}

function openNode(node) {
  const caseNodes = [
    ...(state.detailCase?.businessNodes || []),
    ...(state.detailCase?.nodes || []),
  ];
  const raw = typeof node === 'string' ? caseNodes.find((item) => item.id === node) : node;
  state.selectedNode = raw ? describeNode(raw, raw.visualChain || 'A') : null;
  const sheet = document.querySelector('#node-sheet');
  if (!sheet || !state.selectedNode) return;
  const item = state.selectedNode;
  const card = raw?.assetCard;
  const isBusinessStage = Boolean(card);
  const saved = state.savedStages.includes(item.id);
  activeDna?.setSelected(item.id, item.visualChain);
  sheet.innerHTML = `
    <div class="sheet-mask" data-sheet-mask>
      <section class="node-sheet" role="dialog" aria-modal="true" aria-labelledby="node-title">
        <div class="sheet-accent" style="--node-color:${item.color}"></div>
        <header><div><p class="eyebrow">${item.stageLabel} · ${item.visualChainLabel}</p><h2 id="node-title">${item.name}</h2></div><button class="icon-button" data-action="close-node" aria-label="关闭">${icon('x')}</button></header>
        <p class="evidence-note">来自：${escapeHtml(state.detailCase?.title || item.sourceTitle || '内置案例')}<br />整案实验成本：${escapeHtml(state.detailCase?.costLabel || item.costLabel || '待核算')}<br />阶段拆解是编辑分析参考，不是已验证收益。</p>
        ${assetMapMarkup(buildNodeMap(raw || item))}
        ${isBusinessStage ? `<button class="primary-button full" data-save-stage="${item.id}">${saved ? '已保存到本地工作台' : '保存阶段资产卡'} ${saved ? icon('check') : icon('bookmark')}</button>` : `<button class="primary-button full" data-add-node="${item.id}">${state.canvasNodes.includes(item.id) ? '此案例节点已在画布' : '保留案例内容，加入画布'} ${icon('plus')}</button>`}
      </section>
    </div>
  `;
  requestAnimationFrame(() => sheet.querySelector('.sheet-mask')?.classList.add('visible'));
  sheet.querySelector('.sheet-mask')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeNodeSheet();
    }
  });
  sheet.querySelector('.node-sheet .icon-button')?.focus();
}

function closeNodeSheet() {
  const previousId = state.selectedNode?.id;
  const sheet = document.querySelector('#node-sheet');
  if (sheet) sheet.innerHTML = '';
  state.selectedNode = null;
  activeDna?.setSelected('');
  if (previousId) document.querySelector(`[data-node-id="${previousId}"]`)?.focus({ preventScroll: true });
}

function renderCaseDemo() {
  const selectedCase = cases.find(item => item.id === state.demoCaseId) || cases[0];
  const demoNodes = selectedCase?.businessNodes?.length ? selectedCase.businessNodes : selectedCase?.nodes || [];
  const isLoading = state.demoStatus === 'loading';
  const isReady = state.demoStatus === 'done';
  const loadingSteps = ['读取内置案例', '整理七阶段商业路径', '准备公开来源'];

  app.innerHTML = `
    <section class="page case-demo-page">
      ${pageHeader('内置案例演示', `从 ${caseLibraryMeta.total} 个预置案例中查看商业 DNA`, `<span class="local-demo-badge"><i></i>LOCAL DATA / OFFLINE</span>`)}
      <div class="ai-workspace case-demo-workspace">
        <section class="prompt-workbench case-demo-picker">
          <div class="workbench-head"><span>01 / 选择内置案例</span><span>${isLoading ? '本地载入中' : isReady ? '案例已载入' : '等待选择'}</span></div>
          <label for="demo-case-select">
            <span>案例名称</span>
            <select id="demo-case-select" ${isLoading ? 'disabled' : ''}>
              ${cases.map(item => `<option value="${item.id}" ${item.id === selectedCase.id ? 'selected' : ''}>${escapeHtml(item.title)} · ${escapeHtml(item.industry)}</option>`).join('')}
            </select>
          </label>
          <div class="demo-case-summary">
            <span>${escapeHtml(selectedCase.industry)}</span>
            <h2>${escapeHtml(selectedCase.title)}</h2>
            <p>${escapeHtml(selectedCase.value)}</p>
          </div>
          <p class="demo-boundary"><strong>演示边界</strong> 全部内容均已预置在本地案例库。本页不接收文本、网页、图片或 PDF，不调用外部接口，也不进行智能计算。</p>
          <div class="prompt-foot">
            <span>${caseLibraryMeta.free} / ${caseLibraryMeta.total} 个案例免费可用</span>
            <button class="primary-button" data-action="start-demo" ${isLoading ? 'disabled' : ''}>${isLoading ? '正在载入' : isReady ? '重新载入' : '载入案例'} ${icon('play')}</button>
          </div>
        </section>
        <section class="reasoning-panel demo-loading-panel" aria-live="polite" aria-busy="${isLoading}">
          <div class="reasoning-orbit ${isLoading ? 'running' : ''}"><i></i><i></i><i></i><span>${icon('library')}</span></div>
          <p class="eyebrow">LOCAL CASE LOADER</p>
          <h2>${isLoading ? '正在读取本地案例' : isReady ? '案例资料已准备好' : '选择后即可开始演示'}</h2>
          <div class="pipeline">
            ${loadingSteps.map((step, index) => `<div class="pipeline-step ${isReady ? 'done' : isLoading && index === 0 ? 'active' : ''}"><span>${isReady ? icon('check') : String(index + 1).padStart(2, '0')}</span><div><strong>${step}</strong><i></i></div></div>`).join('')}
          </div>
        </section>
      </div>
      ${isReady ? `
        <section class="ai-result case-demo-result">
          <div class="section-heading"><div><p class="eyebrow">CASE PRESET / LOCAL DATA</p><h2>${escapeHtml(selectedCase.title)}</h2></div><span class="result-score"><b>7</b> 个商业阶段</span></div>
          <div class="result-grid">
            <div><span>提供什么</span><strong>${escapeHtml(selectedCase.offer)}</strong><p>${escapeHtml(selectedCase.value)}</p></div>
            <div><span>谁来付费</span><strong>${escapeHtml(selectedCase.payer)}</strong><p>${escapeHtml(selectedCase.purchaseReason)}</p></div>
            <div><span>试做成本</span><strong>${escapeHtml(selectedCase.costLabel)}</strong><p>整案实验口径，节点成本与收益仍需自行验证。</p></div>
          </div>
          <div class="demo-dna-layout" style="--dna-a:${dnaTheme.chains.A.color};--dna-b:${dnaTheme.chains.B.color}">
            <section class="demo-dna-stage">
              <canvas id="demo-dna-canvas" aria-label="${escapeHtml(selectedCase.title)}的七阶段商业 DNA，可旋转缩放并点击节点"></canvas>
              <div class="dna-axis"><span>${dnaTheme.chains.A.label}</span><i></i><span>${dnaTheme.chains.B.label}</span></div>
              <div class="dna-controls" aria-label="DNA视图控制">
                <button class="icon-button" data-demo-dna="reset" aria-label="复位视图" title="复位视图">${icon('rotate')}</button>
                <button class="icon-button" data-demo-dna="in" aria-label="放大" title="放大">${icon('zoom-in')}</button>
                <button class="icon-button" data-demo-dna="out" aria-label="缩小" title="缩小">${icon('zoom-out')}</button>
              </div>
            </section>
            <aside class="case-intel demo-stage-list">
              <p class="eyebrow">PUBLIC → PRIVATE</p>
              <h2>七阶段商业路径</h2>
              <div class="chain-flow">${demoNodes.map((node, index) => `<button data-node-id="${node.id}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.method)}</small></span></button>`).join('')}</div>
            </aside>
          </div>
          ${sourcesMarkup(selectedCase)}
          <div class="demo-result-actions"><button class="primary-button" data-action="demo-to-canvas">把该案例七关加入画布 ${icon('nodes')}</button><button class="secondary-button" data-case-id="${selectedCase.id}">查看完整案例与来源</button></div>
          <div id="node-sheet"></div>
        </section>
      ` : ''}
    </section>
  `;

  if (!isReady || !demoNodes.length) return;
  state.detailCase = selectedCase;
  const dnaApi = createDnaScene(document.querySelector('#demo-dna-canvas'), demoNodes, openNode);
  activeDna = dnaApi;
  cleanup = () => { dnaApi.destroy(); activeDna = null; };
  document.querySelectorAll('[data-demo-dna]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.demoDna === 'in') dnaApi.zoom(-1.5);
      if (button.dataset.demoDna === 'out') dnaApi.zoom(1.5);
      if (button.dataset.demoDna === 'reset') dnaApi.reset();
    });
  });
}

function startCaseDemo() {
  const selectedCase = cases.find(item => item.id === state.demoCaseId) || cases[0];
  if (!selectedCase) {
    showToast('内置案例暂不可用');
    return;
  }
  clearRuntime();
  state.detailCase = selectedCase;
  state.demoStatus = 'loading';
  renderCaseDemo();
  const doneTimer = setTimeout(() => {
    state.demoStatus = 'done';
    renderCaseDemo();
    document.querySelector('.case-demo-result')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, 620);
  timers.push(doneTimer);
}

function canvasScore() {
  const selected = resolveCanvasNodes(state.canvasNodes, cases, modules);
  const types = new Set(selected.map(item => item.type || item.id));
  const completeness = Math.round((types.size / modules.length) * 100);
  const estimates = modules.filter(item => types.has(item.id));
  const avgRisk = estimates.length ? estimates.reduce((sum, item) => sum + item.risk, 0) / estimates.length : 50;
  const hasCore = ['exposure', 'conversion', 'transaction', 'delivery'].filter(id => types.has(id)).length;
  const score = Math.round(Math.min(96, completeness * 0.5 + hasCore * 8 + (100 - avgRisk) * 0.18));
  const sourced = selected.some(item => item.sourceCaseId);
  return { completeness, score, cost: sourced ? '待核算' : `¥${estimates.reduce((sum, item) => sum + item.cost, 0)}`, risk: sourced ? '待评估' : Math.round(avgRisk), sourced };
}

function renderCanvas() {
  const metrics = canvasScore();
  const selected = resolveCanvasNodes(state.canvasNodes, cases, modules);
  app.innerHTML = `
    <section class="page canvas-page">
      ${pageHeader('商业画布', '保留案例方法与来源，组合自己的验证路径')}
      <p class="local-note">保存在当前浏览器，不跨设备同步。完整度仅表示环节覆盖；演示评分不代表盈利概率。案例节点的成本与风险需要另行核算。</p>
      <div class="canvas-summary">
        <div class="score-gauge" style="--score:${metrics.score * 3.6}deg"><div><strong>${metrics.sourced ? '—' : metrics.score}</strong><span>${metrics.sourced ? '方案待实测' : '演示分'}</span></div></div>
        <div class="canvas-metrics"><span><small>环节覆盖</small><strong>${metrics.completeness}%</strong></span><span><small>${metrics.sourced ? '整案成本' : '模板成本示例'}</small><strong>${metrics.cost}</strong></span><span><small>${metrics.sourced ? '实际风险' : '模板风险示例'}</small><strong>${metrics.risk}</strong></span></div>
        <div class="canvas-diagnosis"><p class="eyebrow">NEXT EXPERIMENT</p><strong>先核实需求，再验证首次成交</strong><p>节点齐全不等于业务成立。请检查目标用户、交付边界与现实成本。</p><button class="primary-button" data-action="open-validation">打开 7 天验证清单 ${icon('chevron-right')}</button></div>
      </div>
      <section class="flow-board" aria-label="当前商业节点">
        <div class="flow-board-head"><div><span>当前方案</span><strong>我的案例组合 / 本地草案</strong></div><span>${selected.length} NODES</span></div>
        <div class="flow-track">
          ${selected.length ? selected.map((item, index) => `
            <div class="flow-node">
              <span class="node-order">${String(index + 1).padStart(2, '0')}</span>
              <i style="--node-color:${item.color}"></i>
              <strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.hint)}</small>${item.sourceCaseId ? `<small class="source-label">来自：${escapeHtml(item.sourceTitle)}</small><small>可复用：${escapeHtml(item.reuse)}</small><button class="source-open" data-case-id="${item.sourceCaseId}">查看来源案例</button>` : '<small class="source-label">通用演示模板</small>'}
              <button data-remove-node="${item.id}" aria-label="移除${item.name}" title="移除${item.name}">${icon('x')}</button>
            </div>
            ${index < selected.length - 1 ? '<span class="flow-link"></span>' : ''}
          `).join('') : '<div class="empty-state"><strong>画布还没有节点</strong><p>从下方节点库选择第一个商业环节。</p></div>'}
        </div>
      </section>
      <section class="module-library">
        <div class="section-heading"><div><p class="eyebrow">MODULE LIBRARY</p><h2>可用节点</h2></div><button class="quiet-action" data-action="clear-canvas">清空画布</button></div>
        <div class="module-grid">
          ${modules.map((item) => `
            <button class="module-item ${state.canvasNodes.includes(item.id) ? 'selected' : ''}" data-toggle-node="${item.id}" aria-pressed="${state.canvasNodes.includes(item.id)}">
              <i style="--node-color:${item.color}"></i><span><strong>${item.name}</strong><small>${item.chain} · 风险 ${item.risk}</small></span>${state.canvasNodes.includes(item.id) ? icon('check') : icon('plus')}
            </button>
          `).join('')}
        </div>
      </section>
    </section>
  `;
}

function validationProgress() {
  const completed = state.validationChecks.filter(Boolean).length;
  return { completed, percent: Math.round((completed / state.validationChecks.length) * 100) };
}

function renderValidation() {
  const metrics = canvasScore();
  const progress = validationProgress();
  const tasks = [
    ['表面现象', '用不超过 50 字写清这条商业主线。'],
    ['用户痛点', '找 5 位目标用户，确认问题是否真实存在。'],
    ['最小交付', '完成 1 页样张或 1 个最小可用模板。'],
    ['理解测试', '配 3 张原理卡，请用户复述其中的逻辑。'],
    ['付费测试', '写清谁付钱、为什么付、测试价格是多少。'],
    ['风险边界', '删除侵权、夸大、违规和无法交付的部分。'],
    ['成交验证', '向 10 位目标用户展示样品并进行真实报价。'],
  ];
  app.innerHTML = `
    <section class="page validation-page">
      ${pageHeader('7 天验证方案', '通用行动模板 · 请根据所选案例调整', `<button class="secondary-button" data-action="back-validation">← 返回画布</button>`)}
      <section class="validation-progress">
        <div class="progress-orbit" style="--progress:${progress.percent * 3.6}deg"><div><strong>${progress.completed}/7</strong><span>已完成</span></div></div>
        <div><p class="eyebrow">VALIDATION STATUS / ${state.validationDecision.toUpperCase()}</p><h2>先验证需求，再继续投入</h2><p>这是预置的通用七天清单，并非针对当前案例动态生成。每完成一关，记录人数、原话、报价或支付证据。</p><div class="progress-line"><i style="width:${progress.percent}%"></i></div></div>
        <dl><div><dt>环节覆盖</dt><dd>${metrics.completeness}%</dd></div><div><dt>风险参考</dt><dd>${metrics.risk}</dd></div><div><dt>成本参考</dt><dd>${metrics.cost}</dd></div></dl>
      </section>

      <p class="local-note">以下四项为“本地门店内容服务”演示样例；目标用户、交付与价格均需替换为你的真实实验设定。</p>
      <section class="validation-answers">
        <div><span>01 / 目标用户</span><strong>缺少稳定内容方法的本地小店经营者</strong><p>先从能提供真实到店反馈的 3 家门店开始。</p></div>
        <div><span>02 / 最小交付</span><strong>1 页 7 天选题与拍摄清单</strong><p>不先承诺完整月历，也不承诺流量结果。</p></div>
        <div><span>03 / 测试价格</span><strong>9.9 元样张 / 49 元轻定制</strong><p>价格必须对应清楚、有限且能按时完成的交付。</p></div>
        <div><span>04 / 第一步</span><strong>3 次访谈 + 1 次真实报价</strong><p>让用户复述价值，并记录拒绝付费的原因。</p></div>
      </section>

      <section class="validation-workbench">
        <div class="section-heading"><div><p class="eyebrow">7-DAY CHECKPOINTS</p><h2>每天只推进一件事</h2></div><span>${progress.percent}% COMPLETE</span></div>
        <div class="validation-days">
          ${tasks.map(([checkpoint, action], index) => `
            <article class="validation-day ${state.validationChecks[index] ? 'done' : ''}">
              <button class="day-toggle" data-validation-day="${index}" aria-pressed="${state.validationChecks[index]}"><span>${state.validationChecks[index] ? icon('check') : String(index + 1).padStart(2, '0')}</span><span><strong>第 ${index + 1} 天 · ${checkpoint}</strong><small>${action}</small></span></button>
              <label><span>结果证据</span><input data-validation-note="${index}" value="${escapeHtml(state.validationNotes[index])}" placeholder="记录人数、原话、报价或支付证据" /></label>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="decision-board">
        <div><p class="eyebrow">STAGE REVIEW</p><h2>用证据决定下一步</h2><p>继续：至少 3 人能复述主线，且至少 1 人愿意付费或预订。调整：用户看懂但不会用，或只接受免费样品。暂停：10 人无人能复述，或存在无法处理的合规风险。</p></div>
        <div class="decision-controls" role="group" aria-label="阶段决定">
          ${[['continue', '继续'], ['adjust', '调整'], ['pause', '暂停']].map(([value, label]) => `<button class="${state.validationDecision === value ? 'active' : ''}" data-decision="${value}">${label}</button>`).join('')}
        </div>
        <button class="primary-button" data-action="save-validation">保存验证进度 ${icon('check')}</button>
      </section>
    </section>
  `;
}

function renderProfile() {
  const menu = [
    ['bookmark', '我的收藏', `${state.favorites.length} 个案例 · 当前浏览器`],
    ['file', '最近查看', `${state.recentCases.length} 个案例 · 当前浏览器`],
    ['nodes', '保存方案', `${state.savedStages.length} 张阶段卡 · 1 个本地画布草案`],
    ['shield', '隐私与本地数据', '收藏与进度仅存当前浏览器'],
    ['settings', '使用说明', '免费案例、画布与缓存边界'],
  ];
  app.innerHTML = `
    <section class="page profile-page">
      ${pageHeader('我的工作台', '当前设备上的收藏、画布与浏览记录')}
      <section class="identity-band">
        <div class="avatar"><span>本地</span></div>
        <div><p class="eyebrow">LOCAL WORKSPACE / DEVICE ONLY</p><h2>本地工作台</h2><p>无需登录。收藏、最近查看、画布与验证进度只保存在当前浏览器，不会自动同步到其他设备。</p></div>
        <button class="secondary-button" data-action="local-data-note">存储说明</button>
      </section>
      <section class="profile-stats">
        <div><span>收藏案例</span><strong>${state.favorites.length}</strong><small>本地记录</small></div>
        <div><span>画布节点</span><strong>${state.canvasNodes.length}</strong><small>当前草案</small></div>
        <div><span>保存阶段</span><strong>${state.savedStages.length}</strong><small>本地资产卡</small></div>
      </section>
      <section class="profile-menu-wrap">
        <div class="section-heading"><div><p class="eyebrow">WORKSPACE</p><h2>项目菜单</h2></div></div>
        <div class="profile-menu">
          ${menu.map(([itemIcon, label, detail], index) => `
            <button data-menu="${label}"><span class="menu-index">0${index + 1}</span><span class="menu-icon">${icon(itemIcon)}</span><span><strong>${label}</strong><small>${detail}</small></span>${icon('chevron-right')}</button>
          `).join('')}
        </div>
      </section>
      <section id="recent-cases" class="content-section"><div class="section-heading"><h2>最近查看</h2><span>当前浏览器</span></div><div class="signal-list">${state.recentCases.map(id => cases.find(item => item.id === id)).filter(Boolean).map(item => `<button class="signal-row" data-case-id="${item.id}"><span class="signal-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.accessLabel)}</small></span>${icon('chevron-right')}</button>`).join('') || '<p class="local-note">还没有查看记录，先到案例库挑一个免费案例。</p>'}</div></section>
      <div class="membership-band">
        <div><p class="eyebrow">全部免费 · 无广告</p><h2>先看懂，再动手试一试</h2><p>${caseLibraryMeta.free} 个内置案例均可免费阅读全文，不需要购买会员。当前版本不展示广告，也不会在核心阅读和画布流程中插入推广内容；使用记录仅保存在当前浏览器。</p></div>
        <button class="primary-button" data-action="free-cases">浏览免费案例 ${icon('chevron-right')}</button>
      </div>
    </section>
  `;
}

function render() {
  clearRuntime();
  syncNav();
  if (state.validationOpen) {
    renderValidation();
    app.scrollTop = 0;
    return;
  }
  if (state.activeTab === 'home') renderHome();
  if (state.activeTab === 'cases') renderCases();
  if (state.activeTab === 'ai') renderCaseDemo();
  if (state.activeTab === 'canvas') renderCanvas();
  if (state.activeTab === 'profile') renderProfile();
  app.scrollTop = 0;
}

function switchTab(tab) {
  if (!navigation.some((item) => item.id === tab)) return;
  state.activeTab = tab;
  state.validationOpen = false;
  state.detailCase = null;
  render();
  app.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]')?.dataset.tab;
  if (tab) return switchTab(tab);

  const caseId = event.target.closest('[data-case-id]')?.dataset.caseId;
  if (caseId) return openCase(caseId);

  const filter = event.target.closest('[data-filter]')?.dataset.filter;
  if (filter) {
    state.caseFilter = filter;
    renderCases();
    return;
  }


  const nodeId = event.target.closest('[data-node-id]')?.dataset.nodeId;
  if (nodeId) return openNode(nodeId);

  const addNode = event.target.closest('[data-add-node]')?.dataset.addNode;
  if (addNode) {
    if (!state.canvasNodes.includes(addNode)) state.canvasNodes.push(addNode);
    closeNodeSheet();
    if (persist()) showToast('案例内容与来源已加入画布');
    return;
  }

  const saveStage = event.target.closest('[data-save-stage]')?.dataset.saveStage;
  if (saveStage) {
    state.savedStages = state.savedStages.includes(saveStage)
      ? state.savedStages.filter(id => id !== saveStage)
      : [...state.savedStages, saveStage];
    if (persist()) showToast(state.savedStages.includes(saveStage) ? '阶段资产卡已保存到当前浏览器' : '已取消保存阶段资产卡');
    openNode(saveStage);
    return;
  }

  const toggleNode = event.target.closest('[data-toggle-node]')?.dataset.toggleNode;
  if (toggleNode) {
    state.canvasNodes = state.canvasNodes.includes(toggleNode) ? state.canvasNodes.filter((id) => id !== toggleNode) : [...state.canvasNodes, toggleNode];
    renderCanvas();
    persist();
    return;
  }

  const removeNode = event.target.closest('[data-remove-node]')?.dataset.removeNode;
  if (removeNode) {
    state.canvasNodes = state.canvasNodes.filter((id) => id !== removeNode);
    renderCanvas();
    persist();
    return;
  }

  const validationDay = event.target.closest('[data-validation-day]')?.dataset.validationDay;
  if (validationDay !== undefined) {
    const index = Number(validationDay);
    state.validationChecks[index] = !state.validationChecks[index];
    renderValidation();
    return;
  }

  const decision = event.target.closest('[data-decision]')?.dataset.decision;
  if (decision) {
    state.validationDecision = decision;
    renderValidation();
    return;
  }

  const menu = event.target.closest('[data-menu]')?.dataset.menu;
  if (menu === '我的收藏') { state.savedOnly = true; state.caseFilter = '全部'; state.caseAccess = 'all'; state.caseKeyword = ''; return switchTab('cases'); }
  if (menu === '最近查看') return document.querySelector('#recent-cases')?.scrollIntoView({ block: 'start' });
  if (menu === '保存方案') return switchTab('canvas');
  if (menu === '隐私与本地数据') return showToast('数据仅存在当前浏览器，可在浏览器站点数据中清除');
  if (menu === '使用说明') return showToast('100 个预置案例免费阅读；页面不上传文件或调用外部模型');

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'reset-cases' || action === 'free-cases' || action === 'starter-cases') {
    state.caseFilter = action === 'starter-cases' ? '轻量试做' : '全部'; state.caseAccess = 'all'; state.caseKeyword = ''; state.savedOnly = false;
    switchTab('cases'); document.querySelector('#case-search')?.focus({ preventScroll: true }); return;
  }
  if (action === 'saved-cases') { state.savedOnly = !state.savedOnly; renderCases(); document.querySelector('[data-action="saved-cases"]')?.focus({ preventScroll: true }); return; }
  if (action === 'bookmark' && state.detailCase) {
    const id = state.detailCase.id;
    const saved = !state.favorites.includes(id);
    state.favorites = saved ? [...state.favorites, id] : state.favorites.filter(value => value !== id);
    event.target.closest('[data-action="bookmark"]').outerHTML = bookmarkMarkup(state.detailCase);
    document.querySelector('[data-action="bookmark"]')?.focus({ preventScroll: true });
    if (persist()) showToast(saved ? '已收藏，刷新后仍可查看' : '已取消收藏');
    return;
  }
  if (action === 'case-to-canvas' && state.detailCase && !state.detailCase.locked) {
    state.canvasNodes = [...new Set([...state.canvasNodes, ...state.detailCase.nodes.map(node => node.id)])];
    switchTab('canvas'); if (persist()) showToast('七关内容和来源已保留'); return;
  }
  if (action === 'close-case') return switchTab('cases');
  if (action === 'close-node') {
    closeNodeSheet();
    return;
  }
  if (action === 'start-demo') return startCaseDemo();
  if (action === 'demo-to-canvas') {
    const selectedCase = cases.find(item => item.id === state.demoCaseId);
    if (!selectedCase?.nodes.length) return showToast('该案例暂时没有可加入画布的内容');
    state.canvasNodes = [...new Set([...state.canvasNodes, ...selectedCase.nodes.map(node => node.id)])];
    switchTab('canvas');
    if (persist()) showToast('该案例七关与来源已加入本地画布');
    return;
  }
  if (action === 'clear-canvas') {
    if (state.canvasNodes.length && !window.confirm('清空当前画布？收藏与最近查看不会删除。')) return;
    state.canvasNodes = [];
    renderCanvas();
    persist();
    return;
  }
  if (action === 'open-validation') {
    state.validationOpen = true;
    render();
    return;
  }
  if (action === 'back-validation') {
    state.validationOpen = false;
    render();
    return;
  }
  if (action === 'save-validation') {
    if (persist()) showToast('验证进度已保存到当前浏览器');
    return;
  }
  if (action) showToast({ notify: '当前没有未读通知', bookmark: '案例已收藏' }[action] || '操作已响应');
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'demo-case-select') return;
  state.demoCaseId = event.target.value;
  state.demoStatus = 'idle';
  renderCaseDemo();
});

document.addEventListener('input', (event) => {
  const note = event.target.dataset.validationNote;
  if (note !== undefined) state.validationNotes[Number(note)] = event.target.value;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.selectedNode) {
    closeNodeSheet();
  }
});

render();
