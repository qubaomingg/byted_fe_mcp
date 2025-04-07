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

# 构建项目
RUN npm run build

# 设置环境变量（可被 docker run 时覆盖）
ENV API_BASE_URL=http://fe-lib.bytedance.net
ENV NODE_ENV=production

# 暴露端口（如果需要）
EXPOSE 9000

# 启动命令
CMD ["npm", "start"]
