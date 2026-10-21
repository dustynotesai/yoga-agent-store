// Publish the same tested static artifact without requiring Actions workflow access.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../src/paths.js';

const run = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
const remote = run(['remote', 'get-url', 'origin']);
const identity = { name: run(['config', 'user.name']), email: run(['config', 'user.email']) };
execFileSync(process.execPath, ['--test'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
execFileSync(process.execPath, ['scripts/build-pages.js'], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'yoga-pages-publish-'));
try {
  run(['init', '-b', 'gh-pages'], temporary);
  run(['remote', 'add', 'origin', remote], temporary);
  run(['config', 'user.name', identity.name], temporary);
  run(['config', 'user.email', identity.email], temporary);
  // Use the active GitHub CLI account, leaving global Git credential settings alone.
  run(['config', 'credential.helper', ''], temporary);
  run(['config', '--add', 'credential.helper', '!gh auth git-credential'], temporary);
  if (run(['ls-remote', '--heads', 'origin', 'gh-pages'], temporary)) {
    run(['fetch', '--depth', '1', 'origin', 'gh-pages'], temporary);
    run(['reset', '--hard', 'FETCH_HEAD'], temporary);
    run(['rm', '-r', '--ignore-unmatch', '.'], temporary);
  }
  fs.cpSync(path.join(ROOT, 'dist'), temporary, { recursive: true });
  run(['add', '.'], temporary);
  if (run(['status', '--porcelain'], temporary)) {
    run(['commit', '-m', 'Publish Mountain Flow browser demo'], temporary);
    run(['push', 'origin', 'HEAD:gh-pages'], temporary);
  }
  console.log('Browser demo published to gh-pages. Enable this branch in repository Settings > Pages.');
} finally {
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('yoga-pages-publish-')) throw new Error('Invalid temporary path');
  fs.rmSync(temporary, { recursive: true, force: true });
}
