import { ipcMain } from 'electron'
import PythonSandboxManager from '../../app/sandbox/python-sandbox-manager.js'

const pythonManager = new PythonSandboxManager()

/**
 * 注册 Python 沙盒相关的 IPC 处理器
 */
export function registerPythonSandboxHandlers() {
	// 执行 Python 代码
	ipcMain.handle('python:execute', async (event, { code, options }) => {
		try {
			const result = await pythonManager.execute(code, options)
			return { success: true, data: result }
		} catch (error) {
			console.error('执行 Python 代码失败:', error)
			return {
				success: false,
				error: {
					message: error.message,
					stack: error.stack,
				},
			}
		}
	})

	// 验证 Python 语法
	ipcMain.handle('python:validate', async (event, { code, pythonPath }) => {
		try {
			const sandbox = pythonManager.getSandbox('default') ||
			                pythonManager.createSandbox('default', { pythonPath })
			const result = await sandbox.validateSyntax(code)
			return { success: true, data: result }
		} catch (error) {
			console.error('验证 Python 语法失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 检查 Python 环境
	ipcMain.handle('python:check', async (event, { pythonPath }) => {
		try {
			const result = await pythonManager.checkPython(pythonPath)
			return { success: true, data: result }
		} catch (error) {
			console.error('检查 Python 环境失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 创建 Python 沙盒
	ipcMain.handle('python:create', async (event, { id, config, preset }) => {
		try {
			let sandbox
			if (preset) {
				sandbox = pythonManager.createSandboxWithPreset(id, preset)
			} else {
				sandbox = pythonManager.createSandbox(id, config)
			}
			return { success: true, data: { id } }
		} catch (error) {
			console.error('创建 Python 沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 删除 Python 沙盒
	ipcMain.handle('python:delete', async (event, { id }) => {
		try {
			const result = pythonManager.deleteSandbox(id)
			return { success: result }
		} catch (error) {
			console.error('删除 Python 沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 列出所有 Python 沙盒
	ipcMain.handle('python:list', async () => {
		try {
			const sandboxes = pythonManager.listSandboxes()
			return { success: true, data: sandboxes }
		} catch (error) {
			console.error('列出 Python 沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取 Python 沙盒统计
	ipcMain.handle('python:stats', async (event, { id }) => {
		try {
			const stats = pythonManager.getSandboxStats(id)
			if (!stats) {
				return { success: false, error: '沙盒不存在' }
			}
			return { success: true, data: stats }
		} catch (error) {
			console.error('获取 Python 统计失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取执行历史
	ipcMain.handle('python:history', async (event, options) => {
		try {
			const history = pythonManager.getHistory(options)
			return { success: true, data: history }
		} catch (error) {
			console.error('获取 Python 历史失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 清空历史
	ipcMain.handle('python:clearHistory', async () => {
		try {
			pythonManager.clearHistory()
			return { success: true }
		} catch (error) {
			console.error('清空 Python 历史失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 批量执行
	ipcMain.handle('python:executeBatch', async (event, { codes, options }) => {
		try {
			const results = await pythonManager.executeBatch(codes, options)
			return { success: true, data: results }
		} catch (error) {
			console.error('批量执行 Python 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 执行 Python 文件
	ipcMain.handle('python:executeFile', async (event, { filePath, options }) => {
		try {
			const result = await pythonManager.executeFile(filePath, options)
			return { success: true, data: result }
		} catch (error) {
			console.error('执行 Python 文件失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 安装 Python 包
	ipcMain.handle('python:installPackage', async (event, { packageName, pythonPath }) => {
		try {
			const sandbox = pythonManager.getSandbox('default') ||
			                pythonManager.createSandbox('default', { pythonPath })
			const result = await sandbox.installPackage(packageName)
			return { success: true, data: result }
		} catch (error) {
			console.error('安装 Python 包失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取预设列表
	ipcMain.handle('python:presets', async () => {
		try {
			const presets = Object.keys(PythonSandboxManager.PRESETS)
			return { success: true, data: presets }
		} catch (error) {
			console.error('获取 Python 预设失败:', error)
			return { success: false, error: error.message }
		}
	})

	console.log('Python 沙盒 IPC 处理器已注册')
}
