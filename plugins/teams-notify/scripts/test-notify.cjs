#!/usr/bin/env node
// teams-notify smoke test — feeds a fake hook payload to notify.cjs via stdin
// and prints its stdout/stderr. Usage: node test-notify.cjs [--event=ask|perm|stop|idle]

const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = { event: 'ask' };
  for (const a of argv.slice(2)) {
    const m = /^--event=(.+)$/.exec(a);
    if (m) args.event = m[1];
  }
  return args;
}

function buildPayload(event) {
  const cwd = process.cwd();
  const session_id = 'test-session';
  switch (event) {
    case 'ask':
      return {
        hook_event_name: 'PreToolUse',
        tool_name: 'AskUserQuestion',
        tool_input: {
          questions: [{
            question: 'Which library should we use for date formatting?',
            header: 'Library',
            options: [
              { label: 'date-fns' },
              { label: 'luxon' },
              { label: 'dayjs' }
            ],
            multiSelect: false
          }]
        },
        cwd,
        session_id
      };
    case 'perm':
      return {
        hook_event_name: 'Notification',
        notification_type: 'permission_prompt',
        message: 'Bash(npm install …)',
        cwd,
        session_id
      };
    case 'stop':
      return {
        hook_event_name: 'Stop',
        cwd,
        session_id
      };
    case 'idle':
      return {
        hook_event_name: 'Notification',
        notification_type: 'idle_prompt',
        cwd,
        session_id
      };
    default:
      throw new Error(`unknown event '${event}' (use ask|perm|stop|idle)`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  let payload;
  try {
    payload = buildPayload(args.event);
  } catch (e) {
    process.stderr.write(`test-notify: ${e.message}\n`);
    process.exit(2);
  }

  const notifyPath = path.join(__dirname, 'notify.cjs');
  const child = spawn(process.execPath, [notifyPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  child.stdout.on('data', d => process.stdout.write(d));
  child.stderr.on('data', d => process.stderr.write(d));
  child.on('error', err => {
    process.stderr.write(`test-notify: spawn failed: ${err.message}\n`);
    process.exit(1);
  });
  child.on('exit', code => {
    process.stdout.write(`\ntest-notify: event=${args.event} exit=${code}\n`);
    process.exit(code == null ? 1 : code);
  });

  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();
}

main();
