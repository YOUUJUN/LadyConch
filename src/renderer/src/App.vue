<script setup>
import Versions from './components/Versions.vue'

const ipcHandle = () => {
	console.log('llmAPI', window.api.llmAPI)
	window.api.llmAPI.testLLMClient()
}

async function testPlan() {
	// 创建任务计划（自动使用 skills）
	const result = await window.api.llmAPI.plan({
		goal: '开发一个用户登录功能',
		context: {
			framework: 'Vue 3',
			backend: 'Node.js',
		},
	})

	if (result.success) {
		const plan = result.data
		console.log('任务计划:', plan)
		console.log('使用的 Skills:', plan.usedSkills)
		console.log('新创建的 Skill:', plan.newSkill)

		// 执行任务计划
		const execResult = await window.api.planner.execute({
			planId: plan.id,
		})

		console.log('执行结果:', execResult)
	}
}
</script>

<template>
	<img alt="logo" class="logo" src="./assets/electron.svg" />
	<div class="creator">Powered by electron-vite</div>
	<div class="text">
		Build an Electron app with
		<span class="vue">Vue</span>
	</div>
	<p class="tip">
		Please try pressing
		<code>F12</code>
		to open the devTool
	</p>
	<div class="actions">
		<div class="action">
			<a href="https://electron-vite.org/" target="_blank" rel="noreferrer">Documentation</a>
		</div>
		<div class="action">
			<a target="_blank" rel="noreferrer" @click="testPlan">Send IPC</a>
		</div>
	</div>
	<Versions />
</template>
