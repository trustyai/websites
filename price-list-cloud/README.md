# 代理商价目表生成器 · 云端版

跨设备登录、数据永久保存的价目表生成系统。登录后价目表保存在服务器数据库，
在任何电脑 / 手机上登录同一账号即可看到并继续编辑同一份数据。
未登录时仍可纯本地使用（自动保存到浏览器 + 草稿文件导入导出）。

功能：公司 Logo / 中英文公司名抬头、31 种货币、中文 / 英文 / 中英对照三版切换、
一个产品名绑定多个型号（输出自动合并单元格）、可隐藏含税列、成为代理商条件、
导出 Excel / PDF / 打印（均含图片）、响应式适配 PC / 平板 / 手机。

技术栈：Node.js + Express + SQLite，前端为单页应用（零构建，纯静态托管）。

---

## 一、本地运行（先在自己电脑上跑起来看看）

需要先安装 Node.js 18 或更高版本（https://nodejs.org）。然后在本目录执行：

```bash
npm install        # 安装依赖（会编译 better-sqlite3，需联网）
npm start          # 启动
```

浏览器打开 http://localhost:3000 即可。第一个注册的账号会自动成为「管理员」。

> 如果 `npm install` 在编译 better-sqlite3 时报错，通常是缺少编译工具：
> - Windows：安装时选中 “Tools for Native Modules”，或 `npm i -g windows-build-tools`
> - macOS：`xcode-select --install`
> - Linux：`sudo apt-get install -y build-essential python3`

---

## 二、上线到云服务（推荐 Render，免费档即可起步）

以 Render 为例（Railway 类似）：

1. 把本项目推到一个 GitHub 仓库。
2. Render → New → Web Service，连接该仓库。
3. 配置：
   - Build Command: `npm install`
   - Start Command: `npm start`
4. 在 Environment 里添加环境变量（见下方表格），**JWT_SECRET 必填**。
5. **重要：数据持久化**。Render 默认文件系统重启即清空，必须挂一块持久磁盘：
   - 添加 Disk（如挂载到 `/var/data`）。
   - 设环境变量 `DB_PATH=/var/data/app.db`。
   - 否则每次重新部署，账号和价目表都会丢失。
6. 部署完成后访问分配的网址，注册第一个（管理员）账号即可。

---

## 三、部署到自己的服务器 / VPS

```bash
git clone <你的仓库>
cd price-list-cloud
npm install
# 设置环境变量（或写到 .env 后用 dotenv/系统方式注入）
export JWT_SECRET="一长串随机字符串"
export DB_PATH="/opt/pricelist/app.db"
npm start
```

建议用 `pm2` 守护进程并用 Nginx 反代 + HTTPS：

```bash
npm i -g pm2
pm2 start server.js --name pricelist
pm2 save
```

---

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 监听端口（云平台通常自动注入） | 3000 |
| `JWT_SECRET` | 登录令牌签名密钥，**生产务必设为随机长串** | 临时随机（重启失效） |
| `ALLOW_REGISTRATION` | `true` 开放注册 / `false` 仅管理员开户 | true |
| `DB_PATH` | SQLite 文件路径，云平台指向持久磁盘 | ./data/app.db |
| `MAX_BODY` | 请求体上限（含图片会偏大） | 25mb |

生成 JWT_SECRET：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 账号体系

- 默认开放注册；**第一个注册的账号自动成为管理员**。
- 内部员工专用：设 `ALLOW_REGISTRATION=false`，外人无法自助注册。
  之后用命令行开户：

  ```bash
  node scripts/create-admin.js sales@company.com 密码至少6位 "销售小王" user
  node scripts/create-admin.js boss@company.com 密码至少6位 "张经理" admin
  ```

---

## 数据与备份

- 所有数据在 SQLite 文件（`DB_PATH`）里，**定期备份这个文件即可**。
- 每个账号的价目表彼此隔离，互相看不到。
- 价目表里的产品图片以 base64 存在记录中，图多时单条会偏大；如需大规模商用、
  多人高并发，建议把数据库换成 PostgreSQL、图片改存对象存储（可在此基础上扩展）。

---

## API 一览（前端已对接，二次开发可参考）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/register | 注册 {email,password,displayName?} |
| POST | /api/login | 登录 {email,password} |
| GET | /api/me | 当前用户（需 token） |
| GET | /api/lists | 我的价目表列表 |
| GET | /api/lists/:id | 读取单个价目表 |
| POST | /api/lists | 新建 {title,data} |
| PUT | /api/lists/:id | 更新 {title,data} |
| DELETE | /api/lists/:id | 删除 |
| GET | /api/public/p/:id | 公开商品详情（无需登录，供导出链接） |

鉴权方式：登录拿到 `token`，后续请求带 `Authorization: Bearer <token>`。

---

## 商品详情链接（PDF / Excel 可点击）

每个产品可填写「商品详情链接」，也可使用本站自动生成的公开详情页：

1. 登录账号，编辑产品后点「云端保存」——系统会为每个产品发布公开页。
2. 产品卡片上可「复制链接」或「用作导出链接」。
3. 也可直接填写你自己的官网 / 商城商品 URL。
4. 导出 **Excel** 时，品名单元格为可点击超链接；导出 **PDF** 时，品名区域带可点击热区。
5. 客户打开链接即可查看图片、规格、简介与价格（页面路径：`/p/<公开ID>`）。

> 未登录、仅本机草稿时：请填写外部商品 URL，导出才会带可点击链接；本站公开页需云端保存后生效。