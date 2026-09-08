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
examples/
  settings.json             # Example configuration
```

## License

[MIT](LICENSE)
