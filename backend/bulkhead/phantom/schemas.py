from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class NarrowModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SensorEvent(NarrowModel):
    event_id: UUID
    household_id: UUID
    device_id: str = Field(min_length=1, max_length=36, pattern=r"^[a-zA-Z0-9_-]+$")
    sequence: int = Field(strict=True, ge=1, le=2147483647)
    observed_at: float = Field(ge=0)
    kind: Literal["door.open", "door.closed", "motion.detected", "lock.locked", "lock.unlocked",
                  "presence.detected", "sensor.offline", "sensor.online"]
    # No arbitrary attributes, recordings, credentials, or browser-provided source label.


class CommandInput(NarrowModel):
    command_key: UUID
    target: Literal["hallway_light", "entry_lock"]
    command: Literal["turn_on", "turn_off", "unlock"]
    assessment_id: UUID | None = None


class RuleInput(NarrowModel):
    revision: int = Field(ge=1)
    target: Literal["hallway_light", "entry_lock"]
    enabled: bool
    window_seconds: int = Field(default=10, ge=2, le=30)


class PrivacyInput(NarrowModel):
    retention_days: int = Field(ge=1, le=30)


class DemoInput(NarrowModel):
    scenario: Literal["normal_entry", "compromised_sensor", "replay", "forged_sender", "owner_approval", "sensor_dropout"]
    command_key: UUID


class ApprovalInput(NarrowModel):
    decision: Literal["approve", "reject"]
