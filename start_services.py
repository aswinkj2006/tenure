"""
Tenure — Microservices Runner

Starts all Tenure backend services concurrently for local development / demo:
  - Orchestrator (Port 8000)
  - Anomaly Service (Port 8001)
  - Alert Service (Port 8002)
  - RAG Service (Port 8003)

Usage:
  python start_services.py
"""

import subprocess
import os
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).parent

# Ensure we use project .venv or Python 3.11 with all installed dependencies
venv_py = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
py311_candidate = r"C:\Users\Aswin K J\AppData\Local\Programs\Python\Python311\python.exe"

if venv_py.exists():
    PYTHON_EXE = str(venv_py)
elif os.path.exists(py311_candidate):
    PYTHON_EXE = py311_candidate
else:
    PYTHON_EXE = sys.executable

SERVICES = [
    {
        "name": "Orchestrator",
        "cmd": [PYTHON_EXE, "-m", "uvicorn", "services.orchestrator.main:app", "--port", "8000", "--host", "0.0.0.0", "--reload"],
        "port": 8000,
    },
    {
        "name": "Anomaly Service",
        "cmd": [PYTHON_EXE, "-m", "uvicorn", "services.anomaly_service.main:app", "--port", "8001", "--host", "0.0.0.0", "--reload"],
        "port": 8001,
    },
    {
        "name": "Alert Service",
        "cmd": [PYTHON_EXE, "-m", "uvicorn", "services.alert_service.main:app", "--port", "8002", "--host", "0.0.0.0", "--reload"],
        "port": 8002,
    },
    {
        "name": "RAG Service",
        "cmd": [PYTHON_EXE, "-m", "uvicorn", "services.rag_service.main:app", "--port", "8003", "--host", "0.0.0.0", "--reload"],
        "port": 8003,
    },
]


def main():
    print("=" * 60)
    print("[TENURE] Starting Tenure Backend Microservices System...")
    print("=" * 60)

    processes = []
    try:
        for s in SERVICES:
            print(f"[*] Launching {s['name']} on http://localhost:{s['port']}...")
            p = subprocess.Popen(s["cmd"], cwd=str(ROOT_DIR))
            processes.append((s["name"], p))
            time.sleep(0.5)

        print("\n[READY] All services running! Press Ctrl+C to terminate all services.\n")
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Shutting down services...")
        for name, p in processes:
            p.terminate()
        for name, p in processes:
            p.wait()
        print("Done.")



if __name__ == "__main__":
    main()
