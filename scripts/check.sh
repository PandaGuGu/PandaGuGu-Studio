#!/usr/bin/env bash
# PandaGuGu Studio 质量检查：类型检查 + 构建 + 品牌残留扫描
set -e
cd "$(dirname "$0")/.."

echo "==> tsc --noEmit"
npx tsc --noEmit

echo "==> npm test (core 单测)"
npm test

echo "==> 品牌残留扫描 (glm5v/vcanvas/E01)"
if grep -rn "glm5v-drawing\|vcanvas-.*Date.now\|E01.ai" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "!! 发现品牌残留，请清理" && exit 1
fi
echo "    干净"

echo "==> npm run build"
npm run build

echo "✅ check 全部通过"
