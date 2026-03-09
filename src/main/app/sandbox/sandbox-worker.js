import { parentPort, workerData } from 'worker_threads'
import vm from 'vm'

/**
 * Worker 线程中的沙盒执行器
 */
function executeSandbox() {
	const { code, context, enableConsole } = workerData

	const logs = []
	const errors = []

	try {
		// 创建沙盒上下文
		const sandbox = {
			console: enableConsole ? {
				log: (...args) => logs.push({ type: 'log', args }),
				error: (...args) => errors.push({ type: 'error', args }),
				warn: (...args) => logs.push({ type: 'warn', args }),
				info: (...args) => logs.push({ type: 'info', args }),
			} : undefined,
			// 禁用危险的全局对象
			setTimeout: undefined,
			setInterval: undefined,
			setImmediate: undefined,
			process: undefined,
			require: undefined,
			global: undefined,
			Buffer: undefined,
			...context,
		}

		// 创建 VM 上下文
		const vmContext = vm.createContext(sandbox)

		// 执行代码
		const script = new vm.Script(code, {
			filename: 'sandbox-worker.js',
			displayErrors: true,
		})

		const result = script.runInContext(vmContext, {
			timeout: 30000, // Worker 内部超时
			displayErrors: true,
		})

		// 发送结果
		parentPort.postMessage({
			success: true,
			result,
			logs,
			errors,
		})
	} catch (error) {
		// 发送错误
		parentPort.postMessage({
			success: false,
			error: {
				message: error.message,
				stack: error.stack,
				name: error.name,
			},
			logs,
			errors,
		})
	}
}

// 执行沙盒
executeSandbox()
