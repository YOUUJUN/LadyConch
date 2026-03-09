import { v1 as uuidv1 } from 'uuid'
import SkillRunner from '../skills/skill-runner.js'

/**
 * 任务规划器 - 类似 OpenClaw 的任务分解和执行模块
 */
class TaskPlanner {
	constructor(llmClient, config = {}) {
		this.llmClient = llmClient
		this.tasks = new Map() // 任务存储
		this.executionHistory = [] // 执行历史
		this.skillRunner = new SkillRunner(config.skillsConfig)
		this.skillsLoaded = false
	}

	/**
	 * 确保 skills 已加载
	 * @private
	 */
	async ensureSkillsLoaded() {
		if (!this.skillsLoaded) {
			try {
				await this.skillRunner.loadAllSkills()
				this.skillsLoaded = true
			} catch (error) {
				console.warn('加载 skills 失败:', error.message)
			}
		}
	}

	/**
	 * 查找适合任务的 skills
	 * @param {string} goal - 目标描述
	 * @returns {Promise<Array>} 匹配的 skills
	 */
	async findRelevantSkills(goal) {
		await this.ensureSkillsLoaded()

		// 提取关键词进行搜索
		const keywords = goal.toLowerCase().match(/\b\w+\b/g) || []
		const relevantSkills = []

		for (const keyword of keywords) {
			const results = this.skillRunner.searchSkills(keyword)
			relevantSkills.push(...results)
		}

		// 去重
		const uniqueSkills = Array.from(
			new Map(relevantSkills.map(s => [s.name, s])).values()
		)

		return uniqueSkills
	}

	/**
	 * 使用 LLM 判断是否需要创建新 skill
	 * @param {string} goal - 目标描述
	 * @param {Array} availableSkills - 可用的 skills
	 * @returns {Promise<Object>} 判断结果
	 */
	async shouldCreateNewSkill(goal, availableSkills) {
		const systemPrompt = `你是一个 skill 评估助手。判断现有 skills 是否足以完成目标。

可用的 skills：
${availableSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}

如果现有 skills 不足以完成目标，返回 JSON：
{
  "needNewSkill": true,
  "reason": "原因说明",
  "skillName": "建议的 skill 名称",
  "skillDescription": "skill 功能描述"
}

如果现有 skills 足够，返回：
{
  "needNewSkill": false,
  "recommendedSkills": ["skill1", "skill2"]
}`

		this.llmClient.resetContext(systemPrompt)
		this.llmClient.addMessage('user', `目标：${goal}`)

		const response = await this.llmClient.chat()

		try {
			const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
			                  response.match(/\{[\s\S]*\}/)
			if (jsonMatch) {
				return JSON.parse(jsonMatch[1] || jsonMatch[0])
			}
			return JSON.parse(response)
		} catch (error) {
			console.error('解析 skill 评估结果失败:', error)
			return { needNewSkill: false, recommendedSkills: [] }
		}
	}

	/**
	 * 调用 skill-creator 创建新 skill
	 * @param {string} skillName - skill 名称
	 * @param {string} skillDescription - skill 描述
	 * @param {string} goal - 目标描述
	 * @returns {Promise<Object>} 创建结果
	 */
	async createNewSkill(skillName, skillDescription, goal) {
		await this.ensureSkillsLoaded()

		const skillCreator = this.skillRunner.getSkill('skill-creator')
		if (!skillCreator) {
			throw new Error('skill-creator 不可用，无法创建新 skill')
		}

		// 获取 skill-creator 的完整上下文
		const context = await this.skillRunner.getSkillContext('skill-creator', {
			includeReferences: true,
			includeScripts: true,
		})

		// 使用 LLM 生成 skill
		const systemPrompt = `${context.body}

你现在需要创建一个新的 skill。

Skill 信息：
- 名称：${skillName}
- 描述：${skillDescription}
- 用途：${goal}

请生成完整的 SKILL.md 内容，包括 frontmatter 和详细指令。`

		this.llmClient.resetContext(systemPrompt)
		this.llmClient.addMessage('user', '请生成 SKILL.md 内容')

		const skillContent = await this.llmClient.chat()

		return {
			name: skillName,
			description: skillDescription,
			content: skillContent,
			createdAt: Date.now(),
		}
	}

	/**
	 * 分解复杂任务为子任务（增强版：支持 skills）
	 * @param {string} goal - 目标描述
	 * @param {Object} context - 上下文信息
	 * @returns {Promise<Object>} 任务计划
	 */
	async planTask(goal, context = {}) {
		const planId = uuidv1()

		// 1. 查找相关的 skills
		const relevantSkills = await this.findRelevantSkills(goal)
		console.log(`找到 ${relevantSkills.length} 个相关 skills`)

		// 2. 判断是否需要创建新 skill
		const skillEvaluation = await this.shouldCreateNewSkill(goal, relevantSkills)

		let newSkill = null
		if (skillEvaluation.needNewSkill) {
			console.log(`需要创建新 skill: ${skillEvaluation.skillName}`)
			try {
				newSkill = await this.createNewSkill(
					skillEvaluation.skillName,
					skillEvaluation.skillDescription,
					goal
				)
				console.log(`新 skill 已创建: ${newSkill.name}`)
			} catch (error) {
				console.error('创建新 skill 失败:', error.message)
			}
		}

		// 3. 准备 skills 信息用于规划
		const availableSkills = newSkill
			? [...relevantSkills, { name: newSkill.name, description: newSkill.description }]
			: relevantSkills

		const skillsInfo = availableSkills.length > 0
			? `\n\n可用的 Skills：\n${availableSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n\n在制定计划时，优先考虑使用这些 skills 来完成任务。`
			: ''

		const systemPrompt = `你是一个任务规划助手。你的职责是将复杂目标分解为可执行的子任务。

规则：
1. 将目标分解为清晰、可执行的步骤
2. 每个子任务应该是原子性的、可验证的
3. 识别任务之间的依赖关系
4. 为每个任务分配优先级
5. 优先使用可用的 skills 来完成任务
6. 输出 JSON 格式的任务计划${skillsInfo}

输出格式：
{
  "goal": "目标描述",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "详细描述",
      "dependencies": [],
      "priority": "high|medium|low",
      "estimatedTime": "预估时间",
      "tools": ["需要的工具"],
      "skill": "使用的 skill 名称（如果适用）"
    }
  ],
  "executionOrder": ["task-1", "task-2", ...]
}`

		this.llmClient.resetContext(systemPrompt)
		this.llmClient.addMessage('user', `请为以下目标制定任务计划：

目标：${goal}

上下文信息：
${JSON.stringify(context, null, 2)}`)

		const response = await this.llmClient.chat()

		let plan
		try {
			// 尝试从响应中提取 JSON
			const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
			                  response.match(/\{[\s\S]*\}/)
			if (jsonMatch) {
				plan = JSON.parse(jsonMatch[1] || jsonMatch[0])
			} else {
				plan = JSON.parse(response)
			}
		} catch (error) {
			console.error('解析任务计划失败:', error)
			throw new Error('无法解析任务计划')
		}

		// 保存任务计划
		plan.id = planId
		plan.createdAt = Date.now()
		plan.status = 'pending'
		plan.usedSkills = availableSkills.map(s => s.name)
		plan.newSkill = newSkill
		this.tasks.set(planId, plan)

		return plan
	}

	/**
	 * 执行任务计划
	 * @param {string} planId - 计划ID
	 * @param {Function} onProgress - 进度回调
	 * @returns {Promise<Object>} 执行结果
	 */
	async executePlan(planId, onProgress) {
		const plan = this.tasks.get(planId)
		if (!plan) {
			throw new Error(`任务计划不存在: ${planId}`)
		}

		plan.status = 'executing'
		const results = []
		const completedTasks = new Set()

		for (const taskId of plan.executionOrder) {
			const task = plan.tasks.find(t => t.id === taskId)
			if (!task) continue

			// 检查依赖是否完成
			const dependenciesMet = task.dependencies.every(dep => completedTasks.has(dep))
			if (!dependenciesMet) {
				results.push({
					taskId,
					status: 'skipped',
					reason: '依赖未满足',
				})
				continue
			}

			// 执行任务
			onProgress?.({ taskId, status: 'running', task })

			try {
				const result = await this.executeTask(task, plan.goal)
				results.push({
					taskId,
					status: 'completed',
					result,
				})
				completedTasks.add(taskId)
				onProgress?.({ taskId, status: 'completed', result })
			} catch (error) {
				results.push({
					taskId,
					status: 'failed',
					error: error.message,
				})
				onProgress?.({ taskId, status: 'failed', error: error.message })

				// 失败后是否继续执行
				if (task.priority === 'high') {
					plan.status = 'failed'
					break
				}
			}
		}

		plan.status = completedTasks.size === plan.tasks.length ? 'completed' : 'partial'
		plan.completedAt = Date.now()
		plan.results = results

		this.executionHistory.push({
			planId,
			completedAt: Date.now(),
			status: plan.status,
			results,
		})

		return {
			planId,
			status: plan.status,
			results,
			completedTasks: completedTasks.size,
			totalTasks: plan.tasks.length,
		}
	}

	/**
	 * 执行单个任务（增强版：支持 skills）
	 * @param {Object} task - 任务对象
	 * @param {string} goal - 总体目标
	 * @returns {Promise<Object>} 执行结果
	 */
	async executeTask(task, goal) {
		// 如果任务指定了 skill，尝试使用 skill 的上下文
		let skillContext = ''
		if (task.skill) {
			try {
				await this.ensureSkillsLoaded()
				const context = await this.skillRunner.getSkillContext(task.skill, {
					includeReferences: true,
				})
				skillContext = `\n\n使用 Skill: ${task.skill}\n${context.body}\n`
			} catch (error) {
				console.warn(`加载 skill ${task.skill} 失败:`, error.message)
			}
		}

		const systemPrompt = `你是一个任务执行助手。你需要完成指定的任务。

总体目标：${goal}

当前任务：
- 标题：${task.title}
- 描述：${task.description}
- 可用工具：${task.tools.join(', ')}${skillContext}

请执行此任务并返回结果。如果需要使用工具，请调用相应的工具函数。`

		this.llmClient.resetContext(systemPrompt)
		this.llmClient.addMessage('user', '请执行任务并报告结果')

		const response = await this.llmClient.chat()

		return {
			output: response,
			timestamp: Date.now(),
			usedSkill: task.skill || null,
		}
	}

	/**
	 * 获取任务计划
	 * @param {string} planId - 计划ID
	 * @returns {Object} 任务计划
	 */
	getPlan(planId) {
		return this.tasks.get(planId)
	}

	/**
	 * 列出所有任务计划
	 * @returns {Array} 任务计划列表
	 */
	listPlans() {
		return Array.from(this.tasks.values())
	}

	/**
	 * 获取执行历史
	 * @returns {Array} 执行历史
	 */
	getHistory() {
		return this.executionHistory
	}

	/**
	 * 重新规划任务（基于执行反馈）
	 * @param {string} planId - 原计划ID
	 * @param {string} feedback - 反馈信息
	 * @returns {Promise<Object>} 新的任务计划
	 */
	async replan(planId, feedback) {
		const originalPlan = this.tasks.get(planId)
		if (!originalPlan) {
			throw new Error(`任务计划不存在: ${planId}`)
		}

		const context = {
			originalPlan,
			feedback,
			executionResults: originalPlan.results,
		}

		return await this.planTask(originalPlan.goal, context)
	}

	/**
	 * 获取所有可用的 skills
	 * @returns {Promise<Array>} skills 列表
	 */
	async getAvailableSkills() {
		await this.ensureSkillsLoaded()
		return this.skillRunner.listSkills()
	}

	/**
	 * 搜索 skills
	 * @param {string} query - 搜索关键词
	 * @returns {Promise<Array>} 匹配的 skills
	 */
	async searchSkills(query) {
		await this.ensureSkillsLoaded()
		return this.skillRunner.searchSkills(query)
	}

	/**
	 * 获取 skill 详情
	 * @param {string} skillName - skill 名称
	 * @returns {Promise<Object>} skill 详情
	 */
	async getSkillDetails(skillName) {
		await this.ensureSkillsLoaded()
		return await this.skillRunner.getSkillContext(skillName, {
			includeReferences: true,
			includeScripts: true,
		})
	}

	/**
	 * 重新加载 skills
	 * @returns {Promise<Array>} 加载的 skills
	 */
	async reloadSkills() {
		this.skillsLoaded = false
		await this.ensureSkillsLoaded()
		return this.skillRunner.listSkills()
	}
}

export default TaskPlanner
