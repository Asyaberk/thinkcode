#!/bin/sh
# entrypoint.sh — backend startup script
# 1. DB hazır olana kadar bekle
# 2. Alembic migrations çalıştır
# 3. DB boşsa seed et
# 4. Uvicorn başlat

set -e

echo "⏳ Waiting for DB to be ready..."
python - <<'PYEOF'
import time, psycopg2, os, sys

for i in range(30):
    try:
        conn = psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", 5432)),
            user=os.environ["DB_USERNAME"],
            password=os.environ["DB_PASSWORD"],
            dbname=os.environ["DB_DATABASE"],
        )
        conn.close()
        print("✅ DB is ready.")
        sys.exit(0)
    except Exception as e:
        print(f"  Waiting... ({i+1}/30) {e}")
        time.sleep(2)

print("❌ DB not reachable after 60s")
sys.exit(1)
PYEOF

echo "🔄 Running Alembic migrations..."
alembic upgrade head

echo "🌱 Checking if seed is needed..."
python - <<'PYEOF'
import os, sys, psycopg2, subprocess

conn = psycopg2.connect(
    host=os.environ["DB_HOST"],
    port=int(os.environ.get("DB_PORT", 5432)),
    user=os.environ["DB_USERNAME"],
    password=os.environ["DB_PASSWORD"],
    dbname=os.environ["DB_DATABASE"],
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM users")
count = cur.fetchone()[0]
conn.close()

if count == 0:
    print("📦 DB is empty — running seed...")
    result = subprocess.run(
        ["python", "-m", "scripts.seed.run_all"],
        cwd="/app"
    )
    sys.exit(result.returncode)
else:
    print(f"✅ DB already has {count} users — skipping seed.")
PYEOF

echo "🚀 Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
