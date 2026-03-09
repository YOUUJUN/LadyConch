import vm from 'vm'
import { Worker } from 'worker_threads'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * JavaScript 沙盒执行器
 */
class Sandbox {
	constructor(config = {}) {
		this.timeout = config.timeout || 5000 // 默认 5 秒超时
		this.memoryLimit = config.memoryLimit || 50 * 1024 * 1024 // 50MB
		this.enableConsole = config.enableConsole !== false
		this.allowedModules = config.allowedModules || []
	}

	/**
	 * 在沙盒中执行代码（同步模式）
	 * @param {string} code - 要执行的代码
	 * @param {Object} context - 上下文对象
	 * @returns {Object} 执行结果
	 */
	executeSync(code, context = {}) {
		const logs = []
		const errors = []

		try {
			// 创建沙盒上下文
			const sandbox = {
				console: this.enableConsole ? {
					log: (...args) => logs.push({ type: 'log', args }),
					error: (...args) => errors.push({ type: 'error', args }),
					warn: (...args) => logs.push({ type: 'warn', args }),
					info: (...args) => logs.push({ type: 'info', args }),
				} : undefined,
				setTimeout: undefined,
				setInterval: undefined,
				setImmediate: undefined,
				process: undefined,
				require: undefined,
				...context,
			}

			// 创建 VM 上下文
			const vmContext = vm.createContext(sandbox)

			// 执行代码
			const script = new vm.Script(code, {
				filename: 'sandbox.js',
				displayErrors: true,
			})

			const result = script.runInContext(vmContext, {
				timeout: this.timeout,
				displayErrors: true,
			})

			return {
				success: true,
				result,
				logs,
				errors,
				executionTime: 0,
			}
		} catch (error) {
			return {
				success: false,
				error: {
					message: error.message,
					stack: error.stack,
					name: error.name,
				},
				logs,
				errors,
			}
		}
	}

	/**
	 * 在沙盒中执行代码（异步模式，使用 Worker）
	 * @param {string} code - 要执行的代码
	 * @param {Object} context - 上下文对象
	 * @returns {Promise<Object>} 执行结果
	 */
	async executeAsync(code, context = {}) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now()

			// 创建 Worker
			const worker = new Worker(
				path.join(__dirname, 'sandbox-worker.js'),
				{
					workerData: {
						code,
						context,
						enableConsole: this.enableConsole,
					},
				}
			)

			// 设置超时
			const timeoutId = setTimeout(() => {
				worker.terminate()
				resolve({
					success: false,
					error: {
						message: '执行超时',
						name: 'TimeoutError',
					},
					executionTime: Date.now() - startTime,
				})
			}, this.timeout)

			// 监听消息
			worker.on('message', (result) => {
				clearTimeout(timeoutId)
				worker.terminate()
				resolve({
					...result,
					executionTime: Date.now() - startTime,
				})
			})

			// 监听错误
			worker.on('error', (error) => {
				clearTimeout(timeoutId)
				worker.terminate()
				resolve({
					success: false,
					error: {
						message: error.message,
						stack: error.stack,
						name: error.name,
					},
					executionTime: Date.now() - startTime,
				})
			})

			// 监听退出
			worker.on('exit', (code) => {
				clearTimeout(timeoutId)
				if (code !== 0) {
					resolve({
						success: false,
						error: {
							message: `Worker 异常退出，代码: ${code}`,
							name: 'WorkerError',
						},
						executionTime: Date.now() - startTime,
					})
				}
			})
		})
	}

	/**
	 * 执行代码并返回结果（自动选择同步或异步）
	 * @param {string} code - 要执行的代码
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 执行结果
	 */
	async execute(code, options = {}) {
		const { context = {}, async = false } = options

		if (async) {
			return await this.executeAsync(code, context)
		} else {
			return this.executeSync(code, context)
		}
	}

	/**
	 * 验证代码语法
	 * @param {string} code - 要验证的代码
	 * @returns {Object} 验证结果
	 */
	validateSyntax(code) {
		try {
			new vm.Script(code)
			return { valid: true }
		} catch (error) {
			return {
				valid: false,
				error: {
					message: error.message,
					stack: error.stack,
				},
			}
		}
	}

	/**
	 * 执行函数
	 * @param {Function} fn - 要执行的函数
	 * @param {Array} args - 函数参数
	 * @param {Object} context - 上下文
	 * @returns {Object} 执行结果
	 */
	executeFunction(fn, args = [], context = {}) {
		const code = `(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(', ')})`
		return this.executeSync(code, context)
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
}

export default Sandbox
