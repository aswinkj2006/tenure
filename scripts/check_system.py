"""Full system status check for Tenure digital twin."""
import urllib.request
import json

print("=== SYSTEM STATUS CHECK ===")

# 1. Anomaly service health
try:
    r = urllib.request.urlopen("http://localhost:8001/health", timeout=3)
    h = json.loads(r.read())
    print(f"[anomaly_service] {h}")
except Exception as e:
    print(f"[anomaly_service] OFFLINE: {e}")

# 2. Stream status
try:
    r = urllib.request.urlopen("http://localhost:8001/stream/status", timeout=3)
    s = json.loads(r.read())
    alive = s["stream_alive"]
    restarts = s["stream_restarts"]
    client = s["sim_client_type"]
    subs = s["subscribers"]
    last_ts = s["last_timestamp"]
    print(f"[stream] alive={alive} restarts={restarts} client={client} ws_subs={subs}")
    print(f"         last_ts={last_ts}")
except Exception as e:
    print(f"[stream] ERROR: {e}")

# 3. Orchestrator
try:
    r = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
    h = json.loads(r.read())
    print(f"[orchestrator] {h}")
except Exception as e:
    print(f"[orchestrator] OFFLINE: {e}")

print()
print("=== LIVE SENSOR READINGS ===")
try:
    r = urllib.request.urlopen("http://localhost:8001/sensors/ur5e-001/latest", timeout=3)
    d = json.loads(r.read())
    s = d["sensors"]
    print(f"  ts: {d['ts']}")
    for i in range(1, 7):
        pos = s.get(f"joint_{i}_position", 0)
        vel = s.get(f"joint_{i}_velocity", 0)
        trq = s.get(f"joint_{i}_torque", 0)
        print(f"  J{i}: pos={pos:+.4f} rad  vel={vel:+.4f} rad/s  trq={trq:+.2f} Nm")
except Exception as e:
    print(f"ERROR: {e}")
