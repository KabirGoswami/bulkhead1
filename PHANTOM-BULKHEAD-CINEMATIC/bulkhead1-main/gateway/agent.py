"""Windows Python 3.12 gateway. OpenSSH carries only fixed, allowlisted helper messages."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import urllib.error
from urllib.parse import urlsplit
from uuid import UUID


class Agent:
    def __init__(self, config):
        self.config = config
        origin = urlsplit(config["app_origin"])
        if origin.scheme != "https" and not (origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1")):
            raise ValueError("Use HTTPS or an explicit loopback lab origin")
        if origin.path or origin.query or origin.fragment or origin.username:
            raise ValueError("App origin cannot contain a path")
        self.credential = os.environ.get("BULKHEAD_AGENT_CREDENTIAL", "")
        if not self.credential:
            raise ValueError("Set BULKHEAD_AGENT_CREDENTIAL securely in the process environment")
        if not Path(config["known_hosts"]).is_file():
            raise ValueError("Pinned known_hosts required; enroll host keys from each VM console")
        self.journal_path = Path(config["journal"])
        self.journal = json.loads(self.journal_path.read_text()) if self.journal_path.exists() else {}
        self.mapping = config["mapping"]
        if self.mapping["ipv4"] != "192.168.10.10" or self.mapping["mac"] != "02:00:00:00:10:10":
            raise ValueError("V1 supports only the synthetic plug mapping")
        UUID(self.mapping["device_id"])

    def api(self, path, body=None):
        request = urllib.request.Request(self.config["app_origin"] + "/api/v1/gateway" + path,
                   data=json.dumps(body).encode() if body is not None else None,
                   headers={"Authorization": "Bearer " + self.credential, "Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    def ssh(self, target, payload=None):
        port = {"router": 2222, "probe": 2223}[target]
        cfg = self.config
        args = ["ssh", "-T", "-p", str(port), "-i", cfg[target+"_key"],
                "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
                "-o", "UserKnownHostsFile=" + cfg["known_hosts"], "-o", "ConnectTimeout=5",
                "-o", "ClearAllForwardings=yes", "-o", "RequestTTY=no", "root@127.0.0.1"]
        args.append("bulkhead" if target == "router" else "fixture")
        result = subprocess.run(args, input=json.dumps(payload) if payload is not None else "", text=True,
                                capture_output=True, timeout=15, check=True)
        return json.loads(result.stdout)

    def router(self, op, job):
        if job["mapping"] != self.mapping:
            raise ValueError("Job does not match the pinned, trusted fixture mapping")
        action_id = job.get("restore_of") or job["id"]
        UUID(action_id)
        return self.ssh("router", {**self.mapping, "op": op, "action_id": action_id,
                                  "ttl": max(1, min(900, int((job.get("expires_at") or time.time()+900)-time.time())))})

    def save(self):
        self.journal_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.journal_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.journal))
        os.replace(temporary, self.journal_path)

    def report(self, job, result):
        self.journal[job["id"]] = {"job": job, "result": result, "reported": False}
        self.save()
        self.api(f"/jobs/{job['id']}/results", result)
        self.journal[job["id"]]["reported"] = True
        self.save()

    def execute(self, job):
        # Journal before mutation; a crash on either side of SSH never extends the router's timeout.
        self.journal[job["id"]] = {"job": job, "result": None, "reported": False}
        self.save()
        if job["execution_mode"] == "dry_run":
            before = self.router("status", job)
            response = self.router("dry_run", job)
            after = self.router("status", job)
            if before != after or response["router_state"] != "unchanged":
                raise ValueError("Dry-run changed router state")
            self.report(job, {"state": "verified", "router_state": "unchanged", "packet_verified": False,
                              "detail": "Dry-run plan verified; firewall unchanged"})
            return
        if self.config.get("dry_run", True) or not self.config.get("adapter_enabled", False):
            raise ValueError("Local agent adapter is disabled or dry-run is enabled")
        if job["action_type"] == "QUARANTINE" and job.get("expires_at", 0) <= time.time():
            self.report(job, {"state": "failed", "router_state": "unchanged", "packet_verified": False,
                              "detail": "Quarantine expired before execution"})
            return
        try:
            if job["action_type"] == "RESTORE":
                self.router("restore", job)
                packet = self.ssh("probe")
                if not packet["plug_reaches_iot"] or not packet["work_reaches_iot"]:
                    raise ValueError("Restoration packet verification failed")
                result = {"state": "verified", "router_state": "restored", "packet_verified": True,
                          "detail": "Plug and unaffected work endpoint reach the IoT HTTP fixture"}
            elif job["action_type"] == "QUARANTINE":
                status = self.router("status", job)
                if status["router_state"] != "blocked":
                    before = self.ssh("probe")
                    if not before["plug_reaches_iot"] or not before["work_reaches_iot"]:
                        raise ValueError("Baseline packet fixture failed")
                applied = self.router("quarantine", job)
                if applied["router_state"] != "blocked":
                    raise ValueError("Router did not apply quarantine")
                self.api(f"/jobs/{job['id']}/results", {"state": "applied", "router_state": "blocked", "packet_verified": False, "detail": "Rule applied; verifying packets"})
                packet = self.ssh("probe")
                if packet["plug_reaches_iot"] or not packet["work_reaches_iot"]:
                    raise ValueError("Blocking or unaffected-work verification failed")
                result = {"state": "verified", "router_state": "blocked", "packet_verified": True,
                          "detail": "Plug cannot reach IoT endpoint; unaffected work endpoint still reaches it"}
            else:
                raise ValueError("Unsupported gateway action")
        except Exception:
            restored = False
            try:
                self.router("restore", job)
                packet = self.ssh("probe")
                restored = packet["plug_reaches_iot"] and packet["work_reaches_iot"]
            finally:
                self.report(job, {"state": "rolled_back" if restored else "failed", "router_state": "restored" if restored else "unknown",
                                  "packet_verified": restored, "detail": "Verification failed; restoration attempted. Router timeout remains the offline fallback."})
            return
        self.report(job, result)

    def cycle(self):
        self.api('/heartbeat', {})
        for item in list(self.journal.values()):
            if item["result"] and not item["reported"]:
                self.report(item["job"], item["result"])
            # Router timeouts independently remove blocking, even during API/agent failure.
            job = item["job"]
            if job["execution_mode"] == "openwrt" and job["action_type"] == "QUARANTINE" and job.get("expires_at", 0) <= time.time() and (item.get("result") or {}).get("state") == "verified":
                self.router("restore", job)
                packet = self.ssh("probe")
                self.report(job, {"state": "rolled_back", "router_state": "restored", "packet_verified": bool(packet["plug_reaches_iot"] and packet["work_reaches_iot"]), "detail": "Expired quarantine restored"})
        for job in self.api('/jobs'):
            existing = self.journal.get(job["id"])
            if existing and existing["result"]:
                self.report(job, existing["result"])
            else:
                self.execute(job)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    agent = Agent(json.loads(Path(args.config).read_text()))
    while True:
        try:
            agent.cycle()
        except Exception as exc:
            # Never print tokens, API error bodies, SSH stderr, or environment values.
            print(f"Gateway cycle failed: {type(exc).__name__}; router timeouts remain active", flush=True)
        if args.once:
            break
        time.sleep(2)


if __name__ == '__main__':
    main()
