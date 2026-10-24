import pytest
from baseline import BaselineEngine, DeviceBaseline
from detector import DetectorEngine
from events import FlowEvent, AuthEvent
from datetime import datetime

def test_baseline_learning():
    engine = BaselineEngine()
    # Simulate 100 ticks of benign traffic
    for i in range(100):
        engine.process_event(FlowEvent(ts=datetime.now(), src="dev1", dst="google.com", port=443, bytes=100))

    baseline = engine.get_baseline("dev1")
    assert baseline.is_learned is True
    assert "google.com" in baseline.known_destinations
    assert baseline.mean_bytes == 100

def test_detector_volume_spike():
    engine = BaselineEngine()
    # Learn baseline
    for i in range(100):
        engine.process_event(FlowEvent(ts=datetime.now(), src="dev1", dst="google.com", port=443, bytes=100))

    detector = DetectorEngine(engine)
    # Trigger spike
    spike_event = FlowEvent(ts=datetime.now(), src="dev1", dst="google.com", port=443, bytes=1000000)
    alert = detector.analyze_event(spike_event)

    assert alert is not None
    assert "VOLUME_SPIKE" in alert.reason_codes

def test_detector_lateral_movement():
    engine = BaselineEngine()
    # Learn baseline
    for i in range(100):
        engine.process_event(FlowEvent(ts=datetime.now(), src="dev1", dst="google.com", port=443, bytes=100))

    detector = DetectorEngine(engine)
    # Trigger lateral movement to lock
    lateral_event = FlowEvent(ts=datetime.now(), src="dev1", dst="lock_1", port=22, bytes=500)
    alert = detector.analyze_event(lateral_event)

    assert alert is not None
    assert "FIRST_LATERAL_CONNECTION" in alert.reason_codes

def test_benign_update_no_alert():
    # Setup a baseline that includes a known update server
    engine = BaselineEngine()
    for i in range(100):
        engine.process_event(FlowEvent(ts=datetime.now(), src="thermostat", dst="google.com", port=443, bytes=100))

    # Manually add update server to baseline to simulate a 'verified' domain
    baseline = engine.get_baseline("thermostat")
    baseline.known_destinations.add("updates.google.com")

    detector = DetectorEngine(engine)
    # Event to update server
    update_event = FlowEvent(ts=datetime.now(), src="thermostat", dst="updates.google.com", port=443, bytes=2000000)

    # It might trigger VOLUME_SPIKE, but not NEW_EXTERNAL_DESTINATION
    alert = detector.analyze_event(update_event)
    if alert:
        assert "NEW_EXTERNAL_DESTINATION" not in alert.reason_codes
