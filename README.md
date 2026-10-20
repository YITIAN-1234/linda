# 邻答 · 澜庭·林语郡 物业 AI 问答（GitHub Pages 版）

一个仓库、两种模式，前端自动切换：
- **静态版（默认）**：打开即用，规则引擎 + 210 条制度条款全部在浏览器本地运行，零后端零 key
- **完整版（可选）**：部署 Cloudflare Workers 后，自动切换 DeepSeek 真实回答；key 只存 Workers Secrets，永不进前端

## 目录

```
linda-site/
├─ index.html          # 手机聊天界面（含后端探测与自动降级）
├─ assets/
│  ├─ engine.js        # 规则引擎：意图/联想检索/锚点判定/拒答分流/口语化/工单
│  └─ kb.json          # 210 条制度条款 + 2 附件（150KB）
├─ workers/
│  ├─ worker.js        # Cloudflare Workers：DeepSeek 判定与生成（key 在 Secrets）
│  └─ wrangler.toml
├─ tests/run_engine.js # Node 对拍测试（60 条评测用例）
└─ README.md
```

## 部署到 GitHub Pages（静态版）

1. 新建 GitHub 仓库（如 `linda`），把本目录所有文件推上去
2. 仓库 Settings → Pages → Source 选 `main` 分支 / 根目录 → Save
3. 等待 1-2 分钟，访问 `https://你的用户名.github.io/linda/` 即正常运行
4. 静态版不需要任何 key、不需要服务器、永不停机

```bash
git init
git add .
git commit -m "邻答 GitHub Pages 版"
git branch -M main
git remote add origin https://github.com/你的用户名/linda.git
git push -u origin main
```

## 部署 Cloudflare Workers（完整版，可选）

```bash
cd workers
npm install -g wrangler     # 或 npx wrangler
npx wrangler login          # 浏览器授权
npx wrangler secret put DEEPSEEK_API_KEY   # 粘贴 sk-xxx，key 只存 Cloudflare
npx wrangler deploy         # 得到 https://xxx.workers.dev
```

然后把 `index.html` 顶部的 `WORKER_URL` 改成你的 workers 地址，重新 push。
前端启动时会探测后端健康：在线走 DeepSeek 完整回答，离线/出错自动回落本地规则引擎，
两种模式用户无感知。

## 本地验证

```bash
# 静态版（Node 对拍 60 条评测用例）
node tests/run_engine.js        # 期望：60/60 全部通过

# 本地预览页面
python -m http.server 8000      # 打开 http://127.0.0.1:8000
```

## 行为规则（两版一致）

- 制度内问题：口语回答 + （出处：《文件简称》第X条），出处必须真实存在
- 制度外问题：委婉拒绝，不建单
- 小区事务但无依据/含糊：固定话术 + 工单（类别/紧急程度/位置/备注）
- 多轮记忆：同对话框保留上下文，追问补房号后自动建单，5 分钟无发言销毁会话
