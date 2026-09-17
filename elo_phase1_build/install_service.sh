#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="${SUDO_USER:-$USER}"
SERVICE=/etc/systemd/system/elo-follow.service
sudo tee "$SERVICE" >/dev/null <<UNIT
[Unit]
Description=ELO Phase 1 Human Following + Obstacle Avoidance
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$ROOT
Environment=PYTHONUNBUFFERED=1
ExecStart=$ROOT/.venv/bin/python -m elo_follow.main
Restart=on-failure
RestartSec=2
Nice=-2

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable elo-follow.service
sudo systemctl restart elo-follow.service
sudo systemctl --no-pager --full status elo-follow.service || true
