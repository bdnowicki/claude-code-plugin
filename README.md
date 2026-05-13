# bn-claude-tools

A Claude Code plugin marketplace with tools for monitoring and enhancing your Claude Code experience.

## Installation

```bash
/plugin marketplace add bdnowicki/claude-code-plugin
```

## Plugins

### statusline

Enhanced statusline for Claude Code showing:

- Model name (e.g. Claude Opus 4.6)
- Current task from todos
- Directory and git branch
- Context window usage (colored bar, scaled to 80% effective limit)
- 5-hour rate limit usage with reset time
- 7-day rate limit usage with reset date

```bash
/plugin install statusline@bn-claude-tools
/statusline:setup-statusline install
```

#### Preview

```
Claude Opus 4.6 │ repo:main █████░░░░░ 50% │ 5h: ███░░░░░░░ 28% ↻ 3:45pm │ 7d: ██░░░░░░░░ 15% ↻ Sat 26.03 3:45pm
```

Colors change based on usage: green (<50%) -> yellow (<75%) -> orange (<90%) -> red (90%+).

### teams

Coordination skill for [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams). The `init-team` skill turns the current session into a team lead that breaks a task into independent sub-tasks, spawns teammates in parallel, coordinates them, and synthesizes results.

```bash
/plugin install teams@bn-claude-tools
/teams:init-team review PR #142 for security, performance, and test coverage
```

Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and Claude Code v2.1.32+.

### teams-notify

Send a Microsoft Teams notification whenever Claude Code is waiting on you — questions from the `AskUserQuestion` tool, tool permission prompts, the `Stop` hook (turn finished), and (optionally) idle prompts. Useful when you run Claude Code in the background and want a ping in Teams the moment it needs input.

```bash
/plugin install teams-notify@bn-claude-tools
/teams-notify:setup-teams-notify
```

Requires a Power Automate Workflow URL from Microsoft Teams. See [`plugins/teams-notify/README.md`](plugins/teams-notify/README.md) for the step-by-step guide, security notes, and troubleshooting.

Supported events:

- `AskUserQuestion` — Claude Code asks you a structured question
- `permission_prompt` — a tool requests permission to run
- `Stop` — the turn finishes and Claude returns control
- `idle_prompt` *(optional)* — long idle periods waiting for input

## Project Structure

```
.claude-plugin/
  marketplace.json          # Marketplace catalog
plugins/
  statusline/
    .claude-plugin/
      plugin.json           # Plugin manifest
    scripts/
      statusline.cjs        # Statusline script
    skills/
      setup-statusline/
        SKILL.md            # Installation skill
  teams/
    .claude-plugin/
      plugin.json           # Plugin manifest
    skills/
      init-team/
        SKILL.md            # Team lead coordination skill
  teams-notify/
    .claude-plugin/
      plugin.json           # Plugin manifest
    config/
      config.example.json   # Example user config
    scripts/
      notify.cjs            # Hook entrypoint
      config-helper.cjs     # Config loader
      test-notify.cjs       # Smoke test
    skills/
      setup-teams-notify/
        SKILL.md            # Interactive installer
      test-teams-notify/
        SKILL.md            # Verify webhook config
      uninstall-teams-notify/
        SKILL.md            # Remove hook wiring
examples/
  settings.json             # Example configuration
```

## License

[MIT](LICENSE)
