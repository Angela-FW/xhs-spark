#!/bin/bash
# 双击运行：登录 GitHub → 创建公开仓库 → 推送代码
set -e
export PATH="$HOME/.local/bin:$PATH"
PROJECT="$HOME/xhs-spark"
REPO_NAME="xhs-spark"
OWNER="Angela-FW"

cd "$PROJECT" || {
  echo "找不到项目：$PROJECT"
  read -r -p "按回车关闭…"
  exit 1
}

if ! command -v gh >/dev/null; then
  echo "未找到 gh，请先告诉 Cursor 助手重新安装。"
  read -r -p "按回车关闭…"
  exit 1
fi

echo "=== 1/3 登录 GitHub（会打开浏览器）==="
if ! gh auth status -h github.com >/dev/null 2>&1; then
  gh auth login --hostname github.com --git-protocol https --web
else
  echo "已登录：$(gh api user --jq .login)"
fi

LOGIN="$(gh api user --jq .login)"
echo "当前账号：$LOGIN"
if [ "$LOGIN" != "$OWNER" ]; then
  echo "注意：当前登录账号是 $LOGIN，不是 $OWNER。"
  echo "将推到 https://github.com/$LOGIN/$REPO_NAME"
  OWNER="$LOGIN"
fi

echo
echo "=== 2/3 创建/关联仓库 ==="
if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "仓库已存在：https://github.com/$OWNER/$REPO_NAME"
  if git remote get-url github >/dev/null 2>&1; then
    git remote set-url github "https://github.com/$OWNER/$REPO_NAME.git"
  else
    git remote add github "https://github.com/$OWNER/$REPO_NAME.git"
  fi
else
  gh repo create "$OWNER/$REPO_NAME" --public --description "重启笔记：小红书文案 + 内容规划" --source=. --remote=github
fi

echo
echo "=== 3/3 推送 main ==="
git push -u github main

echo
echo "完成：https://github.com/$OWNER/$REPO_NAME"
read -r -p "按回车关闭…"
