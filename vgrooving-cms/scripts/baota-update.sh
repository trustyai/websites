#!/bin/bash
# 宝塔一键更新 V槽 CMS（不要求 /www/vgrooving-cms 本身是 git 仓库）
# 用法（在宝塔终端整段粘贴）：
#   curl -fsSL https://raw.githubusercontent.com/trustyai/websites/cursor/multilang-cms-rebuild-78df/vgrooving-cms/scripts/baota-update.sh | bash
set -euo pipefail

BRANCH="cursor/multilang-cms-rebuild-78df"
REPO="https://github.com/trustyai/websites.git"
APP_DIR="${APP_DIR:-/www/vgrooving-cms}"
BUILD_ID="20260716f-layout-fix"
PM2_NAME="${PM2_NAME:-vgrooving-cms}"

echo "==> 目标目录: $APP_DIR"
echo "==> 分支: $BRANCH"
echo "==> 期望 buildId: $BUILD_ID"

command -v git >/dev/null || { echo "ERROR: 未安装 git"; exit 1; }
command -v rsync >/dev/null || { echo "ERROR: 未安装 rsync，请先: yum install -y rsync 或 apt install -y rsync"; exit 1; }

BACKUP="/tmp/vg-backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP"
if [ -d "$APP_DIR/data" ]; then
  echo "==> 备份 data -> $BACKUP/data"
  cp -a "$APP_DIR/data" "$BACKUP/" 2>/dev/null || true
fi
if [ -d "$APP_DIR/public/uploads" ]; then
  echo "==> 备份 uploads -> $BACKUP/uploads"
  cp -a "$APP_DIR/public/uploads" "$BACKUP/uploads" 2>/dev/null || true
fi

TMP="/tmp/vg-src-$$"
rm -rf "$TMP"
echo "==> 从 GitHub 拉取最新代码（临时目录）..."
git clone --depth 1 -b "$BRANCH" "$REPO" "$TMP"

SRC="$TMP/vgrooving-cms"
if [ ! -f "$SRC/server.js" ]; then
  echo "ERROR: 克隆结果里找不到 vgrooving-cms/server.js" >&2
  exit 1
fi

mkdir -p "$APP_DIR"
echo "==> 同步代码到 $APP_DIR （保留 data/ 与 public/uploads/）..."
rsync -a --delete \
  --exclude 'data/' \
  --exclude 'public/uploads/' \
  --exclude 'node_modules/' \
  "$SRC/" "$APP_DIR/"

# 恢复运行时数据
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

# 用绝对路径重启，避免 pm2 指到旧目录
if command -v pm2 >/dev/null 2>&1; then
  echo "==> 重启 pm2: $PM2_NAME (cwd=$APP_DIR)"
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
  fi
  pm2 start "$APP_DIR/server.js" --name "$PM2_NAME" --cwd "$APP_DIR"
  pm2 save || true
else
  echo "WARN: 未找到 pm2，请手动重启 Node"
fi

sleep 1
echo "==> 校验 /api/build ..."
RESP="$(curl -s "http://127.0.0.1:3000/api/build" || true)"
echo "$RESP"
echo "$RESP" | grep -q "$BUILD_ID" || {
  echo ""
  echo "FAIL: buildId 不是 $BUILD_ID，当前进程可能仍指向旧文件。"
  echo "请执行: pm2 show $PM2_NAME | head -40"
  echo "确认 exec cwd / script path 都是 $APP_DIR"
  exit 1
}

echo ""
echo "========================================"
echo " 更新成功！"
echo " buildId = $BUILD_ID"
echo " 后台菜单应出现「商机中心」（不再是「收件箱」）"
echo " 请浏览器强制刷新 (Ctrl+F5) 后测试"
echo " 备份目录: $BACKUP"
echo "========================================"
rm -rf "$TMP"
