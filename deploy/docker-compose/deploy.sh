#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║   舆情监测系统 - 一键部署脚本        ║"
echo "╚══════════════════════════════════════╝"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/5] 检查环境...${NC}"
docker info > /dev/null 2>&1 || { echo -e "${RED}Docker 守护进程未运行${NC}"; exit 1; }
echo -e "${GREEN}  Docker 运行正常${NC}"

echo -e "${YELLOW}[2/5] 生成安全密钥...${NC}"
JWT_SECRET=$(openssl rand -hex 32)
export JWT_SECRET
export INIT_ADMIN_PASSWORD=${INIT_ADMIN_PASSWORD:-opinion123}
export DB_PASSWORD=${DB_PASSWORD:-opinionpass}
echo -e "${GREEN}  JWT_SECRET 已生成${NC}"
echo -e "${GREEN}  初始管理员密码: ${INIT_ADMIN_PASSWORD}${NC}"

echo -e "${YELLOW}[3/5] 构建镜像...${NC}"
docker compose build --parallel 2>&1 | tail -5
echo -e "${GREEN}  镜像构建完成${NC}"

echo -e "${YELLOW}[4/5] 启动服务...${NC}"
docker compose up -d 2>&1

echo -e "${YELLOW}  等待服务就绪...${NC}"
for i in $(seq 1 30); do
    if curl -s http://localhost:3000/api/ops/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}  后端就绪${NC}"
        break
    fi
    sleep 2
done

echo -e "${YELLOW}[5/5] 运行数据库迁移...${NC}"
docker exec opinion-backend npx typeorm migration:run -d dist/database/data-source.js 2>/dev/null || true
echo -e "${GREEN}  迁移完成${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  部署完成！                          ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  管理端: http://localhost:80          ║${NC}"
echo -e "${GREEN}║  用户端: http://localhost:81          ║${NC}"
echo -e "${GREEN}║  账号:   admin                       ║${NC}"
echo -e "${GREEN}║  密码:   ${INIT_ADMIN_PASSWORD}            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"