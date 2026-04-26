/**
 * Vercel CLI Deployment Script (Cross-Platform)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';

const ALLOWED_COMMANDS = new Set(['vercel', 'npm', 'pnpm', 'yarn']);

function log(msg) {
  console.error(msg);
}

function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) throw new Error(`Command not in whitelist: ${cmd}`);
  try {
    if (isWindows) {
      const result = spawnSync('where', [cmd], { stdio: 'ignore' });
      return result.status === 0;
    } else {
      const result = spawnSync('sh', ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' });
      return result.status === 0;
    }
  } catch { return false; }
}

function getCommandOutput(cmd, args) {
  try {
    const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows });
    return result.status === 0 ? (result.stdout || '').trim() : null;
  } catch { return null; }
}

function checkVercelInstalled() {
  if (!commandExists('vercel')) {
    log('Error: Vercel CLI is not installed');
    process.exit(1);
  }
  log(`Vercel CLI version: ${getCommandOutput('vercel', ['--version']) || 'unknown'}`);
}

function checkLoginStatus() {
  try {
    const result = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    const output = (result.stdout || '').trim();
    if (result.status === 0 && output && !output.includes('Error')) {
      log(`Logged in as: ${output}`);
      return true;
    }
  } catch {}
  return false;
}

function detectPackageManager(projectPath) {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
  if (commandExists('pnpm')) return 'pnpm';
  if (commandExists('yarn')) return 'yarn';
  if (commandExists('npm')) return 'npm';
  return null;
}

function doDeploy(projectPath, options) {
  log('');
  log('Starting deployment...');
  const cmdParts = ['vercel'];
  if (options.yes) cmdParts.push('--yes');
  if (options.prod) cmdParts.push('--prod');

  try {
    const result = spawnSync('vercel', cmdParts.slice(1), {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 300000,
      shell: isWindows
    });
    const output = (result.stdout || '') + (result.stderr || '');
    log(output);

    const aliasedMatch = output.match(/Aliased:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const deploymentMatch = output.match(/Production:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const finalUrl = aliasedMatch ? aliasedMatch[1] : (deploymentMatch ? deploymentMatch[1] : null);

    log('');
    if (finalUrl) {
      log(`Deployment successful! URL: ${finalUrl}`);
      console.log(JSON.stringify({ status: 'success', url: finalUrl }));
    } else {
      console.log(JSON.stringify({ status: 'success', output }));
    }
  } catch (error) {
    log('Deployment failed');
    process.exit(1);
  }
}

function main() {
  log('========================================');
  log('Vercel CLI Deployment');
  log('========================================');

  checkVercelInstalled();
  if (!checkLoginStatus()) {
    log('Error: Not logged in');
    process.exit(1);
  }

  const projectPath = path.resolve('web-prototype');
  doDeploy(projectPath, { yes: true, prod: true });
}

main();
