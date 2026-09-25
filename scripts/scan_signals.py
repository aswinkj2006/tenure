"""
Tenure — ProtoTwin Signal Scanner
===================================
Run this with the SAME Python that has prototwin installed
(the one you use to run the bridge).

Usage (PowerShell — note the & operator before the path):
    & "C:/Users/Aswin K J/AppData/Local/Programs/Python/Python311/python.exe" scripts/scan_signals.py

Also works via:
    python scripts/scan_signals.py   (if prototwin is in your default python)

This will:
1. Connect to ProtoTwin (must be running)
2. Scan addresses 0-120 and print ALL non-zero values
3. Help identify the exact gripper signal address

Look for addresses AFTER 43 that change when you open/close
the gripper in ProtoTwin.
"""

import asyncio


async def scan():
    try:
        from websockets.legacy.client import connect as ws_connect
        from prototwin.client import Client as ProtoClient
    except ImportError as e:
        print(f"[scanner] Import error: {e}")
        print("[scanner] Run with: python that has prototwin installed")
        return

    try:
        ws = await ws_connect(
            "ws://localhost:8084",
            compression=None,
            user_agent_header="Scanner",
            ping_interval=None,
            close_timeout=5,
        )
        await ws.recv()
        client = ProtoClient(ws)
        await client.initialize()
        print("[scanner] Connected to ProtoTwin!\n")
    except Exception as e:
        print(f"[scanner] FAILED: {e}")
        print("[scanner] Make sure ProtoTwin is open and running.")
        return

    print("=" * 60)
    print("  Scanning addresses 0-120")
    print("=" * 60)

    results = {}
    for addr in range(0, 121):
        try:
            v = client.get(addr)
            results[addr] = float(v)
        except Exception:
            results[addr] = None

    # Print all addresses with their values
    print(f"\n{'ADDR':>5}  {'VALUE':>12}  NOTES")
    print("-" * 40)
    for addr, val in sorted(results.items()):
        if val is None:
            continue
        note = ""
        if addr == 0:
            note = "sim_time / addr 0"
        elif 2 <= addr <= 43:
            joint_num = (addr - 2) // 7 + 1
            offset = (addr - 2) % 7
            labels = ["motor_state", "target_pos", "target_vel",
                      "force_limit", "current_pos", "current_vel", "current_force"]
            if joint_num <= 6:
                note = f"J{joint_num}.{labels[offset]}"
        elif addr >= 44:
            note = "<< POSSIBLE GRIPPER/TOOL SIGNAL >>"

        abs_val = abs(val) if val is not None else 0
        marker = "***" if addr >= 44 and abs_val > 0.001 else ""
        print(f"  {addr:3d}  {val:12.4f}  {note} {marker}")

    print("\n" + "=" * 60)
    non_zero_tool = {a: v for a, v in results.items()
                     if a >= 44 and v is not None and abs(v) > 0.001}
    if non_zero_tool:
        print(f"  GRIPPER CANDIDATES: {non_zero_tool}")
        print("  -> Open/close gripper in ProtoTwin, run scan again,")
        print("     and note which address CHANGES. That's your gripper signal.")
    else:
        print("  No non-zero signals found at addresses 44+.")
        print("  Gripper may use digital I/O (0 or 1 only) — check addresses")
        print("  44-80 for values exactly 0.0 or 1.0 that change with gripper.")

    print("=" * 60)
    await ws.close()


if __name__ == "__main__":
    asyncio.run(scan())
