import { caseCatalog, freeCaseDetails, caseLibraryMeta } from './case-library.js';
import { composeBusinessStages, buildBusinessNodes } from './business-stages.js';

const webPalette = ['#d9bb72', '#62c7d9', '#9b87e8', '#65c799', '#d98f72', '#c7a8dc'];
const nodeTypes = ['exposure', 'traffic', 'nurture', 'transaction', 'delivery', 'risk', 'profit'];
const freeById = Object.fromEntries(freeCaseDetails.map((item) => [item.id, item]));

function difficultyValue(label = '') {
  if (label.startsWith('入门')) return 2;
  if (label.startsWith('中高')) return 3;
  return 5;
}

function minimumCost(label = '') {
  const match = String(label).match(/(\d+)\s*-\s*\d+\s*元/);
  return match ? Number(match[1]) : 0;
}

function stageToNode(stage, detail) {
  const index = Math.max(0, Math.min(nodeTypes.length - 1, Number(stage.number || 1) - 1));
  return {
    id: `${detail.id}_stage_${stage.number}`,
    name: stage.name,
    type: stage.type || nodeTypes[index],
    canvasModuleId: stage.type || nodeTypes[index],
    chain: index < 3 ? 'public' : 'private',
    definition: stage.transformation,
    method: stage.action,
    industries: detail.industry,
    cost: 0,
    costStatus: 'not_individually_estimated',
    difficulty: difficultyValue(detail.difficulty),
    risk: 0,
    riskStatus: 'not_individually_estimated',
    reuse: stage.reusableUnit,
    epistemicStatus: stage.epistemicStatus,
  };
}

export const cases = caseCatalog.map((catalogItem, index) => {
  const detail = freeById[catalogItem.id];
  const costLabel = detail?.cost || catalogItem.cost;
  const source = detail ? { ...catalogItem, ...detail, id: catalogItem.id, title: catalogItem.name } : null;
  return {
    id: catalogItem.id,
    title: catalogItem.name,
    shortTitle: catalogItem.name.split('：')[0].slice(0, 12),
    industry: catalogItem.industry,
    tags: catalogItem.tags || [],
    difficulty: difficultyValue(catalogItem.difficulty),
    difficultyLabel: catalogItem.difficulty,
    startupCost: detail?.startupCost?.experimentCashCNY?.[0] ?? minimumCost(costLabel),
    costLabel,
    score: 0,
    scoreLabel: '不设经营评分',
    hasScore: false,
    access: catalogItem.access,
    accessLabel: catalogItem.accessLabel,
    locked: !detail,
    featured: Boolean(detail && index < 3),
    value: catalogItem.valueProposition,
    offer: catalogItem.offer || '',
    payer: catalogItem.payer || '',
    purchaseReason: catalogItem.purchaseReason || '',
    evidenceCheckedOn: catalogItem.evidenceCheckedOn || '',
    sourceTier: catalogItem.sourceTier,
    sourceStatusLabel: catalogItem.sourceTier === 'official_page' ? '官方公开页面记录' : '官方页面索引线索',
    proofSources: detail?.factualBasis?.sources || [],
    delivery: detail?.delivery || '',
    chargingModel: detail?.chargingModel || '',
    moneyFlow: detail?.moneyFlow || '',
    acquisition: detail?.acquisition?.visibleChannels || '',
    originalEvidence: detail?.factualBasis?.observation || '',
    entryRequirements: detail?.requirements?.skills || '',
    chain: detail?.chainSummary ? detail.chainSummary.replaceAll(' -> ', ' → ') : '',
    compliance: detail?.complianceHint || catalogItem.complianceHint,
    sourceUrls: catalogItem.sourceUrls || [],
    evidenceLabel: 'E1 公开运营依据',
    validation: detail?.validation || null,
    principle: detail?.principle || '',
    nodes: detail ? detail.stages.map((stage) => stageToNode(stage, detail)) : [],
    businessStages: source ? composeBusinessStages(source) : [],
    businessNodes: source ? buildBusinessNodes(source) : [],
    planet: {
      color: webPalette[index % webPalette.length],
      orbitBand: index % 5,
      size: index < 3 ? .13 : .065,
    },
  };
});

export { caseLibraryMeta };

export const modules = [
  { id: 'exposure', name: '卖点定位', chain: '公域', color: '#d9bb72', cost: 10, difficulty: 1, risk: 15, hint: '把商品、价值和承诺边界说清楚' },
  { id: 'traffic', name: '引流获客', chain: '公域', color: '#62c7d9', cost: 20, difficulty: 2, risk: 25, hint: '把注意力带到承接位置' },
  { id: 'nurture', name: '种草教育', chain: '公域', color: '#9b87e8', cost: 20, difficulty: 2, risk: 18, hint: '建立理解与可核实的购买理由' },
  { id: 'conversion', name: '转化成交', chain: '私域', color: '#aab4c7', cost: 10, difficulty: 2, risk: 20, hint: '把兴趣变成明确交易约定' },
  { id: 'transaction', name: '收款', chain: '私域', color: '#d9bb72', cost: 10, difficulty: 3, risk: 30, hint: '区分订单、到账、退款和成本' },
  { id: 'delivery', name: '产品交付', chain: '私域', color: '#62c7d9', cost: 30, difficulty: 3, risk: 22, hint: '按约交付并减少返工' },
  { id: 'retention', name: '复购裂变', chain: '私域', color: '#65c799', cost: 20, difficulty: 3, risk: 18, hint: '由可验证结果带来再次购买或分享' },
  { id: 'referral', name: '裂变', chain: '私域', color: '#9b87e8', cost: 10, difficulty: 3, risk: 26, hint: '可验证成果带来自然分享' },
  { id: 'profit', name: '利润', chain: '私域', color: '#d9bb72', cost: 0, difficulty: 2, risk: 12, hint: '收入减去完整成本' },
  { id: 'risk', name: '风控', chain: '私域', color: '#ef7d83', cost: 0, difficulty: 2, risk: 8, hint: '版权、规则、隐私与承诺' },
];
