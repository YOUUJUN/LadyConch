import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import DockerSandboxManager from './manager.js'
import { dockerContainerState } from './docker.js'

describe('Docker Sandbox Manager', () => {
  let manager
  const testSessionKey = 'test-session-' + Date.now()

  before(() => {
    manager = new DockerSandboxManager({
      sandbox: {
        mode: 'all',
        scope: 'session',
        workspaceAccess: 'none',
        docker: {
          image: 'node:18-alpine',
        },
      },
    })
  })

  after(async () => {
    // 清理测试容器
    const containers = await manager.list()
    for (const container of containers) {
      if (container.sessionKey.includes('test-session')) {
        await manager.remove(container.containerName)
      }
    }
  })

  it('should create sandbox context', async () => {
    const context = await manager.getContext({
      sessionKey: testSessionKey,
    })

    assert.ok(context, 'Context should be created')
    assert.strictEqual(context.enabled, true)
    assert.ok(context.containerName, 'Container name should exist')
  })

  it('should execute JavaScript code', async () => {
    const result = await manager.execute('console.log("Hello")', {
      language: 'js',
      sessionKey: testSessionKey,
    })

    assert.strictEqual(result.success, true)
    assert.ok(result.stdout.includes('Hello'))
  })

  it('should execute bash commands', async () => {
    const result = await manager.execute('echo "test"', {
      language: 'bash',
      sessionKey: testSessionKey,
    })

    assert.strictEqual(result.success, true)
    assert.ok(result.stdout.includes('test'))
  })

  it('should handle execution errors', async () => {
    const result = await manager.execute('exit 1', {
      language: 'bash',
      sessionKey: testSessionKey,
    })

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.code, 1)
  })

  it('should list containers', async () => {
    const containers = await manager.list()

    assert.ok(Array.isArray(containers))
    const testContainer = containers.find((c) =>
      c.sessionKey.includes('test-session')
    )
    assert.ok(testContainer, 'Test container should be in list')
  })

  it('should check if sandbox is enabled', () => {
    const enabled = manager.isEnabled()
    assert.strictEqual(enabled, true)
  })

  it('should get sandbox config', () => {
    const config = manager.getConfig()

    assert.strictEqual(config.mode, 'all')
    assert.strictEqual(config.scope, 'session')
    assert.strictEqual(config.workspaceAccess, 'none')
  })

  it('should cache contexts', async () => {
    const context1 = await manager.getContext({
      sessionKey: testSessionKey,
    })
    const context2 = await manager.getContext({
      sessionKey: testSessionKey,
    })

    assert.strictEqual(context1.containerName, context2.containerName)
  })

  it('should verify container is running', async () => {
    const context = await manager.getContext({
      sessionKey: testSessionKey,
    })

    const state = await dockerContainerState(context.containerName)
    assert.strictEqual(state.exists, true)
    assert.strictEqual(state.running, true)
  })
})
