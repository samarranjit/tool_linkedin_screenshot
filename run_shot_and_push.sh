#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/cholab/LabMembers/Samar/tool_linkedin_screenshot-main"
BRANCH="main"

cd "$REPO_DIR"

# Load nvm so node is available for non-interactive shells (systemd)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Load env vars if you use .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Sync with remote before doing any work
git fetch origin
git rebase origin/$BRANCH

# Run screenshot bot
node shot.js

# Ensure git identity exists (local to this repo)
git config user.name "ChoLab Screenshot Bot"
git config user.email "cholab-bot@users.noreply.github.com"

# Commit + push ONLY if screenshots changed
git add screens

if git diff --cached --quiet; then
  echo "No new screenshot changes to push."
  exit 0
fi

git commit -m "Update LinkedIn screenshots ($(date -Iseconds))"

# Sync again before pushing, in case remote changed while script was running
git fetch origin
git rebase origin/$BRANCH

git push origin "$BRANCH"
