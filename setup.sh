#!/bin/bash
# Karma Harness — Setup Script
# Usage: ./setup.sh /path/to/your/project

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/your/project"
  echo "Example: $0 ~/projects/my-app"
  exit 1
fi

TARGET="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Installing Karma Harness in $TARGET/.karma/"

# 1. Create .karma/ in target project
mkdir -p "$TARGET/.karma"

# 2. Copy harness structure (exclude this script and README)
rsync -av --exclude="setup.sh" --exclude="README.md" "$HERE/" "$TARGET/.karma/"

# 3. Create required directories
mkdir -p "$TARGET/.karma/.mettri/tarefas/pendentes"
mkdir -p "$TARGET/.karma/.mettri/tarefas/em-andamento"
mkdir -p "$TARGET/.karma/.mettri/tarefas/concluidas"
mkdir -p "$TARGET/.karma/.mettri/trail"
mkdir -p "$TARGET/.karma/e2e-tests"
mkdir -p "$TARGET/.karma/trail"

# 4. Create empty tarefas.html if not exists
if [ ! -f "$TARGET/.karma/tarefas.html" ]; then
  cat > "$TARGET/.karma/tarefas.html" << 'HTMLEOF'
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tarefas</title></head>
<body><h1>Karma — Tarefas</h1><p>Rode sync-html.mjs para gerar o quadro.</p></body></html>
HTMLEOF
fi

# 5. Add .karma/ to .gitignore if not already there
if [ -f "$TARGET/.gitignore" ]; then
  if ! grep -q "^\.karma/" "$TARGET/.gitignore" 2>/dev/null; then
    echo "" >> "$TARGET/.gitignore"
    echo "# Karma Harness" >> "$TARGET/.gitignore"
    echo ".karma/" >> "$TARGET/.gitignore"
    echo "✅ Added .karma/ to .gitignore"
  fi
else
  echo "# Karma Harness" > "$TARGET/.gitignore"
  echo ".karma/" >> "$TARGET/.gitignore"
  echo "✅ Created .gitignore with .karma/ entry"
fi

echo ""
echo "✅ Karma Harness installed in $TARGET/.karma/"
echo ""
echo "Next steps:"
echo "  1. Edit .karma/opencode.json — set your model names and adjust paths"
echo "  2. Edit .karma/AGENTS.md — configure your project structure, commands, domains"
echo "  3. Edit .karma/.mettri/identidade.md — set your agent's name and persona"
echo "  4. Edit .karma/.mettri/claims.yaml — add your project domains"
echo "  5. Add .karma/ to your opencode workspace"
echo ""
