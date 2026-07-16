#!/bin/bash
# 宝塔一键更新 V槽 CMS（请在服务器上执行）
# 用法：bash baota-update.sh
# 或：curl -fsSL https://raw.githubusercontent.com/trustyai/websites/cursor/multilang-cms-rebuild-78df/vgrooving-cms/scripts/baota-update.sh | bash
set -euo pipefail

BRANCH="cursor/multilang-cms-rebuild-78df"
REPO="https://github.com/trustyai/websites.git"
APP_DIR="${APP_DIR:-/www/vgrooving-cms}"
BUILD_MARK="bindOutsideClose"

echo "==> 目标目录: $APP_DIR"
echo "==> 分支: $BRANCH"

# 若当前目录就是含 server.js 的 CMS，优先用当前目录
if [ -f "./server.js" ] && [ -f "./package.json" ]; then
  APP_DIR="$(pwd)"
  echo "==> 检测到当前目录即为 CMS，改用: $APP_DIR"
fi

mkdir -p "$(dirname "$APP_DIR")"
BACKUP="/tmp/vg-backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP"

if [ -d "$APP_DIR/data" ]; then
  echo "==> 备份 data / uploads -> $BACKUP"
  cp -a "$APP_DIR/data" "$BACKUP/" 2>/dev/null || true
  cp -a "$APP_DIR/public/uploads" "$BACKUP/" 2>/dev/null || true
fi

TMP="/tmp/vg-src-$$"
rm -rf "$TMP"
echo "==> 克隆最新代码..."
git clone --depth 1 -b "$BRANCH" "$REPO" "$TMP"

# 仓库结构是 websites/vgrooving-cms/
SRC="$TMP/vgrooving-cms"
if [ ! -f "$SRC/server.js" ]; then
  echo "ERROR: 克隆结果里找不到 vgrooving-cms/server.js" >&2
  exit 1
fi

mkdir -p "$APP_DIR"
# 同步代码（不删 data/uploads）
rsync -a --delete \
  --exclude 'data/' \
  --exclude 'public/uploads/' \
  --exclude 'node_modules/' \
  "$SRC/" "$APP_DIR/"

# 恢复数据
if [ -d "$BACKUP/data" ]; then
  mkdir -p "$APP_DIR/data"
  cp -a "$BACKUP/data/." "$APP_DIR/data/" 2>/dev/null || true
fi
if [ -d "$BACKUP/uploads" ]; then
  mkdir -p "$APP_DIR/public/uploads"
  cp -a "$BACKUP/uploads/." "$APP_DIR/public/uploads/" 2>/dev/null || true
fi

cd "$APP_DIR"
echo "==> npm install..."
npm install --omit=dev

# 重启 pm2
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe vgrooving-cms >/dev/null 2>&1; then
    pm2 restart vgrooving-cms --update-env
  else
    pm2 start server.js --name vgrooving-cms
  fi
  pm2 save || true
else
  echo "WARN: 未找到 pm2，请手动重启 Node 进程"
fi

echo "==> 本地文件校验..."
if grep -q "$BUILD_MARK" "$APP_DIR/public/common.js"; then
  echo "OK: common.js 含 $BUILD_MARK"
else
  echo "FAIL: common.js 仍是旧版！" >&2
  exit 1
fi
if grep -q '20260716c' "$APP_DIR/public/product.html"; then
  echo "OK: product.html 含缓存戳"
else
  echo "WARN: product.html 缓存戳未找到"
fi

echo "==> 通过本机 HTTP 校验（若端口不是 3000 请改）..."
sleep 1
CODE="$(curl -s "http://127.0.0.1:3000/common.js?v=20260716c" | grep -c "$BUILD_MARK" || true)"
if [ "${CODE:-0}" -gt 0 ]; then
  echo "OK: http://127.0.0.1:3000 已返回新 JS"
else
  echo "FAIL: 本机 3000 端口仍返回旧 JS。请检查 pm2 是否指向 $APP_DIR" >&2
  echo "pm2 信息：" >&2
  pm2 show vgrooving-cms 2>/dev/null | head -40 || true
  exit 1
fi

echo ""
echo "========================================"
echo " 更新成功。请浏览器强制刷新后测试："
echo " https://vgrooving.com/products/pneumatic"
echo " 验证：打开源码应看到 common.js?v=20260716c"
echo " 备份在: $BACKUP"
echo "========================================"
rm -rf "$TMP"
