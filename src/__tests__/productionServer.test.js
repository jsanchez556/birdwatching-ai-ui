/** @jest-environment node */
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  createStaticAppServer,
  positiveEnvironmentNumber,
  safePathFromUrl,
} from '../../server'

function get(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ port, path: pathname, headers }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({
        body: Buffer.concat(chunks),
        headers: res.headers,
        status: res.statusCode,
      }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('production static server', () => {
  let runtime
  let port
  let distDir

  beforeEach(async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'birdwatching-ui-server-'))
    await mkdir(path.join(distDir, 'assets'))
    await writeFile(path.join(distDir, 'index.html'), '<main>Birdwatching app</main>')
    await writeFile(path.join(distDir, 'assets', 'index-abcdefgh.js'), 'x'.repeat(2048))
    runtime = createStaticAppServer({ distDir, requestLogger: () => {} })
    await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve))
    port = runtime.server.address().port
  })

  afterEach(async () => {
    await runtime.shutdown()
  })

  test('serves an SPA fallback without caching the HTML', async () => {
    const response = await get(port, '/account', { Accept: 'text/html' })
    expect(response.status).toBe(200)
    expect(response.body.toString()).toContain('Birdwatching app')
    expect(response.headers['cache-control']).toBe('no-cache')
  })

  test('serves hashed assets immutably with negotiated compression', async () => {
    const response = await get(port, '/assets/index-abcdefgh.js', {
      'Accept-Encoding': 'gzip',
    })
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toContain('immutable')
    expect(response.headers['content-encoding']).toBe('gzip')
  })

  test('does not turn missing assets or traversal paths into the SPA shell', async () => {
    expect((await get(port, '/assets/missing.js', { Accept: 'text/html' })).status).toBe(404)
    expect(safePathFromUrl('/..%2Fsecret', distDir)).toBeNull()
  })

  test('exposes liveness and changes readiness during idempotent shutdown', async () => {
    expect((await get(port, '/health/live')).status).toBe(200)
    const first = runtime.shutdown()
    const second = runtime.shutdown()
    expect(second).toBe(first)
    await first
  })

  test('validates production shutdown environment values', () => {
    process.env.STATIC_SERVER_GRACE_MS = 'not-a-number'
    expect(() => positiveEnvironmentNumber('STATIC_SERVER_GRACE_MS', 10000))
      .toThrow(/positive number/)
    delete process.env.STATIC_SERVER_GRACE_MS
  })

  test('forces a stalled connection closed within the shutdown bound', async () => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    await new Promise((resolve) => socket.once('connect', resolve))
    const closed = new Promise((resolve) => socket.once('close', resolve))

    await expect(runtime.shutdown({ graceMs: 5, hardTimeoutMs: 50 }))
      .resolves.toEqual({ exitCode: 0, forced: true })
    await closed
    expect(socket.destroyed).toBe(true)
  })
})
