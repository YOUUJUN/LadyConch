#!/bin/bash

# Docker Sandbox 构建脚本

set -e

IMAGE_NAME="ladyconch-sandbox"
IMAGE_TAG="latest"
FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

echo "开始构建 Docker 沙盒镜像..."
echo "镜像名称: ${FULL_IMAGE}"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 构建镜像
docker build -t "${FULL_IMAGE}" "${SCRIPT_DIR}"

echo "✓ 镜像构建完成: ${FULL_IMAGE}"

# 显示镜像信息
echo ""
echo "镜像信息:"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "使用方法:"
echo "  const manager = new DockerSandboxManager({"
echo "    sandbox: {"
echo "      docker: {"
echo "        image: '${FULL_IMAGE}'"
echo "      }"
echo "    }"
echo "  })"
