#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${MYPAD_DB_FILE:-$(dirname "$0")/data/mypad.db}"
DB_DIR="$(dirname "$DB_FILE")"

mkdir -p "$DB_DIR"

if [ ! -f "$DB_FILE" ]; then
  touch "$DB_FILE"
  echo "Created empty SQLite database at $DB_FILE"
else
  echo "Database already exists at $DB_FILE"
fi
