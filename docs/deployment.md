# 部署

线上：<https://rubisco0211.github.io/>，仓库 `RUBisco0211/RUBisco0211.github.io`（GitHub Pages **用户页**）。

```bash
git push            # 推到 main 就自动部署
```

`.github/workflows/deploy.yml`：`npm ci → test → build → upload-pages-artifact → deploy-pages`。

Pages 的 `build_type` 必须是 `workflow`（不是 `legacy`，那是 Jekyll 分支构建）：

```bash
gh api -X PUT repos/RUBisco0211/RUBisco0211.github.io/pages -f build_type=workflow
```

## `base` 路径

用户页是根路径，`vite.config.ts` 保持默认 `/`。

如果改成**项目页**（`<user>.github.io/<repo>`），必须设 `base: '/<repo>/'` —— 正文和静态资源都靠
`import.meta.env.BASE_URL` 拼地址，`scripts/copy-content.ts` 写的 `dist/content/` 也在同一个前缀下。
