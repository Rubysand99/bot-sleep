#!/usr/bin/env bash
# Tự cập nhật bot: có commit mới trên origin/main thì pull, cài thư viện (nếu package đổi) và restart các tiến trình pm2.
# Chạy định kỳ bằng cron (xem README, mục "Tự cập nhật"). Chỉ restart khi thật sự có code mới.
#   BRANCH     nhánh theo dõi (mặc định main)
#   PM2_APPS   tên các tiến trình pm2, cách nhau bằng khoảng trắng (mặc định: bot-drew bot-cartone)
set -u
cd "$(dirname "$0")/.." || exit 1

BRANCH="${BRANCH:-main}"
PM2_APPS="${PM2_APPS:-bot-drew bot-cartone}"
LOCK=/tmp/bot-sleep-autoupdate.lock
log() { echo "$(date '+%F %T') [auto-update] $*"; }

# Không chạy chồng 2 lần cùng lúc
exec 9>"$LOCK"
flock -n 9 || exit 0

git fetch -q origin "$BRANCH" || { log "git fetch lỗi (mạng?)"; exit 1; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
[ "$LOCAL" = "$REMOTE" ] && exit 0

log "Có code mới: ${LOCAL:0:7} -> ${REMOTE:0:7}"
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE")

# Chỉ lấy đúng code trên GitHub; file .env của VPS không bị đụng (đã nằm trong .gitignore)
git reset --hard "origin/$BRANCH" -q || { log "git reset lỗi"; exit 1; }

if echo "$CHANGED" | grep -qE '^package(-lock)?\.json$'; then
  log "package đổi -> npm install"
  npm install --omit=dev --no-audit --no-fund || { log "npm install lỗi, KHÔNG restart"; exit 1; }
fi

for app in $PM2_APPS; do
  if pm2 describe "$app" >/dev/null 2>&1; then
    pm2 restart "$app" --update-env >/dev/null && log "đã restart $app"
  else
    log "không thấy tiến trình pm2 '$app' (xem tên bằng: pm2 ls)"
  fi
done
log "Xong, đang chạy ${REMOTE:0:7}"
