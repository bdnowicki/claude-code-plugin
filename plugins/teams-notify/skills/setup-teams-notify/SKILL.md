---
name: setup-teams-notify
description: Install and configure the teams-notify plugin — send Microsoft Teams notifications when Claude Code needs user input
argument-hint: "[install|status|reconfigure]"
user-invocable: true
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "AskUserQuestion"]
---

# Setup Teams Notify

You are helping the user install and configure the `teams-notify` plugin. This plugin sends a message to a Microsoft Teams channel via an incoming webhook whenever Claude Code is waiting on the user (asking a question, requesting permission, or finishing a turn).

## What this plugin does

- Posts a card to a Teams channel when Claude Code awaits user input.
- Triggered via Claude Code hooks: `PreToolUse` (AskUserQuestion), `Notification` (permission_prompt, idle_prompt), and `Stop` (turn finished).
- Reads its configuration from `~/.claude/teams-notify.json` (a per-user secret file, never committed).

## Paths

Compute these once at the start of the skill and use them throughout:

- Plugin scripts live next to this skill. From `${CLAUDE_SKILL_DIR}`:
  - `notify.cjs`       → `${CLAUDE_SKILL_DIR}/../../scripts/notify.cjs`
  - `test-notify.cjs`  → `${CLAUDE_SKILL_DIR}/../../scripts/test-notify.cjs`
- Resolve both to **absolute** paths. When you embed them in JSON, use **forward slashes** (Node.js handles them on Windows and you avoid backslash escaping).
- User config:    `~/.claude/teams-notify.json`
- User settings:  `~/.claude/settings.json`
- Log file:       `~/.claude/teams-notify.log`

## Actions

Branch on the user's argument. Default is `install`.

### install (default)

#### Step 1 — Resolve script paths

Compute the absolute path to `notify.cjs` and `test-notify.cjs` as described under **Paths** above. Verify both files exist (use Glob or Read). If `notify.cjs` is missing, abort with a clear error: the plugin is not properly installed.

#### Step 2 — Check for existing configuration

Check whether `~/.claude/teams-notify.json` already exists.

If it exists, use `AskUserQuestion` to confirm intent:

```
questions:
  - question: "A teams-notify config already exists at ~/.claude/teams-notify.json. What do you want to do?"
    options:
      - label: "Reconfigure (overwrite)"
        description: "Discard the existing config and walk through setup again."
      - label: "Abort"
        description: "Leave the existing config untouched and stop the installer."
    multiSelect: false
```

On **Abort** → stop and tell the user nothing was changed.
On **Reconfigure** → continue.

If the file does not exist → continue.

#### Step 3 — Ask about the webhook URL

Use `AskUserQuestion`:

```
questions:
  - question: "Do you already have a Microsoft Teams Workflow webhook URL?"
    options:
      - label: "I have a Workflow URL ready, I'll paste it"
        description: "Skip the tutorial and go straight to pasting the URL."
      - label: "Show me how to create one in Teams"
        description: "Display step-by-step instructions for creating a Workflows webhook."
      - label: "Cancel"
        description: "Abort the installer without making any changes."
    multiSelect: false
```

On **Cancel** → stop. No files changed.
On **I have a Workflow URL ready** → skip to step 5.
On **Show me how** → go to step 4.

#### Step 4 — Show the tutorial

Print this text **verbatim** (do not rewrite or reformat):

```
1. In Microsoft Teams: Apps → search "Workflows" → add the app.
2. Open Workflows. Templates → search "webhook" → pick
   "Post to a channel when a webhook request is received".
3. Sign in if prompted. Select the target Team and Channel.
4. Click "Create flow". Copy the generated URL (long URL containing
   "logic.azure.com" and "?sig=…").
5. Come back here and paste it on the next prompt.
```

Then ask the user to paste the URL. Do **not** use `AskUserQuestion` for this — wait for the next plain user message (the pasted URL) and treat that message as the webhook URL.

#### Step 5 — Validate the webhook URL

The URL must:

- Start with `https://`, AND
- Contain either `logic.azure.com` **or** `office.com/webhook`.

If both checks pass → continue silently to step 6.

If validation fails → warn the user that the URL does not look like a Teams Workflow / Incoming Webhook URL, then `AskUserQuestion`:

```
questions:
  - question: "The URL you provided doesn't match the expected Teams webhook pattern. Proceed anyway?"
    options:
      - label: "Yes, use this URL"
        description: "I'm sure — continue with the provided URL."
      - label: "No, let me re-enter it"
        description: "Go back and paste a different URL."
      - label: "Cancel installer"
        description: "Abort without writing any config."
    multiSelect: false
```

Loop on "re-enter" by asking again. On "Cancel" → abort. On "Yes" → continue.

#### Step 6 — Ask for a project label

Use `AskUserQuestion`:

```
questions:
  - question: "How should notifications be labeled with a project name?"
    options:
      - label: "Auto-detect from current directory"
        description: "Use the cwd basename per session — recommended for multi-repo work."
      - label: "Use a fixed label"
        description: "Pick a single project label for every notification, regardless of cwd."
    multiSelect: false
```

On **Auto-detect** → set `projectLabel` to `null` in the config (the runtime will derive it per session).
On **Use a fixed label** → wait for the next plain user message and use that string as `projectLabel`.

#### Step 7 — Pick events to notify on

Use `AskUserQuestion` with `multiSelect: true`. List the three "default ON" events first so the user naturally sees them at the top, then `idle_prompt`. The user must explicitly select what they want — there is no implicit default.

```
questions:
  - question: "Which Claude Code events should trigger a Teams notification?"
    options:
      - label: "AskUserQuestion (Claude asks user a question)"
        description: "Fires when Claude uses the AskUserQuestion tool. Recommended."
      - label: "permission_prompt (Claude requests permission)"
        description: "Fires on permission prompts (tool approval). Recommended."
      - label: "Stop (Claude finished turn)"
        description: "Fires when Claude finishes responding. Recommended."
      - label: "idle_prompt (idle notifications)"
        description: "Fires on long-idle prompts. Off by default — can be chatty."
    multiSelect: true
```

Map the selected labels to config keys:

- "AskUserQuestion …"      → `askUserQuestion: true`
- "permission_prompt …"    → `permissionPrompt: true`
- "Stop …"                 → `stop: true`
- "idle_prompt …"          → `idlePrompt: true`

Anything not selected becomes `false`.

#### Step 8 — Message detail level

Use `AskUserQuestion`:

```
questions:
  - question: "How much of Claude's message should be included in the Teams card?"
    options:
      - label: "full"
        description: "Full body (up to maxBodyChars). Best context, but the message contents are sent to Teams."
      - label: "header-only"
        description: "Send only the question title or event header — no body. Privacy-friendly."
      - label: "minimal"
        description: "Send just the event type and project label. No question content at all."
    multiSelect: false
```

Store the chosen label as `messageDetail` in the config.

#### Step 9 — Write `~/.claude/teams-notify.json`

Use the `Write` tool (the file is new or being overwritten). Schema:

```json
{
  "enabled": true,
  "webhookUrl": "<URL from step 3/4/5>",
  "projectLabel": null,
  "events": {
    "askUserQuestion": true,
    "permissionPrompt": true,
    "idlePrompt": false,
    "stop": true
  },
  "messageDetail": "full",
  "timeoutMs": 1500,
  "maxBodyChars": 1500,
  "throttleMs": 0,
  "logFile": "~/.claude/teams-notify.log"
}
```

Fill in the values collected in steps 3–8. Set unselected event flags to `false`. Keep the defaults shown above for `timeoutMs`, `maxBodyChars`, `throttleMs`, `logFile`, and `enabled`.

#### Step 10 — Merge hooks into `~/.claude/settings.json`

This step **must be non-destructive**. Other plugins (e.g. `statusline`) write to the same file.

1. Read `~/.claude/settings.json`. If it does not exist, treat it as `{}`. Parse the JSON.
2. Ensure the structure exists: `settings.hooks` is an object; `settings.hooks.PreToolUse`, `settings.hooks.Notification`, and `settings.hooks.Stop` are arrays. Create only the ones you need; leave other top-level keys (e.g. `statusLine`) untouched.
3. The hook command string is exactly: `node "<absolute-path-to-notify.cjs>"` — use forward slashes inside the JSON string.
4. Build the entries you need based on the user's event selections from step 7:

   - If `askUserQuestion` is enabled → add to `PreToolUse`:
     ```json
     {
       "matcher": "AskUserQuestion",
       "hooks": [
         { "type": "command", "command": "node \"<abs-notify.cjs>\"" }
       ]
     }
     ```
   - For `Notification` events, collapse `permission_prompt` and `idle_prompt` into a **single** entry when both are enabled, using a pipe-separated matcher:
     - both enabled  → `matcher: "permission_prompt|idle_prompt"`
     - only permissionPrompt → `matcher: "permission_prompt"`
     - only idlePrompt → `matcher: "idle_prompt"`
     - neither → do not add any `Notification` entry.
     ```json
     {
       "matcher": "permission_prompt|idle_prompt",
       "hooks": [
         { "type": "command", "command": "node \"<abs-notify.cjs>\"" }
       ]
     }
     ```
   - If `stop` is enabled → add to `Stop` (no `matcher` field):
     ```json
     {
       "hooks": [
         { "type": "command", "command": "node \"<abs-notify.cjs>\"" }
       ]
     }
     ```
5. **Deduplicate.** Before appending an entry, scan the existing array for that event:
   - If an entry exists with the **same matcher** (or same lack of matcher, for `Stop`) AND any of its `hooks[].command` strings already equals the command you would add → skip; do not add a duplicate.
   - If an entry exists with the same matcher but a different command → append your hook to that entry's `hooks` array (preserve the other plugin's hook).
   - Otherwise → append a new entry to the array.
6. Write the updated JSON back with `Write` (read-modify-write, pretty-printed with 2-space indentation).

#### Step 11 — Smoke test

Run the test sender via Bash:

```
node "<absolute-path-to-test-notify.cjs>" --event=ask
```

Capture stdout and stderr. Display a brief summary (exit code + last few lines of output) to the user.

#### Step 12 — Confirm delivery

Use `AskUserQuestion`:

```
questions:
  - question: "Did a test notification appear in your Teams channel?"
    options:
      - label: "Yes"
        description: "Notification arrived — setup is complete."
      - label: "No"
        description: "Nothing showed up in Teams."
      - label: "Check log file"
        description: "Show the last 20 lines of ~/.claude/teams-notify.log so we can diagnose."
    multiSelect: false
```

- **Yes** → tell the user:
  > Setup complete. Restart Claude Code for hooks to take effect in new sessions. The current session is already configured.
- **No** → read `~/.claude/teams-notify.log` if it exists and show the last 20 lines. Suggest common fixes: wrong webhook URL (re-run `reconfigure`), network blocked by firewall, Workflow flow not yet activated in Teams, or Teams channel permissions.
- **Check log file** → same as **No**: read and display the last 20 lines of the log, then offer to re-run the smoke test.

### status

1. Check whether `~/.claude/teams-notify.json` exists.
   - If missing → report "teams-notify is not configured" and stop.
   - If present → read and pretty-print its contents, but **redact** `webhookUrl`: show only the first 40 characters followed by `…` (never the full URL, never the `?sig=` portion).
2. Read `~/.claude/settings.json` and list which teams-notify hook entries are wired up. For each of `PreToolUse`, `Notification`, `Stop`, search for entries whose `hooks[].command` contains the absolute path to `notify.cjs` and report which matchers are in place.
3. If `~/.claude/teams-notify.log` exists, report its absolute path and last-modified timestamp (use Bash `stat` or equivalent). If it does not exist, say "no log file yet — no notifications have been attempted".

### reconfigure

Run the exact same flow as **install**, but **skip step 2** (the existing-config check) — go straight from step 1 to step 3. The user has explicitly asked to reconfigure, so prompting whether to overwrite is redundant.

## Notes

- **Never commit `~/.claude/teams-notify.json`.** It contains the webhook URL, which is a bearer secret. The file lives in the user's home directory, outside this repo.
- **Hook commands must use forward slashes or escaped backslashes in JSON.** Prefer forward slashes — Node.js on Windows accepts them and you avoid `\\` escaping in JSON string literals.
- **All paths must be absolute, not relative.** Relative paths break because hooks may be invoked from any working directory.
- **Uninstall is handled by a separate skill** (`uninstall-teams-notify`). Do not duplicate that logic here — if the user asks to remove the plugin, direct them to that skill instead.
