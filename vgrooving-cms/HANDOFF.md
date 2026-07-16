# V槽 CMS — 新窗口无缝对接文档

> 更新时间：2026-07-16  
> 分支：`cursor/multilang-cms-rebuild-78df`（base: `main`）  
> PR：https://github.com/trustyai/websites/pull/2  
> 应用目录：`vgrooving-cms/`  
> 当前 buildId：`20260716g-admin-modules`

把本文件 + `DEVELOPER.md` 丢给新会话即可继续开发。

---

## 1. 一句话现状

Node/Express 多语言 JSON CMS。后台已按「概况 / 商机中心 / 建站与维护 / 视频中心 / 推广 / AI / 大数据 / 物流 / 后台设置」分组；智能选型可后台锁定推荐机型；产品详情支持富文本插图；**模板默认语言为 English**（`/` 打开英文站）。

---

## 2. 本轮完成（20260716g）

### 2.1 智能选型：后台如何调整推荐机型

两条路径（前台 `public/app.js` → `updateRec`）：

1. **产品标签（兜底打分）**  
   产品编辑 →「智能选型匹配」勾选材料/厚度/规模/功能。  
   保存为 `m:` / `t:` / `s:` / `f:` 前缀标签（兼容旧的无前缀 `thin`/`small`）。

2. **推荐锁定（优先）**  
   建站与维护 → **智能选型** →「推荐锁定」：按材料/厚度/规模/功能组合，填写产品 `slug` 列表。  
   命中规则时**强制**展示这些机型（忽略打分）。

### 2.2 产品详情富文本 + 图片

- 字段：`products[].description`（HTML）  
- 编辑器工具栏：`🖼` 媒体库插图、`⬆图` 上传插入  
- 前台：`product.js` → `.product-desc`

### 2.3 默认全英文

- `data/content.default.json` → `"defaultLang": "en"`，语言列表 English 优先  
- 根路径 `/` = 英文；中文为 `/zh`  
- **已上线站点**的 `data/content.json` 不会被脚本覆盖：请到后台 **品牌与导航 → 默认语言** 改为 `en` 后保存

### 2.4 多功能侧栏（对标截图结构）

| 分组 | 页面 |
|------|------|
| 概况 | 仪表盘 |
| 商机中心 | 全部商机 / 聊天记录 / 在线客服话术 |
| 建站与维护 | 产品 / 公司信息 / 智能选型 / 首页 / 装修 / 品牌导航 / 联系页 / 网站设置SEO |
| 视频中心 | 视频列表（含 YouTube 导入）/ 分组 / 数据分析 |
| 推广服务 | 推广与获客文案 |
| AI 智能中心 | AI 客服配置 |
| 大数据中心 | 站内行业词分析（产品+商机本地检索） |
| 物流服务 | 物流说明富文本 |
| 后台设置 | 媒体库 / 翻译备份 / 账号 |

数据落点：

- `i18n.<lang>.company` — 公司信息各栏目 HTML  
- `i18n.<lang>.wizard.locks` — 选型锁定规则  
- `videos` — `{ groups, items }`（随 content 保存）  
- `modules.promo / logistics / decorate`

---

## 3. 部署

```bash
curl -fsSL https://raw.githubusercontent.com/trustyai/websites/cursor/multilang-cms-rebuild-78df/vgrooving-cms/scripts/baota-update.sh | bash
curl -s http://127.0.0.1:3000/api/build   # 期望 20260716g-admin-modules
```

强刷后台 Ctrl+F5。若前台仍是中文根路径：改默认语言为 en 并保存。

---

## 4. 建议下一步

1. 公司信息 / 隐私等栏目挂到前台独立路由（现仅后台可编）  
2. 视频中心前台展示页（产品页嵌入 YouTube）  
3. 大数据对接真实第三方 API（现为站内检索）  
4. 商机详情「AI 草拟回复」  
5. 人工接管在线聊天

---

## 5. 新会话开场白

```
继续做 trustyai/websites 的 vgrooving-cms。
分支 cursor/multilang-cms-rebuild-78df，PR #2。
请先读 vgrooving-cms/HANDOFF.md。
上一轮 buildId=20260716g-admin-modules：多功能侧栏、选型锁定、富文本插图、默认英文。
下一步：……
```
