import path from 'path'
import { app } from 'electron'

// 状态目录：使用 Electron 的 userData 路径
const STATE_DIR = app ? app.getPath('userData') : path.join(process.env.HOME || process.env.USERPROFILE || '', '.ladyconch')

export const DEFAULT_SANDBOX_WORKSPACE_ROOT = path.join(STATE_DIR, 'sandboxes')
export const SANDBOX_STATE_DIR = path.join(STATE_DIR, 'sandbox')
export const SANDBOX_REGISTRY_PATH = path.join(SANDBOX_STATE_DIR, 'containers.json')

export const DEFAULT_SANDBOX_IMAGE = 'ladyconch-sandbox:latest'
export const DEFAULT_SANDBOX_CONTAINER_PREFIX = 'ladyconch-sbx-'
export const DEFAULT_SANDBOX_WORKDIR = '/workspace'
export const DEFAULT_SANDBOX_IDLE_HOURS = 24
export const DEFAULT_SANDBOX_MAX_AGE_DAYS = 7

export const DEFAULT_TOOL_ALLOW = [
  'exec',
  'read',
  'write',
  'edit',
]

export const DEFAULT_TOOL_DENY = [
  'browser',
  'network',
]
