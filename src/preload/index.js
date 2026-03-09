import { contextBridge, ipcRenderer, ipcMain } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

//大模型调用
const llmAPI = {
	hi: () => ipcRenderer.invoke('llm:hi'),
	testLLMClient: () => ipcRenderer.invoke('llm:testLLMClient'),
	testLLMStream: () => ipcRenderer.invoke('llm:testLLMStream'),
	testOnlineLLMClient: () => ipcRenderer.invoke('llm:testOnlineLLMClient'),
	
	plan: (...params) => ipcRenderer.invoke('planner:plan', ...params),
}

// Custom APIs for renderer
const api = {
	llmAPI,
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI)
		contextBridge.exposeInMainWorld('api', api)
	} catch (error) {
		console.error(error)
	}
} else {
	window.electron = electronAPI
	window.api = api
}
