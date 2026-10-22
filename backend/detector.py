from typing import List, Dict, Any, Optional
from datetime import datetime
from events import FlowEvent, AuthEvent
from baseline import DeviceBaseline
from alert_model import Alert

class DetectorEngine:
    def __init__(self, baseline_engine):
        self.baseline_engine = baseline_engine
        self.alert_history: List[Alert] = []

    def analyze_event(self, event: Any) -> Optional[Alert]:
        node_id = None
        if isinstance(event, FlowEvent):
            node_id = event.src
        elif isinstance(event, AuthEvent):
            node_id = event.account_id

        if not node_id: return None

        baseline = self.baseline_engine.get_baseline(node_id)
        if not baseline.is_learned:
            return None # Don't alert during learning phase

        signals = []

        # --- Flow Analysis ---
        if isinstance(event, FlowEvent):
            # 1. New External Destination
            if event.dst not in baseline.known_destinations:
                signals.append("NEW_EXTERNAL_DESTINATION")

            # 2. Volume Spike
            if baseline.std_bytes > 0:
                z_score = (event.bytes - baseline.mean_bytes) / baseline.std_bytes
                if z_score > 3: # 3 standard deviations
                    signals.append("VOLUME_SPIKE")

            # 3. First Lateral Connection
            # (Simplification: any internal peer not in baseline)
            if event.dst in ["camera_1", "lock_1", "hub", "router"] and event.dst not in baseline.known_peers:
                signals.append("FIRST_LATERAL_CONNECTION")

        # --- Auth Analysis ---
        if isinstance(event, AuthEvent):
            # 4. New Geo Login
            if event.geo not in baseline.login_geos:
                signals.append("NEW_GEO_LOGIN")

            # 5. Failed Login Burst (Simplified check)
            if event.result == "fail":
                # In a real system, we'd track windowed counts
                signals.append("FAILED_LOGIN_ATTEMPT")

        if not signals:
            return None

        # Confidence Calculation
        confidence = "low"
        if len(signals) >= 3: confidence = "high"
        elif len(signals) >= 2: confidence = "medium"

        # Explainable Reason
        explanation = self.generate_explanation(node_id, signals, event)

        return Alert(
            id=f"alert_{int(datetime.now().timestamp())}",
            node_id=node_id,
            confidence=confidence,
            reason_codes=signals,
            explanation=explanation,
            timestamp=datetime.now()
        )

    def generate_explanation(self, node_id: str, signals: List[str], event: Any) -> str:
        parts = []
        if "NEW_EXTERNAL_DESTINATION" in signals:
            dst = event.dst if isinstance(event, FlowEvent) else "unknown"
            parts.append(f"sent data to an unknown server ({dst})")
        if "VOLUME_SPIKE" in signals:
            parts.append(f"sent {event.bytes} bytes (significant spike)")
        if "FIRST_LATERAL_CONNECTION" in signals:
            dst = event.dst if isinstance(event, FlowEvent) else "unknown"
            parts.append(f"attempted to reach {dst} for the first time")
        if "NEW_GEO_LOGIN" in signals:
            geo = event.geo if isinstance(event, AuthEvent) else "unknown"
            parts.append(f"login attempt from unusual location ({geo})")
        if "FAILED_LOGIN_ATTEMPT" in signals:
            parts.append("multiple failed login attempts detected")

        return f"The node {node_id} { ' and '.join(parts)}."
