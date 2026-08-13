#!/usr/bin/env node
// pgg — PandaGuGu Studio CLI 入口。
// 与网页版共用同一套 core(类型/提示词/HTML渲染/导入解析),方便 AI 与脚本操控。

import { fail, parseArgs, readVersion } from './config'
import { runPlan } from './commands/plan'
import { runImport } from './commands/import'
import { runRender } from './commands/render'
import { runHistory } from './commands/history'
import { runServe } from './commands/serve'

const BANNER = `🐼 pgg — PandaGuGu Studio CLI v${readVersion()} (蓝图 ⇄ AI ⇄ HTML)`

async function main(): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2))
  const cmd = positionals.shift() || ''

  switch (cmd) {
    case 'plan': {
      console.log(BANNER)
      await runPlan(positionals, flags)
      break
    }
    case 'import': {
      console.log(BANNER)
      await runImport(positionals, flags)
      break
    }
    case 'render': {
      console.log(BANNER)
      await runRender(positionals, flags)
      break
    }
    case 'history': {
      console.log(BANNER)
      await runHistory(positionals, flags)
      break
    }
    case 'serve': {
      await runServe(flags)
      break
    }
    case 'version':
    case '-v':
    case '--version':
      console.log(BANNER)
      break
    case 'help':
    case '-h':
    case '--help':
    case '':
      printHelp()
      break
    default:
      fail(`未知命令: ${cmd}\n` + helpText())
  }
}

function helpText(): string {
  return [
    '',
    '用法:',
    '  pgg plan <blueprint.json> [prompt]  蓝图 → AI → 完整 HTML',
    '       --provider=zai|deepseek|kimi|qwen|ark|google|fireworks|openrouter|custom',
    '       --model=<模型ID> --key=<API Key> --endpoint=<端点>',
    '       --style="风格描述" --out=out.html --no-stream',
    '  pgg import <file.html> [-o out.json]   HTML → 蓝图 JSON',
    '  pgg render <blueprint.json> [-o out.html]  蓝图 → HTML(离线,不经 AI)',
    '  pgg history list|show|add|rm|clear  生成历史(文件级,~/.pandagugu/history.json)',
    '  pgg serve [--port 8787]                本地 REST API (GET /health · POST /api/plan · /api/import)',
    '  pgg version / help',
    '',
    '配置优先级: 命令行参数 > 环境变量(PGG_PROVIDER/PGG_MODEL/PGG_API_KEY/PGG_ENDPOINT) > ~/.pandagugu.json',
    '',
  ].join('\n')
}

function printHelp(): void {
  console.log(BANNER)
  console.log(helpText())
}

main().catch((e) => fail((e as Error)?.message || String(e)))
