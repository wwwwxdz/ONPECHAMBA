#!/bin/bash
set -e

mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

echo "[DockerEntrypoint] Iniciando servidor grafico virtual Xvfb..."
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

sleep 1

echo "[DockerEntrypoint] Iniciando aplicacion Node.js..."
exec node dist/index.js
