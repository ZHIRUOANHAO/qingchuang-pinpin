import { caseCatalog, loadCaseDetail } from './case-index.js';
import { createDraft, validateDraft, saveDraft, listDrafts, getDraft, deleteDraft, exportDraft } from './feedback-store.js';

const $ = (selector) => document.querySelector(selector);
const escape = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const caseById = new Map(caseCatalog.map((item) => [item.id, item]));
const outcomeNames = { worked: '达到预期', mixed: '部分有效', failed: '未达预期', unknown: '仍在观察' };
const favoriteKey = 'qingchuang.practice-feedback.favorites.v1';
const exercises = [
  {
    id: 'life-price-sheet', title: '小店价目表', caseId: 'real_092',
    demand: '假设一家小店的商品和价格分散，顾客不容易看清。',
    deliverable: '一页清楚的价目表草稿', firstStep: '列出 5 项虚构商品和价格。',
    steps: [
      ['整理内容', '写下 5 项虚构商品的名称、规格与价格，先确定哪些信息需要放在一起。'],
      ['排成一页', '用纸笔或你熟悉的排版工具，把名称和价格对应清楚，先完成可阅读的草稿。'],
      ['请人试读', '请一位愿意帮忙的熟人找到指定商品的价格，观察用时和卡住的地方。']
    ],
    needs: '纸笔或常用排版工具、5 条虚构商品资料、一位愿意试读的人。',
    record: '记录投入时长、找价格的用时、看不懂的地方及对方原话。看得懂不等于愿意付费。',
    reference: '创客贴是工具参考。它提供设计工具，你做的是一页排版练习；两者的经营方式不同。'
  },
  {
    id: 'life-resume-layout', title: '同学简历排版', caseId: 'real_020',
    demand: '假设同学已有简历内容，重点却被杂乱的排版淹没。',
    deliverable: '一页排版统一的简历样稿', firstStep: '用虚构资料写 3 段简历内容。',
    steps: [
      ['整理重点', '用虚构资料准备教育、技能和经历三部分，只调整信息层级，不编造真实个人的经历。'],
      ['统一排版', '用熟悉的文档工具，统一字号、间距和标题层级，做成一页样稿。'],
      ['请人找信息', '请一位同学在样稿中找到教育和经历，记录哪一处不清楚，再修改一次。']
    ],
    needs: '一份虚构简历内容、常用文档工具、一位愿意试读的人。',
    record: '记录排版耗时、试读者是否找到关键信息、修改点与原话反馈。样稿不代表能获得面试或工作。',
    reference: '五百丁是简历模板工具参考。工具公司的付费功能，与个人帮别人整理版式的服务不同。'
  },
  {
    id: 'life-signup-form', title: '活动报名表', caseId: 'real_015',
    demand: '假设活动报名散落在聊天里，组织者很难整理。',
    deliverable: '一张可让组织者试用的报名信息表', firstStep: '写下组织者需要的 3 个字段。',
    steps: [
      ['明确要收什么', '假设组织一次读书会，列出昵称、参加场次、备注等必要字段，先用虚构资料。'],
      ['做一张信息表', '用纸笔或常用表格工具，写明活动说明和字段，用 3 条虚构报名信息检查能否整理。'],
      ['请组织者试用', '请一位熟人模拟组织者，根据这张表统计场次和人数，记录是否省事、哪里还不清楚。']
    ],
    needs: '一个模拟活动说明、常用表格工具、3 条虚构报名资料、一位愿意试用的人。',
    record: '记录整理耗时、漏填或重复的位置、组织者原话。不要把完成表格当成已经有人付费。',
    reference: 'Tally 是表单工具参考，不是练习的必需软件。先做通用信息表，再按需要了解工具公司的付费功能。'
  }
];
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
const state = { view: 'library', query: '', industry: '', filter: 'all', favorites: [], currentCase: null, currentExercise: null, editorDraft: null, editorBack: false, editorExerciseBack: null, returnFocus: null };
const dialog = $('#case-dialog');
let toastTimer;
let detailRequest = 0;

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}

function drafts(caseId) {
  try { return listDrafts(caseId); } catch (error) { notify(error.message || '无法读取本机草稿，请检查浏览器存储设置。'); return null; }
}

function bookmarkIcon(saved) {
  return `<svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

function bookmarkButton(item) {
  const saved = state.favorites.includes(item.id);
  return `<button class="icon-button${saved ? ' is-saved' : ''}" data-action="favorite" data-case="${escape(item.id)}" aria-label="${saved ? '取消收藏' : '收藏'}：${escape(item.name)}" aria-pressed="${saved}">${bookmarkIcon(saved)}</button>`;
}

function renderExercises() {
  $('#exercise-grid').innerHTML = exercises.map((exercise) => `<article class="exercise-card"><p class="exercise-label">情境练习 · 非经营实证</p><h2>${escape(exercise.title)}</h2><p class="exercise-demand">${escape(exercise.demand)}</p><dl class="exercise-facts"><div><dt>做出一页</dt><dd>${escape(exercise.deliverable)}</dd></div><div><dt>今天第一步</dt><dd>${escape(exercise.firstStep)}</dd></div></dl><button class="button primary" data-action="exercise" data-exercise="${escape(exercise.id)}" aria-label="看练习：${escape(exercise.title)}">看练习 <span aria-hidden="true">→</span></button></article>`).join('');
}

function showExercise(exerciseId) {
  const exercise = exerciseById.get(exerciseId);
  if (!exercise) return notify('未找到这个情境练习。');
  detailRequest++;
  state.currentExercise = exerciseId;
  state.currentCase = exercise.caseId;
  state.editorDraft = null;
  const records = drafts(exercise.caseId)?.filter((draft) => draft.exerciseId === exerciseId);
  $('#dialog-content').innerHTML = `<div class="dialog-head"><span class="eyebrow">入门情境练习 · 非经营实证</span><button class="icon-button" data-action="close" aria-label="关闭练习详情">✕</button></div><div class="dialog-body"><h2 id="dialog-title" tabindex="-1">${escape(exercise.title)}</h2><p class="dialog-intro">${escape(exercise.demand)}</p><div class="action-box"><h3>这次先做出什么</h3><p>${escape(exercise.deliverable)}。先用虚构资料做样稿，再观察是否更容易使用。</p></div><ol class="exercise-steps">${exercise.steps.map(([title, body]) => `<li><div><h3>${escape(title)}</h3><p>${escape(body)}</p></div></li>`).join('')}</ol><div class="exercise-notes"><div><h3>需要什么</h3><p>${escape(exercise.needs)}</p></div><div><h3>记录什么</h3><p>${escape(exercise.record)}</p></div></div><div class="exercise-reference"><p>${escape(exercise.reference)}</p><button class="button secondary" data-action="detail" data-case="${escape(exercise.caseId)}">看参考案例 <span aria-hidden="true">↗</span></button></div><p class="exercise-record-note">入门情境练习，不是原案例经营复现。收入或付费意愿需要另行测试。</p><button class="button primary" data-action="write-exercise" data-exercise="${escape(exercise.id)}">记录这次尝试 <span aria-hidden="true">→</span></button><p class="editor-subtitle">只在这台设备的当前浏览器保存，暂未公开。</p><div class="section-title"><h3>这次练习的本机草稿</h3><span>仅自己可见</span></div><div class="dialog-local-list">${records ? (records.length ? records.map((draft) => draftCard(draft, true)).join('') : '<p class="draft-text">实际尝试后，在这里留下做法、结果和证据。</p>') : '<p class="draft-text" role="alert">暂时无法读取已有草稿，请检查浏览器存储设置。</p>'}</div></div>`;
  openDialog();
  $('#dialog-title').focus();
}

function renderCards() {
  const filtered = caseCatalog.filter((item) => {
    const text = [item.name, item.industry, item.valueProposition, item.offer, ...(item.tags || [])].join(' ').toLocaleLowerCase();
    return (!state.query || text.includes(state.query.toLocaleLowerCase())) && (!state.industry || item.industry === state.industry) && (state.filter === 'all' || (state.filter === 'favorites' ? state.favorites.includes(item.id) : item.tags?.includes(state.filter)));
  });
  $('#results-count').textContent = `显示 ${filtered.length} 个案例`;
  $('#case-empty').hidden = filtered.length > 0;
  $('#case-grid').innerHTML = filtered.map((item) => `<article class="case-card">
    <div class="card-top"><span class="case-number">CASE ${escape(item.id.replace('real_', ''))}</span>${bookmarkButton(item)}</div>
    <p class="card-industry">${escape(item.industry)} · ${escape(item.tags?.find((tag) => tag.includes('试做')) || '对照研究')}</p>
    <h2>${escape(item.name)}</h2><p class="case-description">${escape(item.offer || item.valueProposition)}</p>
    <div class="case-dna" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
    <div class="case-facts"><span>${escape(item.cost?.split('；')[0] || item.difficulty)}</span><span class="source-label">${item.sourceTier === 'official_index' ? '官方索引线索' : '官方页面来源'}</span></div>
    <div class="card-actions"><button class="button secondary" data-action="detail" data-case="${escape(item.id)}" aria-label="查看案例：${escape(item.name)}">查看案例 <span aria-hidden="true">↗</span></button><button class="button quiet" data-action="write" data-case="${escape(item.id)}" aria-label="为${escape(item.name)}写实践记录">写实践记录</button></div>
  </article>`).join('');
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function draftCard(item, compact = false) {
  const title = item.exerciseTitle || item.caseTitle || caseById.get(item.caseId)?.name || '案例记录';
  const date = new Date(item.updatedAt);
  const isoDate = Number.isNaN(date.getTime()) ? '' : date.toISOString();
  return `<article class="draft-card"><div class="draft-meta"><span>${item.type === 'question' ? '问题 / 评论' : '实践记录'}</span>${item.type === 'practice' ? `<span class="outcome-label">${escape(outcomeNames[item.outcome] || outcomeNames.unknown)}</span>` : ''}<span>本机草稿</span><time datetime="${escape(isoDate)}">${escape(formatTime(item.updatedAt))}</time></div>${compact ? '' : `<h2>${escape(title)}</h2>`}${item.exerciseId ? `<p class="exercise-record-note">入门情境练习 · ${escape(item.exerciseTitle)}，不是原案例经营复现。</p>` : ''}<p class="draft-text">${escape(item.type === 'question' ? item.comment : item.result)}</p><div class="draft-actions"><button class="button secondary" data-action="edit-draft" data-draft="${escape(item.id)}">继续编辑</button><button class="button quiet" data-action="copy-draft" data-draft="${escape(item.id)}">复制摘要</button><button class="button quiet danger" data-action="delete-draft" data-draft="${escape(item.id)}">删除</button></div></article>`;
}

function renderDrafts() {
  const items = drafts();
  if (!items) {
    $('#draft-count').textContent = '—';
    $('#draft-list').innerHTML = '<div class="privacy-note" role="alert">暂时无法读取本机草稿，请检查浏览器存储设置。已有内容不会被覆盖。</div>';
    $('#drafts-empty').hidden = true;
    return;
  }
  $('#draft-count').textContent = items.length;
  $('#draft-list').innerHTML = items.map((item) => draftCard(item)).join('');
  $('#drafts-empty').hidden = items.length > 0;
}

function setView(view) {
  state.view = view;
  $('#library-view').hidden = view !== 'library';
  $('#drafts-view').hidden = view !== 'drafts';
  document.querySelectorAll('.primary-nav [data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-current', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (view === 'drafts') renderDrafts(); else renderCards();
}

function openDialog() {
  if (!dialog.open) { state.returnFocus = document.activeElement; dialog.showModal(); }
}

function closeDialog() { dialog.close(); }

async function showDetail(caseId) {
  const item = caseById.get(caseId);
  if (!item) { notify('未找到这个案例，请重新选择。'); return; }
  const request = ++detailRequest;
  state.currentCase = caseId;
  state.currentExercise = null;
  state.editorDraft = null;
  const title = `<div class="dialog-head"><span class="eyebrow">案例 ${escape(caseId.replace('real_', ''))} · ${escape(item.industry)}</span><button class="icon-button" data-action="close" aria-label="关闭案例详情">✕</button></div><div class="dialog-body"><h2 id="dialog-title" tabindex="-1">${escape(item.name)}</h2><p class="dialog-intro">${escape(item.valueProposition)}</p>`;
  const summarySources = (item.sourceUrls || []).map((url) => { const safe = safeUrl(url); return safe ? `<li><a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(new URL(safe).hostname)} <span aria-hidden="true">↗</span></a></li>` : ''; }).join('');
  $('#dialog-content').innerHTML = `${title}<div class="section-title"><h3>公开来源</h3></div><ul class="source-links">${summarySources}</ul><div class="privacy-note" role="status" aria-live="polite">正在载入七阶段详情…</div><button class="button secondary" data-action="write" data-case="${escape(caseId)}">先写实践记录</button></div>`;
  openDialog();
  $('#dialog-title').focus();
  let detail;
  try {
    detail = await loadCaseDetail(caseId);
    if (!detail) throw new Error('案例的七阶段详情暂不可用。');
  } catch {
    if (request !== detailRequest || !dialog.open) return;
    $('#dialog-content').innerHTML = `${title}<div class="privacy-note" role="alert">详情加载失败。你仍可查看案例简介，或先写本机实践记录。</div><ul class="source-links">${summarySources}</ul><div class="form-actions"><button class="button secondary" data-action="detail" data-case="${escape(caseId)}">重新加载详情</button><button class="button primary" data-action="write" data-case="${escape(caseId)}">写实践记录</button></div></div>`;
    $('#dialog-title').focus();
    return;
  }
  if (request !== detailRequest || !dialog.open || state.editorDraft) return;
  const shouldFocusTitle = document.activeElement.id === 'dialog-title' || document.activeElement === document.body;
  const localItems = drafts(caseId);
  const sources = detail.factualBasis?.sources || [];
  $('#dialog-content').innerHTML = `<div class="dialog-head"><span class="eyebrow">案例 ${escape(caseId.replace('real_', ''))} · ${escape(item.industry)}</span><button class="icon-button" data-action="close" aria-label="关闭案例详情">✕</button></div><div class="dialog-body">
    <div class="dialog-title-row"><h2 id="dialog-title" tabindex="-1">${escape(item.name)}</h2>${bookmarkButton(item)}</div><p class="dialog-intro">${escape(item.valueProposition)}</p>
    <dl class="detail-facts"><div class="detail-fact"><dt>提供什么</dt><dd>${escape(item.offer)}</dd></div><div class="detail-fact"><dt>为谁解决问题</dt><dd>${escape(item.payer)}</dd></div></dl>
    <div class="section-title"><h3>七个阶段，看清做法</h3><span>编辑拆解</span></div><ol class="stage-chain">${detail.stages.map((stage) => `<li><b>${stage.number.toString().padStart(2, '0')}</b>${escape(stage.name)}</li>`).join('')}</ol>
    ${detail.stages.map((stage) => `<details class="stage-details"><summary>${stage.number.toString().padStart(2, '0')} · ${escape(stage.name)}</summary><p>${escape(stage.action)}</p></details>`).join('')}
    <div class="section-title"><h3>原始来源与证据</h3><span>${escape(detail.factualBasis?.checkedOn || item.evidenceCheckedOn)} 核对</span></div><details class="source-details"><summary>查看 ${sources.length} 个公开来源与说明</summary><div class="source-body"><p>${escape(detail.factualBasis?.observation)}</p><ul class="source-links">${sources.map((source) => { const url = safeUrl(source.url); return `<li>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} <span aria-hidden="true">↗</span></a>` : escape(source.label)}<small>${escape(source.host)} · ${escape(source.access || '公开来源')}</small></li>`; }).join('')}</ul><p>公开来源支持案例中产品或服务的存在与描述。案例拆解属于编辑分析，不能据此认定收入、利润或他人的复现结果。</p></div></details>
    <div class="action-box"><h3>先做一个小尝试</h3><p>${escape(detail.validation?.firstAction)}</p><button class="button primary" data-action="write" data-case="${escape(caseId)}">记录我的实践 <span aria-hidden="true">→</span></button></div>
    <div class="section-title"><h3>公开实践与讨论</h3><span>共享功能尚未接通</span></div><div class="public-empty"><strong>当前还没有公开投稿</strong><p>这里将展示审核后的实践记录，包括做法、结果、适用条件和证据。当前预览只支持本机草稿，其他人暂时无法查看。</p><button class="button secondary" data-action="question" data-case="${escape(caseId)}">写问题 / 评论草稿</button></div>
    <div class="section-title"><h3>我的本机草稿</h3><span>${localItems ? `${localItems.length} 条` : '读取失败'} · 仅自己可见</span></div><div class="dialog-local-list">${localItems ? (localItems.length ? localItems.map((draft) => draftCard(draft, true)).join('') : '<p class="draft-text">还没有记录。实际尝试后，可以在这里留下过程与结果。</p>') : '<p class="draft-text" role="alert">无法读取已有草稿，请检查浏览器存储设置后重试。</p>'}</div>
  </div>`;
  if (shouldFocusTitle) $('#dialog-title').focus();
}

const fieldDefinitions = {
  action: ['做了什么', '具体到一次行动，例如给 3 位目标用户演示自己制作的模板。', 'textarea'],
  period: ['实践时间与周期', '写明起止日期或持续时长，例如 10 月 10—14 日，共 5 天。', 'input'],
  context: ['你的条件与限制', '写明投入时间、成本、已有技能、参与对象及人数，让别人能比较条件。', 'textarea'],
  result: ['具体结果', '记录观察到的数量、耗时、卡点或原话反馈。未达预期也可以如实写。', 'textarea'],
  evidence: ['支持结果的证据', '说明证据是什么、来自哪里以及它支持哪一项结果。不要写入手机号等隐私。', 'textarea'],
  evidenceUrl: ['可选公开证据链接', '可填写无需登录即可查看的 https 链接；本次不上传图片或文件。', 'input'],
  comment: ['补充说明 / 问题', '补充你还不确定的地方，或给其他使用者留下一个具体问题。', 'textarea']
};

function fieldMarkup(name, draft, required, full = false) {
  let [label, hint, kind] = fieldDefinitions[name];
  if (name === 'comment' && draft.type === 'question') { label = '问题或评论正文'; hint = '写明你对这个案例的具体疑问或补充。还未实践时，请不要写成已发生的结果。'; }
  const value = draft[name] || '';
  const attrs = `id="field-${name}" name="${name}" aria-describedby="hint-${name} error-${name}"${required ? ' aria-required="true"' : ''}`;
  const limits = { action: 2000, period: 200, context: 2000, result: 3000, evidence: 4000, evidenceUrl: 2048, comment: 2000 };
  const control = kind === 'textarea' ? `<textarea ${attrs} maxlength="${limits[name]}" rows="3">${escape(value)}</textarea>` : `<input ${attrs} type="${name === 'evidenceUrl' ? 'url' : 'text'}" maxlength="${limits[name]}" value="${escape(value)}" />`;
  return `<div class="form-field${full ? ' full' : ''}" data-field="${name}"><label for="field-${name}">${escape(label)}${required ? '<span class="required-marker">必填</span>' : ''}</label><span id="hint-${name}" class="field-hint">${escape(hint)}</span>${control}<span id="error-${name}" class="field-error" hidden></span></div>`;
}

function showEditor(caseId, draft = null, type = 'practice', back = dialog.open && !state.editorDraft, exercise = null) {
  const item = caseById.get(caseId);
  if (!item) { notify('未找到关联案例。'); return; }
  detailRequest++;
  state.currentCase = caseId;
  state.editorBack = back;
  state.editorExerciseBack = exercise?.id || (back ? state.currentExercise : null);
  state.editorDraft = draft || createDraft({ caseId, caseTitle: item.name, type, outcome: 'unknown', ...(exercise ? { exerciseId: exercise.id, exerciseTitle: exercise.title } : {}) });
  renderEditor();
  openDialog();
  $('#dialog-title').focus();
}

function renderEditor() {
  const draft = state.editorDraft;
  const practice = draft.type === 'practice';
  $('#dialog-content').innerHTML = `<div class="dialog-head"><button class="button quiet" data-action="editor-back">${state.editorBack ? (state.editorExerciseBack ? '← 返回练习' : '← 返回案例') : '取消'}</button><button class="icon-button" data-action="close" aria-label="关闭记录编辑器">✕</button></div><div class="dialog-body"><h2 id="dialog-title" tabindex="-1">${practice ? '记录一次真实尝试' : '留下问题或评论'}</h2><p class="editor-subtitle">先说清过程，再留下证据。结果不理想，也有参考价值。</p><div class="editor-case">${draft.exerciseId ? `入门情境练习 · 非经营实证<strong>${escape(draft.exerciseTitle)}</strong><p>参考案例：${escape(draft.caseTitle)}<br />这条记录属于练习，不是原案例经营复现。</p>` : `关联案例<strong>${escape(draft.caseTitle)}</strong>`}</div><form id="feedback-form" novalidate>
    <fieldset class="form-type"><legend>你想留下什么？</legend><div class="radio-group"><label class="radio-option"><input type="radio" name="type" value="practice" ${practice ? 'checked' : ''} /><span>实践记录<small>我做过，想记录过程和结果</small></span></label><label class="radio-option"><input type="radio" name="type" value="question" ${!practice ? 'checked' : ''} /><span>问题 / 评论<small>还没实践，想问问或补充</small></span></label></div></fieldset>
    <fieldset class="outcome-field" ${practice ? '' : 'hidden'}><legend>这次尝试的结果</legend><div class="outcome-options">${Object.entries(outcomeNames).map(([value, label]) => `<label class="radio-option"><input type="radio" name="outcome" value="${value}" ${draft.outcome === value ? 'checked' : ''} /><span>${label}</span></label>`).join('')}</div></fieldset>
    <div id="form-errors" class="error-summary" role="alert" hidden></div><div class="form-grid">
    ${practice ? ['action', 'period', 'context', 'result', 'evidence', 'evidenceUrl', 'comment'].map((name) => fieldMarkup(name, draft, !['evidenceUrl', 'comment'].includes(name), ['action', 'result', 'evidence', 'evidenceUrl', 'comment'].includes(name))).join('') : fieldMarkup('comment', draft, true, true)}
    </div><div class="form-footer"><p>只在这台设备的当前浏览器保存，暂未公开。关闭前请保存；请勿填写他人的联系方式、身份信息或私密资料。</p><div class="form-actions"><button class="button primary" type="submit">保存本机草稿</button><button class="button secondary" type="button" data-action="copy-current">复制当前摘要</button></div></div>
    </form></div>`;
}

function collectForm() {
  const form = $('#feedback-form');
  if (!form) return state.editorDraft;
  const input = new FormData(form);
  const current = { ...state.editorDraft, type: input.get('type') || state.editorDraft.type, outcome: input.get('outcome') || 'unknown' };
  Object.keys(fieldDefinitions).forEach((name) => { if (input.has(name)) current[name] = input.get(name).toString().trim(); });
  return current;
}

function showErrors(errors = {}, message = '') {
  document.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; element.hidden = true; });
  document.querySelectorAll('[aria-invalid]').forEach((element) => element.removeAttribute('aria-invalid'));
  const entries = Object.entries(errors);
  for (const [name, error] of entries) {
    const input = $(`#field-${name}`);
    const output = $(`#error-${name}`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (output) { output.textContent = Array.isArray(error) ? error.join('；') : String(error); output.hidden = false; }
  }
  const summary = $('#form-errors');
  summary.hidden = false;
  summary.textContent = message || `还有 ${entries.length} 项需要补充，请按字段提示填写。`;
  const invalid = $('#feedback-form [aria-invalid=true]');
  if (invalid) invalid.focus(); else { summary.setAttribute('tabindex', '-1'); summary.focus(); }
}

async function copyText(text) {
  const previousFocus = document.activeElement;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('aria-label', '待复制摘要');
      area.className = 'copy-buffer';
      (dialog.open ? $('#dialog-content') : document.body).append(area);
      area.focus(); area.select();
      const success = document.execCommand('copy');
      area.remove();
      if (!success) throw new Error('copy unavailable');
    }
    notify('摘要已复制，包含“本机草稿”说明。');
  } catch { notify('浏览器未允许复制，请检查剪贴板权限后重试。'); }
  finally { if (previousFocus?.isConnected) previousFocus.focus(); }
}

async function performAction(button) {
  const action = button.dataset.action;
  const caseId = button.dataset.case;
  if (action === 'close') return closeDialog();
  if (action === 'exercise') return showExercise(button.dataset.exercise);
  if (action === 'write-exercise') {
    const exercise = exerciseById.get(button.dataset.exercise);
    if (!exercise) return notify('未找到这个情境练习。');
    return showEditor(exercise.caseId, null, 'practice', true, exercise);
  }
  if (action === 'detail') return showDetail(caseId);
  if (action === 'write' || action === 'question') return showEditor(caseId, null, action === 'question' ? 'question' : 'practice');
  if (action === 'favorite') {
    const wasSaved = state.favorites.includes(caseId);
    const next = wasSaved ? state.favorites.filter((id) => id !== caseId) : [...state.favorites, caseId];
    try { localStorage.setItem(favoriteKey, JSON.stringify(next)); } catch { return notify('收藏未保存，请检查浏览器存储设置。'); }
    state.favorites = next;
    const item = caseById.get(caseId);
    document.querySelectorAll('[data-action="favorite"]').forEach((element) => { if (element.dataset.case === caseId) { element.classList.toggle('is-saved', !wasSaved); element.setAttribute('aria-pressed', String(!wasSaved)); element.setAttribute('aria-label', `${wasSaved ? '收藏' : '取消收藏'}：${item.name}`); element.innerHTML = bookmarkIcon(!wasSaved); } });
    if (state.filter === 'favorites') renderCards();
    return notify(wasSaved ? '已取消本机收藏。' : '已收藏，仅保存在本机。');
  }
  if (action === 'editor-back') return state.editorBack ? (state.editorExerciseBack ? showExercise(state.editorExerciseBack) : showDetail(state.currentCase)) : closeDialog();
  if (action === 'copy-current') {
    const current = collectForm();
    const validation = validateDraft(current);
    if (!validation.valid) { showErrors(validation.errors); return; }
    return copyText(exportDraft(current));
  }
  if (action === 'edit-draft') {
    const draft = getDraft(button.dataset.draft);
    if (!draft) return notify('这条草稿已不存在。');
    return showEditor(draft.caseId, draft, draft.type, dialog.open);
  }
  if (action === 'copy-draft') {
    const draft = getDraft(button.dataset.draft);
    if (draft) return copyText(exportDraft(draft));
    return notify('这条草稿已不存在。');
  }
  if (action === 'delete-draft') {
    if (!window.confirm('删除这条本机草稿？删除后无法恢复。')) return;
    try {
      const deleted = deleteDraft(button.dataset.draft);
      renderDrafts();
      if (dialog.open && !state.editorDraft) { if (state.currentExercise) showExercise(state.currentExercise); else showDetail(state.currentCase); }
      notify(deleted ? '已删除本机草稿。' : '这条草稿已不存在。');
    } catch (error) { notify(error.message || '删除失败，请重试。'); }
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) setView(button.dataset.view);
  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((element) => { const active = element === button; element.classList.toggle('is-active', active); element.setAttribute('aria-pressed', String(active)); });
    renderCards();
  }
  if (button.dataset.action) performAction(button).catch((error) => notify(error.message || '操作未完成，请重试。'));
});

$('#case-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderCards(); });
$('#industry-filter').addEventListener('change', (event) => { state.industry = event.target.value; renderCards(); });
$('#reset-filters').addEventListener('click', () => {
  state.query = ''; state.industry = ''; state.filter = 'all';
  $('#case-search').value = ''; $('#industry-filter').value = '';
  document.querySelectorAll('[data-filter]').forEach((element) => { const active = element.dataset.filter === 'all'; element.classList.toggle('is-active', active); element.setAttribute('aria-pressed', String(active)); });
  renderCards(); $('#case-search').focus();
});

dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
document.addEventListener('keydown', (event) => {
  if (!dialog.open || event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('a[href], button, input, textarea, select, summary, [tabindex]')].filter((element) => {
    return element.tabIndex >= 0 && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  });
  if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;
  if (!focusable.includes(current)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  else if (event.shiftKey && current === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
});
dialog.addEventListener('close', () => {
  detailRequest++;
  state.editorDraft = null;
  if (state.returnFocus?.isConnected) state.returnFocus.focus(); else (state.view === 'library' ? $('#case-search') : $('.primary-nav [data-view="drafts"]')).focus();
});

dialog.addEventListener('change', (event) => {
  if (event.target.name === 'type') {
    state.editorDraft = collectForm();
    if (state.editorDraft.type === 'question') state.editorDraft.outcome = 'unknown';
    renderEditor();
    $(`#feedback-form input[name="type"][value="${state.editorDraft.type}"]`).focus();
  }
});

dialog.addEventListener('submit', (event) => {
  if (event.target.id !== 'feedback-form') return;
  event.preventDefault();
  const draft = collectForm();
  const validation = validateDraft(draft);
  if (!validation.valid) { showErrors(validation.errors); return; }
  try {
    const saved = saveDraft(draft);
    state.editorDraft = saved;
    renderDrafts();
    if (saved.exerciseId && exerciseById.has(saved.exerciseId)) showExercise(saved.exerciseId); else showDetail(saved.caseId);
    notify('已保存本机草稿，尚未公开发布。');
  } catch (error) { showErrors(error.errors || {}, error.message || '草稿未能保存，请检查浏览器存储设置。'); }
});

function initialize() {
  try { const value = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); state.favorites = Array.isArray(value) ? value.filter((id) => caseById.has(id)) : []; } catch { state.favorites = []; }
  $('#catalog-total').textContent = caseCatalog.length;
  $('#industry-filter').insertAdjacentHTML('beforeend', [...new Set(caseCatalog.map((item) => item.industry))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((industry) => `<option value="${escape(industry)}">${escape(industry)}</option>`).join(''));
  renderExercises(); renderCards(); renderDrafts();
}

initialize();
