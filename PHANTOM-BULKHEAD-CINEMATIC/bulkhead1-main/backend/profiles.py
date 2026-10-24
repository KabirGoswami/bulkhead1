from typing import Dict, Any

class Profile:
    def __init__(self, name: str, criticality_overrides: Dict[str, str], autonomy_overrides: Dict[str, int]):
        self.name = name
        self.criticality_overrides = criticality_overrides
        self.autonomy_overrides = autonomy_overrides

PROFILES = {
    "Admin": Profile(
        name="Admin",
        criticality_overrides={},
        autonomy_overrides={}
    ),
    "Family": Profile(
        name="Family with Kids",
        criticality_overrides={"speaker": "medium", "plug_1": "medium"},
        autonomy_overrides={"low": 1}
    ),
    "Work": Profile(
        name="Works from Home",
        criticality_overrides={"laptop": "safety", "router": "safety"},
        autonomy_overrides={"high": 1} # More aggressive auto-containment for work assets
    ),
    "Solo": Profile(
        name="Lives Alone",
        criticality_overrides={"lock_1": "safety", "camera_1": "safety"},
        autonomy_overrides={"safety": 2} # Allow confirmation for safety devices
    )
}
