#!/bin/sh
# Debian 13 disposable VM, management NIC enp0s3, four separate lab NICs.
set -eu
[ "$(cat /sys/class/dmi/id/product_name)" = "VirtualBox" ] || exit 1
cat > /etc/sysctl.d/99-bulkhead.conf <<'SYSCTL'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
net.ipv4.ip_forward=0
SYSCTL
sysctl --system >/dev/null
# Each isolated namespace has one physical VM NIC and one default route via OpenWrt.
for pair in plug:10 iot:20 work:30 guest:40; do
    name="${pair%:*}"; subnet="${pair#*:}"
    nic="$(for address_file in /sys/class/net/*/address; do
        if [ "$(cat "$address_file")" = "02:00:00:00:$subnet:10" ]; then
            basename "$(dirname "$address_file")"
        fi
    done)"
    [ -n "$nic" ] || { echo "Expected lab NIC for $name is missing" >&2; exit 1; }
    ip netns list | grep -q "^$name " && { echo 'Already configured; reboot before reconfiguration' >&2; exit 1; }
    ip netns add "$name"
    ip link set "$nic" netns "$name"
    ip -n "$name" link set lo up
    ip -n "$name" link set "$nic" address "02:00:00:00:$subnet:10"
    ip -n "$name" addr flush dev "$nic"
    ip -n "$name" addr add "192.168.$subnet.10/24" dev "$nic"
    ip -n "$name" link set "$nic" up
    ip -n "$name" route add default via "192.168.$subnet.1"
    ip netns exec "$name" sysctl -w net.ipv6.conf.all.disable_ipv6=1 >/dev/null
done
mkdir -p /var/lib/bulkhead-probe
printf 'bulkhead routed endpoint\n' > /var/lib/bulkhead-probe/index.html
# systemd supervises the IoT HTTP fixture across probe-helper calls.
systemd-run --unit=bulkhead-iot --property=Restart=always ip netns exec iot python3 -m http.server 8000 --bind 192.168.20.10 --directory /var/lib/bulkhead-probe
