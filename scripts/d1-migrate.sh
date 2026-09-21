#!/usr/bin/env bash
# Apply committed Drizzle SQL files to the card-vault D1 database.
# Usage: scripts/d1-migrate.sh --local | --remote
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

target="${1:-}"
if [[ "${target}" != "--local" && "${target}" != "--remote" ]]; then
  echo "usage: scripts/d1-migrate.sh --local | --remote" >&2
  exit 64
fi

files=(
  drizzle/0000_lyrical_carnage.sql
  drizzle/0001_lumpy_moira_mactaggert.sql
  drizzle/0002_majestic_nighthawk.sql
  drizzle/0003_brainy_vargas.sql
  drizzle/0004_phase2_collection_controls.sql
  drizzle/0005_phase3_valuation_history.sql
)

echo "Applying drizzle 0000–0005 to D1 database card-vault (${target#--})"
for file in "${files[@]}"; do
  echo "→ ${file}"
  npx wrangler d1 execute card-vault "${target}" --file="${file}"
done
echo "Migrations applied."
