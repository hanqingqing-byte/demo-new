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

推荐把它部署成一个 Node 容器，然后接上 Supabase：

- 数据库：Supabase Postgres
- 对象存储：Supabase Storage
- 应用服务：Node 24

部署前先执行 `supabase/schema.sql` 建表，然后把这些环境变量配上：

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`
- `SUPABASE_PUBLIC_URL`

注意：对象存储的 bucket 需要是公开可读的，这样分享页才能直接显示图片。

如果你部署在 Render 上，`APP_ORIGIN` 可以先不填。服务会自动使用 Render 提供的 `RENDER_EXTERNAL_URL`；等你后面绑定了自定义域名，再把 `APP_ORIGIN` 改成正式域名即可。

如果这些变量都配好了，服务会自动切到线上数据库和对象存储；否则会回退到本地文件存储，方便开发联调。

如果你想直接按 Render Blueprint 部署，可以把仓库根目录里的 `render.yaml` 提交上去，然后在 Render 里选 `New + -> Blueprint`。

Render 控制台手动部署的话，顺序是：
1. `New + -> Web Service`
2. 连接你的 GitHub 仓库
3. 选择这个项目
4. 填 `Build Command` 为 `npm install`
5. 填 `Start Command` 为 `npm start`
6. 在环境变量里填 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_BUCKET`、`SUPABASE_PUBLIC_URL`
7. `APP_ORIGIN` 可以先留空，等拿到 Render 的线上地址后再补，或者直接用你的自定义域名
8. `PORT` 不用你手动填，Render 会自动注入

## 环境变量

- `PORT`：服务端口，本地默认 `4173`，Render 会自动注入

## 说明

- 首次启动会自动生成两条示例 Demo 和几条反馈
- 如果你后续要把它部署到线上，我可以继续帮你补对象存储、数据库和域名配置
