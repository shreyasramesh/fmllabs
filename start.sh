#!/bin/bash
set -e

if [ -f .env.local ]; then
  echo "Sourcing .env.local..."
  set -a
  source .env.local
  set +a
fi

echo "Checking port 3000..."
PID=$(lsof -ti :3000 2>/dev/null || true)

if [ -n "$PID" ]; then
  echo "Killing process $PID on port 3000..."
  kill $PID
  sleep 1
  echo "Port 3000 is now free."
else
  echo "Port 3000 is free."
fi

echo "Starting dev server..."
npm run dev
