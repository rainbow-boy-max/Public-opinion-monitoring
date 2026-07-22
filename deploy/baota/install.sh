#!/bin/bash
#
# 全网舆情监测系统 - 宝塔部署包安装器
# Phase 1: 环境预检、运行目录创建与安全配置生成
#
# 使用方法:
#   bash install.sh \
#     --domain opinion.example.com \
#     --site-root /www/wwwroot/opinion-monitor \
#     --runtime-root /www/server/opinion-monitor
#

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step() { echo -e "${BLUE}[STEP]${NC} $*"; }

# 默认配置
DOMAIN=""
SITE_ROOT="/www/wwwroot/opinion-monitor"
RUNTIME_ROOT="/www/server/opinion-monitor"
BACKEND_PORT="3000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 解析命令行参数
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --site-root)
        SITE_ROOT="$2"
        shift 2
        ;;
      --runtime-root)
        RUNTIME_ROOT="$2"
        shift 2
        ;;
      --backend-port)
        BACKEND_PORT="$2"
        shift 2
        ;;
      --help|-h)
        show_usage
        exit 0
        ;;
      *)
        error "未知参数: $1\n使用 --help 查看帮助"
        ;;
    esac
  done
  
  # 验证必填参数
  if [[ -z "$DOMAIN" ]]; then
    error "缺少必填参数 --domain，请指定部署域名"
  fi
}

show_usage() {
  cat <<EOF
全网舆情监测系统 - 宝塔部署包安装器

用法:
  bash install.sh [选项]

必填参数:
  --domain <域名>              部署域名，如 opinion.example.com

可选参数:
  --site-root <路径>           前端发布根目录 (默认: /www/wwwroot/opinion-monitor)
  --runtime-root <路径>        Compose、数据与日志根目录 (默认: /www/server/opinion-monitor)
  --backend-port <端口>        后端绑定端口 (默认: 3000)
  --help, -h                   显示帮助信息

示例:
  bash install.sh --domain opinion.example.com
  bash install.sh --domain opinion.example.com --site-root /data/opinion

注意:
  - 本脚本只执行环境预检、目录创建与安全配置生成
  - 不会启动容器或修改宝塔站点配置
  - 实际部署请使用生成的可视化控制台完成
EOF
}

# 创建运行目录
create_directories() {
  step "创建运行目录..."
  
  local dirs=(
    "$SITE_ROOT"
    "$SITE_ROOT/current"
    "$SITE_ROOT/releases"
    "$SITE_ROOT/backups"
    "$RUNTIME_ROOT/compose"
    "$RUNTIME_ROOT/data/mysql"
    "$RUNTIME_ROOT/data/redis"
    "$RUNTIME_ROOT/data/uploads"
    "$RUNTIME_ROOT/logs"
    "$RUNTIME_ROOT/scripts"
    "$RUNTIME_ROOT/nginx"
    "$RUNTIME_ROOT/backups"
  )
  
  for dir in "${dirs[@]}"; do
    mkdir -p "$dir"
    info "✓ 已创建: $dir"
  done
}

# 复制脚本与配置模板
copy_files() {
  step "复制脚本与配置模板..."
  
  # 复制脚本
  cp "$SCRIPT_DIR/scripts/"*.sh "$RUNTIME_ROOT/scripts/"
  chmod +x "$RUNTIME_ROOT/scripts/"*.sh
  info "✓ 已复制脚本到: $RUNTIME_ROOT/scripts/"
  
  # 复制 Compose 配置
  cp "$SCRIPT_DIR/compose/docker-compose.yml" "$RUNTIME_ROOT/compose/"
  info "✓ 已复制 Compose 配置到: $RUNTIME_ROOT/compose/"
  
  # 生成宝塔 Nginx 配置
  sed -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__SITE_ROOT__|$SITE_ROOT|g" \
      -e "s|__BACKEND_PORT__|$BACKEND_PORT|g" \
      "$SCRIPT_DIR/nginx/opinion-monitor.conf.template" \
      > "$RUNTIME_ROOT/nginx/opinion-monitor.conf"
  info "✓ 已生成 Nginx 配置: $RUNTIME_ROOT/nginx/opinion-monitor.conf"
}

# 生成配置摘要
generate_summary() {
  local summary_file="$RUNTIME_ROOT/INSTALL_SUMMARY.txt"
  
  cat > "$summary_file" <<EOF
========================================
全网舆情监测系统 - 安装摘要
========================================
安装时间: $(date '+%Y-%m-%d %H:%M:%S')
部署域名: $DOMAIN

目录配置:
  - 前端发布根目录: $SITE_ROOT
  - 运行时根目录: $RUNTIME_ROOT
  - 数据目录: $RUNTIME_ROOT/data
  - 日志目录: $RUNTIME_ROOT/logs
  - 备份目录: $RUNTIME_ROOT/backups

网络配置:
  - 后端端口: 127.0.0.1:$BACKEND_PORT
  - MySQL: Docker 内部网络
  - Redis: Docker 内部网络

安全配置:
  - 配置文件: $RUNTIME_ROOT/compose/.env (权限 600)
  - 初始管理员账户已生成，请查看终端输出

下一步:
  1. 检查宝塔面板是否已安装 Docker 与 Docker Compose
  2. 在宝塔面板创建站点并配置域名 $DOMAIN
  3. 复制 $RUNTIME_ROOT/nginx/opinion-monitor.conf
     到宝塔 Nginx 配置并重载
  4. 构建或拉取后端镜像，更新 $RUNTIME_ROOT/compose/.env 中的 BACKEND_IMAGE
  5. 发布前端构建产物到 $SITE_ROOT/current/admin 与 $SITE_ROOT/current/user
  6. 进入 $RUNTIME_ROOT/compose 执行 docker compose up -d
  7. 访问 https://$DOMAIN/admin 登录管理端

========================================
EOF
  
  info "✓ 已生成安装摘要: $summary_file"
}

# 主函数
main() {
  echo "========================================"
  echo "全网舆情监测系统 - 宝塔部署包安装器"
  echo "Phase 1: 环境预检与基础配置"
  echo "========================================"
  echo ""
  
  parse_args "$@"
  
  # 1. 环境预检
  step "执行环境预检..."
  bash "$SCRIPT_DIR/scripts/preflight.sh" "$RUNTIME_ROOT"
  echo ""
  
  # 2. 创建目录
  create_directories
  echo ""
  
  # 3. 复制文件
  copy_files
  echo ""
  
  # 4. 生成安全配置
  step "生成安全配置..."
  bash "$SCRIPT_DIR/scripts/generate-env.sh" "$RUNTIME_ROOT"
  echo ""
  
  # 5. 生成摘要
  generate_summary
  echo ""
  
  # 完成
  echo "========================================"
  info "Phase 1 安装完成！"
  echo "========================================"
  echo ""
  cat "$RUNTIME_ROOT/INSTALL_SUMMARY.txt"
  echo ""
  warn "请妥善保存上述初始管理员密码，首次登录后会强制修改"
  echo ""
}

main "$@"
