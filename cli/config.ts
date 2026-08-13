// pgg — PandaGuGu Studio CLI.
// 蓝图 → AI → HTML 的文件级工作流,方便 AI 或脚本直接操控,
// 与网页版共用同一套 core 逻辑(提示词/HTML 渲染/导入解析)。
//
// 用法:
//   pgg plan <blueprint.json> [prompt] [选项]  蓝图 → AI → HTML
//   pgg import <file.html> [-o out.json]       HTML → 蓝图 JSON
//   pgg serve [--port 8787]                    本地 REST API
//   pgg version
//
// 配置优先级:命令行参数 > 环境变量 > ~/.pandagugu.json
//   环境变量:PGG_PROVIDER / PGG_MODEL / PGG_API_KEY / PGG_ENDPOINT

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type { Blueprint, BlueprintElement, SemanticType } from '../src/lib/core/types'

// ── 配置 ──

export interface CliConfig {
  providerId: string
  modelId: string
  apiKey: string
  /** 可选:自定义端点(覆盖服务商默认,Custom 必填) */
  endpoint?: string
}

const CONFIG_PATH = join(homedir(), '.pandagugu.json')

export interface Flags {
  [key: string]: string | boolean | undefined
}

/** 极简参数解析:--key=value / --key value / -k value / 位置参数 */
export function parseArgs(argv: string[]): { positionals: string[]; flags: Flags } {
  const positionals: string[] = []
  const flags: Flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('-')) { flags[key] = next; i++ }
        else flags[key] = true
      }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1)
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) { flags[key] = next; i++ }
      else flags[key] = true
    } else {
      positionals.push(a)
    }
  }
  return { positionals, flags }
}

function readConfigFile(): Partial<CliConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return {
      providerId: raw.provider || raw.providerId,
      modelId: raw.model || raw.modelId,
      apiKey: raw.apiKey,
      endpoint: raw.endpoint,
    }
  } catch {
    return {}
  }
}

/** 合并 命令行 > 环境变量 > ~/.pandagugu.json > 默认(z.ai) */
export function resolveConfig(flags: Flags): CliConfig {
  const file = readConfigFile()
  const providerId = String(
    flags.provider || process.env.PGG_PROVIDER || file.providerId || 'zai'
  )
  const endpoint = (flags.endpoint as string) ||
    process.env.PGG_ENDPOINT || file.endpoint || undefined
  return {
    providerId,
    modelId: String(
      flags.model || process.env.PGG_MODEL || file.modelId || ''
    ),
    apiKey: String(
      flags.key || process.env.PGG_API_KEY || file.apiKey || ''
    ),
    endpoint,
  }
}

// ── 工具 ──

export function fail(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

export function ok(msg: string): void {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`)
}

export function dim(msg: string): void {
  console.error(`\x1b[90m${msg}\x1b[0m`)
}

export function readJson(path: string): any {
  if (!existsSync(path)) fail(`文件不存在: ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch (e) {
    fail(`JSON 解析失败 ${path}: ${(e as Error).message}`)
  }
}

export function writeText(path: string, text: string): void {
  writeFileSync(path, text, 'utf-8')
}

export function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
    )
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}
