# Time Tracking for Claude Code Sessions

## How It Works

This setup helps Claude track actual elapsed time during work sessions by logging timestamps with each commit.

## Manual Usage (Current Setup)

After each commit, run:
```bash
./.claude/hooks/commit-timestamp.sh
```

This will:
- Log the timestamp and commit message to `.claude/time-log.txt`
- Calculate time since the last commit
- Display elapsed time

## Automatic Git Hook (Optional)

To automatically track time with every commit, create a post-commit hook:

```bash
# Create the hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
if [ -f .claude/hooks/commit-timestamp.sh ]; then
    ./.claude/hooks/commit-timestamp.sh
fi
EOF

# Make it executable
chmod +x .git/hooks/post-commit
```

## For Claude to Check Time

At any point during a session, Claude can:

```bash
# View the current session log
cat .claude/time-log.txt | tail -20

# Calculate total session time
head -1 .claude/time-log.txt | grep -oP '\[\K[^\]]+' # Get start time
tail -1 .claude/time-log.txt | grep -oP '\[\K[^\]]+' # Get current time
```

## Integration with CLAUDE.md

Add this reminder to the project's CLAUDE.md:

```markdown
## Time Tracking

- Check `.claude/time-log.txt` to see actual elapsed time
- Run `./.claude/hooks/commit-timestamp.sh` after commits to log timestamps
- Use `tail .claude/time-log.txt` to verify recent activity timing
```

## Example Session Log

```
[2025-09-30 19:00:00] Started work on test fixes
  ⏱️  Session started

[2025-09-30 19:05:00] Fixed BackupRestore type errors
  ⏱️  Time since last commit: 5 minutes

[2025-09-30 19:12:00] Fixed all test failures
  ⏱️  Time since last commit: 7 minutes

# Total session time: 12 minutes
```
