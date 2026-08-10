# 等保三级通信加密整改方案

## 问题描述

当前系统所有 HTTP 通信均为明文传输，不符合等保三级"通信传输全程加密"的要求。

## 整改方案

### 方案一：Nginx 反向代理 TLS 终止（推荐）

在生产环境中，通过 Nginx 配置 HTTPS，实现 TLS 终止。

#### 1. 获取 SSL 证书

```bash
# 使用 Let's Encrypt 免费证书
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 2. Nginx 配置

```nginx
# /etc/nginx/conf.d/opinion-monitor.conf

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 协议和加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # SSL 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 管理端
    location / {
        proxy_pass http://localhost:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 用户端
    location /user {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 后端
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

#### 3. 自动续期证书

```bash
# 添加 cron 任务，每月 1 号自动续期
0 0 1 * * certbot renew --quiet && systemctl reload nginx
```

### 方案二：Docker Compose 部署

如果使用 Docker Compose 部署，参考以下配置：

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/html:/usr/share/nginx/html
    depends_on:
      - backend
      - frontend-admin
      - frontend-user

  backend:
    build: ./backend
    expose:
      - "3000"
    environment:
      - NODE_ENV=production

  frontend-admin:
    build: ./frontend-admin
    expose:
      - "5174"

  frontend-user:
    build: ./frontend-user
    expose:
      - "5173"
```

### 方案三：开发环境自签名证书（仅测试）

```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Nginx 配置
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

## 验证方法

```bash
# 检查 SSL 配置
curl -I https://your-domain.com

# 检查证书有效期
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# 在线检测
# https://www.ssllabs.com/ssltest/
```

## 等保合规要点

- [x] 通信传输全程加密（TLS 1.2+）
- [x] 强制 HTTPS（HTTP 自动跳转）
- [x] 证书有效管理（自动续期）
- [x] 安全头配置（HSTS、X-Frame-Options 等）
- [x] 加密套件符合国家标准（支持国密算法可选）

## 国密算法支持（可选）

如需支持国密 SM2/SM3/SM4 算法，可使用：
- Tongsuo（铜锁）：https://github.com/Tongsuo-Project/Tongsuo
- GmSSL：https://github.com/guanzhi/GmSSL

Nginx 配置示例：
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-SM2-WITH-SM4-SM3:ECDHE-RSA-AES128-GCM-SHA256;
```