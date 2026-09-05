# Fuderation Workshop 组件 — 模板仓库

用于构建**单个** [Fuderation Workshop](https://chat.fuderation.com/guide#component-guide-section-1)
组件的模板仓库。组件是渲染在故事线聊天消息内的交互式 UI 小部件。你在 `src/`
中编写源码，构建后会在仓库根目录生成一个可直接导入 Workshop 的 `component.json`。

> 一个仓库一个组件。每做一个新组件，就用此模板新建一个仓库。

## 前置要求

- **Node.js 18+**（基于 Node 22 开发）以及 npm。
- 开发依赖，通过 `npm install` 安装：
  - **esbuild** —— 将 `src/script.ts` 编译为压缩后的内联脚本；也用于打包预览工具。
  - **typescript** —— 依据 `types/bridge.d.ts` 中的桥接函数声明，对
    `src/script.ts` 做类型检查。
  - **dompurify / markdown-it** —— 仅供本地预览使用，与站点自身依赖一致。
  - **acorn / @csstools/css-tokenizer / parse5-sax-parser** —— 定位 JS / CSS / HTML
    注释，在不重新生成源码的前提下去除注释。
  - **terser** —— 为 iframe JavaScript 的局部标识符选择短名称；构建仅把名称改动应用回原文。

没有任何运行时依赖 —— 组件以纯 HTML/CSS/JS 形式交付。

## 快速开始

```bash
npm install        # 安装构建与预览依赖
# 编辑 src/ 下的文件（从 info-card 脚手架开始）
npm run build      # 生成 ./component.json
npm run preview    # 本地预览：http://localhost:5173
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
│   ├── script.ts        # 经 esbuild 编译     -> component.script   (必定 iframe 模式)
│   ├── script.js        # 去注释，iframe 局部变量改名 -> component.script (模式由内容决定)
│   ├── ai_prompt.md     # AI 附加提示词        -> component.ai_prompt
│   └── meta.json        # { "name", "description" }
├── component.json       # 构建产物（生成、被忽略）—— 导入此文件到 Workshop
├── scripts/
│   ├── build.mjs        # 构建脚本
│   ├── strip-comments.mjs # 保留源码写法的注释清理
│   ├── rename-identifiers.mjs # 仅替换合适的局部标识符
│   ├── preview.mjs      # 本地预览服务器
│   └── vendor-runtime.mjs # 拉取 / 校验被冻结的官方运行时
├── tools/preview/       # 预览工具前端（模拟聊天气泡 + 宿主桥接）
├── vendor/              # 冻结的官方组件运行时（第三方代码，非 MIT）
├── types/bridge.d.ts    # 桥接函数的环境类型声明
└── .agents/skills/      # 创作技能（流程 + 设计 + 参考）
```

`markup.html`/`styles.css`/`script.*` 中的 `$参数名$` 占位符，会在调用时由 AI 通过
`<$name$><参数名>值</参数名></$name$>` 填入。

## 本地预览

```bash
npm run preview                     # http://localhost:5173
npm run preview -- --open --port 5199
```

用**真实的官方运行时**（冻结在 `vendor/`）把 `src/` 渲染到模拟聊天气泡里，
配色、气泡与 Markdown 样式直接取自站点自己的样式表。修改 `src/` 会自动刷新。

- **参数面板**：自动扫出所有 `$参数$` 占位符并生成输入框，改动即时重渲染。
- **前后正文**：填写组件前后的 Markdown 正文，用站点同款 markdown-it 渲染。
- **拖放载入**：把任意 `component.json` 拖进窗口即可预览（也支持单栏位 `source`）。
- **宽度切换**：320 / 360 / 480 / 680，用来复现窄气泡下的自动缩放。
- **宿主调用记录**：toast、fillInput、剪贴板、存储、世界书、消息改写全部可见。

它会告诉你：

- 当前落在哪种渲染模式、为什么；
- CSS 是否被 1000 字符上限静默截断、`:hover`/`@keyframes` 是否根本没生效；
- 切到 320px 时组件是否被 `autoScaleRoot()` 整体缩小；
- 哪些标签被消毒器删掉；
- `changeMsg` 的自我重调用是否真的能来回切换（Workshop 自带预览做不到这点）。

详见 [`tools/preview/README.md`](tools/preview/README.md)。

## 编写脚本

`src/script.js` 与 `src/script.ts` **二选一**，不要同时存在。

- **`script.js`（去注释，iframe 模式下还会缩短局部变量名）** —— DSL 脚本一行写一个桥接调用，例如
  `setText('[data-out]', '$Text$')`。文件扩展名**不保证 DSL 模式**：只有当
  每条语句都是白名单桥接调用、且不含原生 JS 时，才会落在轻量的 **DSL 模式**；否则照样
  进 iframe。以 `npm run build` 打印的模式为准。
- **`script.ts`（编译）** —— 由 esbuild 打包并压缩为内联 IIFE。任何编译产物都会运行在沙箱
  **iframe 模式**。正常编写 TypeScript 即可，但**不要 `import` 桥接函数** —— 它们由运行时
  注入为全局函数，并在 `types/bridge.d.ts` 中做了环境声明。iframe 内禁止外部/CDN 脚本，
  也禁止任何联网。

用 `npm run typecheck` 对 TypeScript 源码做类型检查，`npm test` 运行构建回归测试。

## 构建时压缩了什么

**HTML、CSS 和 DSL 脚本只去注释；iframe JavaScript 还会缩短合适的局部变量名；
`script.ts` 继续完整压缩。** 构建在清理后做首尾去空白（`.trim()`），不改动源文件。
`script.js` 不做语法压缩，也不合并桥接调用。

| 源文件 | DSL 模式 | iframe 模式 |
|---|---|---|
| `src/markup.html` | 去 HTML 注释 + `.trim()` | 相同 |
| `src/styles.css` | 去 CSS 注释 + `.trim()` | 相同 |
| `src/script.js` | 去 JS 注释 + `.trim()`，保留逐条桥接调用 | 去注释 + 缩短合适的局部变量/参数名，可关闭或保留指定名称 |
| `src/script.ts` | 不适用 | esbuild 打包为 IIFE，去空白 + 精简语法 + 混淆标识符 |
| `src/ai_prompt.md` | 仅 `.trim()`，不去注释 | 相同 |

清理使用语言解析器定位注释后编辑原文，不重新输出整棵语法树。因此引号、中文、URL、
正则表达式、`$参数$` 和注释之外的缩进都保持原样；变量改名单独按下节规则处理。HTML 中的属性值、
`textarea`、`script`、`style` 和 SVG CDATA 等内容不会被当成 HTML 注释删除；
内嵌 JS/CSS 不在 HTML 清理范围内，请按仓库约定分别写入脚本和样式文件。

必要的分隔符会保留：JS 块注释中的换行影响自动分号插入，不能删除；相邻 token 之间
可能补一个空格。CSS 的 `1/*说明*/px` 不能合并成 `1px`，所以留下空的 `/**/`；
HTML 的 `&am<!--说明-->p;` 不能变成实体 `&amp;`，所以留下空的 `<!---->`。
只有会改变解析结果的边界才保留空注释，注释文字都会删除。无效 JS 会报告
`src/script.js` 和解析位置，不会尝试用正则猜测哪些内容可以删。

**字符预算和模式判定都以清理后的构建产物为准。** 20000 字符的总上限和 1000 字符
的 DSL CSS 上限不再计入已删除的注释，但保留的空白及必要分隔符仍占预算。本地预览
复用同一构建函数，因此 `src/` 预览与导出的 JSON 一致。

去注释后，依赖注释内容或 CSS 原始长度触发的 iframe 模式可能回到 DSL。
需要明确使用 iframe 时，在 `script.js` 中写 `(() => {})();` 即可；它不执行实际操作，
但会命中原生 JS 检测，而且不会被优化掉。纯 DSL 脚本继续一行一个桥接调用。

### iframe JavaScript 的选择性改名

`script.js` 去注释后若属于 iframe 模式，默认缩短局部变量和参数名。Terser 负责作用域、
重名冲突和保留字检查；构建比较改名前后的 AST，只把标识符名称差异应用回原始源码，
不使用 Terser 打印的脚本。因此引号、反斜杠、中文、模板字符串和语句格式保持原样。
若 AST 还有其他变化、产物没有变短或模式改变，则保留去注释后的脚本。

以下名称不会改动：顶层声明、外部全局量（包括桥接 API）、对象属性、对象简写中的绑定、
函数/类名及直接推断名称的绑定、标签、私有属性，以及含 `$` 的标识符。生成的短名称
只使用英文字母，不会引入新的 `$参数$`。直接 `eval` / `with` 可见的相关作用域交由
Terser 保守处理。CSS 选择器、HTML ID 和字符串里的名称不会跟着改名。

可在 `src/meta.json` 中配置：

```json
{
  "name": "MyPanel",
  "build": {
    "renameIdentifiers": true,
    "reservedNames": ["keepThisLocalName"]
  }
}
```

`renameIdentifiers` 默认 `true`，`reservedNames` 默认空数组；名称保留规则应用于所有作用域。
设为 `false` 可让 `script.js` 只去注释。依赖函数 `toString()` 中的参数/变量拼写时，应关闭
改名；改名不能保留函数源码反射结果。`build` 配置只用于本地构建，不写入组件导出，
也不影响 `script.ts` 已有的完整压缩行为。本地预览使用相同设置。

### 为什么 `script.js` 不做语法压缩

不是漏了，是压了会坏。`minify: true` 会启用 esbuild 的 `minifySyntax`，把相邻的表达式
语句用逗号合并：

```js
// 源码：2 条独立语句
setText('[data-name]', '$Name$');
addClass('[data-card]', 'is-open');

// minify: true 之后：1 条语句
setText("[data-name]","$Name$"),addClass("[data-card]","is-open");
```

运行时判定「纯 DSL」时按 `[\r\n;]+` 切分语句，再要求每条都形如 `名字(...)`。合并后的这
一行**仍然通过检查**（名字是白名单里的 `setText`），于是组件照旧留在 DSL 模式，然后把
整串当作一次 `setText` 调用去解析参数——结果是静默跑错，而不是报错。

而且 esbuild 默认会把非 ASCII 转成 `\uXXXX` 转义（`toast('欢迎')` → `toast("\u6B22\u8FCE")`）。
DSL 参数由运行时的字符串解析器读取，不是 JS 引擎，未必会还原转义——中文可能原样显示成
转义序列。（该行为可用 `charset: 'utf8'` 规避。）

当前 `script.js` 不经过 esbuild。DSL 脚本只去注释；iframe 脚本另外按验证后的标识符位置
替换局部变量名。因此不会合并桥接调用，也不会改写字符串转义。
`script.ts` 的编译、打包和完整压缩路径保持不变。

## 自动构建（GitHub Actions）

仓库内置工作流 [`.github/workflows/build.yml`](.github/workflows/build.yml)：

- **推送到 `main`** 时，CI 会执行 `npm ci`、类型检查、`npm test`、`npm run build`，然后把更新后的
  `component.json` 自动提交回 `main`（提交信息带 `[skip ci]`，并通过 `paths-ignore`
  避免触发死循环）。
- **Pull Request** 仅做校验（类型检查 + 测试 + 构建），不提交。
- 也可在 Actions 页面手动触发（`workflow_dispatch`）。

也就是说：开发者本地无需提交 `component.json`，由 CI 在 `main` 上生成并提交这一份权威产物。

> 注意：若 `main` 开启了分支保护并禁止直接推送，需要允许 `github-actions` 机器人推送
> （或改用具备写权限的 PAT），CI 的回推才能成功。

## 两种渲染模式（重要）

运行时会为每个组件选择 **DSL（内联）** 或 **iframe（沙箱）** 模式，二者行为差异很大。
`npm run build` 会打印判定结果与相应警告。

| | DSL 模式 | iframe 模式 |
|---|---|---|
| CSS | **被摊平成内联 `style` 属性**；只读前 1000 字符；`@media`/`@keyframes` 被跳过；`:hover`、`::before` 完全不生效 | 真正的 `<style>` 样式表，一切正常 |
| 脚本执行时机 | **点击组件时** | **挂载时** |
| 桥接函数 | 全部 26 个，同步 | 除 `openUrl` 外全部；存储 / 世界书 / `progress` / `wait` 变为异步 |

**进入 iframe 模式的条件**（满足其一）：

1. 脚本命中原生 JS 检测（`const`/`function`/`=>`/`document.`/`setTimeout(` 等）；
2. 脚本的**前 32 条语句**中存在非白名单调用（32 是**校验窗口**，不是数量上限——
   运行时先取前 32 条再逐条校验，因此全为白名单调用的 40 条脚本照样留在 DSL 模式，
   第 33 条起既不校验也不保证执行）；
3. *（无脚本时）* HTML 含 `<html`/`<head`/`<body`；
4. *（无脚本时）* **CSS 超过 1000 字符**；
5. *（无脚本时）* CSS 含 `@media`/`@supports`/`@keyframes`/`@font-face` 等 at-rule；
6. *（无脚本时）* CSS 选中了 `html`/`body`/`:root`。

编译产物（`script.ts`）必然命中第 1 条。需要完整 CSS 时，可以在 `script.js` 中加
`(() => {})();` 明确使用 iframe；无脚本组件也可通过 `@media` 块触发。
不要依赖注释文字或去注释前的 CSS 长度来维持 iframe。

⚠️ 「纯 DSL 脚本 + 超过 1000 字符的 CSS」会停留在 DSL 模式并**静默丢弃多余样式**，
构建会就此告警。

## 约束（构建时校验）

- `name` ≤ 32 字符；仅限字母、数字、`-`、`_`、CJK 字符（U+4E00–U+9FA5）。
- `markup.html` 不可为空——导入端会丢弃没有 html 的组件。
- `description` ≤ 120 字符；`ai_prompt` ≤ 1000 字符。
  `ai_prompt` 为空时，AI 根本不会被告知该组件的存在。
- `html` + `css` + `script` 合计 ≤ 20000 字符。**按处理后的构建产物计**，
  详见[构建时压缩了什么](#构建时压缩了什么)。
- DSL 模式额外限制：最多 1000 字符 CSS（去注释后）。桥接调用的 32 条是**校验窗口**而非上限——
  运行时只校验前 32 条语句，多出来的不校验也不保证执行，别依赖。
- 禁止真实联网、真实登录、真实支付。**也不能加载外部字体**
  （iframe CSP 的 `font-src` 只允许 `data:`，Google Fonts 会静默失败）。
- 组件在 VN 模式下不生效。

## 了解更多

- 创作流程与桥接函数 DSL 参考：
  [`SKILL.md`](.agents/skills/fuderation-component-builder/SKILL.md)。
- 运行时逆向记录（渲染模式、消毒规则、尺寸与异步桥接）：
  [`RUNTIME_INTERNALS.md`](.agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md)。
- 带注解的真实组件示例（媒体卡、骰子、自切换消息、双组件状态机）：
  [`EXAMPLES.md`](.agents/skills/fuderation-component-builder/EXAMPLES.md)。
- 完整单组件走查：
  [`EXAMPLE_PASSWORD_GATE.md`](.agents/skills/fuderation-component-builder/EXAMPLE_PASSWORD_GATE.md)。
- 设计令牌与样式指南：
  [`.agents/skills/frontend-design/`](.agents/skills/frontend-design/)。
- 官方指南：<https://chat.fuderation.com/guide#component-guide-section-1>
  （已逐字归档于
  [`reference/OFFICIAL_GUIDE_zh.md`](.agents/skills/fuderation-component-builder/reference/OFFICIAL_GUIDE_zh.md)）。

## 许可证

本项目以 [MIT 许可证](LICENSE) 发布，允许在保留许可声明的前提下用于开源或私有产品。

**例外：[`vendor/`](vendor/) 目录不适用 MIT 许可证。** 其中的
`storyComponents.js`（原样取回）与 `site-chat.css`（样式表子集）均来自 Fuderation 公开
Web 客户端的专有代码，版权归其所有者，仅为让本地预览与线上行为、外观完全一致而收录。若你要 fork、再分发或公开发布本仓库，
请先阅读 [`vendor/README.md`](vendor/README.md)；必要时删除该目录，改用
`npm run vendor:runtime -- --update` 在本地按需拉取。
