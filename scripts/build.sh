#!/usr/bin/env bash
# 生产构建（产物 dist/）
set -e
cd "$(dirname "$0")/.."
exec npm run build
