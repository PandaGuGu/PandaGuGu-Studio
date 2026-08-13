// pgg import — HTML → 蓝图 JSON(简化 + 自动布局)。
// 与网页版「导入 HTML → 画布」同一套解析逻辑(core/htmlToBlueprint),
// 仅输出 JSON 蓝图,不画到画布上 —— 适合把已有网页转成蓝图再交给 AI 重做。

import { basename, dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { htmlToBlueprint } from '../../src/lib/core/htmlToBlueprint'
import type { Blueprint } from '../../src/lib/core/types'
import { fail, ok, dim, writeText } from '../config'
import type { Flags } from '../config'

export async function runImport(positionals: string[], flags: Flags): Promise<void> {
  if (positionals.length < 1) {
    fail('用法: pgg import <file.html> [-o out.json]')
  }
  const htmlPath = resolve(positionals[0])
  const html = readFileSync(htmlPath, 'utf-8')

  // Node 端没有全局 DOMParser,用 linkedom 解析后注入
  const { document } = parseHTML(html)
  const bp = htmlToBlueprint(html, document as unknown as Document)
  if (!bp || bp.elements.length === 0) {
    fail('未能从 HTML 中解析出可用的蓝图结构')
  }

  const outPath = flags.out
    ? resolve(String(flags.out))
    : join(dirname(htmlPath), basename(htmlPath, '.html') + '.blueprint.json')
  writeText(outPath, JSON.stringify(bp, null, 2))

  const count = countElements(bp)
  ok(`已写入 ${outPath}`)
  dim(`${count} 个元素,根类型: ${bp.elements.map((e) => e.type).join(', ')}`)
  dim('提示: 用 pgg plan 交给 AI 生成新版,或在 PandaGuGu Studio「⇪ 导入 HTML」里载入画布继续编辑')
}

function countElements(bp: Blueprint): number {
  let n = 0
  const walk = (e: Blueprint['elements'][number]) => {
    n++
    for (const c of e.children || []) walk(c)
  }
  bp.elements.forEach(walk)
  return n
}
