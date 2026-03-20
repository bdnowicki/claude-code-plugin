---
name: setup-statusline
description: Install and configure the enhanced Claude Code statusline with rate limit monitoring
argument-hint: "[install|uninstall|status]"
user-invocable: true
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob"]
---

# Setup Enhanced Statusline

You are helping the user install or configure the enhanced Claude Code statusline plugin.

## What this statusline shows

- Model name (e.g. Claude Opus 4.6)
- Current task from todos (if any)
- Directory name and git branch
- Context window usage (colored bar, scaled to 80% effective limit)
- 5-hour rate limit usage with reset time
- 7-day rate limit usage with reset date

## Actions

Based on the user's argument:

### install (default)

1. Find the statusline script path. It is located at: `${CLAUDE_SKILL_DIR}/../scripts/statusline.cjs`
2. Read the user's current `~/.claude/settings.json`
3. Add or update the `statusLine` key:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node \"<absolute-path-to-statusline.cjs>\""
     }
   }
   ```
4. Tell the user to restart Claude Code for changes to take effect.

### uninstall

1. Read the user's `~/.claude/settings.json`
2. Remove the `statusLine` key
3. Confirm removal

### status

1. Read `~/.claude/settings.json`
2. Check if the statusLine is configured and pointing to the correct script
3. Report the current configuration status
