# PandaGuGu Studio — 静态站点 Docker 镜像
# 构建：docker build -f deploy/Dockerfile -t pandagugu-studio .
# 运行：docker run -d -p 8080:80 pandagugu-studio

# 1) 构建阶段
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) 运行阶段
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
