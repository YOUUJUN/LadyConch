import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Skill 加载器和运行器
 */
class SkillRunner {
	constructor(config = {}) {
		this.skillsDir = config.skillsDir || path.join(__dirname, '../skills')
		this.skills = new Map()
		this.executionHistory = []
	}

	/**
	 * 加载单个 skill
	 * @param {string} skillPath - skill 目录路径
	 * @returns {Promise<Object>} skill 对象
	 */
	async loadSkill(skillPath) {
		try {
			const skillMdPath = path.join(skillPath, 'SKILL.md')
			const content = await fs.readFile(skillMdPath, 'utf-8')

			// 解析 frontmatter
			const { name, description, compatibility, body } = this._parseSkillMd(content)

			// 检查依赖的资源
			const resources = await this._scanResources(skillPath)

			const skill = {
				name,
				description,
				compatibility,
				body,
				path: skillPath,
				resources,
				loadedAt: Date.now(),
			}

			this.skills.set(name, skill)
			return skill
		} catch (error) {
			throw new Error(`加载 skill 失败: ${error.message}`)
		}
	}

	/**
	 * 解析 SKILL.md 文件
	 * @private
	 */
	_parseSkillMd(content) {
		const lines = content.split('\n')

		// 查找 frontmatter
		if (lines[0].trim() !== '---') {
			throw new Error('SKILL.md 缺少 frontmatter')
		}

		let endIdx = null
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				endIdx = i
				break
			}
		}

		if (endIdx === null) {
			throw new Error('SKILL.md frontmatter 未闭合')
		}

		// 解析 frontmatter
		const frontmatterLines = lines.slice(1, endIdx)
		const frontmatter = {}

		let i = 0
		while (i < frontmatterLines.length) {
			const line = frontmatterLines[i]

			if (line.startsWith('name:')) {
				frontmatter.name = line.substring(5).trim().replace(/['"]/g, '')
			} else if (line.startsWith('description:')) {
				const value = line.substring(12).trim()
				// 处理多行描述
				if (value === '>' || value === '|' || value === '>-' || value === '|-') {
					const descLines = []
					i++
					while (i < frontmatterLines.length && (frontmatterLines[i].startsWith('  ') || frontmatterLines[i].startsWith('\t'))) {
						descLines.push(frontmatterLines[i].trim())
						i++
					}
					frontmatter.description = descLines.join(' ')
					continue
				} else {
					frontmatter.description = value.replace(/['"]/g, '')
				}
			} else if (line.startsWith('compatibility:')) {
				const value = line.substring(14).trim()
				frontmatter.compatibility = value.replace(/['"]/g, '')
			}

			i++
		}

		// 获取 body（frontmatter 之后的内容）
		const body = lines.slice(endIdx + 1).join('\n').trim()

		return {
			name: frontmatter.name,
			description: frontmatter.description,
			compatibility: frontmatter.compatibility,
			body,
		}
	}

	/**
	 * 扫描 skill 的资源文件
	 * @private
	 */
	async _scanResources(skillPath) {
		const resources = {
			scripts: [],
			references: [],
			assets: [],
		}

		try {
			// 扫描 scripts 目录
			const scriptsDir = path.join(skillPath, 'scripts')
			try {
				const scriptFiles = await fs.readdir(scriptsDir)
				resources.scripts = scriptFiles.map(f => path.join(scriptsDir, f))
			} catch {}

			// 扫描 references 目录
			const referencesDir = path.join(skillPath, 'references')
			try {
				const refFiles = await fs.readdir(referencesDir)
				resources.references = refFiles.map(f => path.join(referencesDir, f))
			} catch {}

			// 扫描 assets 目录
			const assetsDir = path.join(skillPath, 'assets')
			try {
				const assetFiles = await fs.readdir(assetsDir)
				resources.assets = assetFiles.map(f => path.join(assetsDir, f))
			} catch {}
		} catch (error) {
			console.warn('扫描资源失败:', error)
		}

		return resources
	}

	/**
	 * 加载所有 skills
	 * @returns {Promise<Array>} 加载的 skills 列表
	 */
	async loadAllSkills() {
		try {
			const entries = await fs.readdir(this.skillsDir, { withFileTypes: true })
			const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name)

			const loadedSkills = []

			for (const dirName of skillDirs) {
				try {
					const skillPath = path.join(this.skillsDir, dirName)
					const skill = await this.loadSkill(skillPath)
					loadedSkills.push(skill)
					console.log(`✓ 加载 skill: ${skill.name}`)
				} catch (error) {
					console.error(`✗ 加载 skill 失败 (${dirName}):`, error.message)
				}
			}

			return loadedSkills
		} catch (error) {
			throw new Error(`加载 skills 失败: ${error.message}`)
		}
	}

	/**
	 * 获取 skill
	 * @param {string} name - skill 名称
	 * @returns {Object|null} skill 对象
	 */
	getSkill(name) {
		return this.skills.get(name) || null
	}

	/**
	 * 列出所有 skills
	 * @returns {Array} skills 列表
	 */
	listSkills() {
		return Array.from(this.skills.values()).map(skill => ({
			name: skill.name,
			description: skill.description,
			compatibility: skill.compatibility,
			path: skill.path,
			resourceCount: {
				scripts: skill.resources.scripts.length,
				references: skill.resources.references.length,
				assets: skill.resources.assets.length,
			},
		}))
	}

	/**
	 * 搜索 skills
	 * @param {string} query - 搜索关键词
	 * @returns {Array} 匹配的 skills
	 */
	searchSkills(query) {
		const lowerQuery = query.toLowerCase()
		return this.listSkills().filter(skill => {
			return (
				skill.name.toLowerCase().includes(lowerQuery) ||
				skill.description.toLowerCase().includes(lowerQuery)
			)
		})
	}

	/**
	 * 读取 skill 的引用文件
	 * @param {string} skillName - skill 名称
	 * @param {string} referenceName - 引用文件名
	 * @returns {Promise<string>} 文件内容
	 */
	async readReference(skillName, referenceName) {
		const skill = this.getSkill(skillName)
		if (!skill) {
			throw new Error(`Skill 不存在: ${skillName}`)
		}

		const refPath = path.join(skill.path, 'references', referenceName)
		try {
			return await fs.readFile(refPath, 'utf-8')
		} catch (error) {
			throw new Error(`读取引用文件失败: ${error.message}`)
		}
	}

	/**
	 * 执行 skill 的脚本
	 * @param {string} skillName - skill 名称
	 * @param {string} scriptName - 脚本名称
	 * @param {Array} args - 脚本参数
	 * @returns {Promise<Object>} 执行结果
	 */
	async executeScript(skillName, scriptName, args = []) {
		const skill = this.getSkill(skillName)
		if (!skill) {
			throw new Error(`Skill 不存在: ${skillName}`)
		}

		const scriptPath = path.join(skill.path, 'scripts', scriptName)

		// 检查脚本是否存在
		try {
			await fs.access(scriptPath)
		} catch {
			throw new Error(`脚本不存在: ${scriptName}`)
		}

		// 根据脚本类型执行
		const ext = path.extname(scriptPath)

		if (ext === '.py') {
			// 执行 Python 脚本
			const { spawn } = await import('child_process')
			return new Promise((resolve) => {
				let stdout = ''
				let stderr = ''

				const process = spawn('python', [scriptPath, ...args])

				process.stdout.on('data', (data) => {
					stdout += data.toString()
				})

				process.stderr.on('data', (data) => {
					stderr += data.toString()
				})

				process.on('close', (code) => {
					resolve({
						success: code === 0,
						stdout,
						stderr,
						exitCode: code,
					})
				})

				process.on('error', (error) => {
					resolve({
						success: false,
						error: error.message,
					})
				})
			})
		} else if (ext === '.js') {
			// 执行 JavaScript 脚本
			try {
				const module = await import(scriptPath)
				const result = await module.default(...args)
				return {
					success: true,
					result,
				}
			} catch (error) {
				return {
					success: false,
					error: error.message,
				}
			}
		} else {
			throw new Error(`不支持的脚本类型: ${ext}`)
		}
	}

	/**
	 * 获取 skill 的完整上下文
	 * @param {string} skillName - skill 名称
	 * @param {Object} options - 选项
	 * @returns {Promise<Object>} skill 上下文
	 */
	async getSkillContext(skillName, options = {}) {
		const skill = this.getSkill(skillName)
		if (!skill) {
			throw new Error(`Skill 不存在: ${skillName}`)
		}

		const context = {
			name: skill.name,
			description: skill.description,
			body: skill.body,
			compatibility: skill.compatibility,
		}

		// 可选：加载引用文件
		if (options.includeReferences) {
			context.references = {}
			for (const refPath of skill.resources.references) {
				const refName = path.basename(refPath)
				try {
					context.references[refName] = await fs.readFile(refPath, 'utf-8')
				} catch (error) {
					console.warn(`读取引用文件失败 (${refName}):`, error.message)
				}
			}
		}

		// 可选：列出脚本
		if (options.includeScripts) {
			context.scripts = skill.resources.scripts.map(s => path.basename(s))
		}

		return context
	}

	/**
	 * 重新加载 skill
	 * @param {string} skillName - skill 名称
	 * @returns {Promise<Object>} 重新加载的 skill
	 */
	async reloadSkill(skillName) {
		const skill = this.getSkill(skillName)
		if (!skill) {
			throw new Error(`Skill 不存在: ${skillName}`)
		}

		return await this.loadSkill(skill.path)
	}

	/**
	 * 卸载 skill
	 * @param {string} skillName - skill 名称
	 * @returns {boolean} 是否成功卸载
	 */
	unloadSkill(skillName) {
		return this.skills.delete(skillName)
	}

	/**
	 * 验证 skill 格式
	 * @param {string} skillPath - skill 目录路径
	 * @returns {Promise<Object>} 验证结果
	 */
	async validateSkill(skillPath) {
		const errors = []
		const warnings = []

		try {
			// 检查 SKILL.md 是否存在
			const skillMdPath = path.join(skillPath, 'SKILL.md')
			try {
				await fs.access(skillMdPath)
			} catch {
				errors.push('SKILL.md 文件不存在')
				return { valid: false, errors, warnings }
			}

			// 解析 SKILL.md
			const content = await fs.readFile(skillMdPath, 'utf-8')
			const { name, description, body } = this._parseSkillMd(content)

			// 验证必需字段
			if (!name) {
				errors.push('缺少 name 字段')
			}
			if (!description) {
				errors.push('缺少 description 字段')
			}
			if (!body || body.length < 50) {
				warnings.push('skill 内容过短')
			}

			// 检查 body 长度
			const lineCount = body.split('\n').length
			if (lineCount > 500) {
				warnings.push(`skill 内容过长 (${lineCount} 行)，建议拆分到引用文件`)
			}

			return {
				valid: errors.length === 0,
				errors,
				warnings,
				info: {
					name,
					description: description?.substring(0, 100),
					bodyLines: lineCount,
				},
			}
		} catch (error) {
			errors.push(`验证失败: ${error.message}`)
			return { valid: false, errors, warnings }
		}
	}
}

export default SkillRunner
