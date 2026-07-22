#!/bin/bash
#
# 宝塔部署包 - 环境预检脚本
# 功能：检测 Linux 发行版、Docker、Docker Compose、宝塔 Nginx、端口、磁盘与内存
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# 检查 root 权限
check_root() {
  if [[ $EUID -ne 0 ]]; then
    error "请使用 root 或 sudo 执行本脚本"
  fi
  info "✓ 当前用户为 root"
}

# 检查 Linux 发行版
check_os() {
  if [[ ! -f /etc/os-release ]]; then
    error "无法识别的 Linux 发行版，仅支持 CentOS/Ubuntu/Debian/Alma/Rocky"
  fi

  . /etc/os-release
  case "$ID" in
    centos|rhel|almalinux|rocky)
      OS_FAMILY="rhel"
      ;;
    ubuntu|debian)
      OS_FAMILY="debian"
      ;;
    *)
      error "不支持的 Linux 发行版: $ID，仅支持 RHEL/CentOS/Alma/Rocky/Ubuntu/Debian"
      ;;
  esac

  info "✓ 发行版: $PRETTY_NAME ($OS_FAMILY)"
}

# 检查 Docker
check_docker() {
  if ! command -v docker &>/dev/null; then
    error "未安装 Docker Engine，请先通过宝塔面板或官方脚本安装 Docker"
  fi

  if ! docker info &>/dev/null; then
    error "Docker 未运行或权限不足"
  fi

  local docker_version
  docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
  info "✓ Docker Engine: $docker_version"
}

# 检查 Docker Compose
check_docker_compose() {
  # 优先检查 Compose V2 (plugin)
  if docker compose version &>/dev/null; then
    local compose_version
    compose_version=$(docker compose version --short 2>/dev/null || echo "v2")
    info "✓ Docker Compose Plugin: $compose_version"
    return 0
  fi

  # 回退检查 Compose V1 (standalone)
  if command -v docker-compose &>/dev/null; then
    local compose_version
    compose_version=$(docker-compose version --short 2>/dev/null || echo "v1")
    warn "检测到 Docker Compose V1，建议升级到 V2 Plugin"
    info "✓ Docker Compose: $compose_version"
    return 0
  fi

  error "未安装 Docker Compose，请先安装 Docker Compose Plugin"
}

# 检查宝塔面板
check_baota() {
  if [[ ! -f /www/server/panel/class/public.py ]]; then
    warn "未检测到宝塔面板，将跳过宝塔 Nginx 配置"
    return 0
  fi

  if [[ -f /www/server/panel/data/panel.conf ]]; then
    info "✓ 检测到宝塔面板"
  else
    warn "宝塔面板目录存在但配置不完整"
  fi

  # 检查宝塔 Nginx
  if [[ ! -x /www/server/nginx/sbin/nginx ]]; then
    warn "未安装宝塔 Nginx，无法自动生成站点代理配置"
  else
    local nginx_version
    nginx_version=$(/www/server/nginx/sbin/nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+' || echo "unknown")
    info "✓ 宝塔 Nginx: $nginx_version"
  fi
}

# 检查端口占用
check_ports() {
  local ports=(3000 3306 6379)
  local port_conflict=0

  for port in "${ports[@]}"; do
    if ss -tunlp 2>/dev/null | grep -q ":$port " || netstat -tunlp 2>/dev/null | grep -q ":$port "; then
      warn "端口 $port 已被占用，部署时请修改端口映射"
      port_conflict=1
    fi
  done

  if [[ $port_conflict -eq 0 ]]; then
    info "✓ 端口 3000/3306/6379 可用"
  fi
}

# 检查磁盘空间
check_disk() {
  local install_dir="${1:-/www/server/opinion-monitor}"
  local parent_dir=$(dirname "$install_dir")

  # 确保父目录存在
  mkdir -p "$parent_dir" 2>/dev/null || true

  local avail_gb
  avail_gb=$(df -BG "$parent_dir" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//' || echo "0")

  if [[ $avail_gb -lt 10 ]]; then
    error "安装目录所在磁盘可用空间不足 10GB（当前 ${avail_gb}GB），请清理磁盘后重试"
  elif [[ $avail_gb -lt 20 ]]; then
    warn "安装目录所在磁盘可用空间仅剩 ${avail_gb}GB，建议至少保留 20GB"
  else
    info "✓ 磁盘可用空间: ${avail_gb}GB"
  fi
}

# 检查内存
check_memory() {
  local mem_total_mb
  mem_total_mb=$(free -m | awk 'NR==2 {print $2}')

  if [[ $mem_total_mb -lt 2048 ]]; then
    warn "系统内存小于 2GB（当前 ${mem_total_mb}MB），MySQL 与后端可能因 OOM 被 Kill"
  else
    info "✓ 系统内存: ${mem_total_mb}MB"
  fi
}

# 主函数
main() {
  local runtime_root="${1:-/www/server/opinion-monitor}"

  echo "========================================"
  echo "全网舆情监测系统 - 环境预检"
  echo "========================================"
  echo ""

  check_root
  check_os
  check_docker
  check_docker_compose
  check_baota
  check_ports
  check_disk "$runtime_root"
  check_memory

  echo ""
  info "环境预检通过，可以继续安装"
}

# 允许直接运行或被 source
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
