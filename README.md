# Demo Feedback

这是一个可直接运行的真实项目版本：

- 设计师在 PC 端上传图片，生成可分享链接
- 用户打开分享链接后，可以在 PC 和手机上查看方案
- 用户在分享页提交建议
- 设计师在后台查看每条 Demo 的反馈

## 运行

当前项目使用 Node 启动本地服务：

```bash
cd /Users/hanqingqing/.codex/worktrees/a58a/评估
npm start
```

然后访问：

```text
http://127.0.0.1:4173
```

## 部署

如果你想避开绑卡验证，我现在更推荐用 **Cloudflare Pages + Pages Functions**，它能免绑卡把静态页和 API 一起部署出去。

部署前先执行 `supabase/schema.sql` 建表，然后把这些环境变量配上：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`
- `SUPABASE_PUBLIC_URL`

注意：
- 对象存储 bucket 需要是公开可读的，这样分享页才能直接显示图片。
- `APP_ORIGIN` 这版先不用配，前端会直接用当前站点的 `location.origin` 生成分享链接。

### Cloudflare Pages 部署步骤

1. 打开 Cloudflare Dashboard。
2. 进入 `Workers & Pages`。
3. 选择 `Create application` -> `Pages`。
4. 连接你的 GitHub 仓库 `demo-new`。
5. `Build command` 填 `npm run build`，或者保持默认但确保会生成 `dist/`。
6. `Build output directory` 填 `dist`。
6. 在环境变量里填：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_BUCKET`
   - `SUPABASE_PUBLIC_URL`
7. 部署完成后，Cloudflare 会给你一个线上域名。

仓库根目录里也放了 [wrangler.jsonc](/Users/hanqingqing/.codex/worktrees/a58a/评估/wrangler.jsonc)，用于显式告诉 Cloudflare Pages 输出目录是 `dist`。

### 本地运行

本地开发仍然可以继续用 Node 启动：

```bash
cd /Users/hanqingqing/.codex/worktrees/a58a/评估
npm start
```

然后访问：

```text
http://127.0.0.1:4173
```

## 说明

- 首次启动会自动生成两条示例 Demo 和几条反馈
- 如果你后续要把它部署到线上，我可以继续帮你补对象存储、数据库和域名配置
