# V槽 CMS — 新窗口无缝对接文档

> 更新时间：2026-07-16  
> 分支：`cursor/multilang-cms-rebuild-78df`（base: `main`）  
> PR：https://github.com/trustyai/websites/pull/2  
> 应用目录：`vgrooving-cms/`  
> 当前 buildId：`20260716f-layout-fix`

把本文件 + `DEVELOPER.md` 丢给新会话即可继续开发。优先读本文件「当前状态 / 下一步」。

---

## 1. 一句话现状

Node/Express 多语言 JSON CMS（无 DB）。前台 AI 客服 + 表单询盘会写入商机；后台「商机中心」可看买家/产品/来源，并打开 AI 对话。  
**本轮已修**：商机表格与详情弹窗「排版错乱」（根因是弹窗用了未定义的 `var(--card)`，主题只有 `--panel`，弹窗透明导致表格透出叠加）。

---

## 2. 仓库与部署

| 项 | 值 |
|----|-----|
| Repo | `trustyai/websites` |
| 工作分支 | `cursor/multilang-cms-rebuild-78df` |
| 线上常见路径 | `/www/vgrooving-cms`（**通常不是 git 仓库**） |
| 校验 | `curl -s http://127.0.0.1:3000/api/build` → `buildId` |

**宝塔一键更新（推荐，不依赖站点目录是 git）：**

```bash
curl -fsSL https://raw.githubusercontent.com/trustyai/websites/cursor/multilang-cms-rebuild-78df/vgrooving-cms/scripts/baota-update.sh | bash
```

脚本会：clone 分支 → rsync 到 `APP_DIR`（排除 `data/`、`public/uploads/`、`node_modules/`）→ `npm install` → pm2 重启 → 校验 buildId。  
更新后请 **Ctrl+F5** 强刷后台；菜单应是「商机中心」而非旧版「收件箱」。

---

## 3. 本轮布局修复（已完成）

### 根因

- 弹窗背景写成 `background:var(--card)`，CSS 变量不存在 → 透明 → 底下表格透出，看起来像「重叠/乱」。
- `.content { max-width:960px }` 对宽表格太窄，列被挤乱。

### 改动文件

| 文件 | 改动要点 |
|------|----------|
| `admin/index.html` | `.content.wide`、`.table-scroll`、`.modal-mask/.modal-box` 用 `var(--panel)`；买家网格 / 产品条 / 消息盒；操作列可换行 |
| `admin/admin.js` | 商机页加 `wide`；表格包滚动；`ensureModal`；详情/对话弹窗重排；保存备注不再整页 `renderInbox()`；离开商机页去掉 `wide` |
| `server.js` | `BUILD_ID = 20260716f-layout-fix` |
| `scripts/baota-update.sh` | 期望 buildId 同步 |

### 自测清单（布局）

1. 登录后台 → 商机中心：表格横向可滚、列对齐、不挤出卡片外。
2. 点标题 /「回复买家」：详情弹窗**实心背景**，买家信息网格清晰，无表格透出。
3. 智能询盘点「查看对话」：聊天气泡正常，无叠层。
4. 切换主题到「暖米色」再打开弹窗：仍不透明。
5. 离开商机中心到仪表盘：内容区恢复窄宽（无 `wide`）。
6. `GET /api/build` → `20260716f-layout-fix`。

---

## 4. 已完成功能（部署后才生效）

| 能力 | 说明 | 关键路径 |
|------|------|----------|
| 聊天上报 | 前台会话写入 `data/chats.json` | `public/common.js` → `POST /api/chats` |
| 聊天→商机 | 有用户消息时 upsert `source:chat` | `server.js` `upsertLeadFromChat` |
| 访客资料 | 聊天里留联系方式 | `POST /api/chats/profile` |
| 关键词+AI 回复 | 先话术，再可选 OpenAI 兼容 | `POST /api/chat/reply`，配置 `settings.aiChat` |
| 商机中心 | 来源 Tab、买家/产品列、状态/分配、回复/邮件 | `admin/admin.js` `renderInbox` |
| 查看 AI 对话 | `GET /api/leads/:id` 带关联 chat | `showLeadChat` |
| 销售统计 | 仪表盘业务员维度 | `GET /api/leads/stats` |
| 媒体 | `public/uploads/` → `/uploads/...` | `POST /api/upload` |

**路由注意**：`GET /api/leads/stats` 必须写在 `GET /api/leads/:id` **之前**，否则 `stats` 会被当成 id。

---

## 5. 角色权限（速查）

| 角色 | 商机中心 | 聊天记录 | 内容编辑 | 账号管理 |
|------|----------|----------|----------|----------|
| admin | 全部 + 分配 | 全部 | 是 | 是 |
| sales | 仅自己负责 | 可看 | 仅合并自己产品 | 否 |
| editor | 不可见 | 不可见 | 是 | 否 |

默认账号：`admin` / `admin123`（部署后务必改密）。

---

## 6. 关键数据文件（gitignore，部署勿覆盖）

```
data/content.json   # 站点内容
data/config.json    # 账号
data/leads.json     # 商机
data/chats.json     # AI 会话
data/stats.json     # 访问统计
public/uploads/     # 上传媒体
```

模板：`data/content.default.json`。

---

## 7. 建议下一步（按优先级）

1. **线上确认布局**：跑宝塔脚本 → Ctrl+F5 → 按 §3 自测。若仍乱，先看 `/api/build` 是否已是 `20260716f-layout-fix`（未更新就是旧静态资源）。
2. **后台 AI 辅助回复**：在商机详情「写回复」旁增加「AI 草拟回复」（基于询盘摘要 + 关联 chat + 产品），不要用固定话术。
3. **来源追踪增强**：UTM / 落地页 / 广告标识写入 lead，表格可展示。
4. **人工接管聊天**：后台对进行中 session 实时插话（现为只读历史）。
5. **更新 `DEVELOPER.md` §9/§10**：文中仍有「收件箱」与旧 git-pull 部署描述，应以本文件 + `baota-update.sh` 为准。

---

## 8. 本地开发

```bash
cd vgrooving-cms
npm install
npm start
# http://127.0.0.1:3000/admin
```

改前端后：强刷；线上用 buildId 核对是否已部署。

---

## 9. 新会话开场白（可直接粘贴）

```
继续做 trustyai/websites 的 vgrooving-cms。
分支 cursor/multilang-cms-rebuild-78df，PR #2。
请先读 vgrooving-cms/HANDOFF.md 与 DEVELOPER.md。
上一轮已修商机中心弹窗透明导致的排版错乱（buildId 20260716f-layout-fix）。
下一步：……（写你的目标，例如 AI 草拟回复 / 来源 UTM / 人工接管）
```

---

## 10. 已知坑

- 站点目录常无 `.git`，`git pull` 会失败 → 用 `scripts/baota-update.sh`。
- 浏览器缓存旧 `admin.js` / `admin/index.html` → 必须强刷；以 `/api/build` 为准。
- 主题 CSS 只有 `--panel` / `--panel-2`，**不要**再用 `--card`。
- `openChat` 与「点击外部关闭」存在竞态，已在 `common.js` 用延迟绑定修复；若线上「获取实时报价」无反应，多半是未部署新 JS。
- AI 未配置时客服走关键词 + 兜底句，会感觉「总是同一句」——需在后台配 `settings.aiChat` 或丰富话术。
