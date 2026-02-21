# TODO / 审计结论（2026-02-21）

## 1. 总结结论
- 当前项目还不能宣称“所有表在所有参数组合下都不会漏报”。
- 原因不是单纯参数问题，而是有一组表目前没有任何写入逻辑（代码未实现上报链路）。

## 2. 本次已修复
- 修复 `rid` 参数大小写兼容（`rid`/`RID`）导致的 `/verify` 与 `/api/questions` 漏报问题。
- 修复 `/ai` 页面回跳 `/` 时丢失 `rid` 导致中间件拦截的问题。
- 修复 `search` 第 1 页“0 结果不写 history”的问题，现在第 1 页都会写 `search_history`。
- 在 `/api/history/save` 增加验证题生成与落库，打通 `verification_questions` 上报链路。
- 增加验证题生成失败时的 fallback 题，避免 LLM 不可用导致 `verification_questions` 空写入。
- 增加 `results` 入参数组校验，避免脏请求导致不可预期落库。
- 修复 `/verify` 前端统计字段名与后端返回不一致导致的统计显示异常。

## 3. 目前“有上报”的表
- `search_sessions`
- `search_history`
- `verification_questions`
- `user_answers`

## 4. 目前“无上报实现”的表（关键缺口）
- `task_records`
- `click_events`
- `page_engagements`
- `show_all_content_clicks`
- `show_all_references_clicks`

## 5. 参数组合结论
- `/, /ai, /verify` 无 `rid`：中间件拦截（403），不会上报。
- 有 `rid`、无 `q`：页面可访问，但要有用户动作（搜索/提问/答题）才会落库。
- 有 `rid` 且有 `q/query/topic/keyword`：会触发自动搜索/自动提问并落 `search_*` 与 `verification_questions`。
- `RID` 大写参数：当前已兼容，不会因大小写导致 `/verify` / `/api/questions` 链路断裂。

## 6. 仍存在的风险
- `task_* / click_* / engagement_*` 相关 5 张表未接入任何写入 API，属于确定性漏报。
- rrweb 数据在 R2，不在 SQL；且默认仅 `debug=true` 时才启用录制。
- 本次无法在当前沙箱里起本地端口做端到端回归（端口监听权限受限），已完成静态链路审计与 TS 编译校验。

## 7. 下一步 TODO（按优先级）
- 实现 `task_records` 创建与生命周期归档 API。
- 实现 SERP 点击/引用点击上报 API，落 `click_events` 与 `show_all_*`。
- 实现页面活跃时长上报 API，落 `page_engagements`。
- 补参数组合 E2E 矩阵测试（`rid` 有/无、大小写、`q` 有/无、入口 `/` `/ai` `/verify`）。
