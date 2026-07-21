# 部署到 agentprice.niumabox.com（阿里云 ECS + pm2）

为你的子域名 `agentprice.niumabox.com` 定制的部署步骤。
配置：SQLite + 开放注册 + pm2 守护。命令已填好你的域名，基本可直接照抄。
（示例把代码放在 `/opt/agentprice`、后端端口 `3000`；如与现有服务冲突，按第 0 步换端口。）

---

## 0. 选一个没被占用的端口

你已有两个 Node 后端，先确认 3000 没被占（有输出就换 3001/3002…，后面命令里同步改）：

```bash
ss -ltnp | grep -E ':3000|:3001|:3002'
```

---

## 1. 上传代码

把解压后的 `price-list-cloud` 目录传到服务器并改名为 `/opt/agentprice`：

```bash
# 在你本地电脑执行（先解压 zip）：
scp -r price-list-cloud root@你的ECS公网IP:/opt/agentprice
```

或服务器上从 Git 拉取后 `mv` 成 `/opt/agentprice`。

---

## 2. 装依赖（SQLite 需编译工具）

```bash
cd /opt/agentprice

# Ubuntu/Debian:
sudo apt-get update && sudo apt-get install -y build-essential python3
# CentOS/Alibaba Cloud Linux:
# sudo yum groupinstall -y "Development Tools" && sudo yum install -y python3

node -v                      # 确认 >= 18
npm config set registry https://registry.npmmirror.com   # 阿里云装包更快（可选）
npm install --omit=dev
```

---

## 3. 配置环境变量

生成 JWT 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

写 `/opt/agentprice/.env`：

```bash
cat > /opt/agentprice/.env << 'EOF'
PORT=3000
JWT_SECRET=粘贴上一步生成的长串
ALLOW_REGISTRATION=true
DB_PATH=/opt/agentprice/data/app.db
MAX_BODY=25mb
EOF
```

数据将永久保存在 `/opt/agentprice/data/app.db`（程序自动建目录）。

---

## 4. pm2 启动 + 开机自启

```bash
cat > /opt/agentprice/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'agentprice',
    script: 'server.js',
    cwd: '/opt/agentprice',
    env_file: '/opt/agentprice/.env',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M'
  }]
};
EOF

cd /opt/agentprice
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # 按它打印的命令再执行一次（仅首次配开机自启）
```

验证（应返回 `{"ok":true,"allowRegistration":true}`）：

```bash
curl http://127.0.0.1:3000/api/health
```

> 不要在阿里云安全组开放 3000，它只供本机 Nginx 反代，对外只走 80/443。

---

## 5. DNS：把子域名解析到 ECS

在 niumabox.com 的 DNS 控制台加一条 A 记录：

```
主机记录: agentprice
记录类型: A
记录值:   你的 ECS 公网 IP
```

等解析生效（通常几分钟），`ping agentprice.niumabox.com` 能看到你的 IP 即可。

---

## 6. Nginx 反代（与现有站点平级，互不影响）

```bash
cat > /etc/nginx/conf.d/agentprice.conf << 'EOF'
server {
    listen 80;
    server_name agentprice.niumabox.com;

    client_max_body_size 30m;   # 价目表含图片，放宽上传体积

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

nginx -t && systemctl reload nginx
```

> 若你的 Nginx 站点配置目录是 `sites-available/sites-enabled`（Ubuntu 默认），
> 就把上面内容写到 `/etc/nginx/sites-available/agentprice` 再
> `ln -s /etc/nginx/sites-available/agentprice /etc/nginx/sites-enabled/`。

---

## 7. 开启 HTTPS（强烈建议，免费）

```bash
# 没装 certbot 先装：
# apt: sudo apt-get install -y certbot python3-certbot-nginx
# yum: sudo yum install -y certbot python3-certbot-nginx
certbot --nginx -d agentprice.niumabox.com
```

完成后访问 **https://agentprice.niumabox.com** ，注册第一个账号即为管理员。

---

## 8. 每日自动备份（SQLite 就一个文件）

```bash
mkdir -p /opt/agentprice/backups
crontab -e
# 加入一行：每天 03:00 备份，保留最近 14 天
0 3 * * * sqlite3 /opt/agentprice/data/app.db ".backup '/opt/agentprice/backups/app-$(date +\%F).db'" && find /opt/agentprice/backups -name 'app-*.db' -mtime +14 -delete
```

---

## 9. 以后更新代码

```bash
cd /opt/agentprice
# 上传新文件 或 git pull
npm install --omit=dev     # 仅依赖变化时需要
pm2 restart agentprice
```

数据库文件不受代码更新影响，数据安全保留。

---

## 重要提醒：你说「已把之前的文件放在了 agentprice.niumabox.com」

这套**云端版**是一个 Node 后端应用，访问 `/` 会由 server.js 托管前端、`/api/...` 提供接口——
它和「直接把一个 .html 静态文件放到该域名目录」是两种不同的部署方式，**不要混用**：

- 如果你之前在该子域名根目录放了静态 `price-list-builder.html`，请让 Nginx 这个 server 块
  **整段反代到 Node（如上第 6 步）**，而不要再用 `root /var/www/...; index ...;` 指向静态文件，
  否则 `/api` 走不到后端，登录功能会失效。
- 简单判断：配置好后访问 `https://agentprice.niumabox.com/api/health` 能看到
  `{"ok":true}` 就说明反代正确、后端已接管。

如果你其实只想先用「不需要登录的本地版静态文件」挂在这个域名，那不用部署 Node，
直接把 `price-list-builder.html` 重命名为 `index.html` 放进该站点目录即可——
但那样就没有跨设备登录/云端保存。两者取其一，按需选择。
