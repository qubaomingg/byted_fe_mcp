FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Command will be provided by smithery.yaml
# 更新启动命令，添加--experimental-fetch参数
ENTRYPOINT ["node", "--experimental-fetch", "dist/index.js"]
