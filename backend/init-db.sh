#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$(dirname "$0")/data"
DB_FILE="$(dirname "$0")/data/mypad.db"

if [ ! -f "$DB_FILE" ]; then
  touch "$DB_FILE"
  echo "Created empty SQLite database at $DB_FILE"
else
  echo "Database already exists at $DB_FILE"
fi
