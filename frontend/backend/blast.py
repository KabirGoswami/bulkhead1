from typing import List, Set, Dict, Tuple
from collections import deque
from models import HomeState

def get_reachable_nodes(state: HomeState, start_node_id: str) -> Set[str]:
    """
    Calculates all reachable devices and accounts from a starting node.
    Reachability is defined as:
    1. Same zone reachability (Simplified: if they share a zone, they can potentially reach each other).
    2. Explicit peer rules (allowed_peers).
    3. Account links (compromised account reaches all linked devices).
    """
    reachable = {start_node_id}
    queue = deque([start_node_id])

    # Create lookups for faster access
    device_map = {d.id: d for d in state.devices}
    account_map = {a.id: a for a in state.accounts}

    # Map zones to devices
    zone_map: Dict[str, List[str]] = {}
    for d in state.devices:
        zone_map.setdefault(d.zone, []).append(d.id)

    # Map accounts to devices
    account_to_devices: Dict[str, List[str]] = {}
    for a in state.accounts:
        account_to_devices[a.id] = a.linked_device_ids

    while queue:
        current = queue.popleft()

        # If current is a device
        if current in device_map:
            device = device_map[current]

            # 1. Zone Reachability: Any device in the same zone is reachable
            # (In a real network, this would be subnet-based)
            for peer_id in zone_map.get(device.zone, []):
                if peer_id not in reachable:
                    reachable.add(peer_id)
                    queue.append(peer_id)

            # 2. Explicit Peer Rules
            for peer_id in device.allowed_peers:
                if peer_id not in reachable:
                    reachable.add(peer_id)
                    queue.append(peer_id)

            # 3. Account Links: The device is linked to accounts; those accounts are now "compromised"
            for acc_id in device.account_ids:
                if acc_id not in reachable:
                    reachable.add(acc_id)
                    queue.append(acc_id)

        # If current is an account
        elif current in account_map:
            # Account reaches all its linked devices
            for dev_id in account_to_devices.get(current, []):
                if dev_id not in reachable:
                    reachable.add(dev_id)
                    queue.append(dev_id)

    return reachable

def calculate_exposure_score(state: HomeState) -> float:
    """
    Computes a global exposure score (0-100).
    Sum of (Criticality Weight * IsReachable) / Total Weight.
    For the global score, we assume the most vulnerable entry point is the source.
    """
    weights = {"low": 1, "medium": 3, "high": 7, "safety": 15}
    total_potential_weight = sum(weights.get(d.criticality, 1) for d in state.devices)

    # Find the "worst" single node compromise
    max_impact = 0
    all_nodes = [d.id for d in state.devices] + [a.id for a in state.accounts]

    for node in all_nodes:
        reachable = get_reachable_nodes(state, node)
        impact = sum(weights.get(device_map[d_id].criticality, 1)
                     for d_id in reachable if d_id in device_map)
        max_impact = max(max_impact, impact)

    device_map = {d.id: d for d in state.devices} # Re-defined for scope

    return min(100.0, (max_impact / total_potential_weight) * 100)

# Fix for the weight logic in the loop
def calculate_exposure_score_fixed(state: HomeState) -> float:
    weights = {"low": 1, "medium": 3, "high": 7, "safety": 15}
    device_map = {d.id: d for d in state.devices}
    total_potential_weight = sum(weights.get(d.criticality, 1) for d in state.devices)

    if total_potential_weight == 0: return 0.0

    max_impact = 0
    all_nodes = list(device_map.keys()) + [a.id for a in state.accounts]

    for node in all_nodes:
        reachable = get_reachable_nodes(state, node)
        impact = sum(weights.get(device_map[d_id].criticality, 1)
                     for d_id in reachable if d_id in device_map)
        max_impact = max(max_impact, impact)

    return min(100.0, (max_impact / total_potential_weight) * 100)
