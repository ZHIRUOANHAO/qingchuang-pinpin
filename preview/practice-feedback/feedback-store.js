const STORAGE_KEY = 'qingchuang:practice-feedback:v1'
const TYPES = new Set(['practice', 'question'])
const OUTCOMES = new Set(['worked', 'mixed', 'failed', 'unknown'])
const TEXT_LIMITS = {
  id: 80,
  caseId: 80,
  caseTitle: 200,
  type: 20,
  outcome: 20,
  action: 2000,
  period: 200,
  context: 2000,
  result: 3000,
  evidence: 4000,
  evidenceUrl: 2048,
  comment: 2000,
  exerciseId: 80,
  exerciseTitle: 200
}
const EXERCISE_FIELDS = new Set(['exerciseId', 'exerciseTitle'])
const FIELD_NAMES = {
  id: '草稿编号',
  caseId: '所属案例编号',
  caseTitle: '所属案例名称',
  type: '记录类型',
  outcome: '实践结果类型',
  action: '实际做法',
  period: '实践时间或周期',
  context: '实践条件与限制',
  result: '观察到的结果',
  evidence: '证据说明',
  evidenceUrl: '公开证据链接',
  comment: '补充评论或问题',
  exerciseId: '情境练习编号',
  exerciseTitle: '情境练习名称'
}
const DRAFT_FIELDS = [...Object.keys(TEXT_LIMITS), 'status', 'createdAt', 'updatedAt']
const OUTCOME_NAMES = {
  worked: '达到了本次预期',
  mixed: '部分达到预期',
  failed: '未达到本次预期',
  unknown: '暂时无法判断'
}

function ownValue(input, key) {
  if (!input || typeof input !== 'object') return undefined
  return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined
}

function textValue(input, key) {
  const value = ownValue(input, key)
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : ''
}

function exerciseErrors(input) {
  const errors = {}
  for (const field of EXERCISE_FIELDS) {
    const value = ownValue(input, field)
    if (value === undefined) continue
    if (typeof value !== 'string') errors[field] = `${FIELD_NAMES[field]}必须为文字。`
    else if (value.trim().length > TEXT_LIMITS[field]) errors[field] = `${FIELD_NAMES[field]}最多 ${TEXT_LIMITS[field]} 字。`
  }
  const exerciseId = textValue(input, 'exerciseId')
  const exerciseTitle = textValue(input, 'exerciseTitle')
  if (Boolean(exerciseId) !== Boolean(exerciseTitle)) {
    errors[exerciseId ? 'exerciseTitle' : 'exerciseId'] = '情境练习编号与名称需要同时填写，或同时留空。'
  }
  if (exerciseId && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(exerciseId)) {
    errors.exerciseId = '情境练习编号仅支持英文字母、数字、连字符和下划线，且以字母或数字开头。'
  }
  return errors
}

function timestampIsValid(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false
  return new Date(value).toISOString() === value
}

function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `draft_${globalThis.crypto.randomUUID()}`
  }
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function fieldError(errors, message = '草稿内容不完整，请按提示补充后保存。') {
  const error = new Error(message)
  error.name = 'DraftValidationError'
  error.code = 'DRAFT_INVALID'
  error.errors = errors
  return error
}

function storageError(message, code, cause) {
  const error = new Error(message)
  error.name = 'DraftStorageError'
  error.code = code
  if (cause) error.cause = cause
  return error
}

function storage() {
  try {
    const value = globalThis.localStorage
    if (!value || typeof value.getItem !== 'function' || typeof value.setItem !== 'function') {
      throw new Error('localStorage unavailable')
    }
    return value
  } catch (cause) {
    throw storageError('当前浏览器无法使用本地存储，草稿没有保存。请先导出或复制记录，再检查浏览器设置。', 'STORAGE_UNAVAILABLE', cause)
  }
}

function copyDraft(draft) {
  return Object.fromEntries(DRAFT_FIELDS
    .filter(field => !EXERCISE_FIELDS.has(field) || ownValue(draft, field) !== undefined)
    .map(field => [field, draft[field]]))
}

function linkError(value) {
  if (!/^https:\/\//i.test(value) || /\s/.test(value)) {
    return '请填写完整且不含空白字符的 HTTPS 公开链接，或留空。'
  }
  let url
  try {
    url = new URL(value)
  } catch {
    return '请填写完整的 HTTPS 公开链接，或留空。'
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return '证据链接仅支持不含账号密码的 HTTPS 公开链接。'
  }
  const hostname = url.hostname.toLowerCase()
  const localDomain = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? hostname.split('.').map(Number) : null
  const privateIPv4 = ipv4 && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 ||
    (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
    (ipv4[0] === 192 && ipv4[1] === 168))
  const privateIPv6 = hostname === '[::1]' || hostname === '[::]' || /^\[(?:fc|fd|fe8|fe9|fea|feb)/.test(hostname) || hostname.startsWith('[::ffff:')
  if (!hostname || localDomain || privateIPv4 || privateIPv6 || (!hostname.includes('.') && !hostname.startsWith('['))) {
    return '请使用可供他人访问的公开链接，不要填写本机或内网地址。'
  }
  return ''
}

/** Build a local draft only; this function never grants verified/published status. */
export function createDraft(input = {}) {
  const metadataErrors = exerciseErrors(input)
  if (Object.keys(metadataErrors).length) throw fieldError(metadataErrors)
  const now = new Date().toISOString()
  const draft = Object.fromEntries(Object.keys(TEXT_LIMITS)
    .filter(field => !EXERCISE_FIELDS.has(field) || ownValue(input, field) !== undefined)
    .map(field => [field, textValue(input, field)]))
  draft.id = draft.id || newId()
  draft.status = 'local_draft'
  draft.createdAt = timestampIsValid(ownValue(input, 'createdAt')) ? ownValue(input, 'createdAt') : now
  draft.updatedAt = timestampIsValid(ownValue(input, 'updatedAt')) ? ownValue(input, 'updatedAt') : now
  return draft
}

/** Validate without mutating or assuming that missing results mean success. */
export function validateDraft(draft) {
  const errors = {}
  const warnings = []
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { valid: false, errors: { draft: '草稿格式不正确。' }, warnings }
  }
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = ownValue(draft, field)
    if (EXERCISE_FIELDS.has(field) && value === undefined) continue
    if (typeof value !== 'string') {
      errors[field] = `${FIELD_NAMES[field]}必须为文字。`
    } else if (value.length > limit) {
      errors[field] = `${FIELD_NAMES[field]}最多 ${limit} 字，请缩短后保存。`
    } else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      errors[field] = `${FIELD_NAMES[field]}含有不可用的控制字符，请删除后保存。`
    }
  }
  Object.assign(errors, exerciseErrors(draft))
  for (const field of ['id', 'caseId', 'caseTitle']) {
    if (typeof ownValue(draft, field) === 'string' && !draft[field].trim()) {
      errors[field] = `请填写${FIELD_NAMES[field]}。`
    }
  }
  for (const field of ['id', 'caseId']) {
    if (typeof ownValue(draft, field) === 'string' && /\s/.test(draft[field])) {
      errors[field] = `${FIELD_NAMES[field]}不能包含空白字符。`
    }
  }
  const type = ownValue(draft, 'type')
  const outcome = ownValue(draft, 'outcome')
  if (!TYPES.has(type)) errors.type = '请选择“实践记录”或“问题”。'
  if (!OUTCOMES.has(outcome)) errors.outcome = '请选择实践结果；尚无结果时请选择“暂时无法判断”。'
  if (type === 'practice') {
    for (const field of ['action', 'period', 'context', 'result', 'evidence']) {
      if (typeof ownValue(draft, field) === 'string' && !draft[field].trim()) {
        errors[field] = `请填写${FIELD_NAMES[field]}。`
      }
    }
    warnings.push('记录为个人自述，尚未经独立核验；公开链接本身不代表结果已经得到证明。')
  } else if (type === 'question' && typeof ownValue(draft, 'comment') === 'string' && !draft.comment.trim()) {
    errors.comment = '请填写你的具体问题。'
  }
  if (textValue(draft, 'exerciseId')) {
    warnings.push('此记录来自入门情境练习，练习完成不代表原案例经营效果已被复现或验证。')
  }
  const evidenceUrl = ownValue(draft, 'evidenceUrl')
  if (typeof evidenceUrl === 'string' && evidenceUrl.trim() && !errors.evidenceUrl) {
    const message = linkError(evidenceUrl)
    if (message) errors.evidenceUrl = message
  }
  if (ownValue(draft, 'status') !== 'local_draft') {
    errors.status = '预览仅支持本机草稿，不能导入“已发布”或“已验证”状态。'
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (!timestampIsValid(ownValue(draft, field))) errors[field] = '草稿时间格式不正确。'
  }
  if (!errors.createdAt && !errors.updatedAt && Date.parse(draft.updatedAt) < Date.parse(draft.createdAt)) {
    errors.updatedAt = '更新时间不能早于创建时间。'
  }
  return { valid: Object.keys(errors).length === 0, errors, warnings }
}

function readDrafts() {
  let raw
  try {
    raw = storage().getItem(STORAGE_KEY)
  } catch (cause) {
    if (cause && cause.code === 'STORAGE_UNAVAILABLE') throw cause
    throw storageError('无法读取本机草稿，现有内容未被改写。请检查浏览器的本地存储权限。', 'STORAGE_READ_FAILED', cause)
  }
  if (raw === null) return []
  let records
  try {
    records = JSON.parse(raw)
    if (!Array.isArray(records)) throw new Error('Expected draft array')
    const ids = new Set()
    for (const draft of records) {
      if (!validateDraft(draft).valid || ids.has(draft.id) || Object.keys(draft).some(field => !DRAFT_FIELDS.includes(field))) {
        throw new Error('Invalid local draft')
      }
      ids.add(draft.id)
    }
  } catch (cause) {
    throw storageError('本机草稿数据损坏或格式不兼容，原始内容已保留，未自动覆盖。请先备份该浏览器的草稿数据，再处理存储问题。', 'STORAGE_CORRUPT', cause)
  }
  return records.map(copyDraft)
}

function writeDrafts(records) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (cause) {
    if (cause && cause.code === 'STORAGE_UNAVAILABLE') throw cause
    throw storageError('草稿未能保存到本机，可能是存储空间不足或浏览器禁止写入。请先导出或复制记录，勿关闭当前页面。', 'STORAGE_WRITE_FAILED', cause)
  }
}

/** Save or edit only this preview's local drafts, preserving existing creation time. */
export function saveDraft(input) {
  const inputStatus = ownValue(input, 'status')
  if (inputStatus !== undefined && inputStatus !== 'local_draft') {
    throw fieldError({ status: '预览仅支持本机草稿，不能保存“已发布”或“已验证”状态。' })
  }
  const draft = createDraft(input)
  const validation = validateDraft(draft)
  if (!validation.valid) throw fieldError(validation.errors)
  const records = readDrafts()
  const index = records.findIndex(record => record.id === draft.id)
  const now = new Date().toISOString()
  if (index >= 0) {
    if (records[index].caseId !== draft.caseId) {
      throw fieldError({ caseId: '已有草稿的所属案例不能更改，请为另一个案例新建草稿。' })
    }
    const previous = records[index]
    if (ownValue(input, 'exerciseId') === undefined && ownValue(input, 'exerciseTitle') === undefined) {
      for (const field of EXERCISE_FIELDS) {
        if (ownValue(previous, field) !== undefined) draft[field] = previous[field]
      }
    }
    if ((previous.exerciseId || '') !== (draft.exerciseId || '')) {
      throw fieldError({ exerciseId: '已有草稿的练习来源不能更改或删除，请为新的来源新建草稿。' })
    }
    draft.createdAt = records[index].createdAt
    draft.updatedAt = now
    records[index] = draft
  } else {
    draft.createdAt = now
    draft.updatedAt = now
    records.unshift(draft)
  }
  writeDrafts(records)
  return copyDraft(draft)
}

export function listDrafts(caseId) {
  if (caseId !== undefined && (typeof caseId !== 'string' || !caseId.trim())) {
    throw fieldError({ caseId: '请提供有效的所属案例编号。' })
  }
  return readDrafts()
    .filter(draft => caseId === undefined || draft.caseId === caseId.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}

export function getDraft(id) {
  if (typeof id !== 'string' || !id.trim()) return null
  return readDrafts().find(draft => draft.id === id.trim()) || null
}

export function deleteDraft(id) {
  if (typeof id !== 'string' || !id.trim()) return false
  const records = readDrafts()
  const remaining = records.filter(draft => draft.id !== id.trim())
  if (remaining.length === records.length) return false
  writeDrafts(remaining)
  return true
}

/** Export for manual sharing. Exporting neither uploads nor publishes anything. */
export function exportDraft(draft) {
  const validation = validateDraft(draft)
  if (!validation.valid) throw fieldError(validation.errors, '记录内容不完整，请按提示补充后再导出。')
  const lines = [
    '轻创拼拼 · 个人记录',
    '状态：本机草稿，未在平台公开发布。',
    '证据边界：以下为个人自述，未经独立核验，不代表案例已获验证，也不保证他人可以取得相同结果。',
    `案例：${draft.caseTitle}（${draft.caseId}）`,
    `类型：${draft.type === 'practice' ? '实践记录' : '问题'}`
  ]
  if (textValue(draft, 'exerciseId')) {
    lines.push(`来源：入门情境练习「${draft.exerciseTitle}」（${draft.exerciseId}；不代表原案例经营复现）。`)
  }
  if (draft.type === 'practice') {
    lines.push(
      `${textValue(draft, 'exerciseId') ? '本次练习结果' : '结果类型'}：${OUTCOME_NAMES[draft.outcome]}`,
      `实际做法：${draft.action}`,
      `实践时间或周期：${draft.period}`,
      `实践条件与限制：${draft.context}`,
      `观察到的结果：${draft.result}`,
      `证据说明：${draft.evidence}`
    )
  }
  if (draft.evidenceUrl) lines.push(`公开证据链接（仅供对照）：${draft.evidenceUrl}`)
  if (draft.comment) lines.push(`${draft.type === 'question' ? '具体问题' : '补充评论'}：${draft.comment}`)
  lines.push(`创建时间：${draft.createdAt}`, `最后修改：${draft.updatedAt}`)
  return lines.join('\n\n')
}
