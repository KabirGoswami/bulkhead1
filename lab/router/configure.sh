#!/bin/ash
# Run only on the disposable VirtualBox router from its console/bootstrap key.
set -eu
[ "$(cat /sys/class/dmi/id/product_name)" = "VirtualBox" ] || { echo 'VirtualBox fixture required' >&2; exit 1; }
cp /etc/config/network /etc/config/network.pre-bulkhead
cat > /etc/config/network <<'NETWORK'
config interface 'loopback'
 option device 'lo'
 option proto 'static'
 option ipaddr '127.0.0.1'
 option netmask '255.0.0.0'
config interface 'management'
 option device 'eth0'
 option proto 'dhcp'
 option delegate '0'
NETWORK
index=1
for pair in main:10 iot:20 work:30 guest:40; do
    name="${pair%:*}"; subnet="${pair#*:}"
    cat >> /etc/config/network <<NETWORK
config interface '$name'
 option device 'eth$index'
 option proto 'static'
 option ipaddr '192.168.$subnet.1'
 option netmask '255.255.255.0'
 option delegate '0'
NETWORK
    index=$((index+1))
done
cat > /etc/config/firewall <<'FIREWALL'
config defaults
 option input 'REJECT'
 option output 'ACCEPT'
 option forward 'REJECT'
 option flow_offloading '0'
 option flow_offloading_hw '0'
config zone
 option name 'management'
 list network 'management'
 option input 'ACCEPT'
 option output 'ACCEPT'
 option forward 'REJECT'
config zone
 option name 'lab'
 list network 'main'
 list network 'iot'
 list network 'work'
 list network 'guest'
 option input 'REJECT'
 option output 'ACCEPT'
 option forward 'ACCEPT'
config rule
 option name 'Lab ICMP'
 option src 'lab'
 option proto 'icmp'
 option target 'ACCEPT'
FIREWALL
# No routed path from lab zones into the NAT management interface.
cat > /etc/sysctl.d/99-bulkhead.conf <<'SYSCTL'
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
net.ipv4.ip_forward=1
SYSCTL
sysctl -p /etc/sysctl.d/99-bulkhead.conf
/etc/init.d/odhcpd disable
/etc/init.d/odhcpd stop
/etc/init.d/dnsmasq disable
/etc/init.d/dnsmasq stop
uci set dropbear.@dropbear[0].PasswordAuth='off'
uci set dropbear.@dropbear[0].RootPasswordAuth='off'
uci set dropbear.@dropbear[0].Interface='management'
uci commit dropbear
/etc/init.d/network restart
/etc/init.d/firewall restart
/etc/init.d/dropbear restart
