import assert from 'node:assert/strict'
import {
  createDraft,
  validateDraft,
  saveDraft,
  listDrafts,
  getDraft,
  deleteDraft,
  exportDraft
} from '../preview/practice-feedback/feedback-store.js'

const KEY = 'qingchuang:practice-feedback:v1'
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const oldMiniProgramKey = 'qingchuang_favorites'

class MemoryStorage {
  constructor() {
    this.items = new Map([[oldMiniProgramKey, '["existing-user-favorite"]']])
    this.failRead = false
    this.failWrite = false
    this.writes = 0
  }

  getItem(key) {
    if (this.failRead) throw new Error('Browser blocked read')
    return this.items.has(key) ? this.items.get(key) : null
  }

  setItem(key, value) {
    if (this.failWrite) throw new Error('Quota exceeded')
    this.writes += 1
    this.items.set(key, String(value))
  }
}

function useStorage(value = new MemoryStorage()) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value })
  return value
}

function practice(overrides = {}) {
  return {
    caseId: 'real_001',
    caseTitle: '示例案例（仅用于自动化测试）',
    type: 'practice',
    outcome: 'unknown',
    action: '向两位符合条件的朋友展示自己制作的样品，并记录反馈。',
    period: '2026-10-14，当天 30 分钟',
    context: '没有广告预算，访谈对象为熟人，不能代表陌生用户。',
    result: '一位提出改进建议，一位未回复，目前无法判断需求。',
    evidence: '访谈文字记录已由本人保留，导出仅包含去标识化的反馈摘要。',
    evidenceUrl: '',
    comment: '',
    ...overrides
  }
}

function expectError(operation, code, field) {
  assert.throws(operation, error => {
    assert.equal(error.code, code)
    assert.match(error.message, /[\u4e00-\u9fff]/, 'User-facing errors are understandable Chinese')
    if (field) assert.ok(error.errors?.[field], `Error identifies ${field}`)
    return true
  })
}

try {
  const memory = useStorage()
  assert.deepEqual(listDrafts(), [], 'A new browser has no pretend historical contributions')
  assert.equal(getDraft('missing'), null)
  assert.equal(deleteDraft('missing'), false)
  assert.equal(memory.writes, 0)

  const sourceInput = Object.freeze(practice({ action: '  做法\r\n第二行  ', ignored: 'not persisted' }))
  const standard = createDraft(sourceInput)
  assert.equal(standard.action, '做法\n第二行')
  assert.equal(standard.status, 'local_draft')
  assert.ok(standard.id)
  assert.equal('ignored' in standard, false)
  assert.equal(validateDraft(standard).valid, true)
  assert.ok(validateDraft(standard).warnings.some(warning => warning.includes('未经独立核验')))
  assert.equal(sourceInput.action, '  做法\r\n第二行  ', 'Creation does not mutate the caller')
  assert.deepEqual(Object.keys(standard).sort(), [
    'id', 'caseId', 'caseTitle', 'type', 'outcome', 'action', 'period', 'context', 'result',
    'evidence', 'evidenceUrl', 'comment', 'status', 'createdAt', 'updatedAt'
  ].sort(), 'The model uses only the agreed fields')

  const saved = saveDraft(standard)
  assert.deepEqual(getDraft(saved.id), saved, 'Saved values survive a fresh read')
  assert.equal(saved.status, 'local_draft')
  assert.equal(JSON.parse(memory.items.get(KEY)).length, 1)
  const detached = getDraft(saved.id)
  detached.result = 'changed only in memory'
  assert.equal(getDraft(saved.id).result, saved.result, 'Callers cannot mutate persisted records through returned objects')

  const edited = saveDraft({ ...saved, outcome: 'mixed', result: '后续已收到两位反馈，有一位愿意进一步试用。', createdAt: '2000-01-01T00:00:00.000Z' })
  assert.equal(edited.id, saved.id)
  assert.equal(edited.createdAt, saved.createdAt, 'Editing retains the stored creation time')
  assert.ok(edited.updatedAt >= saved.updatedAt)
  assert.equal(listDrafts().length, 1, 'Editing replaces the draft rather than duplicating it')
  assert.equal(getDraft(saved.id).outcome, 'mixed')
  expectError(() => saveDraft({ ...edited, caseId: 'real_002' }), 'DRAFT_INVALID', 'caseId')
  assert.equal(getDraft(saved.id).caseId, 'real_001')

  const anotherCase = saveDraft(practice({ caseId: 'real_002', caseTitle: '另一个测试案例', outcome: 'failed', result: '两位都没有继续试用，未达到本次预期。' }))
  assert.deepEqual(listDrafts('real_001').map(draft => draft.id), [saved.id])
  assert.deepEqual(listDrafts('real_002').map(draft => draft.id), [anotherCase.id])
  assert.deepEqual(listDrafts('absent'), [])
  expectError(() => listDrafts(''), 'DRAFT_INVALID', 'caseId')

  for (const outcome of ['worked', 'mixed', 'failed', 'unknown']) {
    const record = saveDraft(practice({ outcome }))
    assert.equal(getDraft(record.id).outcome, outcome, `The ${outcome} result remains exactly what the author selected`)
    assert.equal(getDraft(record.id).status, 'local_draft', 'No outcome automatically verifies a case')
  }
  for (const field of ['caseId', 'caseTitle', 'action', 'period', 'context', 'result', 'evidence', 'outcome', 'type']) {
    const incomplete = practice({ [field]: '   ' })
    const validation = validateDraft(createDraft(incomplete))
    assert.equal(validation.valid, false, `${field} is required`)
    assert.ok(validation.errors[field])
    expectError(() => saveDraft(incomplete), 'DRAFT_INVALID', field)
  }
  expectError(() => saveDraft(practice({ evidence: '', evidenceUrl: 'https://example.com/proof' })), 'DRAFT_INVALID', 'evidence')
  expectError(() => saveDraft(practice({ outcome: 'verified' })), 'DRAFT_INVALID', 'outcome')
  expectError(() => saveDraft(practice({ type: 'success' })), 'DRAFT_INVALID', 'type')
  assert.equal(createDraft({}).outcome, '', 'Missing outcomes are not silently marked successful')
  assert.equal(createDraft({}).type, '', 'Missing type is not silently accepted')
  expectError(() => saveDraft(practice({ action: '过'.repeat(2001) })), 'DRAFT_INVALID', 'action')
  expectError(() => saveDraft(practice({ caseTitle: '非法\u0000字符' })), 'DRAFT_INVALID', 'caseTitle')
  expectError(() => saveDraft(practice({ caseId: 'real 001' })), 'DRAFT_INVALID', 'caseId')

  const questionInput = {
    caseId: 'real_001', caseTitle: '测试案例', type: 'question', outcome: 'unknown',
    comment: '如果没有现成受众，应如何找到第一位试用者？'
  }
  const question = saveDraft(questionInput)
  assert.equal(question.type, 'question')
  assert.equal(question.action, '')
  assert.equal(question.status, 'local_draft')
  expectError(() => saveDraft({ ...questionInput, comment: '' }), 'DRAFT_INVALID', 'comment')

  const allowedLink = saveDraft(practice({ evidenceUrl: 'https://example.com/notes?case=1#feedback' }))
  assert.equal(allowedLink.evidenceUrl, 'https://example.com/notes?case=1#feedback')
  for (const evidenceUrl of [
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/private.txt',
    'http://example.com', 'https://name:secret@example.com', 'https://name@example.com',
    'https://localhost/secret', 'https://127.0.0.1/', 'https://192.168.0.1/', 'https://10.0.0.1/',
    'https://172.16.0.1/', 'https://[::1]/', 'https://[fd00::1]/', 'https://host.local/',
    'https:example.com', 'https://example.com/line\nbreak', 'not a link'
  ]) {
    expectError(() => saveDraft(practice({ evidenceUrl })), 'DRAFT_INVALID', 'evidenceUrl')
  }

  const attack = JSON.parse(JSON.stringify(practice()))
  Object.defineProperty(attack, '__proto__', { enumerable: true, value: { polluted: true } })
  attack.extra = { status: 'verified' }
  const safe = saveDraft(attack)
  assert.equal('extra' in safe, false)
  assert.equal(Object.getPrototypeOf(safe), Object.prototype)
  assert.equal(Object.prototype.polluted, undefined)
  const inherited = Object.create(practice())
  const inheritedValidation = validateDraft(createDraft(inherited))
  assert.equal(inheritedValidation.valid, false, 'Inherited data cannot stand in for submitted own fields')
  assert.ok(inheritedValidation.errors.caseId)

  for (const status of ['verified', 'published', 'approved']) {
    const injected = practice({ status })
    assert.equal(createDraft(injected).status, 'local_draft', 'Creation always produces a local-only object')
    expectError(() => saveDraft(injected), 'DRAFT_INVALID', 'status')
    assert.equal(validateDraft({ ...safe, status }).valid, false)
  }

  const exported = exportDraft(edited)
  assert.match(exported, /本机草稿，未在平台公开发布/)
  assert.match(exported, /个人自述，未经独立核验/)
  assert.match(exported, /实际做法/)
  assert.match(exported, /实践条件与限制/)
  assert.match(exported, /证据说明/)
  assert.match(exportDraft(question), /具体问题/)
  assert.doesNotMatch(exportDraft(question), /结果类型/)
  const beforeExport = memory.writes
  exportDraft(safe)
  assert.equal(memory.writes, beforeExport, 'Export neither changes storage nor pretends to publish')
  expectError(() => exportDraft({ ...safe, status: 'published' }), 'DRAFT_INVALID', 'status')
  expectError(() => exportDraft({ ...safe, evidence: '' }), 'DRAFT_INVALID', 'evidence')

  const exerciseInput = practice({
    exerciseId: 'everyday-price-list',
    exerciseTitle: '小店价目表情境练习',
    outcome: 'worked',
    action: '整理三款示例商品的名称和价格，并请一位朋友查看是否清楚。',
    result: '朋友能读懂价目表；仅完成了情境任务，没有实际交易。',
    evidence: '保留了价目表文件及该朋友的去标识化反馈摘要。'
  })
  const exerciseStandard = createDraft(exerciseInput)
  assert.equal(exerciseStandard.exerciseId, exerciseInput.exerciseId)
  assert.equal(exerciseStandard.exerciseTitle, exerciseInput.exerciseTitle)
  assert.ok(validateDraft(exerciseStandard).warnings.some(warning => warning.includes('练习完成不代表原案例经营效果')))
  const exercise = saveDraft(exerciseStandard)
  assert.equal(getDraft(exercise.id).exerciseId, exerciseInput.exerciseId)
  assert.equal(getDraft(exercise.id).exerciseTitle, exerciseInput.exerciseTitle)
  assert.equal(listDrafts('real_001').find(draft => draft.id === exercise.id).status, 'local_draft')
  assert.equal(getDraft(exercise.id).outcome, 'worked', 'Completing the exercise still records only the author-selected local outcome')
  const exerciseExport = exportDraft(exercise)
  assert.match(exerciseExport, /来源：入门情境练习「小店价目表情境练习」/)
  assert.match(exerciseExport, /不代表原案例经营复现/)
  assert.match(exerciseExport, /本次练习结果：达到了本次预期/)
  assert.match(exerciseExport, /个人自述，未经独立核验/)
  assert.doesNotMatch(exportDraft(edited), /来源：入门情境练习/, 'Ordinary case exports retain their previous meaning')
  const noMetadataEdit = { ...exercise, comment: '补充了朋友的一条建议。' }
  delete noMetadataEdit.exerciseId
  delete noMetadataEdit.exerciseTitle
  assert.equal(saveDraft(noMetadataEdit).exerciseId, exercise.exerciseId, 'Editing a record cannot accidentally drop its exercise origin')
  expectError(() => saveDraft({ ...exercise, exerciseId: '', exerciseTitle: '' }), 'DRAFT_INVALID', 'exerciseId')
  expectError(() => saveDraft({ ...exercise, exerciseId: 'everyday-resume' }), 'DRAFT_INVALID', 'exerciseId')
  expectError(() => saveDraft({ ...edited, exerciseId: 'new-exercise', exerciseTitle: '新增来源' }), 'DRAFT_INVALID', 'exerciseId')
  expectError(() => saveDraft({ ...exerciseInput, evidence: '' }), 'DRAFT_INVALID', 'evidence')
  assert.equal(createDraft({ exerciseId: '', exerciseTitle: '' }).outcome, '', 'Exercise metadata does not invent an outcome or evidence')
  const blankExercise = saveDraft(practice({ exerciseId: '', exerciseTitle: '' }))
  assert.equal(validateDraft(blankExercise).valid, true)
  assert.doesNotMatch(exportDraft(blankExercise), /来源：入门情境练习/)

  for (const [metadata, field] of [
    [{ exerciseId: 'price-list' }, 'exerciseTitle'],
    [{ exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: 'price-list', exerciseTitle: '  ' }, 'exerciseTitle'],
    [{ exerciseId: '价目表', exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: '../price-list', exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: 'price list', exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: '-price-list', exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: 'p'.repeat(81), exerciseTitle: '小店价目表' }, 'exerciseId'],
    [{ exerciseId: 'price-list', exerciseTitle: '表'.repeat(201) }, 'exerciseTitle'],
    [{ exerciseId: 123, exerciseTitle: '' }, 'exerciseId'],
    [{ exerciseId: '', exerciseTitle: { name: 'not text' } }, 'exerciseTitle']
  ]) {
    expectError(() => createDraft(practice(metadata)), 'DRAFT_INVALID', field)
    expectError(() => saveDraft(practice(metadata)), 'DRAFT_INVALID', field)
    assert.ok(validateDraft({ ...standard, ...metadata }).errors[field])
  }

  const beforeLegacyRead = memory.items.get(KEY)
  const legacy = { ...safe }
  delete legacy.exerciseId
  delete legacy.exerciseTitle
  memory.items.set(KEY, JSON.stringify([legacy]))
  const legacySerialized = memory.items.get(KEY)
  const writesBeforeLegacy = memory.writes
  assert.deepEqual(listDrafts(), [legacy], 'Pre-exercise schema is read as-is without adding fields or outcomes')
  assert.deepEqual(getDraft(legacy.id), legacy)
  assert.equal(validateDraft(legacy).valid, true)
  assert.doesNotMatch(exportDraft(legacy), /来源：入门情境练习/)
  assert.equal(memory.items.get(KEY), legacySerialized, 'Reading the old schema never rewrites stored content')
  assert.equal(memory.writes, writesBeforeLegacy)
  const legacyEdited = saveDraft({ ...legacy, comment: '编辑旧记录的评论。' })
  assert.equal('exerciseId' in legacyEdited, false, 'Ordinary case drafts keep their old shape when edited')
  assert.equal('exerciseTitle' in legacyEdited, false)
  assert.equal(legacyEdited.outcome, legacy.outcome)
  memory.items.set(KEY, beforeLegacyRead)

  assert.equal(deleteDraft(anotherCase.id), true)
  assert.equal(getDraft(anotherCase.id), null)
  assert.equal(deleteDraft(anotherCase.id), false)
  assert.equal(getDraft(saved.id).id, saved.id, 'Deleting a case draft does not delete another case draft')
  assert.equal(memory.items.get(oldMiniProgramKey), '["existing-user-favorite"]', 'Preview never touches the existing mini-program key')

  const priorContents = memory.items.get(KEY)
  memory.failWrite = true
  expectError(() => saveDraft(practice()), 'STORAGE_WRITE_FAILED')
  expectError(() => deleteDraft(saved.id), 'STORAGE_WRITE_FAILED')
  assert.equal(memory.items.get(KEY), priorContents, 'Failed writes do not produce a saved acknowledgement or remove data')
  memory.failWrite = false
  memory.failRead = true
  expectError(() => listDrafts(), 'STORAGE_READ_FAILED')
  expectError(() => saveDraft(practice()), 'STORAGE_READ_FAILED')
  assert.equal(memory.items.get(KEY), priorContents)
  memory.failRead = false

  for (const corrupted of [
    '', '{bad json', 'null', '{}', '[{}]',
    JSON.stringify([{ ...safe, status: 'published' }]),
    JSON.stringify([{ ...safe, outcome: '' }]),
    JSON.stringify([{ ...safe, type: 'unknown-type' }]),
    JSON.stringify([{ ...safe, evidenceUrl: 'javascript:alert(1)' }]),
    JSON.stringify([{ ...safe, exerciseId: 'price-list' }]),
    JSON.stringify([{ ...safe, exerciseId: '../unsafe', exerciseTitle: '小店价目表' }]),
    JSON.stringify([{ ...safe, unexpected: 'unsupported imported content' }]),
    JSON.stringify([safe, safe])
  ]) {
    memory.items.set(KEY, corrupted)
    const priorWrites = memory.writes
    expectError(() => listDrafts(), 'STORAGE_CORRUPT')
    expectError(() => getDraft(safe.id), 'STORAGE_CORRUPT')
    expectError(() => saveDraft(practice()), 'STORAGE_CORRUPT')
    expectError(() => deleteDraft(safe.id), 'STORAGE_CORRUPT')
    assert.equal(memory.items.get(KEY), corrupted, 'Corrupt originals remain available for manual recovery')
    assert.equal(memory.writes, priorWrites, 'No corruption recovery silently resets the draft list')
  }

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })
  expectError(() => listDrafts(), 'STORAGE_UNAVAILABLE')
  expectError(() => saveDraft(practice()), 'STORAGE_UNAVAILABLE')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
  expectError(() => listDrafts(), 'STORAGE_UNAVAILABLE')
  expectError(() => saveDraft(practice()), 'STORAGE_UNAVAILABLE')

  console.log('Practice feedback draft checks passed: local save/edit/recovery, case isolation, honest outcomes, exercise origin and legacy compatibility, evidence validation, safe export, and storage failure/corruption handling.')
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
}
