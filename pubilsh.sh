#!/usr/bin/env bash
# 手动发布脚本：默认发布到 https://registry.npmjs.org/
# 可通过环境变量 REGISTRY 指定目标 registry（例如本地 verdaccio）
set -euo pipefail

REGISTRY="${REGISTRY:-https://registry.npmjs.org/}"
echo "sdk: publish registry = $REGISTRY"

echo "sdk: clean"
npm run clean

echo "sdk: build"
npm run build

echo "sdk: pack"
TGZ_FILE=$(npm pack)
echo "sdk: packed -> $TGZ_FILE"

echo "sdk: publish to $REGISTRY"
npm publish --registry "$REGISTRY" --access public

echo "sdk: publish finished"
echo "sdk: local verify (optional)"
# 若发布到本地 registry，可在本地临时目录安装验证
if [[ "$REGISTRY" == "http://localhost:4873" ]]; then
  TMPDIR=$(mktemp -d)
  pushd "$TMPDIR" > /dev/null
  npm init -y >/dev/null
  npm install "../$TGZ_FILE" --registry "$REGISTRY"
  node -e "console.log(require('supfile'))" || true
  popd > /dev/null
  echo "sdk: local install verify done"
fi

echo "sdk: done"