# 构建基础镜像
FROM node:18-alpine

# 安装常用工具
RUN apk add --no-cache \
    bash \
    git \
    python3 \
    py3-pip \
    curl \
    wget

# 创建工作目录
WORKDIR /workspace

# 设置环境变量
ENV NODE_ENV=production

# 默认命令
CMD ["/bin/bash"]
