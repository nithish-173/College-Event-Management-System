import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const serverPath = fileURLToPath(new URL('./server.js', import.meta.url))
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const apiPort = Number(process.env.API_PORT || process.env.PORT || 3001)
const backend = spawn(process.execPath, [serverPath], { stdio: 'inherit', env: process.env })
let frontend
let shuttingDown = false

function stopChildren() {
  if (shuttingDown) return
  shuttingDown = true
  if (frontend && frontend.exitCode === null) frontend.kill()
  if (backend.exitCode === null) backend.kill()
}

process.on('SIGINT', stopChildren)
process.on('SIGTERM', stopChildren)

backend.on('error', (error) => {
  console.error('Could not start the API server:', error)
  stopChildren()
  process.exitCode = 1
})

backend.on('exit', (code) => {
  if (shuttingDown) return
  console.error(`The API server exited unexpectedly with code ${code}.`)
  stopChildren()
  process.exitCode = 1
})

async function startFrontendWhenApiIsReady() {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) return
    try {
      const response = await fetch(`http://localhost:${apiPort}/api/health`)
      if (response.ok) {
        frontend = spawn(process.execPath, [vitePath, ...process.argv.slice(2)], {
          stdio: 'inherit',
          env: process.env,
        })
        frontend.on('error', (error) => {
          console.error('Could not start the frontend server:', error)
          stopChildren()
          process.exitCode = 1
        })
        frontend.on('exit', (code) => {
          if (shuttingDown) return
          stopChildren()
          process.exitCode = code || 0
        })
        return
      }
    } catch {
      // Retry until the API process is ready.
    }
    await delay(100)
  }
  console.error(`The API did not become ready on port ${apiPort}.`)
  stopChildren()
  process.exitCode = 1
}

await startFrontendWhenApiIsReady()
