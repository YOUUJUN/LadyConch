import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { tmpdir } from 'os'
import { v1 as uuidv1 } from 'uuid'

/**
 * Python 沙盒执行器
 */
class PythonSandbox {
	constructor(config = {}) {
		this.timeout = config.timeout || 10000 // 默认 10 秒超时
		this.pythonPath = config.pythonPath || 'python' // Python 解释器路径
		this.maxOutputSize = config.maxOutputSize || 1024 * 1024 // 1MB
		this.allowedModules = config.allowedModules || [
			'math', 'random', 'datetime', 'json', 're', 'collections'
		]
		this.workDir = config.workDir || path.join(tmpdir(), 'python-sandbox')
	}

	/**
	 * 执行 Python 代码
	 * @param {string} code - Python 代码
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} 执行结果
	 */
	async execute(code, options = {}) {
		const startTime = Date.now()
		const executionId = uuidv1()

		try {
			// 确保工作目录存在
			await mkdir(this.workDir, { recursive: true })

			// 创建临时文件
			const tempFile = path.join(this.workDir, `script_${executionId}.py`)

			// 包装代码以限制危险操作
			const wrappedCode = this._wrapCode(code, options)

			// 写入临时文件
			await writeFile(tempFile, wrappedCode, 'utf-8')

			// 执行 Python 脚本
			const result = await this._executePython(tempFile, options)

			// 清理临时文件
			try {
				await unlink(tempFile)
			} catch (error) {
				console.warn('清理临时文件失败:', error)
			}

			return {
				...result,
				executionTime: Date.now() - startTime,
			}
		} catch (error) {
			return {
				success: false,
				error: {
					message: error.message,
					stack: error.stack,
				},
				executionTime: Date.now() - startTime,
			}
		}
	}

	/**
	 * 包装代码以添加安全限制
	 * @private
	 */
	_wrapCode(code, options) {
		const allowedModules = options.allowedModules || this.allowedModules

		return `
import sys
import json
import io
from contextlib import redirect_stdout, redirect_stderr

# 限制可导入的模块
ALLOWED_MODULES = ${JSON.stringify(allowedModules)}

# 保存原始的 __import__
_original_import = __builtins__.__import__

def _restricted_import(name, *args, **kwargs):
    if name.split('.')[0] not in ALLOWED_MODULES:
        raise ImportError(f"模块 '{name}' 不在允许列表中")
    return _original_import(name, *args, **kwargs)

# 替换 __import__
__builtins__.__import__ = _restricted_import

# 禁用危险函数
__builtins__.eval = None
__builtins__.exec = None
__builtins__.compile = None
__builtins__.open = None
__builtins__.__import__ = _restricted_import

# 捕获输出
stdout_capture = io.StringIO()
stderr_capture = io.StringIO()

result = None
error = None

try:
    with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
        # 用户代码
${code.split('\n').map(line => '        ' + line).join('\n')}

        # 如果最后一行是表达式，捕获其值
        try:
            result = eval(compile('''${code.split('\n').pop()}''', '<string>', 'eval'))
        except:
            pass

except Exception as e:
    error = {
        'type': type(e).__name__,
        'message': str(e),
        'traceback': None
    }
    import traceback
    error['traceback'] = traceback.format_exc()

# 输出结果
output = {
    'success': error is None,
    'result': str(result) if result is not None else None,
    'stdout': stdout_capture.getvalue(),
    'stderr': stderr_capture.getvalue(),
    'error': error
}

print('__SANDBOX_OUTPUT_START__')
print(json.dumps(output))
print('__SANDBOX_OUTPUT_END__')
`
	}

	/**
	 * 执行 Python 脚本
	 * @private
	 */
	_executePython(scriptPath, options) {
		return new Promise((resolve) => {
			let stdout = ''
			let stderr = ''
			let killed = false

			// 启动 Python 进程
			const pythonProcess = spawn(this.pythonPath, [scriptPath], {
				cwd: this.workDir,
				env: {
					...process.env,
					PYTHONIOENCODING: 'utf-8',
				},
			})

			// 设置超时
			const timeoutId = setTimeout(() => {
				killed = true
				pythonProcess.kill('SIGTERM')

				// 如果 SIGTERM 无效，使用 SIGKILL
				setTimeout(() => {
					if (!pythonProcess.killed) {
						pythonProcess.kill('SIGKILL')
					}
				}, 1000)
			}, this.timeout)

			// 捕获标准输出
			pythonProcess.stdout.on('data', (data) => {
				stdout += data.toString()

				// 防止输出过大
				if (stdout.length > this.maxOutputSize) {
					pythonProcess.kill('SIGTERM')
				}
			})

			// 捕获标准错误
			pythonProcess.stderr.on('data', (data) => {
				stderr += data.toString()

				if (stderr.length > this.maxOutputSize) {
					pythonProcess.kill('SIGTERM')
				}
			})

			// 进程退出
			pythonProcess.on('close', (code) => {
				clearTimeout(timeoutId)

				if (killed) {
					resolve({
						success: false,
						error: {
							message: '执行超时',
							type: 'TimeoutError',
						},
						stdout: stdout.substring(0, 1000),
						stderr: stderr.substring(0, 1000),
					})
					return
				}

				// 解析输出
				try {
					const outputMatch = stdout.match(
						/__SANDBOX_OUTPUT_START__([\s\S]*?)__SANDBOX_OUTPUT_END__/
					)

					if (outputMatch) {
						const output = JSON.parse(outputMatch[1].trim())
						resolve(output)
					} else {
						// 如果没有找到标记，返回原始输出
						resolve({
							success: code === 0,
							result: null,
							stdout,
							stderr,
							error: code !== 0 ? {
								message: `进程退出码: ${code}`,
								type: 'ProcessError',
							} : null,
						})
					}
				} catch (error) {
					resolve({
						success: false,
						error: {
							message: '解析输出失败: ' + error.message,
							type: 'ParseError',
						},
						stdout,
						stderr,
					})
				}
			})

			// 进程错误
			pythonProcess.on('error', (error) => {
				clearTimeout(timeoutId)
				resolve({
					success: false,
					error: {
						message: error.message,
						type: 'SpawnError',
					},
					stdout,
					stderr,
				})
			})
		})
	}

	/**
	 * 验证 Python 语法
	 * @param {string} code - Python 代码
	 * @returns {Promise<Object>} 验证结果
	 */
	async validateSyntax(code) {
		const checkCode = `
import py_compile
import sys

try:
    compile('''${code.replace(/'/g, "\\'")}''', '<string>', 'exec')
    print('VALID')
except SyntaxError as e:
    print(f'INVALID: {e}')
`

		try {
			const result = await this._executePython(checkCode, {})
			const isValid = result.stdout.includes('VALID')

			return {
				valid: isValid,
				error: isValid ? null : result.stdout.replace('INVALID: ', '').trim(),
			}
		} catch (error) {
			return {
				valid: false,
				error: error.message,
			}
		}
	}

	/**
	 * 检查 Python 是否可用
	 * @returns {Promise<Object>} 检查结果
	 */
	async checkPython() {
		return new Promise((resolve) => {
			const pythonProcess = spawn(this.pythonPath, ['--version'])

			let output = ''

			pythonProcess.stdout.on('data', (data) => {
				output += data.toString()
			})

			pythonProcess.stderr.on('data', (data) => {
				output += data.toString()
			})

			pythonProcess.on('close', (code) => {
				resolve({
					available: code === 0,
					version: output.trim(),
					path: this.pythonPath,
				})
			})

			pythonProcess.on('error', (error) => {
				resolve({
					available: false,
					error: error.message,
					path: this.pythonPath,
				})
			})
		})
	}

	/**
	 * 安装 Python 包（需要 pip）
	 * @param {string} packageName - 包名
	 * @returns {Promise<Object>} 安装结果
	 */
	async installPackage(packageName) {
		return new Promise((resolve) => {
			const pipProcess = spawn(this.pythonPath, ['-m', 'pip', 'install', packageName])

			let output = ''

			pipProcess.stdout.on('data', (data) => {
				output += data.toString()
			})

			pipProcess.stderr.on('data', (data) => {
				output += data.toString()
			})

			pipProcess.on('close', (code) => {
				resolve({
					success: code === 0,
					output,
				})
			})

			pipProcess.on('error', (error) => {
				resolve({
					success: false,
					error: error.message,
				})
			})
		})
	}
}

export default PythonSandbox
