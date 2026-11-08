// 调 DeepSeek（OpenAI 格式的 /chat/completions）。浏览器可以直接调（DeepSeek 允许跨域），不用自己的服务器。
// Key 只存在这台手机的浏览器里。

export interface AiConfig {
  key: string
  baseUrl: string
  model: string
  /** 仔细识别：让 DeepSeek 先思考再回答，可能更准，但慢很多。默认关。 */
  careful: boolean
}

export class AiError extends Error {}
export class HttpError extends AiError {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message)
  }
}

const endpoint = (c: AiConfig) => c.baseUrl.trim().replace(/\/+$/, '') + '/chat/completions'

/**
 * 发一张图片 + 文字说明，返回模型回答的文字。
 * DeepSeek 默认会先“思考”很久再回答，读单子上的数字用不着，所以默认关掉，快很多。
 */
export async function ask(c: AiConfig, system: string, userText: string, jpegBase64: string | null, timeoutMs = 120_000, think = c.careful, signal?: AbortSignal): Promise<string> {
  const content: unknown[] = []
  if (jpegBase64) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}`, detail: 'high' } })
  content.push({ type: 'text', text: userText })
  const body: Record<string, unknown> = {
    model: c.model.trim(),
    stream: false,
    // 思考的内容也算在 max_tokens 里，思考时给多一点，免得答案被截掉
    max_tokens: think ? 16000 : 4000,
    thinking: { type: think ? 'enabled' : 'disabled' },
    messages: [
      { role: 'system', content: system },
      // 图片只能放在 user 消息里
      { role: 'user', content },
    ],
  }
  let resp: string
  try {
    resp = await post(c, JSON.stringify(body), timeoutMs, signal)
  } catch (e) {
    // 换了别家接口、不认识 thinking 参数的话，去掉再试一次
    if (!(e instanceof HttpError) || e.code !== 400) throw e
    delete body.thinking
    resp = await post(c, JSON.stringify(body), timeoutMs, signal)
  }
  let text: unknown
  try {
    text = JSON.parse(resp).choices[0].message.content
  } catch {
    throw new AiError('AI 回的内容看不懂')
  }
  if (typeof text !== 'string' || !text.trim()) throw new AiError('AI 没有回答内容，请再试一次')
  return text
}

/** 设置页的“测试”：不带图片，看 Key 和地址对不对。 */
export const test = (c: AiConfig) => ask(c, '你是一个测试助手。', '只回复两个字：好的', null, 30_000, false)

async function post(c: AiConfig, json: string, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  if (!c.key.trim()) throw new AiError('还没有填 API Key')
  let url: string
  try {
    url = new URL(endpoint(c)).toString()
  } catch {
    throw new AiError(`接口地址不对：${c.baseUrl}`)
  }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort('timeout'), timeoutMs)
  const onAbort = () => ctl.abort('cancel')
  signal?.addEventListener('abort', onAbort)
  try {
    let r: Response
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${c.key.trim()}` },
        body: json,
        signal: ctl.signal,
      })
    } catch {
      if (ctl.signal.aborted) throw new AiError(ctl.signal.reason === 'cancel' ? '已取消' : 'AI 太久没回应，请再试一次')
      throw new AiError('连不上 AI：没有网络，或者接口地址不对')
    }
    const text = await r.text()
    if (r.ok) return text
    throw new HttpError(r.status, httpMessage(r.status, text))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** 把 HTTP 错误翻成人话。 */
export function httpMessage(code: number, body: string): string {
  let detail = ''
  try {
    const m = JSON.parse(body)?.error?.message
    if (typeof m === 'string' && m.trim()) detail = `（${m}）`
  } catch {
    /* 不是 JSON */
  }
  if (code === 401) return `API Key 不对，请到设置里检查${detail}`
  if (code === 402) return `DeepSeek 账户余额不足，请先充值${detail}`
  if (code === 400 || code === 422) return `请求被拒绝，可能是模型名不对或这个模型不能看图片，请到设置里检查模型名${detail}`
  if (code === 404) return `接口地址不对，请到设置里检查${detail}`
  if (code === 429) return `请求太频繁，等一会儿再试${detail}`
  if (code >= 500 && code <= 599) return `DeepSeek 服务器忙，等一会儿再试（${code}）`
  return `出错了（${code}）${detail}`
}
