import { spawn } from 'child_process'

/**
 * 执行 Docker 命令
 * @param {Array<string>} args - Docker 命令参数
 * @param {Object} [options] - 选项
 * @param {boolean} [options.allowFailure] - 是否允许失败
 * @param {string|Buffer} [options.input] - 输入数据
 * @param {AbortSignal} [options.signal] - 中止信号
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export function execDockerRaw(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })

    const stdoutChunks = []
    const stderrChunks = []
    let aborted = false

    // 处理中止信号
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        aborted = true
        child.kill()
      })
    }

    // 收集输出
    child.stdout.on('data', (data) => {
      stdoutChunks.push(data)
    })

    child.stderr.on('data', (data) => {
      stderrChunks.push(data)
    })

    // 处理完成
    child.on('close', (code) => {
      if (aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        reject(err)
        return
      }

      const stdout = Buffer.concat(stdoutChunks)
      const stderr = Buffer.concat(stderrChunks)
      const result = {
        stdout: stdout.toString('utf-8'),
        stderr: stderr.toString('utf-8'),
        code: code || 0,
      }

      if (code !== 0 && !options.allowFailure) {
        const err = new Error(`Docker command failed with code ${code}`)
        err.code = code
        err.stdout = result.stdout
        err.stderr = result.stderr
        reject(err)
      } else {
        resolve(result)
      }
    })

    // 处理错误
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        const err = new Error('Docker not found. Please install Docker.')
        err.code = 'ENOENT'
        reject(err)
      } else {
        reject(error)
      }
    })

    // 写入输入数据
    if (options.input) {
      child.stdin.write(options.input)
      child.stdin.end()
    }
  })
}

/**
 * 执行 Docker 命令（简化版本）
 * @param {Array<string>} args - Docker 命令参数
 * @param {Object} [options] - 选项
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export async function execDocker(args, options = {}) {
  return await execDockerRaw(args, options)
}

/**
 * 获取容器状态
 * @param {string} containerName - 容器名称
 * @returns {Promise<{exists: boolean, running: boolean}>}
 */
export async function dockerContainerState(containerName) {
  try {
    const result = await execDocker(
      ['inspect', '-f', '{{.State.Running}}', containerName],
      { allowFailure: true }
    )

    if (result.code === 0) {
      const running = result.stdout.trim() === 'true'
      return { exists: true, running }
    }

    return { exists: false, running: false }
  } catch (error) {
    return { exists: false, running: false }
  }
}

/**
 * 创建沙盒容器
 * @param {Object} params - 参数
 * @param {string} params.name - 容器名称
 * @param {import('./types.js').SandboxDockerConfig} params.cfg - Docker 配置
 * @param {string} params.workspaceDir - 工作区目录
 * @param {import('./types.js').SandboxWorkspaceAccess} params.workspaceAccess - 工作区访问权限
 * @param {string} params.agentWorkspaceDir - Agent 工作区目录
 * @param {string} params.scopeKey - 作用域键
 * @param {string} [params.configHash] - 配置哈希
 * @returns {Promise<void>}
 */
export async function createSandboxContainer(params) {
  const args = ['create', '--name', params.name]

  // 添加工作目录
  args.push('-w', params.cfg.workdir)

  // 添加网络模式
  if (params.cfg.network) {
    args.push('--network', params.cfg.network)
  }

  // 添加用户
  if (params.cfg.user) {
    args.push('--user', params.cfg.user)
  }

  // 添加标签
  args.push('--label', `ladyconch.sandbox=true`)
  args.push('--label', `ladyconch.session=${params.scopeKey}`)
  if (params.configHash) {
    args.push('--label', `ladyconch.config-hash=${params.configHash}`)
  }

  // 添加自定义标签
  if (params.cfg.labels) {
    for (const [key, value] of Object.entries(params.cfg.labels)) {
      args.push('--label', `${key}=${value}`)
    }
  }

  // 添加环境变量
  if (params.cfg.env) {
    for (const env of params.cfg.env) {
      args.push('-e', env)
    }
  }

  // 添加挂载
  if (params.workspaceAccess !== 'none') {
    const mode = params.workspaceAccess === 'ro' ? 'ro' : 'rw'
    const mountSource = params.workspaceAccess === 'rw'
      ? params.agentWorkspaceDir
      : params.workspaceDir
    args.push('-v', `${mountSource}:${params.cfg.workdir}:${mode}`)
  }

  // 添加自定义绑定
  if (params.cfg.binds) {
    for (const bind of params.cfg.binds) {
      args.push('-v', bind)
    }
  }

  // 添加镜像
  args.push(params.cfg.image)

  // 执行创建命令
  await execDocker(args)
}

/**
 * 确保沙盒容器存在并运行
 * @param {Object} params - 参数
 * @param {import('./types.js').SandboxConfig} params.cfg - 沙盒配置
 * @param {string} params.workspaceDir - 工作区目录
 * @param {string} params.agentWorkspaceDir - Agent 工作区目录
 * @param {string} params.scopeKey - 作用域键
 * @param {string} params.containerName - 容器名称
 * @returns {Promise<string>} 容器名称
 */
export async function ensureSandboxContainer(params) {
  const { containerName } = params
  const state = await dockerContainerState(containerName)

  if (!state.exists) {
    // 创建容器
    await createSandboxContainer({
      name: containerName,
      cfg: params.cfg.docker,
      workspaceDir: params.workspaceDir,
      workspaceAccess: params.cfg.workspaceAccess,
      agentWorkspaceDir: params.agentWorkspaceDir,
      scopeKey: params.scopeKey,
    })
  }

  // 确保容器运行
  if (!state.running) {
    await execDocker(['start', containerName])
  }

  return containerName
}

/**
 * 在容器中执行命令
 * @param {string} containerName - 容器名称
 * @param {Array<string>} command - 命令
 * @param {Object} [options] - 选项
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
export async function execInContainer(containerName, command, options = {}) {
  const args = ['exec']

  if (options.workdir) {
    args.push('-w', options.workdir)
  }

  if (options.user) {
    args.push('-u', options.user)
  }

  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push('-e', `${key}=${value}`)
    }
  }

  args.push(containerName, ...command)

  return await execDocker(args, { allowFailure: options.allowFailure })
}
