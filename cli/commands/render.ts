// pgg render — 蓝图 JSON → 自包含 HTML(不经 AI,离线渲染)。
// 复用 core/blueprintToHtml(与网页版「🧾 导出 HTML(图片内嵌)」同一渲染器),
// 适合快速出稿/检查布局,不消耗 token。

import { basename, dirname, join, resolve } from 'node:path'
import { blueprintToHtml } from '../../src/lib/core/blueprintToHtml'
import { fail, ok, dim, readJson, writeText } from '../config'
import type { Flags } from '../config'

export async function runRender(positionals: string[], flags: Flags): Promise<void> {
  if (positionals.length < 1) {
    fail('用法: pgg render <blueprint.json> [-o out.html] [--title=页面标题] [--open]')
  }

  const bpPath = resolve(positionals[0])
  const raw = readJson(bpPath)
  if (!raw || !Array.isArray(raw.elements)) {
    fail(`蓝图文件必须包含 elements 数组: ${bpPath}`)
  }

  const title = (flags.title as string) || undefined
  const html = blueprintToHtml(raw, title)
  const outPath = flags.out
    ? resolve(String(flags.out))
    : join(dirname(bpPath), basename(bpPath, '.json') + '.html')
  writeText(outPath, html)

  ok(`已写入 ${outPath} (${html.length.toLocaleString()} 字节, 离线渲染未调用 AI)`)
  if (title) dim(`标题: ${title}`)

  if (flags.open) {
    const { exec } = await import('node:child_process')
    exec(
      process.platform === 'win32'
        ? `start "" "${outPath}"`
        : process.platform === 'darwin'
          ? `open "${outPath}"`
          : `xdg-open "${outPath}"`
    )
    dim('已在默认浏览器打开')
  }
}
