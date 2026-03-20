#!/usr/bin/env node
// Claude Code Statusline
// Shows: model | current task | directory:branch | context | 5h rate limit | 7d rate limit

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const homeDir = os.homedir();
const cacheFile = path.join(homeDir, '.claude', 'cache', 'usage-ratelimit.json');

// Background: fetch rate limit data from API and cache it (fallback when rate_limits not in stdin)
function refreshUsageCache() {
  const cacheDir = path.join(homeDir, '.claude', 'cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const child = spawn(process.execPath, ['-e', `
    const fs = require('fs');
    const path = require('path');
    const cacheFile = ${JSON.stringify(cacheFile)};
    const credsFile = path.join(${JSON.stringify(homeDir)}, '.claude', '.credentials.json');

    try {
      const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
      const token = creds.claudeAiOauth?.accessToken;
      if (!token) process.exit(0);

      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'oauth-2025-04-20',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'quota' }]
        })
      }).then(async r => {
        if (r.status !== 200) return;
        const result = {};
        for (const [k, v] of r.headers.entries()) {
          if (k.startsWith('anthropic-ratelimit-unified-')) {
            result[k.replace('anthropic-ratelimit-unified-', '')] = v;
          }
        }
        result.fetched_at = Date.now();
        fs.writeFileSync(cacheFile, JSON.stringify(result));
      }).catch(() => {});
    } catch (e) {}
  `], { stdio: 'ignore', windowsHide: true, detached: true });
  child.unref();
}

// Read cached usage data
function readUsageCache() {
  try {
    if (!fs.existsSync(cacheFile)) return null;
    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return data;
  } catch (e) { return null; }
}

// Format a reset timestamp as a short local time string (e.g. "3:45pm")
function formatResetTime(resetsAt) {
  if (!resetsAt || resetsAt <= 0) return '';
  const d = new Date(resetsAt * 1000);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m > 0
    ? `${h12}:${String(m).padStart(2, '0')}${ampm}`
    : `${h12}${ampm}`;
}

// Format a reset timestamp with date for 7d window (e.g. "Sat 26.03 3:45pm")
function formatResetDate(resetsAt) {
  if (!resetsAt || resetsAt <= 0) return '';
  const d = new Date(resetsAt * 1000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  const time = m > 0
    ? `${h12}:${String(m).padStart(2, '0')}${ampm}`
    : `${h12}${ampm}`;
  return `${day} ${dd}.${mm} ${time}`;
}

// Build a coloured bar segment for a given percentage + reset time
function buildRateBar(pct, resetsAt) {
  const filled = Math.floor(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  let color;
  if (pct < 50)      color = '\x1b[32m';       // green
  else if (pct < 75) color = '\x1b[33m';       // yellow
  else if (pct < 90) color = '\x1b[38;5;208m'; // orange
  else               color = '\x1b[31m';       // red

  const resetStr = resetsAt ? ` ↻ ${formatResetTime(resetsAt)}` : '';
  return `${color}${bar} ${pct}%${resetStr}\x1b[0m`;
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context window bar
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      if (used < 63)       ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      else if (used < 81)  ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      else if (used < 95)  ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      else                 ctx = ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
    }

    // Rate limit display — prefer data.rate_limits (native Claude Code field),
    // fall back to the self-fetched API cache for backwards compatibility.
    let usageLabel = '';
    const rateLimits = data.rate_limits;

    if (rateLimits) {
      // Native rate_limits field available — use it directly
      const parts = [];

      if (rateLimits.five_hour != null) {
        const pct = Math.round(rateLimits.five_hour.used_percentage);
        const resetsAt = rateLimits.five_hour.resets_at || 0;
        parts.push(`5h: ${buildRateBar(pct, resetsAt)}`);
      }

      if (rateLimits.seven_day != null) {
        const pct = Math.round(rateLimits.seven_day.used_percentage);
        const resetsAt = rateLimits.seven_day.resets_at || 0;
        const resetStr = resetsAt > 0 ? ` ↻ ${formatResetDate(resetsAt)}` : '';
        const filled = Math.floor(pct / 10);
        const bar7 = '█'.repeat(filled) + '░'.repeat(10 - filled);
        let color7;
        if (pct < 50)      color7 = '\x1b[32m';
        else if (pct < 75) color7 = '\x1b[33m';
        else if (pct < 90) color7 = '\x1b[38;5;208m';
        else               color7 = '\x1b[31m';
        parts.push(`7d: ${color7}${bar7} ${pct}%${resetStr}\x1b[0m`);
      }

      if (parts.length > 0) {
        usageLabel = ' │ ' + parts.join(' │ ');
      }
    } else {
      // Fallback: use locally cached API data (pre-native-field sessions)
      const usage = readUsageCache();
      if (usage) {
        const utilization = parseFloat(usage['5h-utilization'] || '0');
        const resetTs = parseInt(usage['5h-reset'] || '0', 10);
        const pct = Math.round(utilization * 100);
        usageLabel = ` │ 5h: ${buildRateBar(pct, resetTs)}`;

        // Refresh cache if stale (older than 2 minutes)
        const age = Date.now() - (usage.fetched_at || 0);
        if (age > 120000) refreshUsageCache();
      } else {
        // No cache yet — kick off first fetch
        refreshUsageCache();
      }
    }

    // Current task from todos
    let task = '';
    const todosDir = path.join(homeDir, '.claude', 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          try {
            const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
            const inProgress = todos.find(t => t.status === 'in_progress');
            if (inProgress) task = inProgress.activeForm || '';
          } catch (e) {}
        }
      } catch (e) {}
    }

    // Git branch
    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, encoding: 'utf8', timeout: 3000, windowsHide: true }).trim();
    } catch (e) {}

    // Output
    const dirname = path.basename(dir);
    const dirLabel = branch ? `${dirname}:${branch}` : dirname;
    if (task) {
      process.stdout.write(`\x1b[2m${model}\x1b[0m │ \x1b[1m${task}\x1b[0m │ \x1b[2m${dirLabel}\x1b[0m${ctx}${usageLabel}`);
    } else {
      process.stdout.write(`\x1b[2m${model}\x1b[0m │ \x1b[2m${dirLabel}\x1b[0m${ctx}${usageLabel}`);
    }
  } catch (e) {
    // Silent fail
  }
});
 