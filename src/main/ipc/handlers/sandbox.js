import { ipcMain } from 'electron'
import SandboxManager from '../../app/sandbox/sandbox-manager.js'

const sandboxManager = new SandboxManager()

/**
 * 注册沙盒相关的 IPC 处理器
 */
export function registerSandboxHandlers() {
	// 执行代码
	ipcMain.handle('sandbox:execute', async (event, { code, options }) => {
		try {
			const result = await sandboxManager.execute(code, options)
			return { success: true, data: result }
		} catch (error) {
			console.error('执行代码失败:', error)
			return {
				success: false,
				error: {
					message: error.message,
					stack: error.stack,
				},
			}
		}
	})

	// 验证语法
	ipcMain.handle('sandbox:validate', async (event, { code }) => {
		try {
			const sandbox = sandboxManager.getSandbox('default') ||
			                sandboxManager.createSandbox('default')
			const result = sandbox.validateSyntax(code)
			return { success: true, data: result }
		} catch (error) {
			console.error('验证语法失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 创建沙盒
	ipcMain.handle('sandbox:create', async (event, { id, config, preset }) => {
		try {
			let sandbox
			if (preset) {
				sandbox = sandboxManager.createSandboxWithPreset(id, preset)
			} else {
				sandbox = sandboxManager.createSandbox(id, config)
			}
			return { success: true, data: { id } }
		} catch (error) {
			console.error('创建沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 删除沙盒
	ipcMain.handle('sandbox:delete', async (event, { id }) => {
		try {
			const result = sandboxManager.deleteSandbox(id)
			return { success: result }
		} catch (error) {
			console.error('删除沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 列出所有沙盒
	ipcMain.handle('sandbox:list', async () => {
		try {
			const sandboxes = sandboxManager.listSandboxes()
			return { success: true, data: sandboxes }
		} catch (error) {
			console.error('列出沙盒失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取沙盒统计
	ipcMain.handle('sandbox:stats', async (event, { id }) => {
		try {
			const stats = sandboxManager.getSandboxStats(id)
			if (!stats) {
				return { success: false, error: '沙盒不存在' }
			}
			return { success: true, data: stats }
		} catch (error) {
			console.error('获取统计失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取执行历史
	ipcMain.handle('sandbox:history', async (event, options) => {
		try {
			const history = sandboxManager.getHistory(options)
			return { success: true, data: history }
		} catch (error) {
			console.error('获取历史失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 清空历史
	ipcMain.handle('sandbox:clearHistory', async () => {
		try {
			sandboxManager.clearHistory()
			return { success: true }
		} catch (error) {
			console.error('清空历史失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 批量执行
	ipcMain.handle('sandbox:executeBatch', async (event, { codes, options }) => {
		try {
			const sandbox = sandboxManager.getSandbox(options?.sandboxId || 'default') ||
			                sandboxManager.createSandbox(options?.sandboxId || 'default')
			const results = await sandbox.executeBatch(codes, options)
			return { success: true, data: results }
		} catch (error) {
			console.error('批量执行失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取预设列表
	ipcMain.handle('sandbox:presets', async () => {
		try {
			const presets = Object.keys(SandboxManager.PRESETS)
			return { success: true, data: presets }
		} catch (error) {
			console.error('获取预设失败:', error)
			return { success: false, error: error.message }
		}
	})

	console.log('沙盒 IPC 处理器已注册')
}
