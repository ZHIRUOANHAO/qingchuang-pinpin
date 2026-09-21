export function filterCases(cases, { keyword = '', access = 'all', tag = '全部', savedOnly = false, favorites = [] } = {}) {
  const query = keyword.trim().toLocaleLowerCase();
  return cases.filter(item => (!query || `${item.title} ${item.industry} ${item.value} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(query))
    && (access === 'all' || (access === 'paid' ? item.locked : !item.locked))
    && (tag === '全部' || item.tags.includes(tag))
    && (!savedOnly || favorites.includes(item.id)));
}

export function resolveCanvasNodes(ids, cases, modules) {
  const nodes = new Map(modules.map(item => [item.id, item]));
  cases.filter(item => !item.locked).forEach(item => item.nodes.forEach(node => nodes.set(node.id, {
    ...node, sourceCaseId: item.id, sourceTitle: item.title, hint: node.method,
    color: item.planet.color, costLabel: item.costLabel,
  })));
  return [...new Set(ids)].map(id => nodes.get(id)).filter(Boolean);
}

export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function readWorkspace(storage, validCaseIds, validNodeIds, validStageIds = new Set()) {
  try {
    const data = JSON.parse(storage.getItem('qingchuang.workspace.v1') || '{}');
    const ids = (value, valid, max) => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && valid.has(id)))].slice(0, max) : [];
    return {
      favorites: ids(data.favorites, validCaseIds, 100),
      recentCases: ids(data.recentCases, validCaseIds, 12),
      ...(validStageIds.size ? { savedStages: ids(data.savedStages, validStageIds, 200) } : {}),
      ...(Array.isArray(data.canvasNodes) ? { canvasNodes: ids(data.canvasNodes, validNodeIds, 200) } : {}),
      ...(Array.isArray(data.validationChecks) && data.validationChecks.length === 7 ? { validationChecks: data.validationChecks.map(value => value === true) } : {}),
      ...(Array.isArray(data.validationNotes) && data.validationNotes.length === 7 ? { validationNotes: data.validationNotes.map(value => typeof value === 'string' ? value.slice(0, 2000) : '') } : {}),
      ...(['pending', 'continue', 'adjust', 'pause'].includes(data.validationDecision) ? { validationDecision: data.validationDecision } : {}),
    };
  } catch { return {}; }
}

export function saveWorkspace(storage, state) {
  try {
    const { favorites, recentCases, canvasNodes, savedStages, validationChecks, validationNotes, validationDecision } = state;
    storage.setItem('qingchuang.workspace.v1', JSON.stringify({ favorites, recentCases, canvasNodes, savedStages, validationChecks, validationNotes, validationDecision }));
    return true;
  } catch { return false; }
}
