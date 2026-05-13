---
name: uninstall-teams-notify
description: Remove teams-notify hooks from settings.json and optionally delete the config file
argument-hint: "[keep-config|purge]"
user-invocable: true
allowed-tools: ["Read", "Write", "Edit", "Bash", "AskUserQuestion"]
---

# Uninstall Teams Notify

You are removing the `teams-notify` plugin's hooks from the user's Claude Code settings, and optionally deleting its config and log files. Be careful — `~/.claude/settings.json` is shared by every plugin, so you must touch only entries that belong to `teams-notify`.

## Arguments

| Argument      | Behavior                                                                                  |
|---------------|-------------------------------------------------------------------------------------------|
| _(none)_      | Same as `keep-config`. Hooks removed; ask before deleting the config + log files.         |
| `keep-config` | Hooks removed; ask before deleting the config + log files.                                |
| `purge`       | Hooks removed; delete the config + log files immediately without asking.                  |

Any other argument: tell the user the allowed values and stop.

## Steps

### 1. Read settings.json

Read `~/.claude/settings.json` with the `Read` tool.

- If the file does not exist, tell the user there is nothing to uninstall and skip to step 4 (config cleanup) anyway — the config file may still be present.
- If the file exists but is not valid JSON, stop and tell the user to fix the JSON manually; do not attempt to rewrite a broken file.

### 2. Identify teams-notify hook entries

Within the parsed settings object, look at each of these top-level hook keys: `PreToolUse`, `Notification`, `Stop`.

Each is an array of matcher blocks shaped roughly like:

```json
{
  "matcher": "...",
  "hooks": [
    { "type": "command", "command": "node \"...\\teams-notify\\scripts\\notify.cjs\" ..." }
  ]
}
```

A hook entry belongs to `teams-notify` if its `command` string contains either of these substrings:

- `teams-notify/scripts/notify.cjs`
- `teams-notify\scripts\notify.cjs`

(Check both — POSIX-style and Windows-style separators may appear in the same file.)

Do **not** match on plugin name alone; the substring must include the path to `notify.cjs` so that hooks from unrelated plugins are never touched.

### 3. Prune the structure

For each top-level event key (`PreToolUse`, `Notification`, `Stop`) present in settings:

1. For every matcher block in the array, filter `hooks[]` to drop entries matching the substrings from step 2.
2. If a matcher block's `hooks` array becomes empty, drop that matcher block.
3. If the top-level event array becomes empty, delete that top-level key entirely.

Count the number of hook entries you removed across all events — you will report this in step 5. Preserve everything else in `settings.json` (other keys, key order where possible, other plugins' hooks).

Write the updated JSON back to `~/.claude/settings.json` using `Write` (pretty-printed, 2-space indent, trailing newline). If nothing changed, skip the write.

### 4. Handle the config + log files

Two files may exist:

- `~/.claude/teams-notify.json` — webhook URL and event toggles (user data).
- `~/.claude/teams-notify.log` — debug log.

Decide based on the argument:

- **`purge`** — delete both files without prompting. If either is already absent, that is fine — the deletion command is wrapped in a try/catch so missing files do not fail the uninstall.
- **`keep-config` or no argument** — use the `AskUserQuestion` tool to ask:

  > Also delete the teams-notify config file (contains your webhook URL) and log file?

  Offer Yes / No. On **Yes**, delete both files (same tolerance for already-absent files). On **No**, leave both files alone and mention their paths in the final report so the user can remove them later.

#### How to delete the files

Use the `Bash` tool to invoke Node's `fs.unlinkSync` — this works identically on Windows, macOS, and Linux without branching on `rm` vs `del`. Append `|| true` to each command so a missing file never fails the uninstall at the shell level. (The log-file variant also pre-checks with `fs.existsSync` for belt-and-braces.)

Delete the config file:

```
node -e "require('fs').unlinkSync(require('os').homedir() + '/.claude/teams-notify.json')" || true
```

Delete the log file (skip-if-missing via `existsSync`):

```
node -e "const fs=require('fs'), os=require('os'); const p=os.homedir()+'/.claude/teams-notify.log'; if(fs.existsSync(p)) fs.unlinkSync(p)" || true
```

Run them as two separate `Bash` calls so an unexpected failure on the config file does not skip the log file. After each call, check the exit code: 0 is success, and `|| true` ensures ENOENT-style "file already absent" outcomes also report 0. Capture stdout/stderr for the final report so you can tell the user whether each file was deleted or was already absent.

### 5. Final confirmation

Report to the user:

> Removed teams-notify hooks from N location(s). Restart Claude Code for the change to take full effect.

Replace `N` with the count from step 3. If you also touched the config / log files (deleted, already-absent, or skipped at user's request), mention each by absolute path and its current state. If nothing was removed at all (no settings file, no matching hooks, no config files), say so plainly — do not pretend work was done.

## Safety rules

- Never delete or rewrite hooks whose `command` does not match the substrings in step 2.
- Never delete `~/.claude/settings.json` itself.
- Never delete `~/.claude/teams-notify.json` unless `purge` was passed or the user explicitly answered Yes.
- If `settings.json` parsing fails, stop and surface the error — do not guess the structure.
