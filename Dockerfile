# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine

# 创建工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 设置环境变量（可被 docker run 时覆盖）
ENV API_BASE_URL=http://fe-lib.bytedance.net
ENV NODE_ENV=production

# 启动命令
CMD ["node", "dist/index.js"]
