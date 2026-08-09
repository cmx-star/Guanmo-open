# 观墨 AI 能力提升分阶段实施计划

> 本文件是“桌面端阅读 AI、阅读成果、阅读提醒与 Agent 行动安全”任务的唯一状态来源。执行时必须使用 `staged-task-handoff` Skill，每次只推进一个阶段，并根据实际代码、Git diff 和验证结果更新本文件。
>
> 仓库根目录已有 `AI_IMPLEMENTATION_PLAN.md`，其当前职责是 Android 只读阅读 MVP，且存在用户未提交修改。本任务不得修改、替换或借用该文件的阶段状态。

## 当前状态

- 项目状态：进行中
- 当前阶段：阶段 6｜本地阅读提醒与系统通知
- 阶段状态：进行中（方案 B 已确认，转入 Windows 原生计划通知）
- 上次执行结果（阶段 5 自动化部分）：
  - 工具注册表新增 effect、capability、confirmationPolicy 与撤销说明；只读工具保持原行为，副作用工具必须返回受支持的确认提案
  - 新增严格 ActionProposal 运行时 schema、15 分钟过期、版本校验、动作/字段白名单与旧 EditConfirmation 兼容解码
  - 新增保存阅读成果、新建 Markdown 阅读笔记、创建阅读提醒三类高层提案工具；文件提案拒绝任意 path，确认后仍走系统保存对话框
  - 将既有 save_memory 收敛为确认提案；确认执行器支持授权重验、重复确认幂等、取消、目标变化、失败分类与匿名状态
  - Agent session/useAiChat/chat metadata/AiPanel 已接入通用行动确认卡；确认历史解码与执行命令按需加载以满足 bundle budget
  - 新增 actionProposal.test.ts、test:action-proposals 与 runtime/routing 定向覆盖
- 验证结果：
  - `npm run test:action-proposals`：通过（7 tests）
  - `npm run test:agent-parser`：通过
  - `npx vitest run tests/agent/agentExecutionBudget.test.ts`：通过（7 tests）
  - `npm run test:routing-matrix`：通过（154 tests）
  - `npm run test:runtime-schemas`：通过
  - `npm run typecheck`：通过
  - 修改文件 ESLint：0 error（7 个预先存在 warning，与本次修改无关）
  - `npm run build:desktop`：通过，bundle budget 通过（入口 1,349,371 bytes）
  - `git diff --check`：无错误（仅 CRLF 提示）
  - 真实桌面行动确认卡验收：未验证（需用户手工执行）
- 阶段 6 已完成：reading_reminders schema/repository/备份兼容、未来绝对时间与 IANA 时区重验、pending 状态机、提醒列表、取消/启动对账骨架、ActionProposal 执行接入、notification 插件最小初始化与定向测试
- 阶段 6 当前验证：`npm run test:reading-reminders` 通过（5 tests）；`npm run test:action-proposals` 通过（7 tests）；提醒备份 Rust 定向测试通过；`npm run typecheck`、Rust fmt/check 通过
- 本阶段剩余：实现仅 Windows 编译的原生计划通知 schedule/list/cancel 受限命令，接回前端适配器；然后补编辑/失败重试/来源返回、完整阶段 6 门禁与安装版人工验收
- 本阶段允许修改：阶段 6 列出的提醒 schema/repository/备份、通知 service/capability、提醒 UI、Agent 提案执行器与定向测试
- 阻塞问题：方案决策阻塞已解除。用户已选择方案 B：实现 Windows 原生计划通知，不引入开机自启、后台常驻、Shell 或任务计划程序；Windows 安装版实际触发、取消、重启与应用关闭验收仍需用户侧执行。阶段 1-5 真实模型/桌面手工验收仍需用户执行
- 下一阶段：阶段 7｜综合验收与扩展决策门
- 远程操作：禁止自动提交、推送、打 tag、创建 PR 或 Release

## 项目目标

围绕观墨“安静阅读 + AI 辅助”的定位，按以下投入优先级形成可验证闭环：

1. 阅读理解深化，约占 60%：让 AI 正确理解选区、章节、全文和多文档资料，输出可回到原文的摘要、依据、问题和推断边界。
2. 阅读到行动，约占 25%：把阅读结果保存为可管理成果，并允许从原文或成果创建本地阅读提醒。
3. 行动安全底座，约占 15%：所有写文件、保存成果、创建提醒等副作用均经过能力白名单、运行时校验、确认卡片和可审计状态。

最终交付应支持：

- 基于选区、章节、全文或工作区资料进行可追溯问答。
- 将 AI 回答保存为 Markdown，或保存为摘要、问题集、批注、知识卡片等结构化阅读成果。
- 阅读成果能够定位回来源文件和原文范围；源文变化后不得静默定位到错误内容。
- 从阅读上下文创建、查看、修改和取消一次性本地提醒，并由系统通知触达。
- Agent 只能提出受约束的写入或提醒动作；真正执行前必须由用户确认。

## 当前能力基线

以下能力已经存在，后续必须复用，不得重复建设：

- `read_selection_context`：按语义原子和两级 token 预算读取本轮授权选区上下文。
- `read_context_file`：读取本轮用户明确添加的已授权文件，并支持文件总结路由。
- `search_knowledge`、`web_search`、`search_memory`：分别负责本地知识、Web 和长期记忆检索。
- 文件总结提示词：已按学习笔记、会议记录、项目文档、普通文章输出结构化总结和来源依据。
- AI 回答：已经以 Markdown 显示，并随聊天会话保存到 SQLite。
- `replace_current_tab_text`：只能针对本轮授权且已打开的文件/选区生成修改确认卡，不直接写入文件。
- 用户手动文件能力：已有 `.md` 新建、另存为、打开标签页和 RAG 索引刷新链路。

当前缺口：

- 没有稳定的匿名阅读质量评测集，也没有对选区/章节/全文/多文档范围的一致验收。
- 摘要和问题清单目前只是聊天文本，不是独立可管理的阅读成果。
- 没有独立批注模型、知识卡片模型、来源锚点失效状态或成果管理 UI。
- Agent 没有新建 Markdown 文件工具，也不应直接获得任意路径写入权限。
- 没有通用副作用分类、统一行动确认模型、行动审计或本地提醒能力。
- 当前依赖中没有 Tauri notification 插件。

## 范围与非目标

### 本计划范围

- 首期只面向 `D:/React/guanmo-open` 桌面端。
- Web 继续保留基础阅读能力，但不启用 AI、SQLite、文件管理或提醒。
- Android 继续由现有 Android 计划与 POC worktree 管理，本计划不得修改移动入口或冒充真机验收。
- 初期提醒只支持一次性本地提醒；重复提醒、跨设备同步和多人协作另行评估。

### 本计划不做

- 不提供任意 `write_file(path, content)`、任意 Shell、模拟鼠标键盘或通用软件控制工具。
- 不直接接入 Google Calendar、Outlook Calendar 或其他账号体系。
- 不把阅读成果写入长期记忆表；长期记忆用于稳定偏好和事实，不等同于阅读笔记或知识卡片。
- 不以 Markdown 文件作为结构化成果和提醒的业务主存储。
- 不在用户未确认时自动修改原文、创建文件、保存成果或注册通知。
- 不引入完整间隔重复算法、卡片评分系统或学习统计，除非后续用户单独确认。

## 核心产品与数据决策

### 阅读范围

统一使用以下范围，不让 UI 文案、路由和工具参数各自定义：

- `selection`：当前明确授权的选区及递进语义上下文。
- `section`：当前标题及其子层级正文，以 Markdown source offset/model 为准。
- `document`：用户明确添加的单个授权文件；截断时必须声明读取范围。
- `workspace`：通过 `search_knowledge` 检索工作区资料，不等同于读取全部文件。

### 阅读成果类型

- `summary`：摘要、观点、关键细节、信息缺口与后续阅读建议。
- `question_set`：面向理解、反思或复习的问题列表，可选参考答案。
- `annotation`：绑定到原文范围的独立笔记，不直接修改原文。
- `flashcard_set`：由正面、背面、来源组成的知识卡片集合；首期只支持保存和查看。
- `note`：用户希望长期保留、但不属于上述固定结构的阅读笔记。

### 阅读成果存储

- 桌面端以 SQLite `reading_artifacts` 为唯一业务主存储。
- 单条记录至少包含：ID、类型、标题、Markdown/结构化内容、来源路径或文档身份、来源内容哈希、heading path、source offsets/行号、引用快照、来源聊天消息、创建/更新时间和状态。
- 结构化字段必须经过运行时 schema 解码；未知类型或损坏数据进入可见错误状态，不静默丢弃。
- 原文变化后，先按路径、内容哈希、offset 和引用文本校验锚点；不能确认时标记“来源已变化”，不得自动贴到相似段落。
- 导出 Markdown 是用户主动操作；导出文件应包含成果正文和可读来源信息，但不得写入绝对路径、聊天隐私或内部调试字段到正文。
- 新表、备份导入导出和旧版本升级必须向后兼容；旧数据库启动后幂等建表，不清空或重建现有业务数据。

### Agent 行动安全

- 工具按 `read`、`write_local`、`schedule`、`external` 分类。
- `read` 可按既有授权直接执行；其余类别默认必须确认。
- Agent 工具只生成结构化行动提案，不直接调用文件系统、SQLite 写入或系统通知。
- 确认卡必须显示动作类型、目标、关键参数、内容预览、是否可撤销及风险说明。
- 用户确认时重新校验目标授权、文件状态、提醒时间和提案版本，防止确认过期状态。
- 写入后记录匿名化行动状态：动作类型、来源消息、状态、时间、错误类别；不记录 API Key、完整文档或完整绝对路径。
- 只有具备确定逆操作的动作提供“撤销”；否则必须明确显示不可自动撤销。

### 提醒模型

- SQLite `reading_reminders` 是提醒真相源，至少包含：ID、标题、说明、到期 UTC 时间、创建时区、状态、来源成果/文档锚点、系统通知 ID、创建/更新时间和错误状态。
- MVP 只允许未来的一次性提醒；自然语言日期必须解析为明确时间并在确认卡展示绝对日期、星期和时区。
- 注册系统通知采用“数据库 pending → 系统注册 → 数据库 scheduled”的可恢复状态机；任一步失败保留可诊断状态。
- 编辑、取消和启动恢复时对账 SQLite 与系统待发通知；不得因单侧失败静默丢提醒或重复触发。
- 通知权限只能在用户创建提醒时请求，不在应用启动时突然弹窗。
- Tauri 官方 notification 插件支持权限检查、发送、计划、查询/取消待发通知；Windows 仅安装后的应用可作为正式验收，开发模式提示只作调试证据。实现阶段必须重新核对当时的官方 API 与平台限制：<https://v2.tauri.app/plugin/notification/>、<https://v2.tauri.app/reference/javascript/notification/>。
- 首期不自动增加开机自启；若安装版在目标系统无法于应用关闭时触发计划通知，应将阶段标记阻塞并由用户决定是否引入自启或改为应用内提醒。

## 总体成功标准

- 阅读回答能够明确显示范围，并让关键结论回到真实文件、标题或行号；无来源时不伪造引用。
- 摘要、问题集、批注和知识卡片能够独立保存、查看、删除并定位来源。
- AI 回答能够由用户一键进入“保存为 Markdown”流程；取消保存不产生文件或业务记录。
- Agent 无法绕过确认卡执行文件写入、成果保存或提醒创建。
- 一次性提醒能够创建、修改、取消、重启恢复，并在 Windows 安装版真实触发系统通知。
- 数据库升级、备份/恢复、Web 能力边界、文件授权和现有 AI 修改确认语义保持兼容。
- 自动测试、类型检查、定向 Lint、桌面构建和对应 Rust 检查通过；真实模型与系统通知验收单独记录，不用构建结果替代。

## 总体实施约束

- 每次只执行当前阶段，不提前创建后续阶段的数据表、工具或 UI。
- 修改前重新读取 `AGENTS.md`、本文件、当前阶段实际代码及对应 `docs/agent-contracts/*.md`。
- 架构、Rust command、SQLite、Agent/RAG、生命周期修改先使用 code-review-graph 做最小影响查询；图为空或落后 HEAD 后再精确符号搜索。
- 现有工作区修改均视为用户改动，不覆盖、不回退、不顺带格式化。
- 不自动安装依赖。进入通知阶段时先确认包版本、bundle 预算和用户授权，再添加依赖。
- 不调用真实付费模型，除非用户明确授权；自动质量检查使用匿名 Fixture 和 mock。
- 测试文件只读取和修改与当前阶段直接相关的范围；不运行全量 E2E 或全仓库覆盖率。
- `guides/engineering-execution.md`、`guides/compatibility.md`、`guides/delivery.md` 当前在仓库中不存在；各阶段必须记录缺失并继续遵守 `AGENTS.md` 与数据库兼容契约，不得虚构其内容。
- 所有新按钮遵守 UI 契约；新增弹窗使用项目自有弹窗结构，不使用 `animal-island-ui` 的 `Modal`。
- 文件操作继续经 `src/hooks/useTauri.ts` 和 `FsAccessState`；只允许大小写不敏感的 `.md` 文档。
- 桌面端业务数据继续使用 SQLite；不得新增 IndexedDB/localStorage 主存储或双写回退。
- 不提交、不推送、不打 tag、不创建 PR/Release，除非当前用户消息另行明确授权。

## 阶段计划

### 阶段 1｜阅读质量基线与可追溯回答

- 目标：统一选区、章节、全文和工作区四种阅读范围，在不新增副作用的前提下提升总结、依据、问题与来源展示的可靠性。
- 关键实现：
  - 建立统一 `ReadingScope`/上下文元数据，在路由、请求构造、回答元数据和 UI 中保持一致。
  - 复用 `read_selection_context`、`read_context_file` 和 `search_knowledge`，不创建可绕过授权的全文读取工具。
  - 为文件总结、章节研究、多文档对照建立匿名 Fixture 和可判定断言：来源存在、截断声明、推断标识、冲突/缺口说明。
  - AI 回答头部以紧凑标签显示“选区 / 章节 / 全文 / 工作区”；来源继续复用现有来源列表和打开定位链路。
- 验收标准：四类范围不会互相越权；关键结论有真实来源；截断和信息不足明确可见；普通问答不被强制套用复杂模板。
- 检查命令：定向阅读/路由测试、`npm run test:selection-context`、`npm run test:routing-matrix`、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、`git diff --check`。
- 暂不处理：成果保存、数据库表、文件导出、批注、卡片、提醒、通知依赖。

### 阶段 2｜阅读结果保存为 Markdown MVP

- 目标：用最小产品闭环验证用户是否愿意保存 AI 阅读结果，不赋予 Agent 新文件写权限。
- 关键实现：
  - 对已完成且非空的 assistant 消息增加“保存为 Markdown”操作。
  - 由确定性应用代码组装标题、正文和可读来源，通过既有保存对话框与 `.md` 校验写入。
  - 用户选择路径并确认后才写入；取消、重名、非法扩展名和写入失败不留下半成品标签页。
  - 成功后打开新标签页并调度该文件的 RAG 索引；不得把内部绝对路径自动写入正文。
- 验收标准：保存、取消、失败、打开与索引刷新闭环通过；Agent 仍不能直接调用创建/写文件。
- 检查命令：新增保存动作定向测试、`npm run test:file-access`、`npm run test:rag-index`、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、`git diff --check`；人工执行一次真实“另存为并重新打开”。
- 暂不处理：结构化成果表、自动批注、知识卡管理、Agent 写入工具。

### 阶段 3｜结构化阅读成果存储与管理

- 目标：让摘要、问题集和普通阅读笔记脱离聊天历史，成为可查询、可定位、可备份的成果。
- 关键实现：
  - 新增向后兼容的 `reading_artifacts` SQLite schema、运行时解码、repository 与定向 CRUD。
  - 将成果入口放在 AI 面板的“对话 / 阅读成果”分区或同等低干扰结构；先支持列表、筛选、查看、删除和打开来源。
  - 在 assistant 回答上提供“保存为摘要 / 问题集 / 阅读笔记”，由应用保存，不调用模型二次改写。
  - 将成果纳入备份导出和同一 Rust SQLx 事务的备份导入；旧备份缺少成果字段时按空数组兼容。
  - 来源锚点保存内容哈希、heading/line/offset 和引用快照；来源失效时显示恢复提示。
- 验收标准：重启后成果仍在；旧数据库和旧备份可用；删除不会改动原文；来源变化不会错误跳转。
- 检查命令：成果 schema/repository/backup 定向测试、`npm run test:runtime-schemas`、数据库相关 Rust 定向测试（单线程）、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、`git diff --check`。
- 暂不处理：行内批注标记、卡片复习、Agent 自动保存、系统提醒。

### 阶段 4｜锚定批注与知识卡片

- 目标：在结构化成果之上支持不修改原文的批注和来源可追溯知识卡片。
- 关键实现：
  - 批注以 source offset + 引用文本 + 前后文指纹定位；在阅读成果面板展示，并在来源打开时高亮目标范围。
  - 适配虚拟 Markdown 预览，定位必须基于现有 Markdown model/source offset，不遍历或假设全文 DOM 已挂载。
  - 知识卡片使用稳定结构：正面、背面、来源、标签；首期只支持生成预览、用户确认保存、查看和删除。
  - AI 只生成结构化候选；解析失败时保留原回答并提示，不保存残缺卡片。
- 验收标准：批注不改变源 Markdown；正常、修改、删除和重命名来源都有明确状态；卡片每条均可回到来源或显示来源失效。
- 检查命令：artifact schema、锚点、Markdown 定位和卡片解析定向测试、相关现有 Markdown 测试、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、`git diff --check`；人工验证长文虚拟预览定位。
- 暂不处理：间隔重复算法、学习评分、跨设备同步。

### 阶段 5｜Agent 行动安全底座

- 目标：在添加提醒和 Agent 新建文件前，统一所有副作用的声明、确认、执行和审计边界。
- 关键实现：
  - 为工具注册表增加 effect、capability、confirmation policy 和可撤销描述，并保持现有只读工具行为不变。
  - 在现有 `EditConfirmation` 兼容边界上引入通用 `ActionProposal/ActionConfirmation`，旧聊天 metadata 仍可解码。
  - 增加运行时 schema，禁止模型自由 JSON 直接进入 store 或执行器。
  - 第一批高层提案工具仅包括：保存阅读成果、建议新建 Markdown 阅读笔记、建议创建阅读提醒；它们返回 pending action，不直接执行。
  - 文件提案不接受任意绝对路径；确认时由用户使用系统保存对话框或选择已授权工作区目标。
  - 记录匿名化行动状态，并对取消、过期提案、重复确认、目标变化和执行失败做定向测试。
- 验收标准：所有副作用都需确认；重复确认不会重复执行；旧文本修改确认仍可用；模型无法构造未注册动作或越权路径。
- 检查命令：Agent 工具选择、执行预算、运行时 schema、确认/过期/幂等定向测试，`npm run test:routing-matrix`、`npm run test:agent-parser`、`npm run test:runtime-schemas`、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、`git diff --check`。
- 暂不处理：任意软件控制、Shell、外部日历和不经确认的自动化。

### 阶段 6｜本地阅读提醒与系统通知

- 目标：完成“阅读上下文 → AI 提案 → 用户确认 → 本地提醒 → 系统通知 → 返回来源”的闭环。
- 关键实现：
  - 新增 `reading_reminders` schema/repository、状态机、运行时解码和备份兼容。
  - 确认卡显示绝对时间、星期、时区、来源文档/成果和通知权限状态；模糊时间必须要求用户补充，不能猜测。
  - 经用户批准后添加并最小初始化 Tauri notification 插件和 capability；不开放无关权限。
  - 支持创建、列表、编辑时间、取消、启动对账和失败重试；系统通知 ID 与 SQLite 状态保持可恢复映射。
  - 通知点击在平台支持时打开对应成果或来源；无法可靠接管点击时至少打开应用并在提醒列表提供明确“查看来源”。
- 验收标准：一次性提醒不会重复触发；取消后不再通知；重启和应用关闭场景结果明确；权限拒绝不影响阅读和成果功能。
- 检查命令：提醒解析/状态机/repository/Agent 提案定向测试、`npm run test:runtime-schemas`、通知 capability 静态检查、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、Rust fmt/check 与相关定向测试、`git diff --check`；Windows 安装版人工验证权限、未来通知、取消、重启和来源返回。
- 暂不处理：重复提醒、开机自启、后台常驻、外部日历。

### 阶段 7｜综合验收与扩展决策门

- 目标：验证三个优先级形成真实产品闭环，并决定是否值得进入日历或有限软件控制。
- 关键实现：
  - 使用匿名短文、长文、多文档冲突资料完成阅读范围、来源、成果和提醒端到端矩阵。
  - 在用户明确授权后，用同一模型/配置/请求集做真实阅读 A/B；不把 mock 或单一示例写成普遍质量结论。
  - 验证旧数据库升级、备份恢复、源文件重命名/修改/删除、通知权限拒绝和安装版通知。
  - 汇总真实使用反馈后再选择：外部日历同步、重复提醒、有限白名单软件动作或停止扩展。
- 验收标准：相关自动门禁全部通过；真实桌面阅读与安装版通知有记录；未完成的外部依赖明确列为债务。
- 检查命令：各阶段定向检查汇总、`npm run typecheck`、定向 ESLint、`npm run build:desktop`、对应 Rust fmt/check/test、`git diff --check`；除非进入发布或用户明确要求，不运行 `npm run check:release`。
- 暂不处理：未经新计划和单独授权的外部账号、任意程序控制、Shell 或输入模拟。

## 当前阶段详细任务

### 阶段 6 目标

完成“阅读上下文 → AI 提案 → 用户确认 → SQLite 提醒 → 系统通知 → 返回来源”的一次性本地提醒闭环；SQLite 是唯一真相源，系统通知注册失败必须保留可诊断状态。

### 阶段 6 执行前必读

- `AGENTS.md`
- `AI_CAPABILITY_ENHANCEMENT_PLAN.md`
- `docs/agent-contracts/ui.md`
- `docs/agent-contracts/ai-selection.md`
- `docs/agent-contracts/database.md`
- `docs/agent-contracts/desktop-services.md`
- 全局 `guides/api-coordination.md` 与 `guides/compatibility.md`
- 当前实际代码：数据库 schema/backup、App 启动恢复、Tauri capability、阶段 5 ActionProposal 执行链路

### 阶段 6 允许修改

- `src/services/database/schema.ts`
- 新增提醒 repository/service/store 与直接相关 UI
- `src/services/dataBackup.ts`、`src/services/database/persistence.ts`
- `src/services/actionProposalCommand.ts`、提醒提案运行时 schema
- `src-tauri/Cargo.toml`、`src-tauri/src/**`、`src-tauri/capabilities/**`、`src-tauri/tauri.conf.json` 中通知所需最小变更
- 阶段 6 直接相关的匿名定向测试、脚本与 `package.json`
- `AI_CAPABILITY_ENHANCEMENT_PLAN.md`

### 阶段 6 实施任务

1. 定义向后兼容的 reading_reminders schema、运行时解码、repository、备份导入导出与一次性提醒状态机。
2. 确认卡与执行器重验明确未来时间、时区、提案版本和来源；模糊或过去时间拒绝执行。
3. 核对并接入 Tauri 官方 notification 插件的当前 API，只开放创建/查询/取消提醒所需最小权限。
4. 实现 pending → 系统注册 → scheduled 的可恢复流程，以及编辑、取消、启动对账和失败重试。
5. 提供低干扰提醒列表和查看来源入口；权限拒绝不得影响阅读与成果能力。
6. 执行阶段 6 定向检查并记录 Windows 安装版未验证项。

### 阶段 6 验收清单

- [ ] 旧数据库幂等新增 reading_reminders，旧备份缺少 reminders 时按空数组兼容。
- [ ] 只接受未来一次性绝对时间；确认卡显示日期、星期、时区。
- [ ] 重复确认、重启对账和重试不会重复创建提醒。
- [ ] 取消后 SQLite 与系统待发通知状态可恢复，不静默丢失。
- [ ] 通知权限只在用户确认创建提醒时请求；拒绝后阅读功能正常。
- [ ] 提醒列表可查看来源；平台点击接管不可用时明确降级。
- [ ] Windows 安装版完成未来通知、取消、重启和来源返回手工验收。

### 阶段 6 检查命令

提醒解析/状态机/repository/Agent 提案定向测试、`npm run test:runtime-schemas`、通知 capability 静态检查、`npm run typecheck`、修改文件定向 ESLint、`npm run build:desktop`、Rust fmt/check 与相关定向测试、`git diff --check`。

### 阶段 6 禁止事项

- 不实现重复提醒、开机自启、后台常驻或外部日历。
- 不在启动时主动请求通知权限。
- 不绕过 ActionProposal 确认或恢复任意路径/任意 Shell 能力。
- 不清空、重建或双写现有业务数据。
- 不自动提交或推送代码。

## 已完成阶段详细任务（历史）

### 阶段 1 目标

在不增加数据库、文件写入和系统权限的前提下，交付可离线验证的阅读范围契约与质量基线，并让用户在真实桌面上清楚看到回答使用了什么范围和来源。

### 阶段 1 执行前必读

- `AGENTS.md`
- `AI_CAPABILITY_ENHANCEMENT_PLAN.md`
- `docs/agent-contracts/ui.md`
- `docs/agent-contracts/ai-selection.md`
- `docs/agent-contracts/file-access.md`
- `docs/agent-contracts/markdown-editor.md`
- `docs/agent-contracts/rag-memory.md`
- `docs/agent-contracts/database.md`
- 当前实际代码：`src/hooks/useAiChat.ts`、`src/services/agent/**`、`src/services/aiChatMessages.ts`、`src/components/ai/AiPanel.tsx`
- 仅在新增或修复相关测试时读取对应的 `tests/agent/**`、选区测试和测试脚本

### 阶段 1 允许修改

- `src/services/agent/answerInstructions.ts`
- `src/services/agent/intentDetector.ts`
- `src/services/agent/routingService.ts`
- `src/services/agent/requestBuilder.ts`
- `src/services/agent/selectionContext.ts`
- `src/services/agent/sourceMetadata.ts`
- `src/services/agent/types.ts`
- `src/services/aiChatMessages.ts`
- `src/hooks/useAiChat.ts`
- `src/components/ai/AiPanel.tsx`
- 与阶段 1 直接相关的匿名 Fixture、Agent/选区定向测试和必要 npm 测试脚本
- `AI_CAPABILITY_ENHANCEMENT_PLAN.md`

如果实际代码证明只需更小范围，必须缩小修改；如不可避免地需要范围外文件，先记录原因，不得顺带重构。

### 阶段 1 实施任务

1. 记录当前四类阅读请求的真实路由、工具、回答元数据和来源展示基线，不调用真实付费模型。
2. 定义并运行时解码统一的阅读范围与来源覆盖元数据；未知值安全降级，不破坏旧聊天记录。
3. 调整路由与请求构造：选区保持两级语义读取，指定文件使用授权文件读取，工作区研究使用 RAG，章节范围基于已有 heading/source offset 信息。
4. 收敛回答要求：摘要/研究/对照结构化，普通解释保持简洁；任何截断、冲突、弱相关或推断必须显式说明。
5. 在 AI 消息中增加紧凑阅读范围标签，并继续使用现有来源列表和打开来源链路；无实际来源时不显示来源占位。
6. 增加匿名定向测试，至少覆盖：选区解释、章节总结、全文总结截断、多文档冲突、弱相关/空结果、普通问答不误触发复杂研究。
7. 执行阶段检查；只修复本阶段引入的问题，然后按真实结果更新顶部状态和阶段历史。

### 阶段 1 验收清单

- [ ] `selection` 不读取未授权文件或自动升级为全文。
- [ ] `section` 以 heading/source offset 为边界，不依赖全文 DOM 已挂载。
- [ ] `document` 只读取本轮授权文件，并在截断时明确说明范围。
- [ ] `workspace` 只把真实 TopK 检索片段作为来源，不声称读取了整个工作区。
- [ ] 关键结论能够对应真实文件、heading 或行号范围。
- [ ] 冲突、信息不足和推断与原文事实分开显示。
- [ ] 普通解释和翻译不被强制输出复杂研究模板。
- [ ] 旧聊天消息和旧 metadata 仍可加载。
- [ ] 真实桌面手工验证阅读范围标签、来源展开和打开定位。

### 阶段 1 检查命令

按源码稳定后的顺序执行，前置失败先处理首个根因：

```powershell
npm run test:selection-context
npm run test:routing-matrix
npm run typecheck
npm exec eslint -- <本阶段修改的 ts/tsx 文件>
npm run build:desktop
git diff --check
```

新增独立阅读质量脚本时，将其加入上述命令并在 `package.json` 使用明确名称；不得调用真实外部模型作为自动测试。

### 阶段 1 禁止事项

- 不创建 `reading_artifacts`、`reading_reminders` 或行动审计表。
- 不添加通知、日历、Shell、自动启动或其他依赖。
- 不实现保存 Markdown、批注、知识卡片或提醒 UI。
- 不改变文件授权、写回确认、RAG 主存储或长期记忆语义。
- 不修改 Android POC 或 `AI_IMPLEMENTATION_PLAN.md`。
- 不自动提交或推送代码。

## 阶段交接规则

- 每次结束更新顶部“当前状态”，只保留最近一次执行摘要、真实检查结果、剩余任务、阻塞与下一阶段。
- 阶段只有在实现、验收和必要检查全部通过后才能标记“已完成”。
- 真实模型、系统通知或安装版验收未执行时必须写“未验证”，不能由 mock、typecheck 或 build 替代。
- 阶段完成后在下方追加简短历史；未完成阶段不写虚假完成记录。
- 每次只推进一个阶段，用户明确要求连续执行也必须逐阶段更新状态和自检。

## 阶段历史

### 阶段 1｜阅读质量基线与可追溯回答

- 状态：进行中（自动化交付完成，真实桌面手工验收未验证）
- 完成内容：统一 ReadingScope 与来源覆盖元数据；路由按选区/章节/全文/工作区收敛；新增 SECTION_READING_ANSWER_PROMPT 并复用文件总结/本地研究/网络对照提示；来源覆盖 resolve/build 与 toContextTagSources；AI 消息头部紧凑范围标签；新增匿名定向测试与 test:reading-quality 脚本
- 验证结果：test:selection-context、test:routing-matrix(152)、test:reading-quality(10)、typecheck、修改文件 ESLint、build:desktop、git diff --check 全部通过；真实桌面手工验收未验证
- 遗留问题：真实模型/桌面阅读范围标签与来源打开定位需用户手工验收（不调用付费模型）

### 阶段 2｜阅读结果保存为 Markdown MVP

- 状态：进行中（自动化交付完成，真实桌面手工验收未验证）
- 完成内容：新建 assistantMessageExport 服务（纯组装 + 保存编排，复用 saveFileAs/addTab/scheduleMarkdownDocumentIndex）；AiPanel 为已完成非空非流式 assistant 消息新增“保存为 Markdown”按钮；取消/失败不留半成品标签页；不向 Agent 开放写文件；新增定向测试与 test:assistant-export 脚本
- 验证结果：test:assistant-export(7)、test:file-access、test:rag-index、typecheck、修改文件 ESLint、build:desktop、git diff --check 全部通过；真实桌面手工“另存为并重新打开”未验证
- 遗留问题：真实桌面另存为→重新打开→索引刷新需用户手工验收

### 阶段 3｜结构化阅读成果存储与管理

- 状态：进行中（自动化交付完成，真实桌面手工验收未验证）
- 完成内容：新增 reading_artifacts SQLite schema（类型/状态 CHECK、来源锚点、索引，幂等建表）；新建 readingArtifacts.ts 运行时解码+CRUD+来源锚点校验；新建 readingArtifactsStore Zustand store；AiPanel 新增对话/成果分区切换、保存为摘要/问题集/笔记、成果卡片与来源状态展示；扩展 database_transactions.rs 备份导入导出含 artifacts（事务原子回滚）；扩展 dataBackup.ts/persistence.ts；新增 15 项定向测试与 test:reading-artifacts 脚本
- 验证结果：test:reading-artifacts(15)、test:runtime-schemas、transactionBridge(4)、cargo test database_transactions(10)、typecheck、修改文件 ESLint、build:desktop、git diff --check 全部通过；真实桌面手工验收（重启成果仍在、旧备份可用、来源变化不错误跳转）未验证
- 遗留问题：真实桌面重启后成果持久化、旧备份恢复与来源变化锚点状态需用户手工验收

### 阶段 4｜锚定批注与知识卡片

- 状态：进行中（自动化交付完成，真实桌面手工验收未验证）
- 完成内容：扩展 readingArtifacts.ts 新增批注/知识卡片结构化内容与运行时解码（损坏数据抛出可见错误）；新增基于 Markdown model/source offset 的虚拟预览安全定位（findMarkdownBlockByOffset/findMarkdownBlockByQuote/computeMarkdownBlockFingerprint/resolveAnnotationPosition，不遍历 DOM）；新增知识卡片候选确定性解析 parseFlashcardCandidates（```flashcard 围栏块与 Q:/A: 问答列表，解析失败保留原回答）；AiPanel 新增批注/卡片保存按钮与定位打开来源；readingArtifactsStore 扩展 structuredContent 持久化；EditorArea 的 replaceMarkdownBlock 改为动态导入以满足 bundle budget；扩展 runtime-schemas-check 与 readingArtifacts.test.ts 定向测试
- 验证结果：test:reading-artifacts(50)、test:runtime-schemas、markdownBlocks(6)、typecheck、修改文件 ESLint(0 error)、build:desktop(bundle budget 通过，入口 1,349,762 bytes)、git diff --check 全部通过；真实桌面手工验收（长文虚拟预览定位、批注不修改原文、来源变化状态）未验证
- 遗留问题：长文虚拟预览批注定位、批注不修改原文、来源修改/删除/重命名状态需用户手工验收

### 阶段 5｜Agent 行动安全底座

- 状态：进行中（自动化交付完成，真实桌面手工验收未验证）
- 完成内容：工具 effect/capability/confirmation/reversible 元数据；ActionProposal 严格运行时 schema 与旧 EditConfirmation 兼容；阅读成果/Markdown 笔记/阅读提醒高层提案；save_memory 确认化；通用确认卡、授权重验、过期/幂等/取消/失败分类与匿名状态；按需加载满足 bundle budget
- 验证结果：test:action-proposals(7)、test:agent-parser、agentExecutionBudget(7)、test:routing-matrix(154)、test:runtime-schemas、typecheck、修改文件 ESLint(0 error)、build:desktop(bundle budget 通过，入口 1,349,371 bytes)、git diff --check 全部通过；真实桌面确认卡交互未验证
- 遗留问题：真实桌面需手工验证保存成果、系统保存对话框、长期记忆确认及历史卡片状态；创建提醒的真正执行由阶段 6 接入

### 阶段 6｜本地阅读提醒与系统通知

- 状态：进行中（方案 B 已确认，Windows 原生计划通知待实现）
- 已完成内容：reading_reminders SQLite 真相源与运行时解码；旧备份缺字段兼容的导入导出；未来绝对时间、时区与确认时重验；pending/scheduled/failed/cancel_pending/cancelled/fired 状态机骨架；提醒列表与取消入口；启动对账；ActionProposal 执行器；notification 2.3.3 插件、Rust 初始化及权限检查/请求/立即通知最小 capability；5 项状态机定向测试与 Rust 备份事务测试
- 当前安全降级：桌面通知适配器不调用类型声明中实际仅移动端可用的 schedule/pending/cancel，也不把未来通知误发为立即通知；持久化失败状态只记录匿名错误码 `desktop_notification_scheduling_unsupported`
- 验证结果：test:reading-reminders(5)、test:action-proposals(7)、Rust backup reminder 定向测试、typecheck、Rust fmt/check 通过；其余阶段 6 门禁尚未执行
- 阻塞证据：tauri-plugin-notification 2.3.3 的 `init()` 桌面 invoke handler 仅注册 notify/request_permission/is_permission_granted；schedule/pending/cancel 位于移动端实现。计划文件原先对桌面能力的假设不成立
- 已确认决策：采用方案 B，实现仅 Windows 编译的原生计划通知 schedule/list/cancel 受限命令；不增加开机自启、后台常驻、Shell 或任务计划程序。完成阶段 6 自动门禁与安装版验收记录前不进入阶段 7
