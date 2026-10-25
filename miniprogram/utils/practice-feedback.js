const STORAGE_KEY = 'practiceFeedback'
const TYPE_LABELS = { practice: '实践记录', question: '问题' }
const OUTCOME_LABELS = { worked: '达到预期', mixed: '部分有效', failed: '未达预期', unknown: '尚不确定' }
const TEXT_LIMITS = {
  id: 80, caseId: 80, caseTitle: 200, type: 20, outcome: 20,
  action: 2000, period: 200, context: 2000, result: 3000,
  evidence: 4000, evidenceUrl: 2048, comment: 2000,
  exerciseId: 80, exerciseTitle: 200
}
const FIELD_NAMES = {
  id: '记录编号', caseId: '所属案例编号', caseTitle: '所属案例名称', type: '记录类型', outcome: '结果类型',
  action: '实际做法', period: '实践时间或周期', context: '条件与限制', result: '观察到的结果',
  evidence: '证据说明', evidenceUrl: '公开证据链接', comment: '补充评论或问题',
  exerciseId: '练习编号', exerciseTitle: '练习名称'
}
const TEXT_FIELDS = Object.keys(TEXT_LIMITS)
const ALL_FIELDS = TEXT_FIELDS.concat(['status', 'createdAt', 'updatedAt'])

function own(input, field) { return input && Object.prototype.hasOwnProperty.call(input, field) ? input[field] : undefined }
function plain(input) { return Boolean(input && typeof input === 'object' && !Array.isArray(input)) }
function value(input, field) { return typeof own(input, field) === 'string' ? input[field].replace(/\r\n?/g, '\n').trim() : '' }
function fail(message, code, errors) {
  const error = new Error(message)
  error.code = code
  if (errors) error.errors = errors
  return error
}
function validTime(input) { return typeof input === 'string' && Number.isFinite(Date.parse(input)) && new Date(input).toISOString() === input }
function copy(record) { return Object.assign({}, record) }

// Native mini programs do not consistently provide the browser URL class.
function linkError(link) {
  if (!/^https:\/\//i.test(link) || /[\s\\\u0000-\u001f\u007f]/.test(link)) return '请填写完整、不含空白字符的 HTTPS 公开链接，或留空。'
  const match = /^https:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(link)
  if (!match || /[@%]/.test(match[1])) return '证据链接不能包含账号密码或编码后的主机地址。'
  const authority = match[1]
  const parts = /^([^:]+)(?::([0-9]{1,5}))?$/.exec(authority)
  if (!parts || (parts[2] && (Number(parts[2]) < 1 || Number(parts[2]) > 65535))) return '请填写有效的 HTTPS 公开域名链接。'
  const host = parts[1].toLowerCase()
  if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host) || host.length > 253) return '请使用公开链接，不要填写本机或内网地址。'
  if (/^[0-9.]+$/.test(host)) {
    const ip = host.split('.').map(Number)
    if (ip.length !== 4 || ip.some(part => part > 255) || /(^|\.)0\d/.test(host) || ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 ||
      (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] === 192 && ip[1] === 168)) return '请使用公开链接，不要填写本机或内网地址。'
  } else if (!host.includes('.') || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^[0-9]+$/.test(host.split('.').pop())) {
    return '请填写有效的 HTTPS 公开域名链接。'
  }
  return ''
}

function errorsFor(input, complete) {
  if (!plain(input)) return { record: '记录格式不正确。' }
  const errors = {}
  TEXT_FIELDS.forEach(field => {
    const content = own(input, field)
    if (content === undefined && (field === 'exerciseId' || field === 'exerciseTitle')) return
    if (typeof content !== 'string') errors[field] = `${FIELD_NAMES[field]}必须为文字。`
    else if (content.length > TEXT_LIMITS[field]) errors[field] = `${FIELD_NAMES[field]}最多 ${TEXT_LIMITS[field]} 字。`
    else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content)) errors[field] = `${FIELD_NAMES[field]}包含不可用的控制字符。`
  })
  ;['id', 'caseId', 'caseTitle'].forEach(field => { if (!value(input, field)) errors[field] = `请填写${FIELD_NAMES[field]}。` })
  ;['id', 'caseId', 'exerciseId'].forEach(field => { if (value(input, field) && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value(input, field))) errors[field] = `${FIELD_NAMES[field]}格式不正确。` })
  if (Boolean(value(input, 'exerciseId')) !== Boolean(value(input, 'exerciseTitle'))) errors.exerciseTitle = '练习编号和名称需要同时保留。'
  if (!Object.prototype.hasOwnProperty.call(TYPE_LABELS, input.type)) errors.type = '请选择实践记录或问题。'
  if (!Object.prototype.hasOwnProperty.call(OUTCOME_LABELS, input.outcome)) errors.outcome = '请选择本次结果；没有结论时请选择尚不确定。'
  if (input.status !== 'draft' && input.status !== 'record') errors.status = '只支持本机草稿或本机记录状态。'
  if (complete && input.type === 'practice') {
    ;['action', 'period', 'context', 'result', 'evidence'].forEach(field => { if (!value(input, field)) errors[field] = `请补充${FIELD_NAMES[field]}，或先暂存草稿。` })
  }
  if (complete && input.type === 'question' && !value(input, 'comment')) errors.comment = '请写出具体问题，或先暂存草稿。'
  if (value(input, 'evidenceUrl')) {
    const message = linkError(value(input, 'evidenceUrl'))
    if (message) errors.evidenceUrl = message
  }
  ;['createdAt', 'updatedAt'].forEach(field => { if (!validTime(input[field])) errors[field] = '记录时间格式不正确。' })
  if (!errors.createdAt && !errors.updatedAt && input.updatedAt < input.createdAt) errors.updatedAt = '更新时间不能早于创建时间。'
  return errors
}

function createRecord(input = {}) {
  if (!plain(input)) throw fail('记录格式不正确。', 'RECORD_INVALID', { record: '记录格式不正确。' })
  const invalid = {}
  TEXT_FIELDS.forEach(field => { if (own(input, field) !== undefined && typeof input[field] !== 'string') invalid[field] = `${FIELD_NAMES[field]}必须为文字。` })
  if (Object.keys(invalid).length) throw fail('请检查填写内容。', 'RECORD_INVALID', invalid)
  if (own(input, 'status') !== undefined && !['draft', 'record', 'local_draft'].includes(input.status)) throw fail('不能保存已发布或已验证状态。', 'RECORD_INVALID', { status: '仅支持本机记录。' })
  const now = new Date().toISOString()
  const record = {}
  TEXT_FIELDS.forEach(field => { record[field] = value(input, field) })
  record.id = record.id || `practice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  record.type = own(input, 'type') === undefined ? 'practice' : record.type
  record.outcome = own(input, 'outcome') === undefined ? 'unknown' : record.outcome
  record.status = input.status === 'record' ? 'record' : 'draft'
  record.createdAt = validTime(input.createdAt) ? input.createdAt : now
  record.updatedAt = validTime(input.updatedAt) ? input.updatedAt : now
  return record
}

function validateRecord(input) {
  const errors = errorsFor(input, true)
  return { valid: Object.keys(errors).length === 0, errors }
}

function readRecords() {
  let raw
  try { raw = wx.getStorageSync(STORAGE_KEY) } catch (error) { throw fail('暂时无法读取本机记录，已有内容未改写。', 'STORAGE_READ_FAILED') }
  if (raw === '' || raw === undefined || raw === null) return []
  try {
    const records = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(records)) throw new Error('not an array')
    const ids = new Set()
    records.forEach(record => {
      if (!plain(record) || Object.keys(errorsFor(record, record.status === 'record')).length || ids.has(record.id) || Object.keys(record).some(field => !ALL_FIELDS.includes(field))) throw new Error('invalid data')
      ids.add(record.id)
    })
    return records.map(record => Object.assign({ exerciseId: '', exerciseTitle: '' }, record))
  } catch (error) { throw fail('本机记录格式异常，原始数据已保留，未自动覆盖。请先到设置导出本机备份。', 'STORAGE_CORRUPT') }
}

function writeRecords(records) {
  try { wx.setStorageSync(STORAGE_KEY, records) } catch (error) { throw fail('本机记录保存失败，可能是空间不足。请先复制当前内容后重试。', 'STORAGE_WRITE_FAILED') }
}

function saveRecord(input, options = {}) {
  if (!plain(options) || (options.complete !== undefined && typeof options.complete !== 'boolean')) throw fail('保存方式不正确。', 'RECORD_INVALID')
  const record = createRecord(input)
  const records = readRecords()
  const index = records.findIndex(item => item.id === record.id)
  if (index >= 0) {
    const previous = records[index]
    if (previous.caseId !== record.caseId) throw fail('已有记录不能更换所属案例，请新建记录。', 'RECORD_INVALID', { caseId: '所属案例不能更改。' })
    if (own(input, 'exerciseId') === undefined && own(input, 'exerciseTitle') === undefined) {
      record.exerciseId = previous.exerciseId
      record.exerciseTitle = previous.exerciseTitle
    }
    if (previous.exerciseId !== record.exerciseId || previous.exerciseTitle !== record.exerciseTitle) throw fail('已有记录不能更换练习来源，请新建记录。', 'RECORD_INVALID', { exerciseId: '练习来源不能更改。' })
    record.createdAt = previous.createdAt
  }
  record.status = options.complete ? 'record' : 'draft'
  record.updatedAt = new Date().toISOString()
  const errors = errorsFor(record, Boolean(options.complete))
  if (Object.keys(errors).length) throw fail('请按提示检查内容，未保存。', 'RECORD_INVALID', errors)
  if (index >= 0) records[index] = record
  else records.unshift(record)
  writeRecords(records)
  return copy(record)
}

function listRecords(filters = {}) {
  if (!plain(filters)) throw fail('筛选条件不正确。', 'RECORD_INVALID')
  return readRecords().filter(record => ['caseId', 'type', 'status'].every(field => !filters[field] || record[field] === filters[field]))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}
function getRecord(id) { return typeof id === 'string' && id.trim() ? readRecords().find(record => record.id === id.trim()) || null : null }
function removeRecord(id) {
  if (typeof id !== 'string' || !id.trim()) return false
  const records = readRecords()
  const next = records.filter(record => record.id !== id.trim())
  if (next.length === records.length) return false
  writeRecords(next)
  return true
}
function exportRecord(record) {
  const errors = errorsFor(record, record && record.status === 'record')
  if (Object.keys(errors).length) throw fail('记录内容格式不正确，无法复制。', 'RECORD_INVALID', errors)
  const lines = [
    '轻创拼拼 · 个人记录',
    `状态：${record.status === 'draft' ? '本机草稿' : '本机实践记录'}，未在平台公开发布。`,
    '证据边界：个人自述，未进行独立核验；本次记录不代表原案例经营效果已复现，也不保证他人取得相同结果。',
    `参考案例：${record.caseTitle}（${record.caseId}）`, `类型：${TYPE_LABELS[record.type]}`
  ]
  if (record.exerciseId) lines.push(`来源：情境练习「${record.exerciseTitle}」（${record.exerciseId}），不计作新增经营实证。`)
  if (record.type === 'practice') {
    lines.push(`本次结果：${OUTCOME_LABELS[record.outcome]}`)
    ;['action', 'period', 'context', 'result', 'evidence'].forEach(field => lines.push(`${FIELD_NAMES[field]}：${record[field] || '尚未填写'}`))
  }
  if (record.evidenceUrl) lines.push(`公开证据链接（仅供对照）：${record.evidenceUrl}`)
  if (record.comment) lines.push(`${record.type === 'question' ? '具体问题' : '补充评论'}：${record.comment}`)
  lines.push(`创建时间：${record.createdAt}`, `最后修改：${record.updatedAt}`)
  return lines.join('\n\n')
}

module.exports = { STORAGE_KEY, TYPE_LABELS, OUTCOME_LABELS, TEXT_LIMITS, createRecord, validateRecord, saveRecord, listRecords, getRecord, removeRecord, exportRecord }
