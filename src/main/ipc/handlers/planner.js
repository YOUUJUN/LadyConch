import { ipcMain } from 'electron'
import LLMClient from '../../app/llm/llm-client.js'
import TaskPlanner from '../../app/planner/task-planner.js'

let plannerInstance = null

/**
 * 获取或创建 TaskPlanner 实例
 */
function getPlannerInstance(config) {
	if (!plannerInstance || config) {
		const llmClient = new LLMClient(
			config || {
				provider: 'ollama',
				modelId: 'qwen2.5:7b',
				baseUrl: 'http://192.168.31.183:11434/v1',
				apiKey: 'ollama',
				temperature: 0.7,
				maxTokens: 2048,
			},
		)
		plannerInstance = new TaskPlanner(llmClient, {
			skillsConfig: config?.skillsConfig,
		})
	}
	return plannerInstance
}

/**
 * 注册任务规划相关的 IPC 处理器
 */
export function registerPlannerHandlers() {
	// 创建任务计划
	ipcMain.handle('planner:plan', async (event, { goal, context, config }) => {
		try {
			const planner = getPlannerInstance(config)
			const plan = await planner.planTask(goal, context)
			return { success: true, data: plan }
		} catch (error) {
			console.error('创建任务计划失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 执行任务计划
	ipcMain.handle('planner:execute', async (event, { planId }) => {
		try {
			const planner = getPlannerInstance()

			// 通过事件发送进度更新
			const onProgress = (progress) => {
				event.sender.send('planner:progress', progress)
			}

			const result = await planner.executePlan(planId, onProgress)
			return { success: true, data: result }
		} catch (error) {
			console.error('执行任务计划失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取任务计划
	ipcMain.handle('planner:get', async (event, { planId }) => {
		try {
			const planner = getPlannerInstance()
			const plan = planner.getPlan(planId)
			if (!plan) {
				return { success: false, error: '任务计划不存在' }
			}
			return { success: true, data: plan }
		} catch (error) {
			console.error('获取任务计划失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 列出所有任务计划
	ipcMain.handle('planner:list', async () => {
		try {
			const planner = getPlannerInstance()
			const plans = planner.listPlans()
			return { success: true, data: plans }
		} catch (error) {
			console.error('列出任务计划失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取执行历史
	ipcMain.handle('planner:history', async () => {
		try {
			const planner = getPlannerInstance()
			const history = planner.getHistory()
			return { success: true, data: history }
		} catch (error) {
			console.error('获取执行历史失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 重新规划任务
	ipcMain.handle('planner:replan', async (event, { planId, feedback, config }) => {
		try {
			const planner = getPlannerInstance(config)
			const newPlan = await planner.replan(planId, feedback)
			return { success: true, data: newPlan }
		} catch (error) {
			console.error('重新规划任务失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取可用的 skills
	ipcMain.handle('planner:skills:list', async () => {
		try {
			const planner = getPlannerInstance()
			const skills = await planner.getAvailableSkills()
			return { success: true, data: skills }
		} catch (error) {
			console.error('获取 skills 列表失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 搜索 skills
	ipcMain.handle('planner:skills:search', async (event, { query }) => {
		try {
			const planner = getPlannerInstance()
			const skills = await planner.searchSkills(query)
			return { success: true, data: skills }
		} catch (error) {
			console.error('搜索 skills 失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 获取 skill 详情
	ipcMain.handle('planner:skills:get', async (event, { skillName }) => {
		try {
			const planner = getPlannerInstance()
			const skill = await planner.getSkillDetails(skillName)
			return { success: true, data: skill }
		} catch (error) {
			console.error('获取 skill 详情失败:', error)
			return { success: false, error: error.message }
		}
	})

	// 重新加载 skills
	ipcMain.handle('planner:skills:reload', async () => {
		try {
			const planner = getPlannerInstance()
			const skills = await planner.reloadSkills()
			return { success: true, data: skills }
		} catch (error) {
			console.error('重新加载 skills 失败:', error)
			return { success: false, error: error.message }
		}
	})

	console.log('任务规划 IPC 处理器已注册')
}
