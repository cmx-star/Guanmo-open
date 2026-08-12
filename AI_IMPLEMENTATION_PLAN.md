# 观墨缺陷与能力缺口分阶段修复计划

> 本文件是本任务唯一状态来源。执行者必须使用 staged-task-handoff Skill，完整读取后只执行当前阶段，不得提前实施后续阶段。

## 当前状态

- 项目状态：进行中
- 当前阶段：阶段 8｜结构化 Embedding 与邻居扩展
- 阶段状态：未开始
- 上次执行结果：阶段 6、7 已完成；Direct、Agent、最终综合回答共享统一总预算与一次安全降级，匿名 RAG 固定评测集和 baseline runner 已建立
- 验证结果：阶段 6 定向测试 25/25、selection/runtime schema、typecheck、desktop build、匿名隔离 Tauri 长对话通过；阶段 7 六项质量指标 1.0、无答案误召回率 0、RAG query 通过；定向 ESLint 0 error（3 个既有 warning）；`git diff --check` 通过
- 本阶段剩余：先对照阶段 7 baseline 冻结结构化 Embedding 输入版本和邻居边界，再实施阶段 8
- 本阶段允许修改：按阶段 8 实施前核实精确文件范围
- 阻塞问题：无
- 下一阶段：阶段 9｜Rust 原生请求取消
- Git 状态：分支 `codex/defect-capability-fixes`；未提交、未推送

## 项目目标

以 `D:/八股/观墨-缺陷与能力缺口修复清单.md` 为需求源，分阶段修复已经确认的正确性和稳定性问题，建立上下文与 RAG 评测闭环，再处理运行时可靠性和高风险产品能力。每次只完成一个编号或一个紧密关联的小组，保持旧索引、旧向量、旧配置、旧聊天和 SQLite 数据兼容。

## 技术栈

- 运行环境：Tauri 2 桌面应用，Windows 为主要验收环境
- 前端：React 18、TypeScript 5、Vite 6
- 桌面端：Rust、SQLx、SQLite、reqwest、Tauri Channel
- 测试：Vitest、Node 定向检查、Rust 单元测试
- 构建：Vite、Cargo、Tauri CLI

## 需求边界与状态

### 本计划必须实施

- 确定缺陷：RAG-01、RAG-02、RAG-03、AGENT-01、CONTEXT-02。
- 稳定性修复：RAG-04。
- 建立评测后再实施的质量能力：RAG-05、RAG-06、RAG-07、CONTEXT-01。
- 运行时可靠性：HTTP-01、HTTP-02、AGENT-02、PERF-01。
- 高风险能力：MD-01、SOURCE-01、PROMPT-01，必须各自独立验收。

### 条件触发，不作为当前交付完成条件

- RAG-08：只有真实知识库规模和基线证明全量扫描不可接受时，才评估 ANN、FTS5 或其他索引方案。
- AGENT-03：只有出现跨重启长任务、后台研究、多次确认恢复或多 Agent 状态图需求时，才评估 checkpoint 或成熟状态图框架。
- 未使用 LangChain 不视为缺陷，不为了框架化重写当前 Agent。

## 总体约束

- 每个会话默认只执行一个阶段，不提前实现后续阶段。
- 优先最小修改，不新增当前阶段不需要的依赖，不重构无关模块。
- RAG 和长期记忆继续以 SQLite 为业务主存储；Rust 内存索引只做查询加速。
- 旧向量、旧预处理版本、旧配置和旧聊天必须保持可读；禁止清库、重置配置或要求用户重建内容。
- 不调整检索权重、阈值或排序策略，除非阶段 7 的离线评测提供收益证据。
- 外部 HTTP 必须继续通过 `src/services/externalHttp.ts` 和受限 Rust 代理，不增加 WebView 直连回退。
- Markdown 预览继续遵守同步 ReactMarkdown、顶层块虚拟化及跨块语义兼容契约。
- 自动化验证不替代真实 Tauri 验收；流式、取消、长对话和长文档阶段必须使用新鲜桌面进程验证。
- 测试只使用匿名 Fixture、临时目录和临时数据库，不读取真实用户数据。
- 不修改或夹带现有 `.trae/`、Android/长文档/使用统计计划和 `design-qa.md`。
- 未经明确要求不提交、推送、打 tag、创建 Release 或 PR。

## 阶段计划

### 阶段 1｜RAG 检索加权正确性（RAG-01）

- 目标：向量和关键词分支只产生原始分数，融合完成后每个结果统一且仅调用一次场景加权。
- 范围：`src-tauri/src/rag_index.rs` 内检索合并逻辑及同文件 Rust 单元测试、本文件。
- 验收标准：纯关键词、纯向量、混合命中都只加权一次；分数不超过 1；排序稳定；作用域、去重、多文档轮询和 TopK 不变。
- 检查命令：定向 Rust 测试、`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`git diff --check`。
- 暂不处理：融合权重、BM25、RRF、MMR、全量扫描优化。

### 阶段 2｜语义分块配置归一（RAG-02）

- 目标：删除失效的 `chunkSize/chunkOverlap` 配置和透传，让配置、实现和契约统一描述当前 AST 语义分块策略。
- 范围：RAG 配置类型、pipeline、chunker、语义分块直接测试、本文件。
- 验收标准：不存在无效配置入口；普通段落、无安全边界文本、代码、公式、列表和表格行为明确；不引入滑动窗口或 overlap。
- 检查命令：语义分块定向测试、`npm run test:agent-parser`、`npm run typecheck`、定向 ESLint、`git diff --check`。
- 暂不处理：Embedding 子块、上下文装箱和数据库迁移。

### 阶段 3｜Agent 单工具超时（AGENT-01）

- 目标：使用一个可清理的超时控制完成子任务 abort 和结构化终止，保留父会话取消转发。
- 范围：Agent executor、Agent 执行预算直接测试、本文件。
- 验收标准：成功、失败、取消、超时四条路径均清理计时器和监听器；区分 timeout、cancelled、tool_error；迟到结果不能覆盖当前消息；写入确认不变。
- 检查命令：Agent 执行预算定向测试、`npm run typecheck`、定向 ESLint、`git diff --check`。
- 暂不处理：整次 Agent deadline、工具重试、Provider 传输取消。

### 阶段 4｜RAG 完整语义块装箱（RAG-03）

- 目标：以预算装入完整 Chunk，消除 `buildContext` 对最后一个来源的字符硬截断，并准确标记跳过与覆盖范围。
- 范围：RAG 上下文构建、直接调用类型/测试、本文件；如需新增通用预算接口，只建立阶段 6 可复用的最小边界。
- 验收标准：不产生未闭合代码围栏、公式或表格；元数据与实际内容一致；放不下时可尝试更短候选；输出不超过预算。
- 检查命令：RAG 上下文定向测试、`npm run typecheck`、定向 ESLint、`git diff --check`。
- 暂不处理：聊天历史摘要、模型级总预算、邻居扩展。

### 阶段 5｜Embedding 超长输入兜底（RAG-04）

- 目标：保留展示 Chunk 的语义完整性，为超长 Embedding 输入提供安全子块、父块映射和有限失败降级。
- 前置：先冻结父 Chunk、Embedding 子块、向量聚合、行号映射和旧向量兼容契约；涉及接口时先记录前后端字段。
- 范围：语义分块/Embedding 输入、pipeline、RAG 持久化与直接测试、本文件；确有必要时最小扩展数据库 Schema 和 Rust 解码。
- 验收标准：超长代码、公式、HTML、无边界长文本不阻断整篇入库；错误可定位但不记录正文；结果映射回原文件和准确行号；旧向量继续可读并渐进重建。
- 检查命令：`npm run test:rag-index`、相关 Schema/迁移定向测试、`npm run typecheck`、定向 ESLint、Rust 定向测试、`git diff --check`。
- 暂不处理：标题路径增强、召回权重调整和大型向量数据库。

### 阶段 6｜统一模型上下文预算（CONTEXT-02、CONTEXT-01）

- 目标：建立 Direct、Agent、最终综合回答共用的总预算，统一装箱系统 Prompt、当前问题、历史、RAG、Memory、选区和工具结果。
- 实施顺序：先建立模型窗口和输出预留契约；再接普通聊天与 Agent；最后接 RAG/选区完整语义原子和一次无副作用超限降级。
- 验收标准：长对话不再无条件发送全部历史；近期原文、用户约束、授权和未完成事项不可淘汰；原始 SQLite 历史不修改；超限最多安全重试一次且不重复副作用；匿名诊断不含正文。
- 检查命令：小窗口假模型定向测试、选区/RAG/Agent 相关定向测试、runtime schema、typecheck、定向 ESLint、desktop build、真实 Tauri 长对话验收、`git diff --check`。
- 暂不处理：调整检索排名和 Prompt A/B 平台。

### 阶段 7｜RAG 离线评测基线（RAG-05）

- 目标：建立匿名化问题—证据集，固定现有关键词、融合权重、阈值和多样化规则作为 baseline。
- 范围：独立评测 Fixture、评测 runner、结果格式和文档、本文件；不得读取真实用户数据。
- 验收标准：可重复记录 Recall@K、MRR/NDCG、来源准确率、无答案误召回率、冷/热延迟和回答 groundedness；基线结果可比较。
- 检查命令：RAG 评测 runner、`npm run test:rag-query`、`git diff --check`。
- 暂不处理：在没有基线证据时引入 BM25、RRF、MMR 或 reranker。

### 阶段 8｜结构化 Embedding 与邻居扩展（RAG-06、RAG-07）

- 目标：将文档标题、标题路径和块类型纳入版本化 Embedding 输入，并在剩余预算内扩展同文档相邻证据。
- 范围：Embedding 预处理版本、渐进重建、检索结果邻居装箱、直接测试、本文件。
- 验收标准：旧向量兼容；标题变化触发正确重建；邻居不跨越不相关标题边界、不重复、标记为 `neighbor-context`；阶段 7 指标不回退且目标场景有收益。
- 检查命令：RAG index/query/评测定向检查、runtime schema、typecheck、Rust 定向测试、`git diff --check`。
- 暂不处理：无评测证据的 reranker 或全新检索引擎。

### 阶段 9｜Rust 原生请求取消（HTTP-01）

- 目标：通过 requestId 和 Rust CancellationToken 让前端取消真正终止 reqwest 请求，并幂等清理注册表。
- 前置：先冻结开始请求、Channel 事件、取消命令和终止状态契约。
- 范围：`externalHttp`、受限 Rust HTTP 代理、runtime schema、AI HTTP 直接测试、本文件。
- 验收标准：取消能停止 Rust 响应读取；正常完成、失败、超时和取消均清理；Origin/DNS/IP/重定向安全边界不变；Web 端仍抛 `UnsupportedCapabilityError`。
- 检查命令：`npm run test:ai-http`、runtime schema、typecheck、Rust 定向测试、desktop build、新鲜 Tauri 取消验收、`git diff --check`。
- 暂不处理：背压窗口和整次 Agent deadline。

### 阶段 10｜Agent 全局 deadline（AGENT-02）

- 目标：模型调用和工具调用共享整次任务 deadline，所有局部超时由剩余时间收敛。
- 范围：Agent 请求配置、executor、Provider 调用衔接、直接测试、本文件。
- 验收标准：deadline 到达后基于已有证据降级回答并声明缺失；仅只读幂等操作允许有限重试；写入和确认类工具绝不自动重试。
- 检查命令：Agent orchestration/预算定向测试、typecheck、定向 ESLint、新鲜 Tauri 验收、`git diff --check`。
- 暂不处理：checkpoint、跨重启恢复和多 Agent 状态图。

### 阶段 11｜端到端有界背压（HTTP-02）

- 目标：为 Rust 上游流、Tauri Channel 和前端 ReadableStream 定义有界缓冲、批次、ACK 窗口和慢消费者策略。
- 前置：先采集文本流和高速本地模型基线，若实际流量未触发风险，只完成契约与压力测试并保持实现后置。
- 验收标准：缓冲字节数有硬上限；取消/超时不会死锁；慢消费者按契约降级或终止；SSE 解析接口保持兼容。
- 检查命令：AI HTTP 压力定向测试、Rust 定向测试、desktop build、新鲜 Tauri 高速流验收、`git diff --check`。
- 暂不处理：音视频或大文件传输能力。

### 阶段 12｜RAG 性能档位调度（PERF-01）

- 目标：让节省内存、平衡、极速档位按知识库规模、可用内存、近期使用和用户活动调度 RAG 初始化、预热与取消。
- 范围：现有性能模式调度、RAG 初始化状态、直接测试、本文件。
- 验收标准：预热不阻塞首屏；用户输入/切文档/内存压力可取消；节省内存保持按需初始化；不得在无测量时增加主动释放。
- 检查命令：app warmup/RAG query 定向检查、typecheck、Rust 定向测试、desktop build、新鲜 Tauri 性能验收、`git diff --check`。
- 暂不处理：RAG-08 全量扫描替换。

### 阶段 13｜跨块 Markdown 语义虚拟化（MD-01）

- 目标：分别为 Reference、Footnote 和必要 HTML 建立跨块语义模型，减少整篇同步渲染降级范围。
- 实施顺序：Reference 独立阶段；Footnote 独立阶段；HTML 独立评估。任一子阶段未通过真实桌面验收不得推进下一项。
- 验收标准：引用、脚注、目录、搜索定位、同步滚动、预览内编辑和虚拟高度校正均不回退；桌面构建无预览 Worker 产物。
- 检查命令：对应 Markdown 定向测试、typecheck、定向 ESLint、desktop build、真实长文档 Tauri 验收、`git diff --check`。
- 暂不处理：重写 Markdown 渲染器或静默牺牲语义。

### 阶段 14｜结论级来源引用（SOURCE-01）

- 目标：为本轮真实工具结果分配稳定来源 ID，校验回答中的引用并支持定位到文件行号或网页。
- 范围：Agent/Direct 来源协议、运行时解码、回答渲染与来源打开、直接测试、本文件。
- 验收标准：引用 ID 必须来自本轮实际结果；未引用候选不展示为已采用；旧回答级来源继续兼容；无来源回答不显示占位。
- 检查命令：reading quality/source/AI panel 定向测试、runtime schema、typecheck、desktop build、真实 Tauri 来源跳转验收、`git diff --check`。
- 暂不处理：自动生成不存在的引用或修改旧聊天正文。

### 阶段 15｜路由与 Prompt 评测闭环（PROMPT-01）

- 目标：为路由规则和 Prompt 建立版本号、匿名固定回归集及可比较的 A/B 结果。
- 范围：路由/Prompt 版本元数据、评测 runner、匿名诊断和文档、本文件。
- 验收标准：记录 Direct/Agent 误判率、能力漏选/多选率、工具成功率、调用数和延迟；版本切换不改变用户数据；结论来自同模型同配置基线。
- 检查命令：routing matrix、Agent parser/orchestration、Prompt 评测 runner、typecheck、`git diff --check`。
- 暂不处理：在没有真实需求时引入 Agent 框架或 checkpoint。

### 阶段 16｜条件项审计与总体验收（RAG-08、AGENT-03）

- 目标：汇总前序阶段结果，判断条件项是否达到实施门槛；未达到则明确维持现状并完成整体交接。
- 验收标准：每个必做编号均有实现、自动化结果和必要桌面证据；RAG-08/AGENT-03 有明确的实施或不实施依据；未验证项不得标记完成。
- 检查命令：只重跑受最终修改影响的定向检查；如进入发布准备，另行取得授权后执行发布门禁。
- 暂不处理：提交、推送、tag 和 Release，除非用户另行明确授权。

## 当前阶段详细任务

### 目标

只完成 RAG-06、RAG-07：将文档标题、标题路径和块类型纳入版本化 Embedding 输入，并在阶段 7 baseline 不回退的前提下，于剩余预算内扩展同文档相邻证据。

### 允许修改

- Embedding 预处理版本、渐进重建与直接测试（实施前按实际调用链冻结精确范围）
- RAG 检索结果邻居装箱及直接测试（仅限剩余预算内扩展）
- 阶段 7 匿名评测 Fixture 与 runner（仅用于证明指标不回退或补充目标场景）
- `AI_IMPLEMENTATION_PLAN.md`

### 实施任务

1. 冻结文档标题、标题路径、块类型的版本化 Embedding 输入格式，以及旧向量兼容和渐进重建条件。
2. 实施结构化 Embedding 输入，确保标题变化和预处理版本变化只触发必要重建。
3. 在统一上下文剩余预算内扩展同文档相邻证据，禁止跨越不相关标题边界或重复装箱。
4. 将扩展证据标记为 `neighbor-context`，保持原 TopK、排序、来源元数据和旧结果兼容。
5. 使用阶段 7 baseline 与目标场景验证指标不回退且目标场景有收益，再更新状态与阶段历史。

### 验收标准

- [ ] 旧向量继续可读，结构化输入按版本渐进重建，标题变化触发正确重建。
- [ ] 邻居扩展只使用剩余预算，不跨不相关标题边界、不重复，并标记为 `neighbor-context`。
- [ ] 原 TopK、检索排序、来源元数据和完整语义 Chunk 保持兼容。
- [ ] 阶段 7 baseline 指标不回退，至少一个匿名目标场景证明邻居扩展收益。
- [ ] RAG index/query/eval、runtime schema、typecheck、Rust 定向测试与 diff 检查通过。

### 检查命令

在阶段 8 冻结精确调用链后回填，至少包含 RAG index/query/eval、runtime schema、typecheck、Rust 定向测试和 `git diff --check`。

### 禁止事项

- 不在 baseline 无收益或回退时调整检索权重、阈值或引入 reranker。
- 不要求用户清库或一次性重建全部旧向量。
- 不跨不相关标题边界扩展邻居，不重复或静默截断完整语义 Chunk。
- 不新增无关依赖，不重构整个聊天或 Agent 架构。
- 不修改或夹带已有无关工作区文件。
- 不自动提交、推送、打 tag、创建 Release 或 PR。

## 阶段历史

### 阶段 1｜RAG 检索加权正确性

- 状态：已完成
- 完成内容：移除关键词候选阶段的提前加权；融合结果集合统一应用一次当前文件/最近文档加权；增加纯关键词、纯向量、混合检索、分数上限和重复查询稳定性回归
- 验证结果：`cargo test --manifest-path src-tauri/Cargo.toml rag_index::tests --lib --jobs 1` 4/4 通过，1 项真实用户数据库测试按设计忽略；Rust fmt、`git diff --check` 通过
- 遗留问题：无

### 阶段 2｜语义分块配置归一

- 状态：已完成
- 完成内容：删除 `RAGConfig`、默认值、pipeline 和 `chunkMarkdown` 中失效的 `chunkSize/chunkOverlap`；补充安全段落边界、无边界超长文本、列表和表格测试，保留代码/公式整体语义
- 验证结果：`npx vitest run tests/rag/semanticChunker.test.ts` 8/8、`npm run test:agent-parser`、`npm run typecheck` 通过；定向 ESLint 0 error（3 个既有 warning）；`git diff --check` 通过
- 遗留问题：无

### 阶段 3｜Agent 单工具超时

- 状态：已完成
- 完成内容：将 abort 与竞速 reject 的双计时器合并为一个可清理控制；超时先 abort 子工具，父取消可终止不响应 abort 的工具；执行结果区分 success、timeout、cancelled、tool_error，迟到结果不回写
- 验证结果：`npx vitest run tests/agent/agentExecutionBudget.test.ts` 10/10、`npm run typecheck` 通过；定向 ESLint 0 error（3 个既有 warning）；`git diff --check` 通过
- 遗留问题：无

### 阶段 4｜RAG 完整语义块装箱

- 状态：已完成
- 完成内容：新增结构化上下文装箱结果；按完整 Chunk 原子装入字符预算，跳过过长候选后继续尝试后续候选；固定前缀、来源头、分隔符和跳过提示全部计入预算；直接聊天来源与实际装入内容一致
- 验证结果：`npx vitest run tests/rag/ragContext.test.ts` 7/7、`npm run typecheck` 通过；定向 ESLint 0 error（1 个既有 warning）；`git diff --check` 通过
- 遗留问题：无

### 阶段 5｜Embedding 超长输入兜底

- 状态：已完成
- 完成内容：超长父 Chunk 仅在 Embedding 请求层按安全边界拆分并保留准确行号；成功子向量均值聚合回父 Chunk；批量失败后每个子输入最多重试一次，匿名错误不含正文；v1 向量保持可读并按 v2 预处理版本渐进重建
- 验证结果：`npx vitest run tests/rag` 35/35、`npm run test:rag-index`、`npm run test:runtime-schemas`、`npm run typecheck` 通过；定向 ESLint 0 error（1 个既有 warning）；`git diff --check` 通过
- 遗留问题：无

### 阶段 6｜统一模型上下文预算

- 状态：已完成
- 完成内容：基于 `maxContextLength` 建立统一窗口、25% 输出预留和固定开销契约；Direct、Agent 循环和最终综合回答共用完整消息原子装箱；优先保留系统规则、当前问题、约束、授权和未完成事项；服务端超限仅重装箱并安全重试一次
- 验证结果：小窗口及降级定向测试与 Agent/RAG 回归 25/25、selection context、runtime schema、typecheck、desktop build 通过；匿名隔离 Tauri 假模型长对话确认请求受预算约束并保留关键约束；定向 ESLint 0 error（3 个既有 warning）；`git diff --check` 通过
- 遗留问题：无

### 阶段 7｜RAG 离线评测基线

- 状态：已完成
- 完成内容：新增匿名固定问题—证据集、内存评测 runner、JSON 指标输出和基线说明；固定现有关键词、向量融合、阈值和多文档多样化逻辑
- 验证结果：Recall@3、MRR、NDCG@3、来源准确率、groundedness 均为 1.0，无答案误召回率为 0；冷/热延迟可重复记录；`npm run test:rag-query` 与 `git diff --check` 通过
- 遗留问题：当前 Fixture 为最小确定性基线，后续质量能力应按真实匿名失败场景增量扩充，不得读取用户数据

## 新窗口执行提示词

~~~text
请使用 staged-task-handoff Skill，完整读取 AGENTS.md 和 AI_IMPLEMENTATION_PLAN.md，
根据顶部当前状态只执行当前阶段，不重复已完成内容，不提前实施后续阶段。
完成后执行本阶段定向检查，并更新当前状态与阶段历史。
不要提交或推送代码。
~~~
