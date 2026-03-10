import DockerSandboxManager from './docker/manager.js'

/**
 * 使用示例
 */
async function examples() {
  // 1. 创建沙盒管理器
  const manager = new DockerSandboxManager({
    sandbox: {
      mode: 'all',
      scope: 'session',
      workspaceAccess: 'rw',
      docker: {
        image: 'ladyconch-sandbox:latest',
      },
    },
  })

  console.log('=== 示例 1: 执行 JavaScript 代码 ===')
  const jsResult = await manager.execute(
    `
    const sum = (a, b) => a + b;
    console.log('2 + 3 =', sum(2, 3));
    `,
    {
      language: 'js',
      sessionKey: 'example-session',
    }
  )
  console.log('输出:', jsResult.stdout)
  console.log('成功:', jsResult.success)
  console.log()

  console.log('=== 示例 2: 执行 Python 代码 ===')
  const pyResult = await manager.execute(
    `
import math
print(f"π = {math.pi}")
print(f"e = {math.e}")
    `,
    {
      language: 'python',
      sessionKey: 'example-session',
    }
  )
  console.log('输出:', pyResult.stdout)
  console.log('成功:', pyResult.success)
  console.log()

  console.log('=== 示例 3: 执行 Bash 命令 ===')
  const bashResult = await manager.execute(
    `
echo "当前目录: $(pwd)"
echo "系统信息: $(uname -a)"
ls -la
    `,
    {
      language: 'bash',
      sessionKey: 'example-session',
    }
  )
  console.log('输出:', bashResult.stdout)
  console.log('成功:', bashResult.success)
  console.log()

  console.log('=== 示例 4: 列出所有容器 ===')
  const containers = await manager.list()
  console.log('容器列表:')
  for (const container of containers) {
    console.log(`  - ${container.containerName}`)
    console.log(`    状态: ${container.running ? '运行中' : '已停止'}`)
    console.log(`    镜像: ${container.image}`)
    console.log(`    创建时间: ${new Date(container.createdAtMs).toLocaleString()}`)
    console.log(`    最后使用: ${new Date(container.lastUsedAtMs).toLocaleString()}`)
  }
  console.log()

  console.log('=== 示例 5: 检查沙盒配置 ===')
  const config = manager.getConfig()
  console.log('沙盒配置:')
  console.log('  模式:', config.mode)
  console.log('  作用域:', config.scope)
  console.log('  工作区访问:', config.workspaceAccess)
  console.log('  Docker 镜像:', config.docker.image)
  console.log('  允许的工具:', config.tools.allow)
  console.log('  拒绝的工具:', config.tools.deny)
  console.log()

  console.log('=== 示例 6: 错误处理 ===')
  const errorResult = await manager.execute(
    `
    throw new Error('这是一个测试错误');
    `,
    {
      language: 'js',
      sessionKey: 'example-session',
    }
  )
  console.log('成功:', errorResult.success)
  console.log('错误输出:', errorResult.stderr)
  console.log()

  console.log('=== 示例 7: 超时控制 ===')
  const timeoutResult = await manager.execute(
    `
    sleep 10
    echo "这条消息不会被打印"
    `,
    {
      language: 'bash',
      sessionKey: 'example-session',
      timeout: 2000, // 2 秒超时
    }
  )
  console.log('成功:', timeoutResult.success)
  console.log('错误:', timeoutResult.error)
  console.log()

  // 清理示例容器（可选）
  // console.log('=== 清理容器 ===')
  // for (const container of containers) {
  //   await manager.remove(container.containerName)
  //   console.log(`已删除: ${container.containerName}`)
  // }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  examples().catch(console.error)
}

export default examples
