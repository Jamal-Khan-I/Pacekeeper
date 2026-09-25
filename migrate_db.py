"""
One-time DB migration to add class_id columns to topics and performance_records.
Safe to run multiple times (checks for existence first).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "pacekeeper.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check existing columns in topics
cur.execute("PRAGMA table_info(topics)")
topics_cols = [r[1] for r in cur.fetchall()]
print("topics columns before:", topics_cols)

if "class_id" not in topics_cols:
    cur.execute("ALTER TABLE topics ADD COLUMN class_id TEXT NOT NULL DEFAULT 'class_a'")
    print("Added topics.class_id")

if "source" not in topics_cols:
    cur.execute("ALTER TABLE topics ADD COLUMN source TEXT NOT NULL DEFAULT 'live'")
    print("Added topics.source")

# Check performance_records
cur.execute("PRAGMA table_info(performance_records)")
perf_cols = [r[1] for r in cur.fetchall()]
print("performance_records columns before:", perf_cols)

if "class_id" not in perf_cols:
    cur.execute("ALTER TABLE performance_records ADD COLUMN class_id TEXT NOT NULL DEFAULT 'class_a'")
    print("Added performance_records.class_id")

if "source" not in perf_cols:
    cur.execute("ALTER TABLE performance_records ADD COLUMN source TEXT NOT NULL DEFAULT 'live'")
    print("Added performance_records.source")

if "image_path" not in perf_cols:
    cur.execute("ALTER TABLE performance_records ADD COLUMN image_path TEXT")
    print("Added performance_records.image_path")

conn.commit()

# Verify
cur.execute("PRAGMA table_info(topics)")
topics_cols_after = [r[1] for r in cur.fetchall()]
print("topics columns after:", topics_cols_after)

cur.execute("PRAGMA table_info(performance_records)")
perf_cols_after = [r[1] for r in cur.fetchall()]
print("performance_records columns after:", perf_cols_after)

conn.close()
print("Migration complete.")
