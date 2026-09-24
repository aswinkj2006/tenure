"""
Tenure — ProtoTwin Connection Checker

Connects to the running ProtoTwin simulation on port 8084
and prints live telemetry signals from the UR5e model.
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sim.client import ProtoTwinClient


async def main():
    print("=" * 60)
    print("Connecting to live ProtoTwin simulation on port 8084...")
    print("=" * 60)

    client = ProtoTwinClient()
    try:
        await client.connect()
        sensors = client.read_all_sensors()

        print("\nSuccessfully read live sensors from your ProtoTwin model:")
        print("-" * 60)
        for name, val in sensors.items():
            print(f"  {name:<22}: {val}")
        print("-" * 60)
        print(f"Total active signals: {len(sensors)}")
        print("ProtoTwin integration is active and verified!\n")

        await client.disconnect()
    except Exception as e:
        print(f"\n[!] Could not connect to ProtoTwin: {e}")
        print("[!] Ensure ProtoTwin is running with your UR5e model loaded.\n")


if __name__ == "__main__":
    asyncio.run(main())
