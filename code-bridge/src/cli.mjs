#!/usr/bin/env node
import os from 'node:os'
import { exchangeGrant, loadState, openInVSCode, pullSnapshot, pushLocal, saveState, startLoopbackBridge } from './bridge.mjs'

function argumentsFor(argv) {
  const [command = 'help', ...rest] = argv
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    if (!rest[index].startsWith('--')) continue
    const key = rest[index].slice(2)
    options[key] = rest[index + 1]?.startsWith('--') || rest[index + 1] === undefined ? true : rest[++index]
  }
  return { command, options }
}

function required(options, key) {
  if (!options[key] || options[key] === true) throw new Error(`--${key} is required`)
  return String(options[key])
}

async function main() {
  const { command, options } = argumentsFor(process.argv.slice(2))
  if (command === 'connect') {
    const state = await exchangeGrant({ api: required(options, 'api'), grant: required(options, 'grant'), root: required(options, 'root'), deviceName: String(options.device || os.hostname()) })
    await pullSnapshot(state, { force: options.force === true })
    const target = await saveState(state)
    console.log(JSON.stringify({ ok: true, workspaceId: state.workspaceId, expiresAt: state.expiresAt, stateFile: target }))
    return
  }
  const workspaceId = required(options, 'workspace')
  const state = await loadState(workspaceId)
  if (command === 'pull') { const result = await pullSnapshot(state, { force: options.force === true }); await saveState(state); console.log(JSON.stringify({ ok: true, files: result.files })); return }
  if (command === 'push') { const result = await pushLocal(state); await saveState(state); console.log(JSON.stringify({ ok: true, applied: result.applied.length })); return }
  if (command === 'open') { openInVSCode(state.root); console.log(JSON.stringify({ ok: true, root: state.root })); return }
  if (command === 'serve') {
    const bridge = await startLoopbackBridge({ state, port: Number(options.port || 0) })
    console.log(JSON.stringify({ ok: true, url: bridge.url, key: bridge.key, workspaceId: state.workspaceId }))
    return
  }
  console.log('Usage: techit-code connect --api <url> --grant <one-time-grant> --root <directory> [--force]\n       techit-code pull|push|open|serve --workspace <id>')
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
