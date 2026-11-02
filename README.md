# Komari Neumorph

轻量的新拟态 Komari 主题。柔和浮起卡片、内凹输入框与筛选按钮，支持浅色与深色，无底部导航。

## 功能

- 节点概览、分组、名称及系统搜索、在线状态筛选。
- CPU、内存、磁盘、上下行速率、累计流量与运行时间。
- 节点硬件详情，1 / 4 / 12 / 24 小时负载、网络及公开 Ping 趋势图。
- WebSocket 定时刷新、退避重连、过期连接提示；离线数据不冒充实时值。
- 私有站点密码登录、两步验证码与 OAuth 入口。
- 统一顶部工具栏，键盘焦点、减少动态效果偏好。
- 后台托管设置：强调色、首页文案、默认外观、流量及运行时间显示、刷新间隔。

## 安装

1. 打开本仓库 **Actions → Build Neumorph theme**，选择最近成功的一次运行。
2. 下载 **komari-Neumorph-installable**，解压外层工作流产物包。
3. 在 Komari 后台主题管理中上传里面的 **komari-Neumorph-v0.2.0.zip** 并启用。

主题 ZIP 根目录直接包含 `komari-theme.json` 与 `dist/`。请勿上传 GitHub 自动生成的源码 ZIP 或外层 Actions 产物 ZIP。

主题使用文档中的 `/api/nodes`、`/api/public`、`/api/clients` WebSocket 和历史记录接口；动态主题设置需要 Komari 1.0.5 或更新版本。开发验证采用官方接口结构的模拟响应，实际安装后仍需结合服务端版本验证。`/admin` 和 `/terminal` 由 Komari 内置界面接管。

## 本地开发

需要 Node.js 22.12+。

```sh
npm ci
KOMARI_URL=http://127.0.0.1:25774 npm run dev
```

打开终端显示的 `/themes/MD3/dist/` 地址。开发代理会将 `/api` HTTP 和 WebSocket 请求转发到 `KOMARI_URL`，不需要把管理员密钥写入源码。

```sh
npm test
npm run package
npx playwright install chromium
npx playwright test
```

安装包及 SHA-256 校验文件输出到 `release/`。GitHub Actions 自动执行类型检查、打包、数据转换测试、浏览器交互与明暗主题无障碍检查，并保留可安装产物。推送 `v*` 标签时还会发布 GitHub Release。

## 技术

TypeScript · Lit · Vite · 原生 HTML 控件 · Chart.js

- [Komari](https://github.com/komari-monitor/komari)
- [主题开发文档](https://www.komari.wiki/dev/theme)

Powered by Komari Monitor.

为兼容已有安装和后台主题设置，内部主题标识继续使用 `MD3`；界面与组件实现已经切换为新拟态。
