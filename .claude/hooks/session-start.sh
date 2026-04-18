#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install Bun if not present
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

cd "$CLAUDE_PROJECT_DIR"

# Install all dependencies (uses bun.lock for reproducibility)
bun install

# Run typecheck for fast feedback on errors
bunx tsc --noEmit
cd client && bunx tsc --noEmit && cd ..
