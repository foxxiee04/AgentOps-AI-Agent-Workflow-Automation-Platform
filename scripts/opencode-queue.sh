#!/usr/bin/env bash
# Runs opencode briefs one by one from a queue folder, independent of the Claude session
# (so implementation keeps going while Claude is rate-limited). Claude enqueues briefs and verifies results.
#
#   queue/NNN-name.md     -> waiting (processed in name order)
#   queue/running/        -> the brief currently in opencode
#   queue/done/           -> finished briefs + NNN-name.md.result (run.sh output: exit code, log path, tail)
#   queue/STOP            -> create this file to stop the runner after the current brief
#
# Usage: bash scripts/opencode-queue.sh [queue-dir]   (default: .opencode-queue in the repo root)
set -u
cd "$(dirname "$0")/.." || exit 1
QUEUE="${1:-.opencode-queue}"
MODEL="${OPENCODE_MODEL:-opencode/deepseek-v4.1-flash-free}"
TIMEOUT="${OPENCODE_TIMEOUT:-840}"
mkdir -p "$QUEUE/running" "$QUEUE/done"
echo "[queue] watching $QUEUE (model $MODEL, timeout ${TIMEOUT}s)"

while [ ! -f "$QUEUE/STOP" ]; do
  next=$(ls "$QUEUE"/*.md 2>/dev/null | sort | head -n 1)
  if [ -z "$next" ]; then
    sleep 60
    continue
  fi
  name=$(basename "$next")
  mv "$next" "$QUEUE/running/$name"
  echo "[queue] $(date '+%H:%M:%S') start $name"
  OPENCODE_MODEL="$MODEL" OPENCODE_TIMEOUT="$TIMEOUT" \
    bash "$HOME/.claude/skills/delegate-opencode/run.sh" "$QUEUE/running/$name" > "$QUEUE/done/$name.result" 2>&1
  status=$?
  mv "$QUEUE/running/$name" "$QUEUE/done/$name"
  echo "[queue] $(date '+%H:%M:%S') end $name (exit $status)"
done
echo "[queue] STOP file found, exiting"
