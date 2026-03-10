import sqlite3
conn = sqlite3.connect('backend/vtt.db')
conn.execute("UPDATE campaigns SET room_id='DRGN15' WHERE id=1")
conn.commit()
print("Room ID updated to DRGN15")
conn.close()
