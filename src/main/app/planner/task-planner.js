import { v1 as uuidv1 } from 'uuid'

/**
 * 任务规划器 - 类似 OpenClaw 的任务分解和执行模块
 */
class TaskPlanner {
	constructor(llmClient) {
		this.llmClient = llmClient
		this.tasks = new Map() // 任务存储
		this.executionHistory = [] // 执行历史
	}

	/**
	 * 分解复杂任务为子任务
	 * @param {string} goal - 目标描述
	 * @param {Object} context - 上下文信息
	 * @returns {Promise<Object>} 任务计划
	 */
	async planTask(goal, context = {}) {
		const planId = uuidv1()

		const systemPrompt = `你是一个任务规划助手。你的职责是将复杂目标分解为可执行的子任务。

规则：
1. 将目标分解为清晰、可执行的步骤
2. 每个子任务应该是原子性的、可验证的
3. 识别任务之间的依赖关系
4. 为每个任务分配优先级
5. 输出 JSON 格式的任务计划

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
      "tools": ["需要的工具"]
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
	 * 执行单个任务
	 * @param {Object} task - 任务对象
	 * @param {string} goal - 总体目标
	 * @returns {Promise<Object>} 执行结果
	 */
	async executeTask(task, goal) {
		const systemPrompt = `你是一个任务执行助手。你需要完成指定的任务。

总体目标：${goal}

当前任务：
- 标题：${task.title}
- 描述：${task.description}
- 可用工具：${task.tools.join(', ')}

请执行此任务并返回结果。如果需要使用工具，请调用相应的工具函数。`

		this.llmClient.resetContext(systemPrompt)
		this.llmClient.addMessage('user', '请执行任务并报告结果')

		const response = await this.llmClient.chat()

		return {
			output: response,
			timestamp: Date.now(),
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
}

export default TaskPlanner
