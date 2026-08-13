// pgg serve — 本地 REST API,让 AI/脚本通过 HTTP 调用与网页版相同的能力。
//
//   GET  /health      → { ok, name: 'pgg', version }
//   GET  /            → 使用说明(HTML)
//   POST /api/plan    → { blueprint, prompt?, style?, provider?, model?, key?, endpoint? }
//                       → 200 { html, raw, providerId, modelId } / 4xx 错误
//   POST /api/import  → { html } → 200 { blueprint, count } / 400
//
// 服务端未配置 Key 时,/api/plan 可从请求体读取 key(适合本地工具链)。

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { planToHtml } from './plan'
import { htmlToBlueprint } from '../../src/lib/core/htmlToBlueprint'
import { fail, ok, dim, readVersion } from '../config'
import type { Flags } from '../config'

const VERSION = readVersion()

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('body too large (max 5MB)'))
        req.destroy()
      }
    })
    req.on('end', () => resolvePromise(data))
    req.on('error', reject)
  })
}

const HELP_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>pgg serve</title>
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;color:#e4e4e7;background:#18181b;line-height:1.7}
code{background:#27272a;padding:2px 6px;border-radius:4px;font-size:.9em}
h1{color:#5eead4}pre{background:#27272a;padding:16px;border-radius:8px;overflow:auto}
</style></head><body>
<h1>🐼 pgg serve — PandaGuGu Studio API</h1>
<p>v${VERSION} 本地服务运行中。与网页版共用同一套 core 逻辑。</p>
<h2>接口</h2>
<pre>GET  /health       健康检查
POST /api/plan     蓝图 → AI → HTML
POST /api/import   HTML → 蓝图 JSON</pre>
<h2>示例</h2>
<pre>curl -s http://localhost:8787/health

curl -s -X POST http://localhost:8787/api/plan \\
  -H "Content-Type: application/json" \\
  -d '{"blueprint": $(cat design.blueprint.json),
       "prompt": "做成深色电商风",
       "provider": "deepseek", "key": "sk-..."}'</pre>
</body></html>`

export async function runServe(flags: Flags): Promise<void> {
  const port = Number(flags.port || process.env.PGG_PORT || 8787)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const route = url.pathname
    const method = (req.method || 'GET').toUpperCase()

    try {
      if (method === 'OPTIONS') {
        sendJson(res, 204, {})
        return
      }
      if (method === 'GET' && route === '/health') {
        sendJson(res, 200, { ok: true, name: 'pgg', version: VERSION })
        return
      }
      if (method === 'GET' && route === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(HELP_HTML)
        return
      }
      if (method === 'POST' && route === '/api/plan') {
        const body = JSON.parse(await readBody(req) || '{}')
        if (!body?.blueprint?.elements) {
          sendJson(res, 400, { error: '请求体需要 blueprint.elements 数组' })
          return
        }
        const result = await planToHtml(body, {})
        sendJson(res, 200, result)
        return
      }
      if (method === 'POST' && route === '/api/import') {
        const body = JSON.parse(await readBody(req) || '{}')
        if (typeof body?.html !== 'string') {
          sendJson(res, 400, { error: '请求体需要 html 字符串' })
          return
        }
        const { document } = parseHTML(body.html)
        const bp = htmlToBlueprint(body.html, document as unknown as Document)
        if (!bp) {
          sendJson(res, 400, { error: '未能解析出蓝图结构' })
          return
        }
        sendJson(res, 200, { blueprint: bp, count: countElements(bp) })
        return
      }
      sendJson(res, 404, { error: `not found: ${method} ${route}` })
    } catch (e) {
      sendJson(res, 400, { error: (e as Error).message })
    }
  })

  server.listen(port, () => {
    ok(`pgg serve v${VERSION} → http://localhost:${port}`)
    dim('GET /health · POST /api/plan · POST /api/import · Ctrl+C 停止')
  })
}

function countElements(bp: any): number {
  let n = 0
  const walk = (e: any) => {
    n++
    for (const c of e.children || []) walk(c)
  }
  bp.elements.forEach(walk)
  return n
}
