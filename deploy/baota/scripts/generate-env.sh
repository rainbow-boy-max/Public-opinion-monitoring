#!/bin/bash
#
# 宝塔部署包 - 安全配置生成脚本
# 功能：生成 MySQL、Redis、JWT、AES 密钥并写入 .env
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# 生成随机密码
generate_password() {
  local length="${1:-32}"
  openssl rand -base64 48 | tr -d '/+=\n' | head -c "$length"
}

# 生成 AES-256-CBC 密钥（32 字节 base64）
generate_aes_key() {
  openssl rand -base64 32
}

# 写入 .env
write_env() {
  local env_file="$1"
  local db_root_password="$2"
  local db_password="$3"
  local redis_password="$4"
  local jwt_secret="$5"
  local aes_key="$6"
  local admin_password="$7"
  
  cat > "$env_file" <<EOF
# 全网舆情监测系统 - 运行时配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
# 警告：本文件包含敏感信息，请勿提交到版本库或通过聊天工具发送

# MySQL 数据库
DB_HOST=mysql
DB_PORT=3306
DB_USERNAME=opinion
DB_PASSWORD=${db_password}
DB_DATABASE=opinion_monitor
DB_ROOT_PASSWORD=${db_root_password}
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${redis_password}
REDIS_DB=0

# JWT 配置
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d

# AES-256-CBC 加密密钥
AES_ENCRYPTION_KEY=${aes_key}

# 初始管理员密码（首次登录后强制修改）
INIT_ADMIN_PASSWORD=${admin_password}

# 应用配置
NODE_ENV=production
PORT=3000
TZ=Asia/Shanghai

# 多租户支持（默认关闭）
TENANT_ENABLED=false
EOF
  
  chmod 600 "$env_file"
  info ".env 已生成: $env_file (权限 600)"
}

# 主函数
main() {
  local runtime_root="${1:-/www/server/opinion-monitor}"
  local compose_dir="$runtime_root/compose"
  local env_file="$compose_dir/.env"
  
  # 创建目录
  mkdir -p "$compose_dir"
  
  # 检查是否已存在配置
  if [[ -f "$env_file" ]]; then
    warn ".env 已存在: $env_file"
    read -p "是否覆盖现有配置？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      info "跳过配置生成"
      return 0
    fi
    
    # 备份旧配置
    local backup_file="${env_file}.bak.$(date +%s)"
    cp "$env_file" "$backup_file"
    info "已备份旧配置到: $backup_file"
  fi
  
  # 生成密钥
  info "正在生成随机密钥..."
  local db_root_password=$(generate_password 32)
  local db_password=$(generate_password 32)
  local redis_password=$(generate_password 32)
  local jwt_secret=$(generate_password 48)
  local aes_key=$(generate_aes_key)
  local admin_password=$(generate_password 16)
  
  # 写入配置
  write_env "$env_file" \
    "$db_root_password" \
    "$db_password" \
    "$redis_password" \
    "$jwt_secret" \
    "$aes_key" \
    "$admin_password"
  
  # 输出初始管理员密码
  echo ""
  echo "========================================"
  echo "初始管理员账户"
  echo "========================================"
  echo "用户名: admin"
  echo "密码: ${admin_password}"
  echo ""
  warn "请妥善保存上述密码，首次登录后会强制修改"
  echo "========================================"
  echo ""
}

# 允许直接运行或被 source
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
