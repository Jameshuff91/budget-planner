#!/bin/bash
# Time tracking hook for Claude Code sessions
# Logs timestamps for each commit to help track actual time spent

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE=".claude/time-log.txt"

# Create log file if it doesn't exist
mkdir -p .claude
touch "$LOG_FILE"

# Get the last commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "Initial commit")

# Log the timestamp
echo "[$TIMESTAMP] $COMMIT_MSG" >> "$LOG_FILE"

# Calculate time since last commit if log exists
if [ -f "$LOG_FILE" ]; then
    LAST_LINE=$(tail -n 2 "$LOG_FILE" | head -n 1)
    if [ ! -z "$LAST_LINE" ]; then
        LAST_TIME=$(echo "$LAST_LINE" | grep -oP '\[\K[^\]]+')
        if [ ! -z "$LAST_TIME" ]; then
            LAST_EPOCH=$(date -d "$LAST_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$LAST_TIME" +%s 2>/dev/null)
            CURRENT_EPOCH=$(date +%s)
            DIFF=$((CURRENT_EPOCH - LAST_EPOCH))
            MINUTES=$((DIFF / 60))
            echo "  ⏱️  Time since last commit: ${MINUTES} minutes" >> "$LOG_FILE"
        fi
    fi
fi

echo ""
echo "⏱️  Timestamp logged: $TIMESTAMP"
echo "📝 Check .claude/time-log.txt for session history"
