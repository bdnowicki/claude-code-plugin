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
examples/
  settings.json             # Example configuration
```

## License

[MIT](LICENSE)
