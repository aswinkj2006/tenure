import sqlite3

conn = sqlite3.connect("db/tenure.db")
cur = conn.cursor()
cur.execute("UPDATE machines SET health_score = 91.5 WHERE machine_id = 'ur5e-001'")
cur.execute("UPDATE machines SET health_score = 92.0 WHERE machine_id = 'kuka-kr10'")
cur.execute("UPDATE machines SET health_score = 90.5 WHERE machine_id = 'fanuc-crx10'")
cur.execute("UPDATE machines SET health_score = 95.0 WHERE machine_id = 'abb-irb1200'")
conn.commit()

rows = cur.execute("SELECT machine_id, name, health_score FROM machines").fetchall()
print("[OK] Updated machine health scores to 90ish:")
for r in rows:
    print(f"  {r[0]}: {r[2]}% ({r[1]})")
conn.close()
