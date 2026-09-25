"""Quick liveness check for the digital twin pipeline."""
import urllib.request
import json
import time

def check():
    readings = []
    for i in range(4):
        try:
            r = urllib.request.urlopen('http://localhost:8001/sensors/ur5e-001/latest', timeout=3)
            d = json.loads(r.read().decode())
            ts = d.get('ts', 'N/A')
            j1 = d.get('sensors', {}).get('joint_1_position', 'N/A')
            j2 = d.get('sensors', {}).get('joint_2_position', 'N/A')
            print(f"[{i+1}] ts={ts[-15:]}  j1={j1}  j2={j2}")
            readings.append((ts, j1))
        except Exception as e:
            print(f"[{i+1}] ERROR: {e}")
        time.sleep(0.5)

    # Check if timestamps are updating
    if len(readings) >= 2:
        if readings[0][0] == readings[-1][0]:
            print("\n[!] STALE DATA — timestamps are NOT updating! The stream may be frozen.")
        else:
            print("\n[OK] Data is live — timestamps are updating.")

        if readings[0][1] == readings[-1][1]:
            print("[!] WARNING — joint positions are NOT changing between readings.")
        else:
            print("[OK] Joint positions are changing between readings.")

if __name__ == "__main__":
    check()
