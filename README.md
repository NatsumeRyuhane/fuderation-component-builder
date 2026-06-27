# Fuderation Workshop 组件 — 模板仓库

用于构建**单个** [Fuderation Workshop](https://chat.fuderation.com/guide#component-guide-section-1)
组件的模板仓库。组件是渲染在故事线聊天消息内的交互式 UI 小部件。你在 `src/`
中编写源码，构建后会在仓库根目录生成一个可直接导入 Workshop 的 `component.json`。

> 一个仓库一个组件。每做一个新组件，就用此模板新建一个仓库。

## 前置要求

- **Node.js 18+**（基于 Node 22 开发）以及 npm。
- 开发依赖，通过 `npm install` 安装：
  - **esbuild** —— 将 `src/script.ts` 编译为压缩后的内联脚本。
  - **typescript** —— 依据 `types/bridge.d.ts` 中的桥接函数声明，对
    `src/script.ts` 做类型检查。

没有任何运行时依赖 —— 组件以纯 HTML/CSS/JS 形式交付。

## 快速开始

```bash
npm install        # 安装 esbuild 与 typescript
# 编辑 src/ 下的文件（从 info-card 脚手架开始）
npm run build      # 生成 ./component.json
```

`component.json` **由构建生成，且被 gitignore 忽略** —— 全新克隆中不存在，只有运行
`npm run build` 后才会出现。每次修改 `src/` 后都要重新构建。

随后在 Workshop 中：打开你的故事线 → **组件** → 导入 `component.json`。保存故事线并进行
**游玩测试** —— 仅看预览无法证明 AI 会真正调用该组件。

## 项目结构

```text
.
├── src/                 # 你编写的源码
│   ├── markup.html      # 仅 HTML            -> component.html
│   ├── styles.css       # 样式               -> component.css
│   ├── script.ts        # 经 esbuild 编译     -> component.script   (iframe 模式)
│   ├── script.js        # 或原样透传          -> component.script   (DSL 模式)
│   ├── ai_prompt.md     # AI 附加提示词        -> component.ai_prompt
│   └── meta.json        # { "name", "description" }
├── component.json       # 构建产物（生成、被忽略）—— 导入此文件到 Workshop
├── scripts/build.mjs    # 构建脚本
├── types/bridge.d.ts    # 桥接函数的环境类型声明
└── .agents/skills/      # 创作技能（流程 + 设计 + 参考）
```

`markup.html`/`styles.css`/`script.*` 中的 `$参数名$` 占位符，会在调用时由 AI 通过
`<$name$><参数名>值</参数名></$name$>` 填入。

## 编写脚本

`src/script.js` 与 `src/script.ts` **二选一**，不要同时存在。

- **`script.js`（原样透传，推荐用于简单组件）** —— 一行写一个桥接函数调用，例如
  `setText('[data-out]', '$Text$')`。它会被原样透传，因此运行在轻量的 **DSL 模式**。
- **`script.ts`（编译）** —— 由 esbuild 打包并压缩为内联 IIFE。任何编译产物都会运行在沙箱
  **iframe 模式**。正常编写 TypeScript 即可，但**不要 `import` 桥接函数** —— 它们由运行时
  注入为全局函数，并在 `types/bridge.d.ts` 中做了环境声明。iframe 内禁止外部/CDN 脚本，
  也禁止任何联网。

用 `npm run typecheck` 对 TypeScript 源码做类型检查。

## 自动构建（GitHub Actions）

仓库内置工作流 [`.github/workflows/build.yml`](.github/workflows/build.yml)：

- **推送到 `main`** 时，CI 会执行 `npm ci`、类型检查、`npm run build`，然后把更新后的
  `component.json` 自动提交回 `main`（提交信息带 `[skip ci]`，并通过 `paths-ignore`
  避免触发死循环）。
- **Pull Request** 仅做校验（类型检查 + 构建），不提交。
- 也可在 Actions 页面手动触发（`workflow_dispatch`）。

也就是说：开发者本地无需提交 `component.json`，由 CI 在 `main` 上生成并提交这一份权威产物。

> 注意：若 `main` 开启了分支保护并禁止直接推送，需要允许 `github-actions` 机器人推送
> （或改用具备写权限的 PAT），CI 的回推才能成功。

## 约束（构建时校验）

- `name` ≤ 32 字符；仅限字母、数字、`-`、`_`、CJK 字符。
- `description` ≤ 120 字符；`ai_prompt` ≤ 1000 字符。
- `html` + `css` + `script` 合计 ≤ 20000 字符。
- 禁止真实联网、真实登录、真实支付。组件在 VN 模式下不生效。

## 了解更多

- 创作流程、桥接函数 DSL 参考与完整示例：
  [`.agents/skills/fuderation-component-builder/`](.agents/skills/fuderation-component-builder/)。
- 设计令牌与样式指南：
  [`.agents/skills/frontend-design/`](.agents/skills/frontend-design/)。
- 官方指南：<https://chat.fuderation.com/guide#component-guide-section-1>。
