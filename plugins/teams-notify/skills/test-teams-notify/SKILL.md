---
name: test-teams-notify
description: Send a test notification through teams-notify to verify the webhook configuration
argument-hint: "[ask|perm|stop|idle]"
user-invocable: true
allowed-tools: ["Bash", "Read"]
---

# Test Teams Notify

You are sending a test notification through the `teams-notify` plugin so the user can confirm their Microsoft Teams webhook is wired up correctly.

## Steps

### 1. Resolve the test script path

The test runner lives at `${CLAUDE_SKILL_DIR}/../../scripts/test-notify.cjs`. Resolve it to an absolute path before invoking — `${CLAUDE_SKILL_DIR}` is the directory of this `SKILL.md`, so the script sits two levels up under `scripts/`.

### 2. Confirm the config exists

Read `~/.claude/teams-notify.json` with the `Read` tool.

- If the file is missing or unreadable, stop immediately and tell the user:
  > teams-notify is not configured. Run `/teams-notify:setup-teams-notify` first, then re-run this skill.
- Do not proceed to step 3 in that case.

### 3. Map the argument to an `--event` flag

The user may pass one of `ask`, `perm`, `stop`, `idle`. Map it as follows (default to `ask` when no argument is supplied):

| Argument | Flag             |
|----------|------------------|
| `ask`    | `--event=ask`    |
| `perm`   | `--event=perm`   |
| `stop`   | `--event=stop`   |
| `idle`   | `--event=idle`   |

If the argument is anything else, tell the user the allowed values and stop.

### 4. Run the test script

Invoke via `Bash`:

```
node "<absolute-path-to-test-notify.cjs>" <flag>
```

Quote the script path (it may contain spaces on Windows). Capture both stdout and stderr.

### 5. Report the result

Show the script's output verbatim to the user (in a fenced code block), then add:

> Check Microsoft Teams for the test message.

### 6. On failure, tail the log

If the script's output indicates an HTTP error (non-2xx status, "fetch failed", "timeout", "ECONNRESET", "ENOTFOUND", etc.) or the process exited non-zero, also read the last 20 lines of `~/.claude/teams-notify.log` and show them to the user under a heading like `Recent log entries:`. If the log file does not exist, mention that as well.

## Notes

- This skill is read-only — it does not modify `settings.json` or any config file.
- Do not retry automatically on failure; surface the error so the user can fix the webhook URL or proxy.
