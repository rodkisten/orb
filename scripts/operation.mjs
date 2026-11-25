import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'

const env = process.env
const branch = env.INPUT_BRANCH || 'main'
const operation = env.INPUT_OPERATION || 'install'
const packages = (env.INPUT_PACKAGES || '').trim()
const custom = (env.INPUT_CUSTOM_CMD || '').trim()
const run = (file, args, capture = false) => execFileSync(file, args, { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' })
const git = (...args) => run('git', args, true).trim()
const output = (name, value) => { if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, name + '=' + value + '\n') }
const shell = command => run('bash', ['-e', '-o', 'pipefail', '-c', command])
const manager = JSON.parse(readFileSync('package.json', 'utf8')).packageManager
if (!/^pnpm@\d+\.\d+\.\d+$/.test(manager)) throw new Error('Expected pinned pnpm packageManager')
run('npm', ['install', '--global', manager])
run('pnpm', ['--version'])
if (git('status', '--porcelain')) throw new Error('Expected clean checkout')
switch (operation) {
  case 'install': run('pnpm', ['install', '--no-frozen-lockfile']); break
  case 'update': shell('pnpm update ' + packages); break
  case 'add':
  case 'uninstall':
    if (!packages) throw new Error('Package list required')
    shell('pnpm ' + (operation === 'add' ? 'add' : 'remove') + ' ' + packages); break
  case 'custom':
    if (!custom) throw new Error('Custom command required')
    break
  default: throw new Error('Unknown operation: ' + operation)
}
if (custom) shell(custom)
output('branch', branch)
if (!git('status', '--porcelain')) {
  output('changed', 'false')
  console.log('No changes to commit')
} else {
  run('git', ['config', 'user.name', 'ploocky[bot]'])
  run('git', ['config', 'user.email', 'ploocky[bot]@users.noreply.github.com'])
  run('git', ['add', '-A'])
  run('git', ['commit', '-m', 'chore(ops): ' + operation + ' [deploy]'])
  run('git', ['push', 'origin', 'HEAD:refs/heads/' + branch])
  output('changed', 'true')
  output('commit_sha', git('rev-parse', 'HEAD'))
}
