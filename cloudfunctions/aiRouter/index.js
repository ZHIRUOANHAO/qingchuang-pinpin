const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const DEEPSEEK_MODEL = 'deepseek-v4-pro'
const ANTHROPIC_MODEL = 'claude-opus-4-8'
const ANTHROPIC_VERSION = '2023-06-01'
const REQUEST_TIMEOUT_MS = 45000
const MAX_TEXT_LENGTH = 20000
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 16
const SUPPORTED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
])

const SYSTEM_PROMPT = `你是轻创拼拼的商业链路分析器。请只输出一个 JSON 对象，不要输出 Markdown。
对象应尽量包含：title、summary、nodes、metrics、warnings。nodes 是数组，每项可包含 id、name、type、chain、definition、method、industries、cost、difficulty、risk、reuse。metrics 可包含 completeness、risk、startupCost、difficulty。不要虚构已验证的收入、流量或支付结果；推断必须明确标注，合规风险要进入 warnings。`

class AppError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

function cleanString(value, field, options = {}) {
  const { required = false, maxLength = MAX_TEXT_LENGTH } = options
  if (value === undefined || value === null) {
    if (required) throw new AppError('INVALID_INPUT', `${field} 不能为空`)
    return ''
  }
  if (typeof value !== 'string') {
    throw new AppError('INVALID_INPUT', `${field} 必须是字符串`)
  }

  const result = value.trim()
  if (required && !result) throw new AppError('INVALID_INPUT', `${field} 不能为空`)
  if (result.length > maxLength) {
    throw new AppError('INPUT_TOO_LARGE', `${field} 超出长度限制`)
  }
  return result
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new AppError('AI_CONFIG_MISSING', `缺少服务端环境变量 ${name}`)
  }
  return value.trim()
}

function inferMediaType(fileId) {
  const cleanId = fileId.split('?')[0].toLowerCase()
  if (cleanId.endsWith('.jpg') || cleanId.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanId.endsWith('.png')) return 'image/png'
  if (cleanId.endsWith('.gif')) return 'image/gif'
  if (cleanId.endsWith('.webp')) return 'image/webp'
  if (cleanId.endsWith('.pdf')) return 'application/pdf'
  return ''
}

function validateMediaType(sourceType, mediaType) {
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      '仅支持 JPEG、PNG、GIF、WebP 图片或 PDF 文件'
    )
  }
  if (sourceType === 'pdf' && mediaType !== 'application/pdf') {
    throw new AppError('INVALID_INPUT', 'sourceType 为 pdf 时必须提供 PDF 文件')
  }
  if (sourceType === 'image' && !mediaType.startsWith('image/')) {
    throw new AppError('INVALID_INPUT', 'sourceType 为 image 时必须提供受支持的图片')
  }
}

function decodeBase64(value) {
  const compact = value.replace(/\s/g, '')
  if (!compact || compact.length > MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new AppError('INVALID_FILE_DATA', 'fileData 不是有效的 Base64 文件或文件过大')
  }

  const buffer = Buffer.from(compact, 'base64')
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw new AppError('INPUT_TOO_LARGE', '文件大小不能超过 15 MB')
  }
  return buffer
}

async function loadFile(event, sourceType) {
  const fileId = cleanString(event.fileId, 'fileId', { maxLength: 1024 })
  const fileData = cleanString(event.fileData, 'fileData', { maxLength: MAX_BASE64_LENGTH })
  if (!fileId && !fileData) {
    throw new AppError('INVALID_INPUT', '图片或 PDF 请求必须提供 fileId 或 fileData')
  }
  if (fileId && fileData) {
    throw new AppError('INVALID_INPUT', 'fileId 与 fileData 只能提供一个')
  }

  let buffer
  if (fileData) {
    buffer = decodeBase64(fileData)
  } else {
    try {
      const result = await cloud.downloadFile({ fileID: fileId })
      buffer = result && result.fileContent
    } catch (error) {
      console.error('cloud file download failed', { name: error && error.name })
      throw new AppError('FILE_DOWNLOAD_FAILED', '无法读取云存储文件，请检查 fileId 和文件权限')
    }
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw new AppError('FILE_DOWNLOAD_FAILED', '云存储文件内容为空')
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new AppError('INPUT_TOO_LARGE', '文件大小不能超过 15 MB')
    }
  }

  const suppliedMediaType = cleanString(event.mediaType, 'mediaType', { maxLength: 64 }).toLowerCase()
  const mediaType = suppliedMediaType || inferMediaType(fileId)
  if (!mediaType) {
    throw new AppError('MEDIA_TYPE_REQUIRED', '无法识别文件类型，请提供 mediaType')
  }
  validateMediaType(sourceType, mediaType)
  return { buffer, mediaType }
}

async function postJson(url, headers, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const requestId = response.headers.get('request-id') || response.headers.get('x-request-id') || ''
    let payload
    try {
      payload = await response.json()
    } catch (error) {
      throw new AppError('AI_PROVIDER_INVALID_RESPONSE', 'AI 服务返回了无法解析的响应', response.status)
    }

    if (!response.ok) {
      console.error('AI provider rejected request', {
        status: response.status,
        requestId
      })
      throw new AppError(
        'AI_PROVIDER_REQUEST_FAILED',
        `AI 服务请求失败（HTTP ${response.status}${requestId ? `，请求 ${requestId}` : ''}）`,
        response.status
      )
    }
    return { payload, requestId }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new AppError('AI_PROVIDER_TIMEOUT', 'AI 服务请求超时，请稍后重试')
    }
    if (error instanceof AppError) throw error
    console.error('AI provider network failure', { name: error && error.name })
    throw new AppError('AI_PROVIDER_UNAVAILABLE', '无法连接 AI 服务，请稍后重试')
  } finally {
    clearTimeout(timer)
  }
}

async function analyzeText(input) {
  const apiKey = requireEnv('DEEPSEEK_API_KEY')
  const { payload, requestId } = await postJson(
    DEEPSEEK_ENDPOINT,
    { authorization: `Bearer ${apiKey}` },
    {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      stream: false
    }
  )
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : ''
  if (typeof content !== 'string' || !content.trim()) {
    throw new AppError('AI_PROVIDER_INVALID_RESPONSE', 'DeepSeek 未返回可用内容')
  }
  return { content, provider: 'deepseek', model: DEEPSEEK_MODEL, usage: payload.usage, requestId }
}

async function analyzeFile(event, sourceType, prompt) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY')
  const { buffer, mediaType } = await loadFile(event, sourceType)
  const fileBlock = {
    type: sourceType === 'pdf' ? 'document' : 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: buffer.toString('base64')
    }
  }
  const { payload, requestId } = await postJson(
    ANTHROPIC_ENDPOINT,
    {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    {
      model: ANTHROPIC_MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          { type: 'text', text: prompt || '请分析此资料，并按系统要求输出 JSON。' }
        ]
      }]
    }
  )
  const content = Array.isArray(payload && payload.content)
    ? payload.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    : ''
  if (!content.trim()) {
    throw new AppError('AI_PROVIDER_INVALID_RESPONSE', 'Anthropic 未返回可用内容')
  }
  return { content, provider: 'anthropic', model: ANTHROPIC_MODEL, usage: payload.usage, requestId }
}

function parseModelJson(content) {
  const trimmed = content.trim()
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(unfenced)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch (error) {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      const parsed = JSON.parse(unfenced.slice(start, end + 1))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch (nestedError) {
      return null
    }
  }
}

function buildData(result, sourceType) {
  const parsed = parseModelJson(result.content)
  const data = parsed || { content: result.content }
  data.id = typeof data.id === 'string' && data.id
    ? data.id.slice(0, 128)
    : `analysis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  data.sourceType = sourceType
  data.provider = result.provider
  data.model = result.model
  return data
}

function errorResult(error) {
  const appError = error instanceof AppError
    ? error
    : new AppError('AI_ROUTER_FAILED', 'AI 路由暂时不可用，请稍后重试')
  if (!(error instanceof AppError)) {
    console.error('aiRouter failed', { name: error && error.name })
  }
  return {
    ok: false,
    error: { code: appError.code, message: appError.message },
    message: appError.message
  }
}

exports.main = async (event = {}) => {
  try {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new AppError('INVALID_INPUT', '请求参数必须是对象')
    }
    const sourceType = cleanString(event.sourceType || 'text', 'sourceType', {
      required: true,
      maxLength: 16
    }).toLowerCase()
    if (!['text', 'image', 'pdf'].includes(sourceType)) {
      throw new AppError('INVALID_SOURCE_TYPE', 'sourceType 仅支持 text、image 或 pdf')
    }

    const input = cleanString(event.input, 'input', {
      required: sourceType === 'text',
      maxLength: MAX_TEXT_LENGTH
    })
    const result = sourceType === 'text'
      ? await analyzeText(input)
      : await analyzeFile(event, sourceType, input)

    return {
      ok: true,
      data: buildData(result, sourceType),
      meta: {
        provider: result.provider,
        model: result.model,
        requestId: result.requestId || undefined,
        usage: result.usage || undefined
      }
    }
  } catch (error) {
    return errorResult(error)
  }
}
