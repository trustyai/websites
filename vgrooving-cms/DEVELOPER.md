# V槽 CMS 开发文档

本文档面向后续继续开发与运维，说明架构、数据、权限、API 与扩展点。

## 1. 项目概览

- **路径**：`vgrooving-cms/`
- **运行**：`npm install && npm start`（默认端口 `3000`）
- **前台**：`/`、`/en`、`/products/:slug`、`/contact` 等（多语言）
- **后台**：`/admin`（默认账号 `admin` / `admin123`）
- **技术栈**：Node.js + Express，JSON 文件存储，无数据库
- **分支**：主开发分支 `cursor/multilang-cms-rebuild-78df`

## 2. 目录结构

```
vgrooving-cms/
├── server.js                 # 后端入口：鉴权、API、SEO、静态资源
├── package.json
├── DEVELOPER.md              # 本文件
├── README.md                 # 部署/使用说明
├── data/
│   ├── content.default.json  # 六语言内容模板（入库）
│   ├── content.json          # 运行时内容（gitignore）
│   ├── config.json           # 账号（gitignore）
│   ├── leads.json            # 询盘商机（gitignore）
│   ├── chats.json            # 前台客服聊天记录（gitignore）
│   └── stats.json            # 访问统计（gitignore）
├── public/                   # 前台静态资源
│   ├── index.html / product.html / contact.html
│   ├── common.js / app.js / product.js / contact.js / styles.css
│   ├── assets/               # Logo 等
│   └── uploads/              # 上传的图片/视频（见 §3）
└── admin/
    ├── index.html
    └── admin.js
```

## 3. 媒体存储（图片 / 视频）

| 项目 | 说明 |
|------|------|
| 磁盘路径 | `vgrooving-cms/public/uploads/` |
| 访问 URL | `/uploads/<文件名>` |
| 上传接口 | `POST /api/upload`（需登录，字段名 `file`） |
| 大小限制 | 300MB |
| 类型 | jpg/jpeg/png/gif/webp/svg/mp4/webm/mov |
| 压缩 | 可选依赖 `jimp`：jpg/png 超宽自动缩到 1600px |

**部署注意**：升级代码时务必保留 `public/uploads/` 与 `data/*.json`，不要被空仓库覆盖。

## 4. 角色与权限

| 角色 | 产品 | 询盘(收件箱) | 聊天记录 | 账号管理 | 内容全局 |
|------|------|--------------|----------|----------|----------|
| admin | 全部 | 全部 + 分配 | 全部 | 是 | 是 |
| sales | 仅自己负责的 | 仅自己负责的 | 可查看 | 否 | 仅合并自己的产品 |
| editor | 全部 | **不可见** | **不可见** | 否 | 是 |

服务端强制校验；前端菜单按角色隐藏。

## 5. 核心数据模型

### 5.1 询盘 / 商机 `leads.json`

```json
{
  "id": "hex",
  "source": "chat|form|product",
  "title": "Chat about 气动V槽成型机",
  "name": "",
  "email": "",
  "phone": "",
  "company": "",
  "country": "",
  "message": "",
  "lang": "zh",
  "page": "/products/xxx",
  "product": "产品名",
  "productSlug": "pneumatic",
  "productImage": "/uploads/...",
  "productPrice": "¥28,000",
  "chatId": "关联 chats.json 的 id",
  "sessionId": "前台会话 id",
  "owner": "u_xxx",
  "time": 1710000000000,
  "read": false,
  "ip": "",
  "status": "new",
  "note": "内部备注",
  "replies": [],
  "lastReplyAt": 0,
  "updatedAt": 1710000000000
}
```

**来源**：`chat` 智能询盘（AI 客服）· `form` 表单询盘 · `product` 产品页询盘  
**状态**：`new` / `following` / `replied` / `won` / `closed`  

前台聊天有用户消息时会自动 upsert 为 `source=chat` 商机；访客可提交联系方式到 `/api/chats/profile`。  
后台「商机中心」可按来源筛选，并「查看对话」加载关联 AI 聊天记录。

### 5.2 聊天记录 `chats.json`

前台 AI 关键词自动回复的会话，由 `public/common.js` 上报。

```json
{
  "id": "hex",
  "sessionId": "s_浏览器会话",
  "lang": "zh",
  "page": "/",
  "messages": [{ "role": "user|agent", "text": "", "time": 0 }],
  "createdAt": 0,
  "updatedAt": 0,
  "ip": "",
  "ua": ""
}
```

最多保留约 500 个会话；单会话消息上限约 120 条。

### 5.3 内容 `content.json`

- `langs` / `defaultLang` / `brand` / `settings`（含 `siteUrl`、`notifyWebhook`、`smtp`、`headHtml`）
- `i18n.<lang>`：导航、hero、wizard、products、contact、chat（客服话术）等

产品字段要点：`id/slug/name/owner/gallery/cardImage/deleted/createdAt/updatedAt/category…`

## 6. API 一览

### 认证 / 账号

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，写 cookie `vg_token` |
| POST | `/api/logout` | 退出 |
| GET | `/api/session` | 当前会话 |
| POST | `/api/password` | 改自己密码 |
| GET/POST/DELETE | `/api/users` | 账号 CRUD（仅 admin） |

### 内容 / 媒体

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/content` | 公开内容（无 settings，已删产品过滤） |
| GET | `/api/admin/content` | 后台完整内容（按角色过滤产品） |
| POST | `/api/content` | 保存内容（业务员合并策略） |
| POST | `/api/upload` | 上传 |
| GET/DELETE | `/api/uploads` | 媒体库列表 / 删除 |

### 询盘

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/leads` | 前台提交（蜜罐字段 `website`、IP 限流） |
| GET | `/api/leads` | 列表（按角色） |
| POST | `/api/leads/read` | 标已读/未读 |
| POST | `/api/leads/status` | 改状态 / 备注 `{ id, status, note? }` |
| POST | `/api/leads/reply` | 回复 `{ id, text, sendEmail? }`，可 SMTP 发买家 |
| POST | `/api/leads/assign` | 分配负责人（仅 admin） |
| DELETE | `/api/leads` | 删除 |
| GET | `/api/leads/stats` | **业务员维度商机统计** |

### 聊天记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chats` | 前台上报 `{ sessionId, messages, append, lang, page }` |
| GET | `/api/chats` | 列表（admin/sales） |
| GET | `/api/chats/:id` | 详情 |
| DELETE | `/api/chats` | 删除（仅 admin） |

### 其它

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 访问统计 |
| GET | `/sitemap.xml` `/robots.txt` | SEO |

## 7. 邮件（SMTP）

在后台 **翻译与备份** 配置 `settings.smtp`：

- `host` / `port` / `secure` / `user` / `pass` / `from` / `to`
- **新询盘通知**：发到 `to`，`replyTo` 为买家邮箱
- **询盘回复买家**：发到询盘 `email`，`replyTo` 为 `to`（方便买家继续回复业务邮箱）

依赖可选包 `nodemailer`；未安装或未配置时，回复仍可只存内部记录。

## 8. 前台关键逻辑

- `public/common.js`：语言路由、导航、搜索、客服 UI、**聊天上报**
- 客服打开：`openChat`；点外部关闭在打开后的下一事件循环才绑定，避免 CTA「获取实时报价」同一次点击立刻关闭
- 产品次按钮「下载参数表」：优先 `product.downloadUrl`，否则根据参数生成 `.txt` 下载
- 静态资源带 `?v=` 缓存戳（改前端后记得同步 bump HTML 里的版本号）
- 客服回复：`POST /api/chat/reply` — 先关键词话术（`i18n.<lang>.chat.replies`），未命中且 `settings.aiChat.enabled` 则调 OpenAI 兼容接口，否则兜底
- AI 配置：后台「翻译与备份」→ `settings.aiChat`（apiUrl/apiKey/model/systemPrompt）
- 联系表单：`contact.js` → `POST /api/leads`

## 9. 后台页面（admin）

| 菜单 | 用途 |
|------|------|
| 仪表盘 | 概览、**业务员商机统计**、访问量、语言完成度 |
| 品牌/首页/选型/产品/联系/在线客服 | 多语言内容编辑 |
| **聊天记录** | 查看前台 AI 会话 |
| **商机中心** | 按来源筛选、买家/产品信息、状态/分配、跟进备注、邮件回复、查看 AI 对话 |
| 媒体库 / 翻译与备份 / 账号 | 资源、SMTP/Webhook、多用户 |

主题：graphite / dark / navy / slate / light / beige（仅后台皮肤）。  
弹窗/卡片请用 `var(--panel)` / `var(--panel-2)`，**不要**用未定义的 `--card`。

更完整的对接说明见 **`HANDOFF.md`**。

## 10. 宝塔部署要点

线上目录（如 `/www/vgrooving-cms`）**常常不是 git 仓库**，不要依赖 `git pull`。推荐：

```bash
curl -fsSL https://raw.githubusercontent.com/trustyai/websites/cursor/multilang-cms-rebuild-78df/vgrooving-cms/scripts/baota-update.sh | bash
```

脚本会 rsync 更新代码并保留 `data/`、`public/uploads/`，重启 pm2 后校验 `/api/build`。  
Nginx：反代 `127.0.0.1:3000`，建议 `client_max_body_size 300m;`  
运行用户（如 `www`）需对 `data/`、`public/uploads/` 可写。

## 11. 后续可扩展方向

1. **人工接管聊天**：后台对某会话实时回复（现为只读 AI 记录）
2. **询盘 ↔ 聊天关联**：按 IP/邮箱合并线索
3. **导出 Excel**：询盘/聊天除 CSV 外支持 xlsx（前台已有 vendor）
4. **数据库迁移**：线索量大时将 `leads.json`/`chats.json` 迁到 SQLite/MySQL
5. **通知增强**：状态变更推企业微信/钉钉；成交提醒
6. **附件回复**：邮件回复附带产品 PDF/图片
7. **更细权限**：销售经理看全组、只读观察员等

## 12. 本地自测清单

```bash
cd vgrooving-cms && npm start
# 登录后台拿 cookie 后：
curl -s -c /tmp/vg.ck -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' http://127.0.0.1:3000/api/login
curl -s -b /tmp/vg.ck http://127.0.0.1:3000/api/leads/stats
curl -s -H 'Content-Type: application/json' \
  -d '{"sessionId":"s_test_12345678","append":true,"lang":"zh","page":"/","messages":[{"role":"user","text":"你好","time":1},{"role":"agent","text":"您好","time":2}]}' \
  http://127.0.0.1:3000/api/chats
curl -s -b /tmp/vg.ck http://127.0.0.1:3000/api/chats
```

---

*文档随 `cursor/multilang-cms-rebuild-78df` 分支功能同步更新。*
