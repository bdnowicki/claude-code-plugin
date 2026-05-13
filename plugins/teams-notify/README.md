# teams-notify

Send a Microsoft Teams notification whenever Claude Code is waiting on you.

Hook events covered:

- `AskUserQuestion` — Claude Code asks you a structured question
- `permission_prompt` — a tool requests permission to run
- `Stop` — the turn finishes and Claude returns control
- `idle_prompt` *(optional)* — long idle periods waiting for input

## Quick start

```bash
/plugin install teams-notify@bn-claude-tools
/teams-notify:setup-teams-notify
```

The setup skill walks you through it interactively. You will need a **Power Automate Workflow URL** from Microsoft Teams — see the tutorial below.

## Why Power Automate Workflows, not classic Incoming Webhooks

Microsoft is **retiring Office 365 Connectors (the old "Incoming Webhook") on May 18, 2026**. Anything created against the old connector will stop delivering messages on that date. The replacement is the **Workflows** app inside Teams, which is just Power Automate under the hood. This plugin only supports Workflows-style webhook URLs.

## Generating your webhook URL

### Step by step

1. **Open Microsoft Teams** (desktop or web client).

2. **Left rail → Apps → search "Workflows"** → click **Add**.
   This is Microsoft's official Power Automate client embedded in Teams.

3. **Open Workflows → Create tab** → search `webhook`.
   Pick the template:
   > **Post to a channel when a webhook request is received**

   *(There is a sibling template "Post to a chat when a webhook request is received" for DMs. For channel notifications, pick the **channel** variant.)*

4. **Sign in** if prompted. Both `Microsoft Teams` and `Connections` should show green checks.

5. **Pick a Team and a Channel** where notifications should land.

   > **Private channels are not supported by Workflows.** Use a standard or shared channel.

6. Click **Create flow**.

7. The next screen shows a long **URL** that looks roughly like:

   ```
   https://prod-XX.westeurope.logic.azure.com/workflows/<guid>/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=<long-signature>
   ```

   Click **Copy** next to it.

8. Paste it when `/teams-notify:setup-teams-notify` asks for the webhook URL.

### Sanity check the URL before configuring the plugin

You can confirm the URL works with a one-liner.

**PowerShell:**
```powershell
Invoke-RestMethod -Method Post `
  -Uri 'PASTE_URL_HERE' `
  -ContentType 'application/json' `
  -Body '{"text":"Test from PowerShell"}'
```

**bash / zsh:**
```bash
curl -X POST 'PASTE_URL_HERE' \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from curl"}'
```

If the chosen channel receives a message from the **Flow** bot, the URL is good.

## Security notes

- The URL contains a `sig=...` query-string signature. **Treat it like a password.** Anyone with the URL can post messages to your channel.
- The plugin stores the URL in `~/.claude/teams-notify.json`, **outside the repo**. Never commit it.
- The publishing actor is the built-in **Flow** bot. The Workflows variant does not let you customize the bot name or avatar — this is a Microsoft platform limitation, not a plugin limitation.

## Limits and quotas

- **Power Automate free plan**: ~2,000 runs/day. In practice unreachable for Claude Code notifications.
- **Tenant policy**: if you cannot see the Workflows app in Teams, your admin has disabled it. Ask them to enable "Power Automate" / "Workflows".

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `403 Unauthorized` | Workflow disabled, or the `sig=` part of the URL got truncated when copied | Open [make.powerautomate.com](https://make.powerautomate.com) → My flows → re-copy the URL. |
| `404 Not Found` | The flow was deleted | Recreate the flow from the template and copy the new URL. |
| HTTP 200 but no message in Teams | Flow ran but failed downstream (channel deleted, bot blocked, etc.) | In Power Automate, open the flow → **Run history** tab → inspect the failed run. |
| Plugin installed but no notifications appear | Hook not wired in `~/.claude/settings.json`, or config file missing | Run `/teams-notify:setup-teams-notify` to (re)wire. Run `/teams-notify:test-teams-notify ask` to verify. |
| Test notification arrives, real sessions don't | Claude Code session predates the hook install | Restart Claude Code so new hooks load. |

## Plugin internals

- `scripts/notify.cjs` — hook entry. Reads stdin, classifies the event, posts to Teams via `fetch` with `AbortController` (default timeout 1500 ms). Any failure logs and `exit 0` — the plugin never blocks Claude Code.
- `scripts/config-helper.cjs` — config loader, defaults, throttle bookkeeping.
- `scripts/test-notify.cjs` — CLI smoke test. `node test-notify.cjs --event=ask|perm|stop|idle`.
- `config/config.example.json` — full schema with inline `_comment` documentation.
- `skills/setup-teams-notify` — interactive installer with the 5-step Workflow tutorial baked in.
- `skills/test-teams-notify` — wraps the smoke test for non-CLI usage.
- `skills/uninstall-teams-notify` — removes hooks from `~/.claude/settings.json` and optionally purges the config file.

## License

MIT. Part of the [bn-claude-tools](../../README.md) marketplace.
