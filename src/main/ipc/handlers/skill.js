import { ipcMain } from 'electron'
import SkillRunner from '../../app/skills/skill-runner.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let skillRunnerInstance = null

/**
 * 获取或创建 SkillRunner 实例
 */
function getSkillRunner(config) {
	if (!skillRunnerInstance || config) {
		const skillsDir = config?.skillsDir || path.join(__dirname, '../../app/skills')
		skillRunnerInstance = new SkillRunner({ skillsDir })
	}
	return skillRunnerInstance
}

/**
 * 注册 Skills 相关的 IPC 处理器
 */
export function registerSkillHandlers() {
	// 加载单个 skill
	ipcMain.handle('skill:load', async (event, { skillPath }) => {
		try {
			const runner = getSkillRunner()
			const skill = await runner.loadSkill(skillPath)
			return { success: true, data: skill }
		} catch (error) {
			console.error('加载 skill 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 加载所有 skills
	ipcMain.handle('skill:loadAll', async (event, config) => {
		try {
			const runner = getSkillRunner(config)
			const skills = await runner.loadAllSkills()
			return { success: true, data: skills }
		} catch (error) {
			console.error('加载所有 skills 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取 skill
	ipcMain.handle('skill:get', async (event, { name }) => {
		try {
			const runner = getSkillRunner()
			const skill = runner.getSkill(name)
			if (!skill) {
				return { success: false, error: 'Skill 不存在' }
			}
			return { success: true, data: skill }
		} catch (error) {
			console.error('获取 skill 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 列出所有 skills
	ipcMain.handle('skill:list', async () => {
		try {
			const runner = getSkillRunner()
			const skills = runner.listSkills()
			return { success: true, data: skills }
		} catch (error) {
			console.error('列出 skills 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 搜索 skills
	ipcMain.handle('skill:search', async (event, { query }) => {
		try {
			const runner = getSkillRunner()
			const skills = runner.searchSkills(query)
			return { success: true, data: skills }
		} catch (error) {
			console.error('搜索 skills 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 读取引用文件
	ipcMain.handle('skill:readReference', async (event, { skillName, referenceName }) => {
		try {
			const runner = getSkillRunner()
			const content = await runner.readReference(skillName, referenceName)
			return { success: true, data: content }
		} catch (error) {
			console.error('读取引用文件失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 执行脚本
	ipcMain.handle('skill:executeScript', async (event, { skillName, scriptName, args }) => {
		try {
			const runner = getSkillRunner()
			const result = await runner.executeScript(skillName, scriptName, args)
			return { success: true, data: result }
		} catch (error) {
			console.error('执行脚本失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取 skill 上下文
	ipcMain.handle('skill:getContext', async (event, { skillName, options }) => {
		try {
			const runner = getSkillRunner()
			const context = await runner.getSkillContext(skillName, options)
			return { success: true, data: context }
		} catch (error) {
			console.error('获取 skill 上下文失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 重新加载 skill
	ipcMain.handle('skill:reload', async (event, { skillName }) => {
		try {
			const runner = getSkillRunner()
			const skill = await runner.reloadSkill(skillName)
			return { success: true, data: skill }
		} catch (error) {
			console.error('重新加载 skill 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 卸载 skill
	ipcMain.handle('skill:unload', async (event, { skillName }) => {
		try {
			const runner = getSkillRunner()
			const result = runner.unloadSkill(skillName)
			return { success: result }
		} catch (error) {
			console.error('卸载 skill 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 验证 skill
	ipcMain.handle('skill:validate', async (event, { skillPath }) => {
		try {
			const runner = getSkillRunner()
			const result = await runner.validateSkill(skillPath)
			return { success: true, data: result }
		} catch (error) {
			console.error('验证 skill 失败:', error)
			return { success: false, error: error.message }
		}
	})

	console.log('Skills IPC 处理器已注册')
}
