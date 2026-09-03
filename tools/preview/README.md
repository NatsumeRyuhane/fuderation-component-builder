# 本地组件预览

```bash
npm run preview          # http://localhost:5173
npm run preview -- --open --port 5199
```

用**真实的 Fuderation 运行时**（冻结在 [`vendor/`](../../vendor/)）把 `src/` 渲染进模拟聊天气泡。
界面语言为中文，配色与排版直接取自站点自己的样式表。修改 `src/` 会自动刷新。

Workshop 自带的预览把所有组件都塞进 iframe、不替换 `$参数$`、也跑不了宿主桥接。
这个工具三件事都做，所以它能提前暴露那些「只有真机试玩才会发现」的问题。

## 真实 vs. 模拟

| | 来源 |
|---|---|
| 消息解析、`$参数$` 替换、转义、代码块处理 | **官方运行时**，未改动 |
| DSL / iframe 模式判定 | **官方运行时** |
| DSL 模式下把 CSS 摊平成内联样式 | **官方运行时** |
| HTML 消毒（DSL 模式） | **官方运行时** + DOMPurify |
| iframe 文档、CSP、高度回报协议 | **官方运行时** |
| 注入的 `[组件使用说明]` 系统提示词 | **官方运行时** |
| 气泡与 Markdown 样式 | **官方样式表**，见 `vendor/site-chat.css` |
| Markdown 渲染 | markdown-it，配置与站点一致：`{html:true, linkify:true, breaks:true}`，输出再过一遍 DOMPurify（`html:true` 会原样放行 HTML，而组件可以通过 `appendMsg`/`changeMsg` 把任意标记写进消息里）|
| 挂载 iframe、响应高度回报 | 我们写的 —— 站点的挂载代码不在任何可达 chunk 里 |
| DSL 解释器与点击绑定 | 我们写的，同上（[`dsl.js`](dsl.js)） |
| 宿主：toast、fillInput、changeMsg、存储、世界书 | 我们写的模拟（[`host.js`](host.js)） |

标注为「我们写的」的部分是根据观测到的契约重建的，细节记录在
[`RUNTIME_INTERNALS.md`](../../.agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md)；
其余部分的行为与真实聊天完全一致。

## 面板说明

### 组件来源

默认预览 `src/`。也可以：

- 点「载入 component.json…」选择文件；
- 或**把 `component.json` 直接拖进窗口任意位置**。

导出信封（`{type, version, component:{…}}`）和裸的组件对象都能识别；如果只有单栏位
`source` 而没有 `html`，会按站点的规则拆出 HTML / CSS / Script。载入外部文件后可以随时
「回到 src/」。

### 参数

自动从 `html` / `css` / `script` 里扫出所有 `$参数$` 占位符，每个给一个输入框。
**改动即时重渲染** —— 不需要手写调用标签。转义过的 `\$名称\$` 会被正确忽略。

### 消息内容

组件在真实聊天里从来不是孤立出现的，所以这里可以填「组件前的正文」和「组件后的正文」，
两段都按 Markdown 渲染（站点用的就是 markdown-it，配置相同）。下面的「助手消息原文」
显示最终拼出来、运行时真正解析的那段文本。

勾选「直接编辑原文」可以完全手写消息 —— 适合测试同一条消息里调用两次组件、
把组件放进代码块、或者故意写错标签。

组件调用 `changeMsg()` 时会自动切到原文模式，因为那时候消息就是组件自己写的。

### 聊天输入框

组件调用 `fillInput()` 时文本会写进这里，和真实客户端一样。它**不会发送任何东西** ——
只是让你确认组件塞给玩家的内容对不对。这是 `fillInput` 唯一的可见效果。

### 渲染模式 / 警告

当前落在哪种模式、为什么，以及会静默出问题的地方：CSS 被 1000 字符上限截断、
伪类不生效、DSL 脚本要点击才执行、iframe 里 `openUrl` 未定义、`ai_prompt` 为空等。

### 注入的系统提示词

故事线实际告诉模型的内容。`ai_prompt` 为空时这里什么都没有 —— 也就意味着 AI 永远不会调用它。

### 宿主调用记录

每一次到达宿主的桥接调用：toast、剪贴板、存储读写、世界书查询、消息改写。
「清除本地存储」会清掉预览用的 `localStorage` 命名空间。

## 它能提前发现什么

- **当前是哪种模式**，以及为什么。
- **CSS 被静默截断**，或 `:hover` / `@keyframes` 在 DSL 模式下根本不生效。
- **自动缩放**：切到 320px，看固定宽度的组件被整体缩小到看不清。
- **被消毒器删掉的标签** —— `canvas`、`form`、`header` 等。
- **`getMsgContent()` 在 iframe 里顶层调用返回空**。
- **`changeMsg` 来回切换**：自我重调用的组件真的能反复切换，因为消息框被真正改写并重新解析。

## 不改 `src/` 直接试一个组件

页面暴露了调试钩子：

```js
__preview.setComponent(
  { name: 'Demo', html: '<div>$T$</div>', css: '.x{}', script: '' },
  '<$Demo$><T>你好</T></$Demo$>',
);
```

## 刷新被冻结的运行时

```bash
npm run vendor:runtime              # 校验已提交的副本
npm run vendor:runtime -- --update  # 从线上重新拉取（含样式表子集）
```

详见 [`vendor/README.md`](../../vendor/README.md)，其中包含许可证说明 —— fork 本仓库前请先阅读。
