import fs from 'fs/promises'
import path from 'path'

/**
 * 确保沙盒工作区存在
 * @param {string} workspaceDir - 工作区目录
 * @param {string} [seedFrom] - 种子目录（用于复制初始文件）
 * @returns {Promise<void>}
 */
export async function ensureSandboxWorkspace(workspaceDir, seedFrom) {
  // 创建工作区目录
  await fs.mkdir(workspaceDir, { recursive: true })

  // 如果提供了种子目录，复制文件
  if (seedFrom) {
    try {
      const files = await fs.readdir(seedFrom)

      for (const file of files) {
        const srcPath = path.join(seedFrom, file)
        const destPath = path.join(workspaceDir, file)

        try {
          // 检查目标文件是否已存在
          await fs.access(destPath)
        } catch {
          // 目标文件不存在，复制
          try {
            const stat = await fs.stat(srcPath)
            if (stat.isFile()) {
              await fs.copyFile(srcPath, destPath)
            }
          } catch (error) {
            // 忽略复制失败
            console.warn(`复制文件失败: ${srcPath}`, error)
          }
        }
      }
    } catch (error) {
      // 忽略种子目录读取失败
      console.warn(`读取种子目录失败: ${seedFrom}`, error)
    }
  }
}

/**
 * 获取工作区信息
 * @param {string} workspaceDir - 工作区目录
 * @returns {Promise<{exists: boolean, files: number}>}
 */
export async function getWorkspaceInfo(workspaceDir) {
  try {
    const stat = await fs.stat(workspaceDir)
    if (!stat.isDirectory()) {
      return { exists: false, files: 0 }
    }

    const files = await fs.readdir(workspaceDir)
    return { exists: true, files: files.length }
  } catch (error) {
    return { exists: false, files: 0 }
  }
}
