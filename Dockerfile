FROM node:18-alpine AS builder

WORKDIR /app

# 先只拷贝package文件
COPY package*.json ./

# 安装所有依赖（包括devDependencies）
RUN npm install

# 然后拷贝其他文件
COPY . .

# 构建应用
RUN npm run build --no-cache

FROM node:18-alpine AS release
WORKDIR /app

# 只拷贝必要的生产文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .

ENV NODE_ENV=production
ENV API_BASE_URL=https://www.life-data.cn

# 安装生产依赖
RUN npm ci --omit-dev

# 使用CMD而不是ENTRYPOINT以便覆盖
CMD ["node", "dist/index.js"]
