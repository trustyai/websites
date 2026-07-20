# Niumabox · 财务模块优化（本仓库交付包）

本目录是 Niumabox 外贸单据站「财务角色第二批」交付物，按 `docs/付款水单-财务可见性-部署文档.md` 部署到现有服务器。

## 本批做了什么

1. **财务可见性补齐**：财务登录后可看全队客户 +「团队单据（财务只读）」视图（第一批只改了 RLS，前端仍按本人过滤）。
2. **付款水单**：客户卡「📎 水单」→ OSS 直传 → `payment_proofs` 入库 → 邮件通知团队财务。

## 目录

```
niumabox/
  sql/06-payment-proofs.sql
  frontend/index.html   # SW=v70
  frontend/sw.js
  backend/api-oss-sign.js
  backend/api-finance-notify.js
  backend/routes-finance.js   # 上传后改名为 routes/finance.js
  docs/付款水单-财务可见性-部署文档.md
```

部署前请准备：OSS RAM AccessKey、在 SQL 里替换 `YOUR_FINANCE_WEBHOOK_SECRET`。
