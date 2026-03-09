import PythonSandbox from './python-sandbox.js'

/**
 * Python 沙盒管理器
 */
class PythonSandboxManager {
	constructor() {
		this.sandboxes = new Map()
		this.executionHistory = []
		this.maxHistorySize = 100
	}

	/**
	 * 创建 Python 沙盒实例
	 * @param {string} id - 沙盒 ID
	 * @param {Object} config - 配置
	 * @returns {PythonSandbox} 沙盒实例
	 */
	createSandbox(id, config = {}) {
		const sandbox = new PythonSandbox(config)
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
	 * @returns {PythonSandbox|null} 沙盒实例
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
	 * 执行 Python 代码
	 * @param {string} code - 代码
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 执行结果
	 */
	async execute(code, options = {}) {
		const {
			sandboxId = 'default',
			saveHistory = true,
		} = options

		// 获取或创建沙盒
		let sandbox = this.getSandbox(sandboxId)
		if (!sandbox) {
			sandbox = this.createSandbox(sandboxId, {
				timeout: options.timeout,
				pythonPath: options.pythonPath,
				allowedModules: options.allowedModules,
			})
		}

		// 执行代码
		const startTime = Date.now()
		const result = await sandbox.execute(code, options)

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
	 * 检查 Python 环境
	 * @param {string} pythonPath - Python 路径
	 * @returns {Promise<Object>} 检查结果
	 */
	async checkPython(pythonPath) {
		const sandbox = new PythonSandbox({ pythonPath })
		return await sandbox.checkPython()
	}

	/**
	 * 预设沙盒配置
	 */
	static PRESETS = {
		// 严格模式 - 最小权限
		strict: {
			timeout: 5000,
			allowedModules: ['math', 'random'],
			pythonPath: 'python',
		},
		// 标准模式 - 平衡
		standard: {
			timeout: 10000,
			allowedModules: ['math', 'random', 'datetime', 'json', 're', 'collections'],
			pythonPath: 'python',
		},
		// 数据科学模式 - 支持科学计算
		datascience: {
			timeout: 30000,
			allowedModules: [
				'math', 'random', 'datetime', 'json', 're', 'collections',
				'numpy', 'pandas', 'matplotlib', 'scipy'
			],
			pythonPath: 'python',
		},
		// 宽松模式 - 更多权限
		relaxed: {
			timeout: 30000,
			allowedModules: [
				'math', 'random', 'datetime', 'json', 're', 'collections',
				'os', 'sys', 'time', 'itertools', 'functools'
			],
			pythonPath: 'python',
		},
	}

	/**
	 * 使用预设创建沙盒
	 * @param {string} id - 沙盒 ID
	 * @param {string} preset - 预设名称
	 * @returns {PythonSandbox} 沙盒实例
	 */
	createSandboxWithPreset(id, preset = 'standard') {
		const config = PythonSandboxManager.PRESETS[preset]
		if (!config) {
			throw new Error(`未知的预设: ${preset}`)
		}
		return this.createSandbox(id, config)
	}

	/**
	 * 批量执行代码
	 * @param {Array<string>} codes - 代码数组
	 * @param {Object} options - 选项
	 * @returns {Promise<Array>} 执行结果数组
	 */
	async executeBatch(codes, options = {}) {
		const results = []

		for (const code of codes) {
			const result = await this.execute(code, options)
			results.push(result)

			// 如果遇到错误且设置了 stopOnError，则停止执行
			if (!result.success && options.stopOnError) {
				break
			}
		}

		return results
	}

	/**
	 * 执行 Python 脚本文件
	 * @param {string} scriptPath - 脚本路径
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 执行结果
	 */
	async executeFile(scriptPath, options = {}) {
		const fs = await import('fs/promises')
		const code = await fs.readFile(scriptPath, 'utf-8')
		return await this.execute(code, options)
	}
}

export default PythonSandboxManager
