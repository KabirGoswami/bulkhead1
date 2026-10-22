import random
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from events import FlowEvent, AuthEvent
from models import HomeState

class HomeSimulator:
    def __init__(self, state: HomeState):
        self.state = state
        self.tick_count = 0
        self.is_running = False
        self.current_scenario = None

    async def run_tick(self) -> List[Any]:
        """Simulates one minute of home activity."""
        self.tick_count += 1
        events = []
        now = datetime.now()

        # --- Benign Traffic Generation ---
        # Camera: steady upload to cloud
        events.append(FlowEvent(ts=now, src="camera_1", dst="secureview.com", port=443, bytes=random.randint(50000, 100000)))

        # Hub: periodic heartbeat
        events.append(FlowEvent(ts=now, src="hub", dst="homelink.com", port=443, bytes=random.randint(100, 500)))

        # Thermostat: small reports
        events.append(FlowEvent(ts=now, src="thermostat", dst="google.com", port=443, bytes=random.randint(50, 200)))

        # Random activity from other devices
        for device in self.state.devices:
            if device.id in ["camera_1", "hub", "thermostat"]: continue
            if random.random() < 0.1:
                events.append(FlowEvent(ts=now, src=device.id, dst="google.com", port=443, bytes=random.randint(100, 1000)))

        # --- Scenario-Based Traffic ---
        if self.current_scenario == "A": # Compromised Smart Plug
            # Sudden large upload to unknown host
            events.append(FlowEvent(ts=now, src="plug_1", dst="evil-cnc.net", port=8080, bytes=random.randint(1000000, 5000000)))
            # Lateral movement attempts
            if random.random() < 0.3:
                events.append(FlowEvent(ts=now, src="plug_1", dst="camera_1", port=22, bytes=random.randint(100, 500)))
            if random.random() < 0.3:
                events.append(FlowEvent(ts=now, src="plug_1", dst="lock_1", port=22, bytes=random.randint(100, 500)))

        elif self.current_scenario == "B": # Stolen Lock Credentials
            # Burst of failed logins from new geo
            if random.random() < 0.5:
                events.append(AuthEvent(ts=now, account_id="camera_vendor_acc", client="attacker-pc", geo="Unknown", result="fail"))

            # Eventually success, then unlock request
            if self.tick_count % 5 == 0:
                events.append(AuthEvent(ts=now, account_id="camera_vendor_acc", client="attacker-pc", geo="Unknown", result="success"))
                events.append(FlowEvent(ts=now, src="attacker-pc", dst="lock_1", port=443, bytes=random.randint(100, 500)))

        elif self.current_scenario == "C": # Benign Update
            # Thermostat firmware update (large volume, new destination)
            if 1 <= (self.tick_count % 10) <= 3:
                events.append(FlowEvent(ts=now, src="thermostat", dst="updates.google.com", port=443, bytes=random.randint(1000000, 2000000)))

        return events

    def set_scenario(self, scenario: Optional[str]):
        self.current_scenario = scenario
        # Reset tick count if scenario changes to ensure deterministic patterns
        self.tick_count = 0
