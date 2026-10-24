from typing import List, Dict, Set, Any, Optional
from datetime import datetime
from collections import defaultdict
import numpy as np
from events import FlowEvent, AuthEvent

class DeviceBaseline:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.known_destinations: Set[str] = set()
        self.known_peers: Set[str] = set()
        self.byte_counts: List[int] = []
        self.login_geos: Set[str] = set()
        self.is_learned = False
        self.sample_count = 0

    def update(self, flow: Optional[FlowEvent] = None, auth: Optional[AuthEvent] = None):
        if flow:
            self.known_destinations.add(flow.dst)
            if flow.dst != "google.com": # Simplified: don't track generic cloud as unique peer
                self.known_peers.add(flow.dst)
            self.byte_counts.append(flow.bytes)

        if auth:
            self.login_geos.add(auth.geo)

    def finalize(self):
        self.is_learned = True

    @property
    def mean_bytes(self) -> float:
        return np.mean(self.byte_counts) if self.byte_counts else 0.0

    @property
    def std_bytes(self) -> float:
        # Avoid division by zero / NaN for perfectly consistent traffic
        val = np.std(self.byte_counts) if self.byte_counts else 0.0
        return max(val, 1.0) # Minimum std to allow z-score calculations


class BaselineEngine:
    def __init__(self):
        self.baselines: Dict[str, DeviceBaseline] = {}
        self.learning_period = 100 # ticks
        self.current_tick = 0

    def get_baseline(self, node_id: str) -> DeviceBaseline:
        if node_id not in self.baselines:
            self.baselines[node_id] = DeviceBaseline(node_id)
        return self.baselines[node_id]

    def process_event(self, event: Any):
        self.current_tick += 1

        # Determine node_id
        node_id = None
        if isinstance(event, FlowEvent):
            node_id = event.src
        elif isinstance(event, AuthEvent):
            node_id = event.account_id

        if not node_id: return

        baseline = self.get_baseline(node_id)

        if not baseline.is_learned:
            baseline.update(
                flow=event if isinstance(event, FlowEvent) else None,
                auth=event if isinstance(event, AuthEvent) else None
            )
            baseline.sample_count += 1
            if baseline.sample_count >= self.learning_period:
                baseline.finalize()

    def dump(self):
        return {key: {"destinations": sorted(b.known_destinations), "peers": sorted(b.known_peers),
                      "bytes": b.byte_counts[-100:], "geos": sorted(b.login_geos),
                      "learned": b.is_learned, "samples": b.sample_count}
                for key, b in self.baselines.items()}

    def restore(self, data):
        for key, value in data.items():
            b = self.get_baseline(key)
            b.known_destinations = set(value["destinations"])
            b.known_peers = set(value["peers"])
            b.byte_counts = value["bytes"]
            b.login_geos = set(value["geos"])
            b.is_learned = value["learned"]
            b.sample_count = value["samples"]
