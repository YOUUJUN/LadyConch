import Sandbox from './sandbox.js'

/**
 * 沙盒管理器 - 管理多个沙盒实例
 */
class SandboxManager {
	constructor() {
		this.sandboxes = new Map()
		this.executionHistory = []
		this.maxHistorySize = 100
	}

	/**
	 * 创建沙盒实例
	 * @param {string} id - 沙盒 ID
	 * @param {Object} config - 配置
	 * @returns {Sandbox} 沙盒实例
	 */
	createSandbox(id, config = {}) {
		const sandbox = new Sandbox(config)
		this.sandboxes.set(id, {
			instance: sandbox,
			config,
			createdAt: Date.now(),
			executionCount: 0,
		})
		return sandbox
	}

	/**
	 * 获取沙盒实例
	 * @param {string} id - 沙盒 ID
	 * @returns {Sandbox|null} 沙盒实例
	 */
	getSandbox(id) {
		const sandbox = this.sandboxes.get(id)
		return sandbox ? sandbox.instance : null
	}

	/**
	 * 删除沙盒实例
	 * @param {string} id - 沙盒 ID
	 * @returns {boolean} 是否成功删除
	 */
	deleteSandbox(id) {
		return this.sandboxes.delete(id)
	}

	/**
	 * 执行代码（使用指定或默认沙盒）
	 * @param {string} code - 代码
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 执行结果
	 */
	async execute(code, options = {}) {
		const {
			sandboxId = 'default',
			context = {},
			async = false,
			saveHistory = true,
		} = options

		// 获取或创建沙盒
		let sandbox = this.getSandbox(sandboxId)
		if (!sandbox) {
			sandbox = this.createSandbox(sandboxId, {
				timeout: options.timeout,
				memoryLimit: options.memoryLimit,
				enableConsole: options.enableConsole,
			})
		}

		// 执行代码
		const startTime = Date.now()
		const result = await sandbox.execute(code, { context, async })

		// 更新统计
		const sandboxData = this.sandboxes.get(sandboxId)
		if (sandboxData) {
			sandboxData.executionCount++
		}

		// 保存历史
		if (saveHistory) {
			this._addHistory({
				sandboxId,
				code,
				result,
				timestamp: startTime,
				executionTime: Date.now() - startTime,
			})
		}

		return result
	}

	/**
	 * 添加执行历史
	 * @private
	 */
	_addHistory(record) {
		this.executionHistory.push(record)

		// 限制历史记录大小
		if (this.executionHistory.length > this.maxHistorySize) {
			this.executionHistory.shift()
		}
	}

	/**
	 * 获取执行历史
	 * @param {Object} options - 选项
	 * @returns {Array} 历史记录
	 */
	getHistory(options = {}) {
		let history = [...this.executionHistory]

		// 按沙盒 ID 过滤
		if (options.sandboxId) {
			history = history.filter(h => h.sandboxId === options.sandboxId)
		}

		// 只返回成功的
		if (options.successOnly) {
			history = history.filter(h => h.result.success)
		}

		// 限制数量
		if (options.limit) {
			history = history.slice(-options.limit)
		}

		return history
	}

	/**
	 * 清空执行历史
	 */
	clearHistory() {
		this.executionHistory = []
	}

	/**
	 * 列出所有沙盒
	 * @returns {Array} 沙盒列表
	 */
	listSandboxes() {
		return Array.from(this.sandboxes.entries()).map(([id, data]) => ({
			id,
			config: data.config,
			createdAt: data.createdAt,
			executionCount: data.executionCount,
		}))
	}

	/**
	 * 获取沙盒统计信息
	 * @param {string} id - 沙盒 ID
	 * @returns {Object|null} 统计信息
	 */
	getSandboxStats(id) {
		const sandbox = this.sandboxes.get(id)
		if (!sandbox) return null

		const history = this.getHistory({ sandboxId: id })
		const successCount = history.filter(h => h.result.success).length
		const failureCount = history.length - successCount

		return {
			id,
			createdAt: sandbox.createdAt,
			executionCount: sandbox.executionCount,
			successCount,
			failureCount,
			successRate: history.length > 0 ? (successCount / history.length) * 100 : 0,
		}
	}

	/**
	 * 预设沙盒配置
	 */
	static PRESETS = {
		// 严格模式 - 最小权限
		strict: {
			timeout: 3000,
			memoryLimit: 10 * 1024 * 1024,
			enableConsole: false,
			allowedModules: [],
		},
		// 标准模式 - 平衡
		standard: {
			timeout: 5000,
			memoryLimit: 50 * 1024 * 1024,
			enableConsole: true,
			allowedModules: [],
		},
		// 宽松模式 - 更多权限
		relaxed: {
			timeout: 10000,
			memoryLimit: 100 * 1024 * 1024,
			enableConsole: true,
			allowedModules: ['lodash', 'moment'],
		},
	}

	/**
	 * 使用预设创建沙盒
	 * @param {string} id - 沙盒 ID
	 * @param {string} preset - 预设名称
	 * @returns {Sandbox} 沙盒实例
	 */
	createSandboxWithPreset(id, preset = 'standard') {
		const config = SandboxManager.PRESETS[preset]
		if (!config) {
			throw new Error(`未知的预设: ${preset}`)
		}
		return this.createSandbox(id, config)
	}
}

export default SandboxManager
