# AI Implementation Plan

## 当前状态

- 当前阶段：阶段 4｜降低 Agent 延迟与重复调用
- 阶段状态：未开始
- 上次执行结果：
  - 完成阶段 3 的编排纯函数拆分，`useAiChat` 保留生命周期、取消、store 和进度职责
  - 删除无实际检索行为的知识库预检索空壳
  - 消除 `routingService` 对 `executor` 的回答提示词反向依赖
  - 新增 3 条编排纯函数定向测试
- 验证结果：
  - `npm run test:agent-parser`：通过
  - `npm run test:ai-http`：通过
  - `npm run test:runtime-schemas`：通过
  - `npm run test:selection-context`：通过
  - `vitest` 编排与路由定向测试：155 通过
  - `npm run typecheck`：通过
  - 阶段 3 相关 ESLint：通过
- 本阶段剩余：
  - 在同一模型、配置和匿名请求集上建立真实路径性能基线
  - 根据基线选择最小的 Agent 往返优化
  - 验证调用预算、取消、超时和重复工具调用
- 本阶段允许修改：
  - Agent 循环与最终回答生成
  - 工具结果复用与调用预算
  - 与真实路径性能直接相关的最小代码和测试
  - `AI_IMPLEMENTATION_PLAN.md`
- 阻塞问题：无
- 下一阶段：阶段 5｜改善长期记忆召回

## 项目目标

在不削弱现有文件授权、写入确认、外部 HTTP、RAG、长期记忆和 Web 能力边界的前提下，重点改善：

1. AI 路由的准确性与可解释性；
2. 普通问答与 Agent 请求的响应速度和 token 成本；
3. `useAiChat`、路由器和 Agent executor 之间的职责边界；
4. 长期记忆的召回质量；
5. Provider 能力展示与实际实现的一致性；
6. 可持续的真实请求评测、性能监测和回归门禁。

本任务不以增加更多工具为目标，不采用一次性大规模重写。

## 技术栈

- 运行环境：Tauri 桌面端
- 前端：React、TypeScript、Zustand
- 桌面后端：Rust
- 业务存储：SQLite
- AI 对话：OpenAI Compatible
- 检索：Rust 后台 RAG、Embedding、关键词降级
- 测试：Vitest、React Testing Library、项目定向检查脚本
- 构建：Vite、TypeScript、Cargo

## 已核实现状

### 当前优势

- 文件读取和修改授权边界清晰；
- 写操作必须生成确认卡片，不能直接落盘；
- 外部 HTTP 统一经过 Rust 代理；
- RAG 已具备后台索引、向量检索、关键词降级和来源定位；
- 选区上下文具备 AST 语义块和分级预算；
- 长期记忆具备作用域、候选确认、冲突和替代治理；
- Agent 已有工具裁剪、参数校验、强依赖补调和短指令续接。

### 当前问题

- 路由主要依赖关键词、正则和固定分数，误触发与漏触发难以量化；
- `useAiChat.ts` 同时负责路由、预检索、Agent、RAG、UI 状态、来源和保存；
- `useAiChat.ts` 与 `executor.ts` 存在重复意图判断和工具构建；
- Agent 请求可能经历多轮规划与二次答案生成，误路由成本较高；
- 知识库“预检索”当前没有实际检索行为；
- 轻量记忆检索在无词面命中时可能无法进入向量比较；
- Provider 类型和推理适配较多，但实际对话协议仅实现 OpenAI Compatible；
- 现有静态检查可以证明契约，却没有真实请求的路由准确率、延迟和成本基线。

### 当前主链路

```text
useAiChat
  → detectIntentScores
  → buildCandidateTools
  → direct / runAgent
  → 模型工具规划
  → 工具执行与强依赖补调
  → 最终回答
  → 会话保存 / 条件式记忆候选提取
```

## 总体约束

### 安全约束

- 不改变本轮 selection/file 标签授权语义；
- 不允许历史标签继承编辑权限；
- 不允许 AI 直接写入文件；
- `save_memory` 继续要求用户本轮明确授权；
- 外部对话、Embedding、搜索和模型列表继续统一经过 `externalHttp.ts`；
- Web 端继续抛出 `UnsupportedCapabilityError`，不增加浏览器直连回退；
- RAG 和长期记忆继续使用 SQLite 主存储及 Rust 后台索引；
- 测试只使用匿名请求、临时文件和临时数据库。

### 工程约束

- 每次只执行当前阶段，不提前实现后续阶段；
- 修改前必须读取实际代码、项目 `AGENTS.md` 和阶段涉及的契约；
- 代码、Git diff 和测试结果优先于任务文件旧描述；
- 先建立基线，再修改行为；
- 优先使用纯函数和现有数据结构，不引入新的 Agent 框架；
- 第一轮路由优化不增加额外模型分类调用；
- 不同时重写路由、Agent executor、RAG 和 Provider；
- 不为达成指标放宽权限、减少确认或扩大默认上下文；
- 不自动提交、推送、打 tag、创建 PR 或 Release；
- 现有工作区修改均视为用户改动，不得覆盖、回退或夹带。

### 验收口径

- 功能正确：请求进入预期模式，调用预期工具；
- 体验正确：用户能理解当前阶段、来源、失败和降级状态；
- 工程正确：无权限扩大、无重复调用、无明显延迟或 token 回归。

## 成功指标

阶段 1 先记录当前基线，后续指标均与同一环境、同一模型和同一请求集的基线比较。

### 路由

- 每条评测请求均定义预期模式：`direct` 或 `agent`；
- Agent 请求定义允许工具、必需工具和禁止工具；
- 明确修改请求必须稳定生成确认卡片；
- 纯 selection 翻译、总结和解释不得继承历史修改或搜索意图；
- 普通问答不得因为弱关键词无意义进入 Agent；
- 路由误判数量必须低于基线，且不得通过扩大 Agent 覆盖率掩盖漏判。

### 性能与成本

- 记录首字延迟、总耗时、模型调用次数、工具调用次数和失败次数；
- 普通直答保持一次模型调用；
- 没有记忆信号时不得触发记忆提取模型调用；
- 同一份 RAG 或记忆结果不得在同轮重复检索；
- Agent 优化后，各标准场景的模型调用次数不得高于基线；
- RAG 查询继续保持后台 TopK，不把全库向量加载到 WebView。

### 安全

- 未授权路径读取继续被拒绝；
- 多编辑目标继续被拒绝；
- selection 精确范围失效时继续要求重新框选；
- 文件修改继续只生成确认卡片；
- 文档、网页、RAG 和记忆中的指令不得覆盖系统和工具规则；
- 自定义提示词不得覆盖安全边界。

## 阶段计划

### 阶段 1｜建立真实评测与性能基线

#### 目标

在修改路由和编排之前，用可重复的匿名请求集记录当前行为。

#### 范围

- Agent 路由矩阵；
- 候选能力与工具选择；
- 续接、selection、编辑授权和记忆边界；
- 匿名指标结构；
- 基线摘要。

#### 实施任务

1. 建立集中式 AI 路由评测集，覆盖：
   - 普通问答；
   - selection 总结、翻译、解释；
   - selection 上下文读取；
   - 文件总结；
   - 本地知识库研究；
   - Web 搜索；
   - 本地与 Web 对照；
   - 文件修改和撤销；
   - 长期记忆查询和保存；
   - 个性化改写；
   - 当前时间；
   - “继续、重试、换个方法”等续接；
   - 容易误触发的边界表达。
2. 每条案例记录：
   - 预期模式；
   - 允许、必需和禁止能力；
   - 是否允许写入；
   - 是否需要来源；
   - 是否允许继承上一轮任务。
3. 为同一请求记录：
   - 路由结果；
   - 候选工具；
   - 实际工具；
   - 模型调用次数；
   - 工具调用次数；
   - 首字和总耗时；
   - 最终状态。
4. 性能数据默认只记录枚举、数量、耗时和错误码，不记录用户原文、文件内容、API Key、URL 参数或工具结果正文。
5. 用固定供应商、模型、请求集和本地数据规模建立基线报告。

#### 验收标准

- 所有核心 AI 能力均有正例、反例和歧义边界案例；
- 测试数据匿名且不读取真实用户文件或数据库；
- 可以自动比较修改前后的路由差异；
- 可以区分路由错误、工具错误、模型错误和传输错误；
- expected 与 observed 分离，不把当前错误固化成正确断言；
- 基线报告明确标注环境、模型和数据规模，不能把合成结果描述为真实用户表现。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:runtime-schemas
npm run typecheck
```

另运行本阶段新增的路由矩阵定向测试。

#### 禁止事项

- 未建立基线前调整大量关键词或分数；
- 使用真实用户提示、文件或记忆作为 Fixture；
- 为统计方便记录完整提示词和上下文正文；
- 自动调用付费 API；
- 修改生产路由；
- 提前拆分 `useAiChat.ts`。

### 阶段 2｜统一路由决策

#### 目标

让一次用户请求只产生一个明确、可检查的路由决策，消除 hook 与 executor 的重复判断。

#### 范围

- `src/services/agent/intentDetector.ts`
- `src/services/agent/toolSelector.ts`
- `src/services/agent/types.ts`
- `src/services/agent/executor.ts`
- `src/services/agent/session.ts`
- `src/hooks/useAiChat.ts`
- 直接相关的 Agent 路由测试

#### 实施任务

1. 定义单一的路由决策对象，至少包含：
   - 请求类型；
   - `direct/agent` 模式；
   - selection 请求类型；
   - 候选能力；
   - 必需能力；
   - 候选工具；
   - 编辑确认需求；
   - 记忆检索模式；
   - 是否允许知识库、Web 和全文读取；
   - 命中的信号或原因码。
2. 由路由服务一次性生成决策：
   - `useAiChat` 负责提供本轮 AppContext；
   - executor 消费决策，不重新执行完整意图检测；
   - 手动能力开关和短指令续接在同一入口合并；
   - 安全校验仍在工具执行层保留。
3. 收紧弱信号：
   - “文档、分析、解释、最新”等单一弱词不能独立决定进入 Agent；
   - 强意图、组合规则、标签上下文和用户手动选择保持较高优先级；
   - selection 快速处理继续优先于历史工具意图。
4. 将路由原因以内部枚举保存，用于测试和匿名诊断；不向用户展示内部推理文本。
5. 路由指南只作为帮助文档，不再承担“必须按关键词才能正确工作”的职责。

#### 验收标准

- `useAiChat` 与 executor 对同一请求不再得到不同候选工具；
- 普通问答不增加模型调用；
- 显式知识库、Web、时间、记忆和修改请求保持原能力；
- selection 翻译和总结不误入修改流程；
- 短指令只继承上一轮 Agent 任务，不继承编辑授权；
- 路由矩阵相对基线减少误判且没有新增安全回归。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:memory
npm run typecheck
```

另运行集中路由矩阵、Agent continuation 和 selection 定向测试。

#### 禁止事项

- 用新的模型调用替代确定性首层路由；
- 把所有不确定请求统一送入 Agent；
- 删除工具层的二次权限校验；
- 顺带修改工具实现。

### 阶段 3｜拆分中央编排，保持行为不变

#### 目标

降低 `useAiChat.ts` 和 `executor.ts` 的职责密度，不在本阶段改变产品行为。

#### 范围

- `src/hooks/useAiChat.ts`
- `src/services/aiChatFlow.ts`
- `src/services/agent/executor.ts`
- 当前阶段新增的最小纯函数模块
- 直接相关测试

#### 实施任务

1. 只提取具备明确输入输出的逻辑：
   - 路由上下文构建；
   - Agent 请求构建；
   - 来源元数据整理；
   - 最终消息构建；
   - Agent 结果到 UI 状态的映射。
2. `useAiChat` 保留：
   - React 生命周期；
   - 请求取消；
   - store 更新；
   - 用户可见进度；
   - 普通与 Agent 分支调度。
3. executor 保留：
   - 模型工具规划循环；
   - 工具白名单；
   - 参数校验；
   - 强依赖补调；
   - 最大步骤和超时；
   - 工具结果回注。
4. 删除没有实际行为的知识库预检索空壳；只有在阶段 4 证明真实预检索有收益时再实现。
5. 保持现有错误文字、确认卡片、来源结构和 Agent 事件 schema。

#### 验收标准

- 路由矩阵结果与阶段 2 完全一致；
- Agent 事件顺序、确认卡片和来源元数据不变；
- 请求取消后不更新已失效消息；
- 不新增持久状态或跨会话隐式状态；
- 不改变现有工具实现和数据库结构。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:ai-http
npm run test:runtime-schemas
npm run typecheck
```

另运行 selection context、文件修改确认和相关 ESLint。

#### 禁止事项

- 同时重写 Zustand store；
- 引入通用工作流或 Agent 框架；
- 顺带重构 RAG、Memory 或 Provider；
- 混入性能行为调整。

### 阶段 4｜降低 Agent 延迟与重复调用

#### 目标

在不降低答案质量和安全性的前提下，减少无意义的模型与工具往返。

#### 范围

- Agent 循环；
- 最终回答生成；
- 工具结果复用；
- 调用预算；
- 与真实路径性能直接相关的最小代码和测试。

#### 实施任务

1. 修改前先在同一模型、同一配置和同一请求集上记录真实路径基线。
2. 区分场景：
   - 单工具即可完成；
   - 多工具研究；
   - 修改确认；
   - 工具结果后需要二次综合；
   - 工具结果本身已是最终状态。
3. 优化原则：
   - 普通直答继续单次调用；
   - 修改工具生成确认卡片后立即结束；
   - 明确的时间、列表或状态查询避免无意义的多轮规划；
   - 本地研究和 Web 对照保留最终综合调用；
   - 多个独立只读工具继续并行；
   - selection Level 1/Level 2 继续串行并执行跳级校验。
4. 如果实现知识库预检索：
   - 必须真正执行检索；
   - 结果必须直接复用；
   - Agent 不得再次调用相同查询；
   - 只有基线证明降低总延迟时才保留。
5. 为每轮设置统一调用预算：
   - 最大模型轮数；
   - 最大工具调用数；
   - 单工具超时；
   - 最大注入字符或 token；
   - 达到预算后的明确降级答案。
6. 区分规划温度与最终回答温度。

#### 验收标准

- 普通请求调用次数不高于基线；
- 修改确认请求不执行无意义的最终综合；
- 研究请求来源和信息不足边界不退化；
- 同轮不存在相同 RAG、Memory 或 Web 查询的重复调用；
- 取消、超时和最大步骤都产生稳定终态；
- 首字延迟和总耗时相对基线有明确改善或证明无回归。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:rag-query
npm run test:runtime-schemas
npm run typecheck
```

另运行真实路径 A/B、最大步骤、超时、取消和重复工具调用测试。

#### 禁止事项

- 通过减少来源、取消确认或扩大缓存有效期换取速度；
- 将不同用户请求的工具结果跨请求复用；
- 没有真实测量就宣称完成性能优化；
- 在没有本地模型或用户明确授权时自动调用付费 API。

### 阶段 5｜改善长期记忆召回

#### 目标

在保持按需检索和作用域隔离的前提下，提高弱记忆与个性化改写场景的召回率。

#### 范围

- `src/services/memory/memoryPolicy.ts`
- `src/services/memory/memoryService.ts`
- `src/services/database/memoryQuery.ts`
- 直接相关记忆测试

#### 实施任务

1. 比较：
   - 词法召回；
   - 向量召回；
   - 结构化事实命中；
   - 项目与全局作用域；
   - active、candidate 和 superseded 过滤。
2. 调整轻量模式候选策略：
   - 优先保留词法匹配；
   - 无词法匹配但已启用 Embedding 时，只从当前作用域和允许分类中取有界候选；
   - 候选上限保持小且固定；
   - 基础查询继续不加载 embedding；
   - 只对候选 ID 二次加载向量。
3. 个性化改写继续只检索 `preference/instruction`；
4. 普通翻译、总结和改写继续不检索记忆；
5. 自动提取继续先成为 candidate，不直接注入；
6. 记录召回方式和候选数，不记录记忆正文。

#### 验收标准

- 无词面重合的真实偏好可以在允许条件下被语义召回；
- 普通改写不增加记忆请求；
- 项目记忆不会跨工作区注入；
- candidate 和被替代记忆不会注入；
- 无 Embedding 时稳定降级为词法检索；
- 查询不恢复全量 embedding 加载。

#### 检查命令

```bash
npm run test:memory
npm run test:memory-query
npm run typecheck
```

另运行个性化改写召回矩阵。

#### 禁止事项

- 每轮默认检索记忆；
- 为提升召回放宽作用域和状态过滤；
- 在基础列表查询中加载 embedding；
- 读取真实用户记忆作为测试数据。

### 阶段 6｜校准 Provider 能力与产品表述

#### 目标

让设置界面、能力检测和实际协议实现保持一致。

#### 范围

- `src/services/ai/aiClient.ts`
- `src/services/ai/providers/**`
- `src/services/ai/reasoningAdapter.ts`
- `src/services/externalHttp.ts` 的现有调用边界
- 与 Provider 展示直接相关的设置代码和文档

#### 实施任务

1. 建立 Provider 能力矩阵：
   - 对话协议；
   - 流式输出；
   - 原生 tool calling；
   - Embedding；
   - reasoning 参数；
   - 模型列表；
   - 本地 API；
   - Origin 授权。
2. 明确区分：
   - 供应商品牌；
   - OpenAI Compatible 接口；
   - 原生 Anthropic Messages；
   - OpenAI Responses。
3. 对未实现协议：
   - UI 不展示为可用；
   - 配置校验给出准确原因；
   - 文档不暗示已经支持。
4. 只有存在明确用户需求时，才将原生 Anthropic Messages 或 OpenAI Responses 作为独立后续任务实现。
5. reasoning 适配使用真实请求验证，不仅依赖模型名字符串。
6. 所有协议继续复用 `externalHttp.ts`。

#### 验收标准

- 用户在配置前能知道协议是否真正可用；
- 未实现协议不会进入运行后才失败；
- OpenAI Compatible 旧配置保持兼容；
- reasoning 参数失败时可安全降级；
- 自定义和本地 Origin 授权行为不变。

#### 检查命令

```bash
npm run test:ai-http
npm run typecheck
```

另运行 Provider 请求体、reasoning 失败降级、相关设置测试和必要桌面构建。

#### 禁止事项

- 为“支持更多 Provider”复制网络实现；
- 使用 WebView 原生 `fetch`；
- 未经真实验证宣称支持某厂商原生协议；
- 无明确需求时新增大型协议依赖。

### 阶段 7｜体验收口与桌面验收

#### 目标

确认路由、状态、来源和失败反馈在真实桌面流程中一致。

#### 范围

- 前六阶段涉及模块；
- 真实桌面验收记录；
- 验收发现问题所需的最小修复；
- 任务文件与必要文档。

#### 实施任务

1. 手动验收：
   - 普通问答；
   - selection 翻译、解释和上下文读取；
   - 单文件总结；
   - 本地知识库研究；
   - Web 搜索与本地对照；
   - 文件修改确认、拒绝和应用；
   - 记忆查询、显式保存和候选管理；
   - Agent 取消、超时、工具失败和降级；
   - 本地模型与远程模型。
2. 核对用户可见状态：
   - 当前在检索、初始化、降级还是生成；
   - 来源只在真实使用资料时出现；
   - 失败原因明确且不泄露密钥或完整上下文；
   - 不展示内部推理内容。
3. 生成基线对比报告：
   - 路由差异；
   - 模型与工具调用次数；
   - 首字与总耗时；
   - 失败和降级；
   - 已知限制。
4. 仅在进入正式发布阶段时执行项目发布门禁。

#### 验收标准

- 所有核心场景具备可复现结果；
- 无权限和数据边界回归；
- 路由准确性、延迟或成本至少有一项明确改善，其他项无显著退化；
- 已知限制与 Provider 能力如实记录；
- 不以单元测试代替真实桌面操作验收。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:ai-http
npm run test:memory
npm run test:memory-query
npm run test:rag-query
npm run test:runtime-schemas
npm run typecheck
npm run build:desktop
```

另运行阶段 1 的完整定向评测集和相关 ESLint。

#### 禁止事项

- 非发布阶段不运行全量 E2E、全仓库覆盖率或发布门禁；
- 不把合成测试结果描述为真实体验；
- 不自动提交、推送、打 tag 或发布。

## 推荐执行顺序

严格按以下顺序推进：

1. 阶段 1：建立基线；
2. 阶段 2：统一路由；
3. 阶段 3：拆分编排；
4. 阶段 4：优化延迟与成本；
5. 阶段 5：改善记忆召回；
6. 阶段 6：校准 Provider 能力；
7. 阶段 7：桌面验收。

阶段 1、2、3 是后续工作的前置条件。

阶段 4、5、6 必须分开实施和验收，避免性能、记忆与网络协议问题混在同一批变更中。

## 当前阶段详细任务

### 阶段 4｜降低 Agent 延迟与重复调用

#### 目标

在不降低答案质量和安全性的前提下，基于真实路径测量减少无意义的模型与工具往返。

#### 开始前必须读取

- `AGENTS.md`
- `docs/agent-contracts/ai-selection.md`
- `src/services/agent/executor.ts`
- `src/hooks/useAiChat.ts` 中的 Agent 与最终回答入口
- 阶段 1 路由矩阵与阶段 3 编排测试

#### 允许修改

- Agent 循环与最终回答生成
- 工具结果复用与调用预算
- 与真实路径性能直接相关的最小代码和测试
- `AI_IMPLEMENTATION_PLAN.md`

#### 验收标准

- [ ] 修改前记录同一模型、配置和匿名请求集的真实路径基线。
- [ ] 普通请求调用次数不高于基线。
- [ ] 修改确认请求不执行无意义的最终综合。
- [ ] 研究请求来源和信息不足边界不退化。
- [ ] 同轮不存在相同 RAG、Memory 或 Web 查询的重复调用。
- [ ] 取消、超时和最大步骤产生稳定终态。
- [ ] 首字延迟和总耗时相对基线有明确改善或证明无回归。

#### 检查命令

```bash
npm run test:agent-parser
npm run test:rag-query
npm run test:runtime-schemas
npm run typecheck
```

#### 禁止事项

- [ ] 不通过减少来源、取消确认或扩大缓存有效期换取速度。
- [ ] 不跨用户请求复用工具结果。
- [ ] 没有真实测量不宣称性能优化完成。
- [ ] 没有本地模型或用户明确授权时不自动调用付费 API。

## 阶段历史

### 阶段 3｜拆分中央编排，保持行为不变

- 状态：已完成
- 完成内容：
  - 提取路由上下文、编辑目标和 Agent 请求构建纯函数
  - 提取 Agent 来源、结果展示映射和最终回答消息构建纯函数
  - 将回答提示词移入独立模块，消除路由服务与 executor 的循环依赖
  - 删除返回 `null` 的知识库预检索空壳，保留真实记忆预检索与 Agent 内知识检索
  - 新增匿名编排定向测试，覆盖当前标签授权、单一路由决策复用、来源和最终消息
- 验证结果：
  - `npm run test:agent-parser`、`npm run test:ai-http`、`npm run test:runtime-schemas`、`npm run test:selection-context`：通过
  - 编排与路由定向 Vitest：155 通过
  - `npm run typecheck`、阶段相关 ESLint、`git diff --check`：通过
- 遗留问题：
  - 未做真实模型性能测量；按计划留到阶段 4
  - 路由矩阵 15 条 expected/observed 差异保持不变，本阶段未调整产品路由行为

### 阶段 2｜统一路由决策

- 状态：已完成
- 完成内容：
  - 创建 `src/services/agent/routingService.ts`，实现 `makeRoutingDecision` 统一路由决策
  - 定义 `RoutingDecision`、`RoutingMode`、`RoutingReasonCode` 类型（`types.ts`）
  - `useAiChat.ts` 调用 `makeRoutingDecision` 生成决策，消除与 executor 的重复意图判断
  - `executor.ts` 消费 `routingDecision`，不再重新执行完整意图检测
  - 收紧弱信号：单一弱词不被 regex 视为强信号，同一词触发多 capability 只算一个弱信号
  - `shouldUseAgentMode`（`intentDetector.ts`）和 `computeAgentMode`（`routingService.ts`）同步收紧
  - 新增 `makeRoutingDecision` 和 `shouldUseAgentMode` 收紧弱信号测试（152 个测试）
  - 导出统一路由决策服务（`index.ts`）
- 验证结果：
  - `npm run test:agent-parser`：通过
  - `npm run test:memory`：通过
  - `npm run test:routing-matrix`：152 通过
  - `npm run typecheck`：通过
- 遗留问题：
  - 基线摘要中仍有 15 条差异（模式误判 3 条、禁止能力误入 12 条）；阶段 3 保持路由行为不变，后续仅在有测量和明确验收时处理
  - "文件修改-算了不改了" 模式误判：`isCancelLastAppliedEdit` 需要历史消息中包含特定格式，单元测试中无实际历史

### 阶段 1｜建立真实评测与性能基线

- 状态：已完成
- 完成内容：
  - 建立 65 条匿名路由案例矩阵（`tests/agent/routingMatrix.test.ts`），覆盖 12 个分类
  - 含正例、反例和边界案例：普通问答、Selection、文件总结、知识库、Web 搜索、Web 对照、文件修改、记忆、个性化改写、时间、续接、边界
  - 生成当前行为基线摘要，记录 expected vs observed 差异（模式误判、禁止能力误入、必需能力漏调）
  - 辅助函数专项测试全部通过（shouldAllowMemoryWrite、classifySelectionRequest、isImplicitEditContinuation、isLocalResearchIntent、isWebComparisonIntent、isDocumentRewriteIntent、isFileSummaryIntent、buildCandidateTools、isWriteTool/isReadTool）
  - 新增 `npm run test:routing-matrix` 命令
  - 未修改任何生产代码
- 验证结果：
  - `npm run test:routing-matrix`：133 通过
  - `npm run test:agent-parser`：通过
  - `npm run test:runtime-schemas`：通过
  - `npm run typecheck`：通过
- 遗留问题：
  - 已知基线差异（弱关键词触发、单字边界误触发等），留待阶段 2 处理
  - 性能数据（延迟、token 成本）留待阶段 4 在用户允许的模型上测量

## 每阶段交付要求

每阶段结束必须更新：

- 顶部当前状态；
- 上次执行结果；
- 实际验证结果；
- 本阶段剩余；
- 阻塞问题；
- 下一阶段；
- 阶段历史。

每次最终只汇报：

1. 本次完成内容；
2. 修改或新增文件；
3. 实际执行的验证及结果；
4. 当前阶段状态；
5. 遗留或阻塞问题；
6. 是否建议新开窗口。

## 新会话使用方式

```text
请使用 staged-task-handoff Skill，完整读取 AI_IMPLEMENTATION_PLAN.md，
根据顶部当前状态只执行当前阶段任务。

不要重复已完成内容，不提前实施后续阶段。
完成后执行当前阶段必要检查，并更新当前状态和阶段历史。
不要提交或推送代码。
```
