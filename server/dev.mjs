import { spawn } from 'node:child_process';

const childProcesses = [];
let shuttingDown = false;

function terminate(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of childProcesses) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 250);
}

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  childProcesses.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`[${name}] exited from signal ${signal}`);
      terminate(1);
      return;
    }

    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      terminate(code ?? 1);
    }
  });
}

const nodeBin = process.execPath;
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

run('ws', nodeBin, ['server/ws-lobby-server.mjs']);
run('vite', npxBin, ['vite', '--host', '0.0.0.0']);

process.on('SIGINT', () => terminate(0));
process.on('SIGTERM', () => terminate(0));
