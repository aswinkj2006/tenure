import sys
sys.path.insert(0, '.')
from db.init_db import SCHEMA, SEED_DATA
import sqlite3

conn = sqlite3.connect('db/tenure.db')
conn.execute('PRAGMA journal_mode=WAL')
conn.execute('PRAGMA foreign_keys=OFF')
conn.executescript(SCHEMA)
conn.executescript(SEED_DATA)
conn.commit()

cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM technicians")
print('Technicians:', cursor.fetchone()[0])
cursor.execute("SELECT COUNT(*) FROM inventory_parts")
print('Parts:', cursor.fetchone()[0])
cursor.execute("SELECT COUNT(*) FROM vendors")
print('Vendors:', cursor.fetchone()[0])
cursor.execute("SELECT COUNT(*) FROM machines")
print('Machines:', cursor.fetchone()[0])
conn.close()
print('DB migration done.')
