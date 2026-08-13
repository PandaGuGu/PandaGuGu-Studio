# PandaGuGu Studio 部署说明

## 方式一：Docker（推荐）

```bash
# 构建镜像（根目录执行）
docker build -f deploy/Dockerfile -t pandagugu-studio .

# 运行
docker run -d -p 8080:80 pandagugu-studio

# 访问 http://localhost:8080
```

## 方式二：静态托管

```bash
npm run build          # 产物在 dist/
```

将 `dist/` 目录部署到任意静态托管（EdgeOne Pages / Netlify / GitHub Pages / Nginx），SPA 需配置回退到 `index.html`（参考 `deploy/nginx.conf`）。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| （无） | 项目为纯前端，无后端依赖。API Key 由用户在设置页填写，存浏览器 localStorage。 | — |

如需部署到子目录（如 `https://example.com/pandagugu/`），构建时指定 base：`npx vite build --base=/pandagugu/`。
