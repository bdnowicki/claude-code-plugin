// teams-notify config helper
// Loads ~/.claude/teams-notify.json, applies defaults, exposes log + throttle utilities.
// No external dependencies. Never throws — callers receive null / errors and exit silently.

const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configFile = path.join(homeDir, '.claude', 'teams-notify.json');
const throttleFile = path.join(homeDir, '.claude', 'cache', 'teams-notify-throttle.json');

const defaults = {
  webhookUrl: '',
  enabled: true,
  events: {
    askUserQuestion: true,
    permissionPrompt: true,
    idlePrompt: false,
    stop: true
  },
  messagePrefix: 'Claude Code',
  projectLabel: null,
  messageDetail: 'full',
  includeOptions: true,
  maxBodyChars: 1500,
  timeoutMs: 1500,
  logFile: '~/.claude/teams-notify.log',
  throttleMs: 0
};

function expandHome(p) {
  if (typeof p !== 'string' || p.length === 0) return p;
  if (p === '~') return homeDir;
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(homeDir, p.slice(2));
  }
  return p;
}

function mergeDefaults(user) {
  const merged = { ...defaults, ...user };
  merged.events = { ...defaults.events, ...(user && user.events ? user.events : {}) };
  return merged;
}

function loadConfig() {
  const errors = [];

  if (!fs.existsSync(configFile)) {
    return { config: null, errors };
  }

  let raw;
  try {
    raw = fs.readFileSync(configFile, 'utf8');
  } catch (e) {
    errors.push('read failed: ' + (e && e.message ? e.message : String(e)));
    return { config: null, errors };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    errors.push('parse failed: ' + (e && e.message ? e.message : String(e)));
    return { config: null, errors };
  }

  if (!parsed || typeof parsed !== 'object') {
    errors.push('config root is not an object');
    return { config: null, errors };
  }

  const config = mergeDefaults(parsed);

  if (typeof config.webhookUrl !== 'string' || config.webhookUrl.trim().length === 0) {
    errors.push('webhookUrl missing or empty');
    return { config: null, errors };
  }

  if (typeof config.logFile === 'string' && config.logFile.length > 0) {
    config.logFile = expandHome(config.logFile);
  }

  return { config, errors };
}

function getLogFile(config) {
  if (!config || typeof config.logFile !== 'string' || config.logFile.length === 0) return null;
  return config.logFile;
}

function appendLog(config, line) {
  const file = getLogFile(config);
  if (!file) return;
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString();
    fs.appendFileSync(file, `[${stamp}] ${line}\n`);
  } catch (e) {
    // best-effort logging — swallow
  }
}

function readThrottleStore() {
  try {
    if (!fs.existsSync(throttleFile)) return {};
    const raw = fs.readFileSync(throttleFile, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') return data;
    return {};
  } catch (e) {
    return {};
  }
}

function writeThrottleStore(store) {
  try {
    const dir = path.dirname(throttleFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(throttleFile, JSON.stringify(store));
  } catch (e) {
    // swallow
  }
}

function checkThrottle(sessionId, throttleMs) {
  if (!throttleMs || throttleMs <= 0) return true;
  const key = sessionId || 'default';
  const store = readThrottleStore();
  const now = Date.now();
  const last = typeof store[key] === 'number' ? store[key] : 0;
  if (now - last < throttleMs) return false;
  store[key] = now;
  writeThrottleStore(store);
  return true;
}

module.exports = {
  defaults,
  loadConfig,
  getLogFile,
  appendLog,
  checkThrottle,
  configFile,
  throttleFile
};
