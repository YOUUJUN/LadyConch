import LLMClient from '../llm/llm-client.js'
import TaskPlanner from './task-planner.js'

/**
 * 示例：使用增强的 TaskPlanner
 */
async function exampleUsage() {
	// 1. 创建 LLM 客户端
	const llmClient = new LLMClient({
		provider: 'ollama',
		modelId: 'qwen2.5:7b',
		baseUrl: 'http://192.168.31.183:11434/v1',
		apiKey: 'ollama',
		temperature: 0.7,
		maxTokens: 2048,
	})

	// 2. 创建 TaskPlanner 实例
	const planner = new TaskPlanner(llmClient)

	// 3. 定义目标
	const goal = '创建一个用户认证系统，包括登录、注册和密码重置功能'

	console.log('=== 开始任务规划 ===')
	console.log(`目标: ${goal}\n`)

	try {
		// 4. 创建任务计划（会自动查询和使用 skills）
		const plan = await planner.planTask(goal, {
			platform: 'web',
			framework: 'express',
		})

		console.log('=== 任务计划 ===')
		console.log(`计划 ID: ${plan.id}`)
		console.log(`状态: ${plan.status}`)
		console.log(`使用的 Skills: ${plan.usedSkills.join(', ') || '无'}`)

		if (plan.newSkill) {
			console.log(`\n新创建的 Skill: ${plan.newSkill.name}`)
			console.log(`描述: ${plan.newSkill.description}`)
		}

		console.log('\n任务列表:')
		plan.tasks.forEach((task, index) => {
			console.log(`\n${index + 1}. ${task.title}`)
			console.log(`   ID: ${task.id}`)
			console.log(`   描述: ${task.description}`)
			console.log(`   优先级: ${task.priority}`)
			console.log(`   预估时间: ${task.estimatedTime}`)
			console.log(`   工具: ${task.tools.join(', ')}`)
			if (task.skill) {
				console.log(`   使用 Skill: ${task.skill}`)
			}
			if (task.dependencies.length > 0) {
				console.log(`   依赖: ${task.dependencies.join(', ')}`)
			}
		})

		console.log(`\n执行顺序: ${plan.executionOrder.join(' -> ')}`)

		// 5. 查询可用的 skills
		console.log('\n=== 可用的 Skills ===')
		const skills = await planner.getAvailableSkills()
		skills.forEach(skill => {
			console.log(`- ${skill.name}: ${skill.description}`)
		})

		// 6. 搜索特定的 skills
		console.log('\n=== 搜索 Skills (关键词: create) ===')
		const searchResults = await planner.searchSkills('create')
		searchResults.forEach(skill => {
			console.log(`- ${skill.name}: ${skill.description}`)
		})

		// 7. 执行任务计划（可选）
		// console.log('\n=== 执行任务计划 ===')
		// const result = await planner.executePlan(plan.id, (progress) => {
		// 	console.log(`任务 ${progress.taskId}: ${progress.status}`)
		// })
		// console.log(`执行完成: ${result.completedTasks}/${result.totalTasks} 个任务`)

	} catch (error) {
		console.error('错误:', error.message)
		console.error(error.stack)
	}
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
	exampleUsage()
}

export default exampleUsage

