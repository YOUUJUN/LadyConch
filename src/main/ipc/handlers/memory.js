import { ipcMain } from 'electron'
import MemoryManager from '../../app/memory/memory-manager.js'
import path from 'path'
import { app } from 'electron'

let memoryInstance = null

/**
 * 获取或创建 MemoryManager 实例
 */
function getMemoryInstance(config) {
	if (!memoryInstance || config) {
		const memoryDir = config?.memoryDir || path.join(app.getPath('userData'), 'memory')
		memoryInstance = new MemoryManager({ memoryDir })
	}
	return memoryInstance
}

/**
 * 注册记忆管理相关的 IPC 处理器
 */
export function registerMemoryHandlers() {
	// 初始化记忆管理器
	ipcMain.handle('memory:init', async (event, config) => {
		try {
			const memory = getMemoryInstance(config)
			await memory.initialize()
			return { success: true, memoryDir: memory.memoryDir }
		} catch (error) {
			console.error('初始化记忆管理器失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 保存记忆
	ipcMain.handle('memory:save', async (event, memoryData) => {
		try {
			const memory = getMemoryInstance()
			const result = await memory.saveMemory(memoryData)
			return { success: true, data: result }
		} catch (error) {
			console.error('保存记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取记忆
	ipcMain.handle('memory:get', async (event, { memoryId }) => {
		try {
			const memory = getMemoryInstance()
			const result = await memory.getMemory(memoryId)
			if (!result) {
				return { success: false, error: '记忆不存在' }
			}
			return { success: true, data: result }
		} catch (error) {
			console.error('获取记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 搜索记忆
	ipcMain.handle('memory:search', async (event, query) => {
		try {
			const memory = getMemoryInstance()
			const results = await memory.searchMemories(query)
			return { success: true, data: results }
		} catch (error) {
			console.error('搜索记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 更新记忆
	ipcMain.handle('memory:update', async (event, { memoryId, updates }) => {
		try {
			const memory = getMemoryInstance()
			const result = await memory.updateMemory(memoryId, updates)
			return { success: true, data: result }
		} catch (error) {
			console.error('更新记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 删除记忆
	ipcMain.handle('memory:delete', async (event, { memoryId }) => {
		try {
			const memory = getMemoryInstance()
			const result = await memory.deleteMemory(memoryId)
			return { success: result, error: result ? null : '记忆不存在' }
		} catch (error) {
			console.error('删除记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 列出所有记忆
	ipcMain.handle('memory:list', async (event, options) => {
		try {
			const memory = getMemoryInstance()
			const results = await memory.listMemories(options)
			return { success: true, data: results }
		} catch (error) {
			console.error('列出记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 清理旧记忆
	ipcMain.handle('memory:cleanup', async (event, options) => {
		try {
			const memory = getMemoryInstance()
			const deletedCount = await memory.cleanupMemories(options)
			return { success: true, data: { deletedCount } }
		} catch (error) {
			console.error('清理记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 导出记忆
	ipcMain.handle('memory:export', async () => {
		try {
			const memory = getMemoryInstance()
			const data = await memory.exportToJson()
			return { success: true, data }
		} catch (error) {
			console.error('导出记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 导入记忆
	ipcMain.handle('memory:import', async (event, { memories }) => {
		try {
			const memory = getMemoryInstance()
			const importedCount = await memory.importFromJson(memories)
			return { success: true, data: { importedCount } }
		} catch (error) {
			console.error('导入记忆失败:', error)
			return { success: false, error: error.message }
		}
	})

	console.log('记忆管理 IPC 处理器已注册')
}
