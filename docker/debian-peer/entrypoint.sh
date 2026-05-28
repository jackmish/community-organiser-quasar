#!/bin/bash
set -euo pipefail

python3 /opt/co21-peer/health-server.py &
echo "co21 debian-peer ready (health on :9080, distro: ${CO21_DISTRO:-debian})"
exec tail -f /dev/null
