import sqlite3
import os

db_path = 'vtt.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def add_column(table, column, type):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {type}")
        print(f"Added column {column} to table {table}")
    except sqlite3.OperationalError:
        print(f"Column {column} already exists in table {table} or table missing")

# Track H: Inventory
add_column("users", "inventory", "TEXT")
add_column("users", "avatar_url", "TEXT")
add_column("users", "bio", "TEXT")
add_column("users", "stats", "JSON")

# Track G: Ambient Audio
add_column("locations", "ambient_audio", "TEXT")
add_column("locations", "map_scale", "INTEGER DEFAULT 5")

# Track H: Fog of War
add_column("locations", "is_fog_active", "BOOLEAN DEFAULT 0")
add_column("locations", "fog_data", "JSON")

# Track H: Initiative Tracker
add_column("campaigns", "initiative_data", "JSON")

conn.commit()
conn.close()
print("Schema update completed.")
