// 构建 pgg CLI — 用 rolldown JS API 打包 cli + core 为单文件 ESM。
// 注意:rolldown rc 版本 write() 的 banner 参数有 bug(会清空产物),
// 但 rolldown 会保留源入口 cli/pgg.ts 顶部的 shebang,无需手动补。
import { rolldown } from 'rolldown'

const bundle = await rolldown({
  input: 'cli/pgg.ts',
  external: [
    'node:path', 'node:fs', 'node:os', 'node:http', 'node:url',
    'linkedom',
  ],
})

await bundle.write({
  file: 'dist-cli/pgg.mjs',
  format: 'esm',
})

console.log('✓ dist-cli/pgg.mjs built')
