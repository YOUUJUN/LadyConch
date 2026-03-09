# Claude Skills 运行模块

加载和运行 Claude Skills 的模块，支持 skill-creator 等标准 skill 格式。

## 功能特性

- **Skill 加载**: 解析 SKILL.md 文件和 frontmatter
- **资源管理**: 自动扫描 scripts、references、assets 目录
- **脚本执行**: 支持执行 Python 和 JavaScript 脚本
- **引用读取**: 按需加载引用文档
- **搜索功能**: 按名称或描述搜索 skills
- **验证功能**: 验证 skill 格式是否正确
- **热重载**: 支持重新加载 skill

## Skill 目录结构

```
skill-name/
├── SKILL.md (必需)
│   ├── YAML frontmatter (name, description 必需)
│   └── Markdown 指令
└── 可选资源
    ├── scripts/    - 可执行脚本
    ├── references/ - 引用文档
    └── assets/     - 资源文件
```

## SKILL.md 格式

```markdown
---
name: skill-name
description: >
  Skill 的描述，说明何时触发以及做什么。
  这是触发机制的主要依据。
compatibility: 可选的兼容性说明
---

# Skill 标题

Skill 的详细说明和指令...

## 使用方法

...
```

## 使用示例

### 基础使用

```javascript
import SkillRunner from './skill-runner.js'

// 创建实例
const runner = new SkillRunner({
  skillsDir: './src/main/app/skills'
})

// 加载所有 skills
const skills = await runner.loadAllSkills()
console.log(`加载了 ${skills.length} 个 skills`)

// 获取特定 skill
const skillCreator = runner.getSkill('skill-creator')
console.log(skillCreator.description)

// 列出所有 skills
const skillList = runner.listSkills()
skillList.forEach(skill => {
  console.log(`${skill.name}: ${skill.description}`)
})

// 搜索 skills
const results = runner.searchSkills('create')
console.log(`找到 ${results.length} 个匹配的 skills`)

// 读取引用文件
const schema = await runner.readReference('skill-creator', 'schemas.md')
console.log(schema)

// 执行脚本
const result = await runner.executeScript(
  'skill-creator',
  'quick_validate.py',
  ['./my-skill']
)
console.log(result.stdout)

// 获取完整上下文
const context = await runner.getSkillContext('skill-creator', {
  includeReferences: true,
  includeScripts: true
})
console.log(context)

// 验证 skill
const validation = await runner.validateSkill('./my-new-skill')
if (!validation.valid) {
  console.error('验证失败:', validation.errors)
}

// 重新加载 skill
await runner.reloadSkill('skill-creator')

// 卸载 skill
runner.unloadSkill('skill-creator')
```

### 在渲染进程中使用

```javascript
// 加载所有 skills
const result = await window.api.skill.loadAll()
if (result.success) {
  console.log('Skills:', result.data)
}

// 获取特定 skill
const skill = await window.api.skill.get({ name: 'skill-creator' })
if (skill.success) {
  console.log('Skill:', skill.data)
}

// 列出所有 skills
const list = await window.api.skill.list()
console.log('Skills:', list.data)

// 搜索 skills
const search = await window.api.skill.search({ query: 'create' })
console.log('搜索结果:', search.data)

// 读取引用文件
const ref = await window.api.skill.readReference({
  skillName: 'skill-creator',
  referenceName: 'schemas.md'
})
console.log('引用内容:', ref.data)

// 执行脚本
const exec = await window.api.skill.executeScript({
  skillName: 'skill-creator',
  scriptName: 'quick_validate.py',
  args: ['./my-skill']
})
console.log('执行结果:', exec.data)

// 获取上下文
const ctx = await window.api.skill.getContext({
  skillName: 'skill-creator',
  options: {
    includeReferences: true,
    includeScripts: true
  }
})
console.log('上下文:', ctx.data)

// 验证 skill
const validate = await window.api.skill.validate({
  skillPath: './my-new-skill'
})
if (!validate.data.valid) {
  console.error('验证失败:', validate.data.errors)
}

// 重新加载
await window.api.skill.reload({ skillName: 'skill-creator' })

// 卸载
await window.api.skill.unload({ skillName: 'skill-creator' })
```

## API 接口

### SkillRunner 类

#### `constructor(config)`
创建 SkillRunner 实例
- `skillsDir`: skills 目录路径

#### `loadSkill(skillPath)`
加载单个 skill
- 返回: `Promise<Object>` skill 对象

#### `loadAllSkills()`
加载所有 skills
- 返回: `Promise<Array>` skills 数组

#### `getSkill(name)`
获取已加载的 skill
- 返回: `Object|null` skill 对象

#### `listSkills()`
列出所有已加载的 skills
- 返回: `Array` skills 摘要列表

#### `searchSkills(query)`
搜索 skills
- 返回: `Array` 匹配的 skills

#### `readReference(skillName, referenceName)`
读取引用文件
- 返回: `Promise<string>` 文件内容

#### `executeScript(skillName, scriptName, args)`
执行脚本
- 返回: `Promise<Object>` 执行结果

#### `getSkillContext(skillName, options)`
获取完整上下文
- `options.includeReferences`: 是否包含引用文件
- `options.includeScripts`: 是否包含脚本列表
- 返回: `Promise<Object>` skill 上下文

#### `reloadSkill(skillName)`
重新加载 skill
- 返回: `Promise<Object>` 重新加载的 skill

#### `unloadSkill(skillName)`
卸载 skill
- 返回: `boolean` 是否成功

#### `validateSkill(skillPath)`
验证 skill 格式
- 返回: `Promise<Object>` 验证结果

### IPC 接口

- `skill:load` - 加载单个 skill
- `skill:loadAll` - 加载所有 skills
- `skill:get` - 获取 skill
- `skill:list` - 列出 skills
- `skill:search` - 搜索 skills
- `skill:readReference` - 读取引用文件
- `skill:executeScript` - 执行脚本
- `skill:getContext` - 获取上下文
- `skill:reload` - 重新加载
- `skill:unload` - 卸载
- `skill:validate` - 验证

## Skill 对象结构

```javascript
{
  name: 'skill-creator',
  description: 'Create new skills...',
  compatibility: 'optional compatibility info',
  body: 'Markdown content...',
  path: '/path/to/skill',
  resources: {
    scripts: ['/path/to/script1.py', ...],
    references: ['/path/to/ref1.md', ...],
    assets: ['/path/to/asset1.html', ...]
  },
  loadedAt: 1234567890
}
```

## 验证结果格式

```javascript
{
  valid: true,
  errors: [],
  warnings: ['skill 内容过长 (600 行)'],
  info: {
    name: 'skill-name',
    description: 'Skill description...',
    bodyLines: 600
  }
}
```

## 脚本执行结果

### Python 脚本

```javascript
{
  success: true,
  stdout: '脚本输出',
  stderr: '',
  exitCode: 0
}
```

### JavaScript 脚本

```javascript
{
  success: true,
  result: '返回值'
}
```

## 使用场景

### 1. Skill 管理界面

```javascript
// 加载并显示所有 skills
const skills = await window.api.skill.loadAll()
skills.data.forEach(skill => {
  displaySkill(skill)
})

// 搜索功能
const searchResults = await window.api.skill.search({ query: userInput })
displayResults(searchResults.data)
```

### 2. Skill 编辑器

```javascript
// 加载 skill 进行编辑
const skill = await window.api.skill.get({ name: 'my-skill' })
editor.setValue(skill.data.body)

// 保存后重新加载
await saveSkill()
await window.api.skill.reload({ skillName: 'my-skill' })
```

### 3. Skill 验证工具

```javascript
// 验证新创建的 skill
const validation = await window.api.skill.validate({
  skillPath: './new-skill'
})

if (!validation.data.valid) {
  showErrors(validation.data.errors)
} else if (validation.data.warnings.length > 0) {
  showWarnings(validation.data.warnings)
} else {
  showSuccess('Skill 格式正确')
}
```

### 4. 与 LLM 集成

```javascript
// 获取 skill 上下文并传递给 LLM
const context = await window.api.skill.getContext({
  skillName: 'skill-creator',
  options: { includeReferences: true }
})

// 构建 LLM 提示
const prompt = `
使用以下 skill 完成任务：

${context.data.body}

任务：${userTask}
`

// 调用 LLM
const result = await window.api.llm.chat({ prompt })
```

## 注意事项

1. **SKILL.md 格式**: 必须包含正确的 frontmatter
2. **必需字段**: name 和 description 是必需的
3. **文件编码**: 所有文件应使用 UTF-8 编码
4. **脚本权限**: Python 脚本需要系统安装 Python
5. **路径处理**: 使用绝对路径或相对于 skillsDir 的路径
6. **资源加载**: 引用文件按需加载，不会自动加载所有内容
7. **热重载**: 修改 skill 后需要调用 reload 才能生效

## skill-creator 特殊说明

skill-creator 是一个用于创建和改进 skills 的 meta-skill，包含：

- **agents/**: 专用子代理指令（grader, comparator, analyzer）
- **scripts/**: Python 脚本工具
  - `run_eval.py` - 运行评估
  - `run_loop.py` - 优化循环
  - `aggregate_benchmark.py` - 聚合基准测试
  - `package_skill.py` - 打包 skill
  - `quick_validate.py` - 快速验证
- **references/**: 参考文档（schemas.md）
- **assets/**: HTML 模板
- **eval-viewer/**: 评估查看器

使用示例：

```javascript
// 执行验证脚本
const result = await window.api.skill.executeScript({
  skillName: 'skill-creator',
  scriptName: 'quick_validate.py',
  args: ['./my-new-skill']
})

// 读取 schema 文档
const schema = await window.api.skill.readReference({
  skillName: 'skill-creator',
  referenceName: 'schemas.md'
})
```

## 扩展开发

### 添加新的脚本类型支持

在 `executeScript` 方法中添加新的文件扩展名处理：

```javascript
else if (ext === '.sh') {
  // 执行 Shell 脚本
  const process = spawn('bash', [scriptPath, ...args])
  // ...
}
```

### 自定义资源目录

修改 `_scanResources` 方法以支持更多资源类型：

```javascript
// 扫描 templates 目录
const templatesDir = path.join(skillPath, 'templates')
try {
  const templateFiles = await fs.readdir(templatesDir)
  resources.templates = templateFiles.map(f => path.join(templatesDir, f))
} catch {}
```
