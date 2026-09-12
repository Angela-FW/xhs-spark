# 重启笔记

面向「37 岁、双非、离职重启、正在找工作」人设的小红书**文案 + 一年内容规划**工具。支持感悟入库、对话微调（预览后确认），以及 **封面生图**。不生成视频。

## 交互说明

- **随便逛**：人设 / 日历 / 感悟 / 对话均可直接点，不强制登录。
- **点「生成」**：才弹出登录 / 注册（保护额度，并开启云端同步）。
- **生文**：用站点共用的 Cloudflare Workers AI（服务端 `CLOUDFLARE_*`），用户不用配 Key。
- **生图**：每人自备 Cloudflare / 硅基流动等 Key；登录后同步到账号，**不占用别人额度**。

## 每次怎么打开

### A. 在 Cursor 云端对话里用

1. 打开这个 Cloud Agent / 项目会话（要保证开发服务在跑）
2. 看 Cursor 左侧或底部的 **Ports（端口）**
3. 找到 **43123** → **Open in Browser / 在浏览器打开**

当前开发地址：[重启笔记](http://127.0.0.1:43123)

未配置 Supabase 时：本地模式，点「生成」也不拦登录（方便自测）。

### B. 本机长期用

```bash
npm install
cp .env.example .env.local   # 按需填写
npm run dev -- --port 43123 --hostname 127.0.0.1
```

也可把 `desktop/打开重启笔记.command`（Mac）或 `.bat`（Windows）复制到桌面双击打开。

## 免费上公网（推荐组合）

全程可走免费档（有额度上限）：

1. **Supabase（免费项目）**
   - 创建项目 → Settings → API，复制 Project URL 与 `anon` key
   - SQL Editor 执行仓库里的 [`supabase/schema.sql`](supabase/schema.sql)（含 `planner_state` 与 `user_cover_keys`）
   - Authentication → Providers → Email：建议关掉 **Confirm email**（个人用更省事）
   - 把 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 写入 `.env.local` 与 Netlify 环境变量

2. **Netlify 免费托管**
   - 导入本仓库 → 填同上环境变量 → Deploy
   - 得到公网链接；未登录可浏览，点「生成」需注册

3. **文生 vs 生图 Key**
   - 文案 / 周选题：在 Netlify / `.env.local` 配置站点共用的 `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`
   - 生图：每人自备 Key（推荐 [Cloudflare Workers AI](https://dash.cloudflare.com/?to=/:account/ai/workers-ai)，约 1 万 Neurons/天）；注册弹窗或生成页填写，登录后写入 Supabase
   - 站点**不会**用共享服务端 Key 代付生图额度

登录后：规划数据与生图 Key 都会同步到 Supabase。

## 发文节奏

- **第 1 个月（第 1–4 周）**：每周 **1** 篇  
- **第 2 个月起**：每周 **2** 篇；求职与生活进展穿插  
- 选题标题在全年日历内不重复  

## 技术栈

Next.js · TypeScript · Tailwind · shadcn/ui · Supabase（可选）
