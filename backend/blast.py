from collections import deque
from fnmatch import fnmatchcase
from models import HomeState


def traffic_allowed(state, source, target):
    devices = {d.id: d for d in state.devices}
    src, dst = devices.get(source), devices.get(target)
    if not src:
        return False
    if src.isolated or src.approval != "approved" or (dst and (dst.isolated or dst.approval != "approved")):
        return False
    if dst:
        if src.policy_peers is not None:
            return target in src.policy_peers
        return src.zone == dst.zone or target in src.allowed_peers
    destinations = src.policy_destinations if src.policy_destinations is not None else src.allowed_destinations
    return any(rule == "*" or fnmatchcase(target, rule) or rule == "*." + target for rule in destinations)


def topology_edges(state):
    edges = []
    devices = {d.id: d for d in state.devices}
    accounts = {a.id: a for a in state.accounts}
    for device in state.devices:
        for peer in state.devices:
            if peer.id != device.id and traffic_allowed(state, device.id, peer.id):
                edges.append({"source": device.id, "target": peer.id,
                              "kind": "peer" if peer.id in device.allowed_peers else "zone"})
        # Network isolation cannot revoke a compromised vendor identity.
        for account_id in device.account_ids:
            if account_id in accounts and not accounts[account_id].access_revoked:
                edges.append({"source": device.id, "target": account_id, "kind": "account"})
    for account in state.accounts:
        if not account.access_revoked:
            for device_id in account.linked_device_ids:
                if device_id in devices:
                    edges.append({"source": account.id, "target": device_id, "kind": "account"})
    return edges


def get_reachable_nodes(state: HomeState, start_node_id: str):
    nodes = {d.id for d in state.devices} | {a.id for a in state.accounts}
    if start_node_id not in nodes:
        return set()
    graph = {}
    for edge in topology_edges(state):
        graph.setdefault(edge["source"], []).append(edge["target"])
    reached, queue = {start_node_id}, deque([start_node_id])
    while queue:
        for peer in graph.get(queue.popleft(), []):
            if peer not in reached:
                reached.add(peer)
                queue.append(peer)
    return reached


def calculate_exposure_score_fixed(state):
    weights = {"low": 1, "medium": 3, "high": 7, "safety": 15}
    weighted = {d.id: weights.get(d.criticality, 1) for d in state.devices}
    total = sum(weighted.values())
    if not total:
        return 0.0
    nodes = [*weighted, *(a.id for a in state.accounts)]
    return min(100.0, max(sum(weighted.get(n, 0) for n in get_reachable_nodes(state, node))
                          for node in nodes) / total * 100)
