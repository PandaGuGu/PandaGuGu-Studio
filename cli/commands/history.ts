// pgg history — 生成历史 CLI 化(文件级存储,与网页版 localStorage 独立)。
//
//   pgg history list [--limit 20]      列出历史
//   pgg history show <id> [--out f.html]  查看/导出某条 HTML
//   pgg history add <file.html> [--prompt=...]  手动收录一条
//   pgg history rm <id>                删除一条
//   pgg history clear                  清空全部
//
// 存储: ~/.pandagugu/history.json(上限 50 条,与网页版 HistoryItem 同构)

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fail, ok, dim, writeText } from '../config'
import type { Flags } from '../config'

interface HistoryItem {
  id: string
  ts: number
  html: string
  prompt?: string
}

const DIR = join(homedir(), '.pandagugu')
const FILE = join(DIR, 'history.json')
const MAX_ITEMS = 50

function load(): HistoryItem[] {
  try {
    if (!existsSync(FILE)) return []
    const raw = JSON.parse(readFileSync(FILE, 'utf-8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function save(items: HistoryItem[]): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(items.slice(0, MAX_ITEMS), null, 2))
}

function fmtTs(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const USAGE = [
  '用法: pgg history <list|show|add|rm|clear>',
  '  list                列出历史(默认最近 20 条, --limit 覆盖)',
  '  show <id> [--out=导出的.html]   查看/导出某条 HTML',
  '  add <file.html> [--prompt=提示词]   手动收录一条',
  '  rm <id>             删除一条',
  '  clear               清空全部',
  ` 存储: ${FILE}(上限 ${MAX_ITEMS} 条)`,
].join('\n')

export async function runHistory(positionals: string[], flags: Flags): Promise<void> {
  const sub = positionals[0] || 'list'

  switch (sub) {
    case 'list': {
      const items = load()
      if (items.length === 0) {
        dim('历史为空。用 pgg history add 收录,或 `pgg plan` 生成后自动收录(后续版本)。')
        return
      }
      const limit = Math.min(Number(flags.limit || 20), items.length)
      console.log(`共 ${items.length} 条,显示最近 ${limit} 条:`)
      for (const it of items.slice(0, limit)) {
        const prompt = (it.prompt || '').replace(/\s+/g, ' ').slice(0, 40)
        console.log(
          `  \x1b[36m${it.id}\x1b[0m  ${fmtTs(it.ts)}  ${it.html.length.toLocaleString()}B  ${prompt ? '· ' + prompt : ''}`
        )
      }
      break
    }

    case 'show': {
      const id = positionals[1]
      if (!id) fail('用法: pgg history show <id>')
      const item = load().find((i) => i.id === id)
      if (!item) fail(`未找到 ${id}(用 pgg history list 查看)`)

      if (flags.out) {
        writeText(resolve(String(flags.out)), item.html)
        ok(`已导出 ${flags.out} (${item.html.length.toLocaleString()} 字节)`)
      } else {
        process.stdout.write(item.html + '\n')
      }
      if (item.prompt) dim(`prompt: ${item.prompt}`)
      break
    }

    case 'add': {
      const file = positionals[1]
      if (!file) fail('用法: pgg history add <file.html> [--prompt=...]')
      const html = readFileSync(resolve(file), 'utf-8')
      const items = load()
      const entry: HistoryItem = {
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        html,
        prompt: (flags.prompt as string) || undefined,
      }
      save([entry, ...items])
      ok(`已收录 ${entry.id} (${html.length.toLocaleString()} 字节)`)
      break
    }

    case 'rm': {
      const id = positionals[1]
      if (!id) fail('用法: pgg history rm <id>')
      const next = load().filter((i) => i.id !== id)
      if (next.length === load().length) fail(`未找到 ${id}`)
      save(next)
      ok(`已删除 ${id}`)
      break
    }

    case 'clear': {
      save([])
      ok('历史已清空')
      break
    }

    default:
      fail(USAGE)
  }
}
