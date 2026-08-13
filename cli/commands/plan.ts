// pgg plan — 蓝图 JSON → AI → 完整 HTML。
// 与网页版「✨ 用画布蓝图生成」完全同一套提示词契约(core/prompt)。
// 核心逻辑 planToHtml() 同时被 pgg serve 的 POST /api/plan 复用。

import { basename, dirname, join, resolve } from 'node:path'
import { getProvider } from '../../src/lib/providers'
import { streamChat, extractHTML } from '../../src/lib/api'
import { buildBlueprintPrompt } from '../../src/lib/core/prompt'
import type { Blueprint } from '../../src/lib/core/types'
import { fail, ok, dim, readJson, resolveConfig, writeText } from '../config'
import type { Flags, CliConfig } from '../config'

export interface PlanRequest {
  blueprint: Blueprint
  /** 用户补充要求(可选) */
  prompt?: string
  /** 风格描述(可选,如「现代深色 SaaS 风」) */
  style?: string
  provider?: string
  model?: string
  key?: string
  endpoint?: string
}

export interface PlanResult {
  html: string
  /** AI 原始输出(未提取前,调试用) */
  raw: string
  providerId: string
  modelId: string
}

/** 合并配置 + 请求参数,返回可用的 {provider, modelId, apiKey}。
 *  抛 Error 而非 fail(),因为 serve 场景不能退出进程(由调用方决定怎么处理)。 */
function resolveRuntime(req: PlanRequest, flags: Flags) {
  const config: CliConfig = resolveConfig(flags)
  const providerId = req.provider || config.providerId
  const provider = getProvider(providerId)
  const modelId = req.model || config.modelId || (provider.models[0]?.id ?? '')
  const apiKey = req.key || config.apiKey
  const endpoint = req.endpoint || config.endpoint
  if (!modelId) throw new Error('未指定模型,请用 --model / PGG_MODEL / 请求体 model')
  if (!apiKey) throw new Error('未配置 API Key,请用 --key / PGG_API_KEY / ~/.pandagugu.json / 请求体 key')
  return { provider, providerId, modelId, apiKey, endpoint }
}

/** 蓝图 + 要求 → AI → 提取 HTML(核心逻辑,CLI 与 serve 共用) */
export async function planToHtml(req: PlanRequest, flags: Flags = {}): Promise<PlanResult> {
  const { provider, modelId, apiKey, endpoint } = resolveRuntime(req, flags)
  const prompt = buildBlueprintPrompt(req.blueprint, req.style) +
    (req.prompt ? `\n\n【用户补充要求】${req.prompt}` : '')

  let raw = ''
  await new Promise<void>((resolvePromise, reject) => {
    streamChat(
      provider,
      apiKey,
      modelId,
      [{ role: 'user', content: prompt }],
      {
        onChunk: (text) => { raw += text },
        onDone: () => resolvePromise(),
        onError: (err) => reject(err),
      },
      undefined,
      endpoint
    ).catch(reject)
  })

  const html = extractHTML(raw) ?? ''
  if (!html) {
    throw new Error('AI 输出中没有提取到 HTML(可能被截断或返回了纯文本)')
  }
  return { html, raw, providerId: provider.id, modelId }
}

export async function runPlan(positionals: string[], flags: Flags): Promise<void> {
  if (positionals.length < 1) {
    fail(
      '用法: pgg plan <blueprint.json> [prompt]\n' +
      '  选项: --provider=zai|deepseek|kimi|qwen|ark|google|fireworks|openrouter|custom\n' +
      '        --model=<模型ID> --key=<API Key> --endpoint=<自定义端点>\n' +
      '        --style="现代深色 SaaS 风" --out=out.html --no-stream\n' +
      '  配置: 环境变量 PGG_PROVIDER/PGG_MODEL/PGG_API_KEY,或 ~/.pandagugu.json'
    )
  }

  const bpPath = resolve(positionals[0])
  const userPrompt = positionals.slice(1).join(' ')
  const raw = readJson(bpPath)
  if (!raw || !Array.isArray(raw.elements)) {
    fail(`蓝图文件必须包含 elements 数组: ${bpPath}`)
  }

  const style = (flags.style as string) || undefined
  const outPath = flags.out
    ? resolve(String(flags.out))
    : join(dirname(bpPath), basename(bpPath, '.json') + '.html')

  const req: PlanRequest = {
    blueprint: raw,
    prompt: userPrompt,
    style,
    provider: flags.provider as string,
    model: flags.model as string,
    key: flags.key as string,
    endpoint: flags.endpoint as string,
  }

  try {
    const { providerId, modelId } = resolveRuntime(req, flags)
    dim(`服务商: ${getProvider(providerId).name}  模型: ${modelId}`)
    dim(`蓝图: ${bpPath} (${raw.elements.length} 个顶层区块)`)
    if (style) dim(`风格: ${style}`)
    if (userPrompt) dim(`补充要求: ${userPrompt}`)

    const { html } = await planToHtml(req, flags)
    writeText(outPath, html)
    ok(`已写入 ${outPath} (${html.length.toLocaleString()} 字节)`)
    dim('可用浏览器直接打开,或用 pgg import 逆向回蓝图继续改')
  } catch (e) {
    fail((e as Error).message)
  }
}
