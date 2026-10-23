import random
from datetime import datetime, timezone
from events import FlowEvent, AuthEvent, VendorCommandEvent
from blast import traffic_allowed


class HomeSimulator:
    def __init__(self, state):
        self.state = state
        self.tick_count = 0
        self.current_scenario = None
        self.blocked = []

    def key(self, key):
        return next((d.id for d in self.state.devices if (d.seed_key or d.id) == key), key)

    def generate_tick(self):
        self.tick_count += 1
        now = datetime.now(timezone.utc)
        events = []
        for d in self.state.devices:
            destination = {"camera_1": "secureview.com", "hub": "homelink.com", "thermostat": "google.com"}.get(d.seed_key or d.id)
            destination = destination or (d.allowed_destinations[0].replace("*.", "telemetry.") if d.allowed_destinations and d.allowed_destinations[0] != "*" else "google.com")
            events.append(FlowEvent(ts=now, src=d.id, dst=destination, port=443, bytes=random.randint(100, 500)))
        for a in self.state.accounts:
            if not a.access_revoked:
                events.append(AuthEvent(ts=now, account_id=a.id, client="home", geo="Home", result="success"))
        if self.current_scenario == "A":
            events.extend([FlowEvent(ts=now, src=self.key("plug_1"), dst="evil-cnc.net", port=8080, bytes=3000000),
                           FlowEvent(ts=now, src=self.key("plug_1"), dst=self.key("router"), port=22, bytes=500)])
        elif self.current_scenario == "B":
            account = next((a for a in self.state.accounts if (a.seed_key or a.id) == "camera_vendor_acc"), None)
            if account and not account.access_revoked:
                events.append(AuthEvent(ts=now, account_id=account.id, client="attacker-pc", geo="Unknown", result="fail"))
                if self.tick_count % 5 == 0:
                    events.append(AuthEvent(ts=now, account_id=account.id, client="attacker-pc", geo="Unknown", result="success"))
                    lock = self.key("lock_1")
                    if lock in account.linked_device_ids:
                        events.append(VendorCommandEvent(ts=now, account_id=account.id, device_id=lock, operation="virtual_unlock_request"))
        elif self.current_scenario == "C":
            device = next((d for d in self.state.devices if (d.seed_key or d.id) == "thermostat"), None)
            if device:
                verified = device.vendor == "Google" and "*.google.com" in device.allowed_destinations
                events.append(FlowEvent(ts=now, src=device.id, dst="updates.google.com", port=443,
                                        bytes=2000000, verified_vendor_update=verified))
        self.blocked = [e for e in events if isinstance(e, FlowEvent) and not traffic_allowed(self.state, e.src, e.dst)]
        # Attempts denied by access policy remain visible as telemetry but cannot traverse the network.
        return [e for e in events if e not in self.blocked]

    async def run_tick(self):
        return self.generate_tick()

    def set_scenario(self, scenario):
        self.current_scenario = scenario
        self.tick_count = 0
