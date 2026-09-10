# 重启笔记

面向「37 岁、双非、离职重启、正在找工作」人设的小红书**文案 + 一年内容规划**工具。支持感悟入库、对话微调（预览后确认），以及 Pollinations **封面生图**。不生成视频。不需要自备服务器。

## 每次怎么打开

### A. 在 Cursor 云端对话里用（现在这套）

1. 打开这个 Cloud Agent / 项目会话（要保证开发服务在跑）
2. 看 Cursor 左侧或底部的 **Ports（端口）**
3. 找到 **43123** → **Open in Browser / 在浏览器打开**
4. 不要自己在系统 Chrome 里手输 `localhost`（那是你电脑本机，不是云端）

当前开发地址：[重启笔记](http://127.0.0.1:43123)

### B. 固定成「桌面图标」（本机长期用）

云端会话**没法直接往你电脑桌面放图标**。本机克隆项目后可以：

1. `npm install`
2. 把 `desktop/打开重启笔记.bat`（Windows）或 `desktop/打开重启笔记.command`（Mac）**复制到桌面**
3. 双击即可启动并打开浏览器  
4. 图标可用仓库里的 `public/app-icon.png`（也可在浏览器打开后：菜单 → **安装应用 / 添加到主屏幕**）

```bash
npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

打开 [http://127.0.0.1:43123](http://127.0.0.1:43123)。

数据保存在浏览器 `localStorage`。请用页头「导出备份 / 导入备份」防止清缓存丢失。

## 发文节奏（已按你的要求调整）

- **第 1 个月（第 1–4 周）**：每周 **1** 篇，慢热建立信任  
- **第 2 个月起**：每周 **2** 篇；求职内容与 **生活进展** 穿插，丰满人物形象  
- 选题标题在全年日历内 **不重复**

打开旧版本本地缓存时，会自动升级到新节奏（感悟等本地数据会尽量保留）。也可点「重置」。

### 封面生图

推荐用有**每日免费额度**的线路（不绑卡、不充值也能用）：

1. **Cloudflare Workers AI（默认）**  
   - 每天约 **10,000 Neurons ≈ 170 张**，次日重置  
   - 在 [dash.cloudflare.com](https://dash.cloudflare.com) 创建 Account ID + 带 Workers AI 权限的 API Token  
   - 配置到本机 `.env.local`（`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`）

写「内容 / 风格 / 颜色」会本地排版文字封面；纯画面描述走 AI 文生图。当前账号不支持参考图生图。

不生成视频成片。

### 上线（可选）

无自有服务器也可：用 Vercel / Netlify 等免费托管部署本 Next.js 项目。本机使用则无需部署。

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui
