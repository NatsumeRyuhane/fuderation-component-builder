<!--
  Verbatim copy of the OFFICIAL Fuderation Workshop component guide.

  Source : https://chat.fuderation.com/guide#component-guide-section-1
           (shipped as a template literal in assets/UserGuide-Do5tSyvX.js)
  Fetched: 2026-09-03 — byte-identical to the copy Charlin distributed.

  DO NOT EDIT. This is the upstream source of truth; when it conflicts with
  SKILL.md or RUNTIME_INTERNALS.md, this file wins on *intent* and
  RUNTIME_INTERNALS.md wins on *observed behaviour*.
  Re-fetch with the recipe in ../RUNTIME_INTERNALS.md#how-this-was-fetched.
-->

# Workshop 组件创作指南

这份文档写给创作者，重点讲三件事：

1. 组件是什么
2. 怎么让 AI 正确调用它
3. 组件脚本里有哪些桥接函数能直接用

如果只记一句话：

`组件 = 由你先定义好的消息内小界面，AI 再用固定标签把它调用出来。`

---

## 1. 组件是什么

Workshop 里的组件是“故事线级”的自定义小部件。

它不是整页网页，也不是完整应用，而是会出现在一条聊天消息里的可视化界面。常见用途：

- 信息卡
- 任务面板
- 假登录框
- 进度条
- 复制口令按钮
- 小型验证或答题面板

它和“素材”的区别很简单：

- 素材：主要是插图，占位符写法像 `{风景}`
- 组件：主要是界面和交互，调用写法像 `<$组件名$>...</$组件名$>`

注意：

- 组件绑定在单条故事线上，不是全角色通用
- `VN 模式` 下组件不生效

---

## 2. 最短上手流程

推荐按这个顺序做：

1. 先建一个最简单的静态组件，不要一开始就做复杂交互
2. 起一个清楚的组件名
3. 写最小源码：HTML + `<style>`
4. 在 `AI附加提示词` 里写清楚“什么时候用、怎么用”
5. 保存故事线
6. 去 `游玩测试` 看 AI 是否真的调出了组件
7. 跑通后再加脚本

新手最容易踩坑的不是“不会写”，而是：

- AI 没按格式调用
- 参数名不一致
- 只看预览，没去真实聊天里测

---

## 3. AI 怎么调用组件

AI 必须输出固定格式，系统才会渲染：

```html
<$组件名$>
  <参数A>值A</参数A>
  <参数B>值B</参数B>
</$组件名$>
```

例如：

```html
<$信息卡$>
  <标题>任务完成</标题>
  <内容>你已解锁下一步权限。</内容>
</$信息卡$>
```

这段会被渲染成你定义好的组件，不会原样显示。

### 参数怎么传

如果 AI 输出：

```html
<$信息卡$>
  <标题>欢迎回来</标题>
  <内容>系统已初始化完成。</内容>
</$信息卡$>
```

那你在组件源码里可以这样接：

```html
<div class="title">$标题$</div>
<div class="content">$内容$</div>
```

系统会把：

- `$标题$` 替换成 `欢迎回来`
- `$内容$` 替换成 `系统已初始化完成。`

如果需要原样输出 `$名称$`，而不是把它当作组件参数，请在两侧的 `$` 前加反斜杠：`\$名称\$`。系统会移除转义符并保留字面量 `$名称$`。HTML、CSS 和脚本中都可以使用，例如：

```js
changeMsg('<\$CyberPanelBeta\$>...</\$CyberPanelBeta\$>')
```

### 最常见错误

- 组件名写错
- 参数名写错
- 外层标签没闭合
- AI 没输出外层 `<$组件名$> ... </$组件名$>`

---

## 4. 编辑器里每一项是什么

### 组件名

组件名决定 AI 调用时写什么。

例如组件名是 `信息卡`，那 AI 必须写：

```html
<$信息卡$>...</$信息卡$>
```

规则：

- 最长 32 个字符
- 只支持中文、英文、数字、`-`、`_`
- 同一故事线里不能重名

推荐命名：

- `信息卡`
- `登录验证`
- `进度面板`
- `复制口令`

### 说明

这是写给创作者自己看的备注，方便管理和导出识别。

### 组件源码

这是核心编辑区。现在是单栏位，不再分 HTML / CSS / Script 三栏。

推荐写法：

```html
<div>HTML结构</div>

<style>
/* 样式 */
</style>

<script>
/* 逻辑 */
</script>
```

你也可以直接粘贴完整 HTML 文档，系统会自动拆分处理。

### AI附加提示词

这是教 AI 如何使用该组件的地方。建议固定写这四件事：

1. 什么时候用
2. 组件名是什么
3. 参数有哪些
4. 一段最小示例

推荐模板：

```text
当你需要【某种场景】时，使用“组件名”组件。
输出格式：
<$组件名$>
  <参数1>...</参数1>
  <参数2>...</参数2>
</$组件名$>
不要省略外层标签，参数名必须保持一致。
```

补充说明：

- 这里的内容会自动附加到故事线的回复格式提示里
- 它会影响 AI 行为
- 它也会占用提示词长度

### 样式预览

这里只负责帮你看布局和外观，不等于真实聊天效果。最终一定要去 `游玩测试`。

---

## 5. 组件脚本怎么写

对创作者来说，最推荐的是写“函数调用式脚本”，也就是 DSL 风格：

```text
setText('[data-result]', '$文本$')
show('[data-result]')
progress('[data-bar]', '[data-text]', 1500)
```

这种写法的好处：

- 不需要完整前端开发知识
- 比原生 JS 更稳
- 更适合创作者做剧情交互

### 脚本规则

- 一行一个调用最稳
- 选择器只在“当前组件内部”查找，不会全局乱找
- 特殊选择器 `@host` 表示当前组件根节点
- 脚本尽量短，不要堆太多逻辑

### 如果你写了原生 JS

如果系统检测到你写的是更原生的 JS，比如：

- `const`
- `function`
- `if`
- `for`
- `document.`
- `window.`

组件会切到隔离 iframe 执行。

这适合高级写法，但要注意：

- 不适合做真实联网功能
- 不建议新手从这里开始
- 新手优先用上面的 DSL 风格

---

## 6. 桥接函数参考

这一节是这份文档的重点。

下面这些是当前代码里能确认可用的函数。你在组件脚本里直接写函数名即可。

## 6.1 聊天与宿主桥接函数

| 函数 | 用法 | 作用 |
|------|------|------|
| `fillInput` | `fillInput('你好')` | 把文字写入聊天输入框 |
| `copyText` | `copyText('ABC-123')` | 复制到剪贴板 |
| `toast` | `toast('已复制', 'success')` | 弹提示，类型支持 `info/success/warning/error` |
| `appendMsg` | `appendMsg('\n新内容')` | 把内容追加到当前助手消息，并持久保存 |
| `changeMsg` | `changeMsg('整条替换')` | 直接替换当前助手消息，并持久保存 |
| `tempAppendMsg` | `tempAppendMsg('\n临时提示')` | 临时追加到当前助手消息，本地效果优先 |
| `tempChangeMsg` | `tempChangeMsg('临时替换')` | 临时替换当前助手消息，本地效果优先 |
| `getMsgContent` | `setText('[data-box]', getMsgContent())` | 读取当前消息内容，常用作别的函数参数 |
| `getUserAvatar` | `setValue('[data-avatar]', getUserAvatar())` | 读取当前登录用户头像地址字符串，可能是 `http/https`、站内路径、`blob:` 或 `data:`，适合传给图片或样式相关函数 |
| `getCharAvatar` | `setValue('[data-avatar]', getCharAvatar())` | 读取当前故事线角色头像地址字符串，适合传给图片或样式相关函数 |
| `getWorldInfo` | `setText('[data-box]', getWorldInfo('吸血鬼'))` | 按触发词读取当前故事线世界书里命中的已启用条目内容，返回描述数组，可作为其他函数参数 |
| `openUrl` | `openUrl('https://example.com')` | 打开链接，只支持 `http/https` |
| `saveToLocal` | `saveToLocal('door_code', '7319')` | 把值保存到当前设备浏览器本地存储 |
| `readFromLocal` | `setValue('[data-code]', readFromLocal('door_code'))` | 读取本地存储值，常用作别的函数参数 |

补充说明：

- `saveToLocal/readFromLocal` 用的是本地 IndexedDB，数据跟设备和浏览器绑定
- 本地存储 key 最长 128 字符
- `getMsgContent`、`getUserAvatar`、`getCharAvatar`、`getWorldInfo` 和 `readFromLocal` 最适合写成“其他函数的参数”
- `getWorldInfo` 会匹配当前聊天会话所在故事线世界书的主触发关键词，只返回已启用条目的内容文本
- `getWorldInfo` 的原始返回值是数组；如果直接传给 `setText`、`setValue`、`fillInput`、`appendMsg`、`changeMsg` 这类文本函数，系统会自动按换行拼接
- `getUserAvatar` / `getCharAvatar` 返回的是“可直接塞给 `<img src>` 或 `background-image` 的字符串”，不保证一定是公网 URL
- 如果用户头像本身就是 `data:image/...;base64,...`，iframe 内可以直接离线显示；如果头像是远程 `http/https` 链接，则仍然依赖浏览器能访问该地址

## 6.2 DOM 操作函数

| 函数 | 用法 | 作用 |
|------|------|------|
| `setText` | `setText('[data-result]', '成功')` | 改元素文本 |
| `setValue` | `setValue('[data-input]', '1234')` | 改输入框值；对 `img/video/audio/source` 会写入 `src`；其他元素会退化为改文本 |
| `show` | `show('[data-result]')` | 显示元素，默认 `display: block` |
| `hide` | `hide('[data-result]')` | 隐藏元素 |
| `addClass` | `addClass('[data-box]', 'done')` | 给元素加 class |
| `removeClass` | `removeClass('[data-box]', 'done')` | 给元素去掉 class |
| `setStyle` | `setStyle('[data-box]', 'color', '#16a34a')` | 设置单个安全 CSS 属性 |

补充说明：

- 这些选择器只会在当前组件内部查找
- 可以用 `@host` 指向整个组件根节点

例如：

```text
setStyle('@host', 'border-color', '#22c55e')
```

头像写入示例：

```html
<img id="avatar-img" src="" alt="Avatar">

<script>
const avatarUrl = getCharAvatar() || getUserAvatar()
if (avatarUrl) {
  setValue('#avatar-img', avatarUrl)
}
</script>
```

不要用 `setStyle('#avatar-img', 'src', avatarUrl)` 当作主要写法。`src` 是元素属性，不是 CSS 样式；写图片地址优先用 `setValue`。

## 6.3 流程控制函数

| 函数 | 用法 | 作用 |
|------|------|------|
| `progress` | `progress('[data-bar]', '[data-text]', 1500)` | 播放进度条动画，并同步百分比文本 |
| `wait` | `wait(800)` | 等待一段时间，最大 10000ms |
| `requireInputEquals` | `requireInputEquals('[data-field]', '7319', '密码错误')` | 校验输入框内容，不相等就弹错并中断后续脚本 |

`requireInputEquals` 第四个参数可以控制是否自动去掉首尾空格：

```text
requireInputEquals('[data-field]', '7319', '密码错误', false)
```

默认是 `true`。

---

## 7. 零基础实战教程：做一个“密码门禁”组件

这一节不是说明，而是可以直接照着做的教程。

目标效果：

- AI 给你发一个“门禁解锁面板”
- 用户输入密码后点击按钮
- 密码正确时播放进度条
- 最后显示“门已开启”

这个组件足够有趣，也足够简单，适合小白第一次练手。

### 第 1 步：先想清楚它在剧情里干什么

先不要急着写代码，先用一句话把需求说清楚。

例如：

```text
我想做一个赛博风的密码门禁组件。用户输入密码后点击“验证”，如果密码正确，就显示进度条并提示“地下实验室已开启”。
```

这句话很重要，因为后面你要把它发给 AI。

### 第 1.5 步：先把“参数”列出来

很多组件做不出来，不是因为源码难，而是因为一开始没想清楚“这个组件到底要接收几个参数”。

你可以把参数理解成：

- AI 调用组件时，必须塞进来的内容
- 组件源码里会用 `$参数名$` 接收的内容

拿这个“密码门禁”来说，最少需要 3 个参数：

| 参数名 | 作用 | 示例 |
|------|------|------|
| `提示语` | 告诉用户现在要验证什么 | `请输入地下实验室门禁密码` |
| `密码` | 正确答案 | `7319` |
| `成功文本` | 验证成功后显示什么 | `地下实验室已开启` |

你在让 AI 生成组件前，最好先自己写出这样一张小表。

经验建议：

- 展示型组件通常 `2 到 4` 个参数就够了
- 带交互的组件通常 `3 到 5` 个参数就够了
- 不要一开始就设计 8 个以上参数，AI 很容易传错
- 如果某个内容不会变化，就不要做成参数，直接写死在 HTML 里

### 第 2 步：先建一个新组件

在工坊里进入：

`工坊 -> 角色 -> 故事线 -> 编辑故事线 -> 组件`

然后新增一个组件，先把这两个字段填好：

- 组件名：`密码门禁`
- 说明：`用于剧情里的门锁、保险柜、终端验证`

### 第 3 步：先不要自己写，直接抄这一版源码

把下面整段内容粘进 `组件源码`：

```html
<div class="door-box">
  <div class="door-title">安全门验证</div>
  <div class="door-desc">$提示语$</div>
  <input data-pass-field placeholder="请输入密码" />
  <button data-component-trigger="1">开始验证</button>
  <div class="door-progress-wrap">
    <div class="door-progress" data-progress-bar></div>
  </div>
  <div class="door-progress-text" data-progress-text>0%</div>
  <div class="door-result" data-result style="display:none;"></div>
</div>

<style>
.door-box {
  border: 1px solid #22c55e;
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(180deg, #08130f, #0f1f18);
  color: #d1fae5;
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.15);
}

.door-title {
  font-size: 15px;
  font-weight: 700;
  color: #86efac;
}

.door-desc {
  margin-top: 6px;
  font-size: 13px;
  color: #a7f3d0;
}

.door-box input,
.door-box button {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
}

.door-box input {
  background: #ecfdf5;
  color: #14532d;
}

.door-box button {
  background: linear-gradient(90deg, #22c55e, #16a34a);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.door-progress-wrap {
  margin-top: 12px;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.12);
}

.door-progress {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, #86efac, #22c55e);
}

.door-progress-text {
  margin-top: 6px;
  font-size: 12px;
  color: #bbf7d0;
}

.door-result {
  margin-top: 12px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.12);
  color: #dcfce7;
  white-space: pre-wrap;
}
</style>

<script>
requireInputEquals('[data-pass-field]', '$密码$', '密码错误')
progress('[data-progress-bar]', '[data-progress-text]', 1500)
setText('[data-result]', '$成功文本$')
show('[data-result]')
</script>
```

### 第 4 步：把 AI附加提示词填上

把下面这段直接粘进 `AI附加提示词`：

```text
当你需要让用户进行门锁、终端、保险柜、权限验证时，使用“密码门禁”组件。
输出格式：
<$密码门禁$>
  <提示语>这里写当前门禁说明</提示语>
  <密码>这里写正确密码</密码>
  <成功文本>这里写验证成功后显示的文字</成功文本>
</$密码门禁$>
不要省略外层标签，参数名必须保持一致。
```

### 第 5 步：保存，然后去游玩测试

保存故事线后，不要只看预览，直接去 `游玩测试`。

然后给 AI 一个非常明确的触发请求，例如：

```text
请给我一个门禁验证面板。正确密码是 7319。提示语写“请输入地下实验室门禁密码”。验证成功后显示“地下实验室已开启”。
```

如果一切正常，AI 应该会输出一个真正的门禁组件，而不是纯文字。

### 第 6 步：如果 AI 没调用出来，直接这样修

很多时候不是组件坏了，而是 AI 不够听话。你可以继续在测试里对 AI 说：

```text
请严格使用“密码门禁”组件，不要只用文字描述。请按以下格式输出：
<$密码门禁$>
  <提示语>请输入地下实验室门禁密码</提示语>
  <密码>7319</密码>
  <成功文本>地下实验室已开启</成功文本>
</$密码门禁$>
```

如果这样能出来，说明你的组件没问题，问题在提示词强度不够。

### 第 7 步：把它变得更好玩

跑通后，你再慢慢升级，不要一开始就堆复杂需求。

你可以继续让 AI 帮你改：

- 改成赛博朋克风
- 改成魔法封印风
- 改成保险柜解锁风
- 增加“失败提示更紧张”
- 增加“成功后按钮变灰”

这一步就已经不是“从零到一”，而是在现有组件上做美化了，成功率会高很多。

---

## 8. 不会编程时，怎么让 AI 帮你生成组件

如果你不会写源码，最实用的方法不是硬学前端，而是学会“怎么给 AI 下正确指令”。

你要做的不是说一句“帮我做个组件”，而是把约束一次说清楚。

### 8.1 给 AI 的万能提示词模板

把下面模板发给任何能写 HTML 的 AI，然后把【】里的内容换掉：

```text
请帮我生成一个适用于 Fuderation Workshop 的组件。

要求：
1. 返回内容必须包含三部分：
   - 组件名
   - 组件源码
   - 组件调用说明（也就是给故事线模型看的提示词，用来告诉模型什么时候用这个组件、组件名是什么、需要传哪些参数、调用格式是什么。这个部分以后会被粘贴到 Workshop 的“AI附加提示词”里）
1.1 调用格式的基本样式为：
<$组件名$>
<参数1></参数1>
<参数2></参数2>
</$组件名$>
2. 组件源码必须写成单栏位格式，也就是一个代码块里同时包含 HTML、<style>、<script>
3. 尽量不要用原生 JavaScript，优先使用这些桥接函数：
   fillInput、copyText、toast、appendMsg、changeMsg、tempAppendMsg、tempChangeMsg、getMsgContent、getUserAvatar、getCharAvatar、openUrl、saveToLocal、readFromLocal、setText、setValue、show、hide、addClass、removeClass、setStyle、progress、wait、requireInputEquals
4. 在开始写组件前，请先根据组件用途，先设计“参数清单”，并单独列出来。格式如下：
   - 参数名
   - 是否必填
   - 参数作用
   - 示例值
   参数数量尽量控制在 2 到 5 个；如果某项内容是固定文案，就不要设计成参数。
5. 组件源码里凡是需要 AI 传入的内容，都必须使用 $参数名$ 占位。不要只写“参数请用 $参数名$ 占位”，而是要明确告诉我：这个组件最终需要哪几个参数。
6. 在你返回的“组件调用说明”里，必须明确写出“这个组件需要传入哪些参数”，不要让调用组件的模型自己猜参数数量和参数名。
7. 这些桥接函数的作用如下，请按功能选用，不要乱用：
   - setText(selector, text)：设置某个元素的文本
   - setValue(selector, value)：设置输入框或元素内容；如果目标是 img/video/audio/source，会写入 src，适合写头像和媒体地址
   - show(selector, display?)：显示某个元素
   - hide(selector)：隐藏某个元素
   - addClass(selector, className)：添加 class
   - removeClass(selector, className)：移除 class
   - setStyle(selector, prop, value)：设置单个样式
   - progress(barSelector, textSelector, duration)：播放进度条动画并更新百分比
   - wait(ms)：等待一段时间
   - requireInputEquals(selector, expected, errorText, trim?)：校验输入框内容，错误时弹提示并中断后续脚本
   - fillInput(text)：把文本填入聊天输入框
   - copyText(text)：复制文本到剪贴板
   - toast(text, type)：弹出提示
   - appendMsg(text)：把文本追加到当前助手消息
   - changeMsg(text)：直接替换当前助手消息
   - tempAppendMsg(text)：临时追加当前助手消息
   - tempChangeMsg(text)：临时替换当前助手消息
   - getMsgContent()：读取当前消息文本，可作为其他函数的参数
   - getUserAvatar()：读取当前登录用户头像地址字符串，可作为其他函数的参数
   - getCharAvatar()：读取当前故事线角色头像地址字符串，可作为其他函数的参数
   - getWorldInfo(trigger)：按触发词读取当前故事线世界书中命中的描述数组，可作为其他函数的参数
   - saveToLocal(key, value)：保存到本地存储
   - readFromLocal(key)：从本地存储读取，可作为其他函数的参数
   - openUrl(url)：打开 http/https 链接
8. 如果组件需要显示头像：
   - 显示当前故事线角色头像，用 getCharAvatar()
   - 显示当前登录用户头像，用 getUserAvatar()
   - 写入 <img> 时优先用 setValue('#头像元素id', getCharAvatar() || getUserAvatar())
   - 不要用 setStyle('#头像元素id', 'src', avatarUrl) 作为主要写法，因为 src 是元素属性，不是 CSS 样式
9. 默认优先使用最稳妥的函数组合：setText、setValue、show、hide、addClass、removeClass、setStyle、progress、wait、requireInputEquals。只有确实需要时再用其他高级函数。
10. 如果组件里有输入框，触发按钮必须带 data-component-trigger="1"
11. 不要依赖联网，不要写 fetch，不要做真实登录、真实支付、真实后台操作
12. 风格要适合聊天气泡内显示，宽度不要太夸张
13. 如果你使用了桥接函数，请在结果最后额外用几行简短说明“用了哪些函数、各自干什么”，方便小白理解。
14. 你输出时请按这个固定结构返回：
   - 第一部分：组件名
   - 第二部分：参数清单
   - 第三部分：组件源码
   - 第四部分：组件调用说明（这是准备粘贴到 Workshop“AI附加提示词”里的内容）

我要的组件用途是：
【这里写你的需求】

我想要的视觉风格是：
【这里写风格，例如：赛博朋克、魔法卷轴、终端、像素风】

请尽量让新手也能直接复制使用。
尽量先用一个最外层div包裹所有内容，然后再在此div内编写组件内容。
请注意，桥接函数workshop已经提供，请勿再次编写，直接当作该函数已有。
```

如果你只想让 AI 走最稳的路线，可以把下面这句也一起发给它：

```text
除非我明确要求，否则请不要用原生 JavaScript，尽量只用 setText、setValue、show、hide、addClass、removeClass、setStyle、progress、wait、requireInputEquals 这几个函数完成组件。如果需要头像，用 getCharAvatar() 取当前故事线角色头像，用 getUserAvatar() 取当前登录用户头像，并用 setValue('#头像元素id', 头像地址) 写入 <img>，不要把 src 当成 setStyle 的 CSS 属性。
```

### 8.2 一个可以直接复制的实际例子

如果你想做“悬赏任务卡”，可以直接把下面这段发给 AI：

```text
请帮我生成一个适用于 Fuderation Workshop 的组件。

要求：
1. 返回内容必须包含三部分：
   - 组件名
   - 组件源码
   - 组件调用说明（也就是给故事线模型看的提示词，用来告诉模型什么时候用这个组件、要传哪些参数、调用格式是什么。这个部分以后会被粘贴到 Workshop 的“AI附加提示词”里）
1.1 调用格式的基本样式为：
<$组件名$>
<参数1></参数1>
<参数2></参数2>
</$组件名$>
2. 组件源码必须写成单栏位格式，也就是一个代码块里同时包含 HTML、<style>、<script>
3. 尽量不要用原生 JavaScript，优先使用这些桥接函数：
   setText、show、hide、addClass、removeClass、setStyle、progress、wait
4. 请先为这个组件设计参数清单，并单独列出来。每个参数都要写清楚名字、作用、示例值。参数数量尽量控制在 2 到 5 个。
5. 这些函数必须严格按下面的签名传参，不要自己增加额外参数：
   - setText(selector, text)：2个参数。改文本。
   - show(selector, display?)：1到2个参数。显示某个区域，第二个参数可省略。
   - hide(selector)：1个参数。隐藏某个区域。
   - addClass(selector, className)：2个参数。添加 class。
   - removeClass(selector, className)：2个参数。移除 class。
   - setStyle(selector, prop, value)：3个参数。设置单个样式。
   - progress(barSelector, textSelector, duration)：3个参数。播放进度条并更新百分比文本。
   - wait(ms)：1个参数。短暂停顿。
6. 如果你不确定某个函数怎么传参，就不要用它，优先用 setText、show、hide、addClass、removeClass、setStyle 这些最直观的函数。
7. 组件源码里所有需要 AI 传入的内容，都必须明确使用 $参数名$ 占位。
8. 返回的“组件调用说明”里必须明确写出“这个组件要传哪几个参数”，不要只给一个笼统调用格式。
9. 不要依赖联网
10. 如果用了桥接函数，请在结果后用简短文字说明为什么这样选函数
11. 你的输出顺序必须是：组件名 -> 参数清单 -> 组件源码 -> 组件调用说明

我要的组件用途是：
做一个“悬赏任务卡”组件，用来展示任务标题、奖励、风险等级、任务说明。它主要是展示型组件，不一定要输入框。

我想要的视觉风格是：
未来感悬赏面板，带一点红色警示和金属边框。

请尽量让新手也能直接复制使用。
尽量先用一个最外层div包裹所有内容，然后再在此div内编写组件内容。
请注意，桥接函数workshop已经提供，请勿再次编写，直接当作该函数已有。
```

### 8.2.1 一个更稳的参数模板

如果你担心 AI 还是会漏参数，可以把这段也一起贴给它：

```text
请先输出“参数清单”，再输出组件源码。

参数清单格式：
1. 参数名：
2. 是否必填：
3. 作用：
4. 示例值：

然后你生成的组件源码里，必须把这些参数逐个写成 $参数名$ 占位。
最后你给出的“组件调用说明”里，也必须把这些参数逐个写进调用格式里。这个“组件调用说明”就是之后要粘贴到 Workshop“AI附加提示词”里的内容。
```

### 8.3 AI 给你结果后，你先检查这 8 件事

不要收到结果就直接粘，先看这几项：

1. 有没有 `组件名`
2. 有没有单独写出 `参数清单`
3. 有没有完整的 `组件源码`
4. 有没有 `组件调用说明`
5. 如果有输入框，按钮有没有 `data-component-trigger="1"`
6. 参数是不是明确写成了 `$标题$`、`$内容$` 这种格式
7. `组件调用说明` 里有没有把参数一个个写出来
8. 有没有乱写 `fetch`、真实登录、复杂原生 JS

只要这几项基本过关，大概率就能正常用。

### 8.4 如果 AI 第一次写得不好，怎么继续改

不要让 AI “重做一个新的”，尽量让它“在原版基础上改”。这样更稳。

#### 只改样式

```text
不要改组件名，不要改参数名，不要改整体结构，只优化这个组件的视觉风格，让它更像赛博朋克终端。
```

#### 只改交互

```text
保留 HTML 和样式，帮我把交互改得更明显。仍然优先使用 Fuderation Workshop 的桥接函数，不要改成复杂原生 JS。
```

#### 让 AI 帮你排错

```text
这是 Fuderation Workshop 组件源码，但现在不能正常工作。请你检查：
1. 参数名是否和调用格式一致
2. 是否适合单栏位源码
3. 是否错误使用了原生 JS
4. 是否遗漏 data-component-trigger="1"
5. 是否能改成更稳定的桥接函数写法

请直接返回修正后的完整组件源码和新的 AI附加提示词。
```

### 8.5 最适合新手的创作顺序

你可以永远按这套顺序来：

1. 先用 AI 做一个“静态展示组件”
2. 测试 AI 是否能调出来
3. 再让 AI 加一个简单交互
4. 再让 AI 改样式
5. 最后才考虑更高级的玩法

这样做，比一开始就要求 AI 生成“复杂小游戏组件”稳定得多。

---

## 9. 示例

## 9.1 最适合新手的“信息卡”

组件名：

```text
信息卡
```

组件源码：

```html
<div class="info-card">
  <div class="info-card__title">$标题$</div>
  <div class="info-card__content">$内容$</div>
</div>

<style>
.info-card {
  border: 1px solid #3b82f6;
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #eff6ff, #ffffff);
}

.info-card__title {
  font-weight: 700;
  color: #1d4ed8;
}

.info-card__content {
  margin-top: 8px;
  color: #334155;
  white-space: pre-wrap;
}
</style>
```

AI附加提示词：

```text
当你需要展示结果、通知、奖励提示时，使用“信息卡”组件。
输出格式：
<$信息卡$>
  <标题>简短标题</标题>
  <内容>详细内容</内容>
</$信息卡$>
```

AI 调用示例：

```html
<$信息卡$>
  <标题>任务完成</标题>
  <内容>你已解锁地下档案室访问权限。</内容>
</$信息卡$>
```

## 9.2 “登录验证”剧情组件

组件源码：

```html
<div class="login-box">
  <div class="title">登录验证</div>
  <input data-login-field="account" placeholder="账号" />
  <input data-login-field="password" type="password" placeholder="密码" />
  <button data-component-trigger="1">登录</button>
  <div class="bar-wrap"><div class="bar" data-login-progress></div></div>
  <div class="percent" data-login-progress-text>0%</div>
  <div class="result" data-login-result style="display:none;"></div>
</div>

<style>
.login-box { border:1px solid #3b82f6; border-radius:10px; padding:10px; }
.login-box input, .login-box button { width:100%; margin-top:8px; padding:8px; border-radius:8px; }
.bar-wrap { margin-top:10px; height:8px; background:#1f2937; border-radius:999px; overflow:hidden; }
.bar { width:0%; height:100%; background:linear-gradient(90deg,#22d3ee,#3b82f6); }
.percent { margin-top:6px; font-size:12px; color:#93c5fd; }
.result { margin-top:10px; white-space:pre-wrap; color:#86efac; }
</style>

<script>
requireInputEquals('[data-login-field="account"]', '$账号$', '账号错误')
requireInputEquals('[data-login-field="password"]', '$密码$', '密码错误')
progress('[data-login-progress]', '[data-login-progress-text]', 1500)
setText('[data-login-result]', '$文本$')
show('[data-login-result]')
</script>
```

AI 调用示例：

```html
<$登录验证$>
  <账号>admin</账号>
  <密码>7321</密码>
  <文本>验证通过，控制台已解锁。</文本>
</$登录验证$>
```

这个例子只是剧情演出，不是真实登录系统。

---

## 10. 限制与注意事项

按当前代码默认配置和校验逻辑，可以先这样理解：

- 单条故事线默认最多 `30` 个组件
- 单个组件 `HTML + CSS + Script` 默认总长度上限 `20000` 字符
- `AI附加提示词` 会计入故事线总提示词长度
- 组件名最长 `32` 字符
- `description` 最长 `120` 字符
- `ai_prompt` 最长 `1000` 字符
- 组件在 `VN 模式` 下不生效

再提醒几个实用点：

- 带输入框的组件，触发按钮建议加 `data-component-trigger="1"`
- `openUrl` 只能开 `http/https`
- 需要真实联网、真实后台、真实支付的功能，不适合用组件做
- 组件更适合“剧情道具”和“消息内交互演出”

---

## 11. 常见问题

### AI 原样吐出了 `<$组件名$>`，没有渲染

先检查：

- 当前故事线里是否真的保存了这个组件
- 组件名是否完全一致
- 外层标签是否闭合
- 当前是否开启了 `VN 模式`

### 组件渲染出来了，但内容是空的

通常是参数名没对上。

比如源码里写 `$标题$`，那 AI 就必须传：

```html
<标题>内容</标题>
```

不能写成别的名字。

### 预览没问题，实战不触发

大概率不是样式问题，而是 AI 提示词写得不够明确。优先回头检查：

- 什么时候使用这个组件，有没有说清楚
- 参数名有没有写清楚
- 有没有最小调用示例

### 保存失败

优先检查：

- 组件名非法
- 组件名重复
- HTML 为空
- 单个组件过长
- 组件数量超限
- AI提示过长导致总提示词超限

---

## 12. 最后建议

如果你是第一次做组件，最稳的路线是：

1. 先做静态卡片
2. 再加一两个简单桥接函数
3. 先让 AI 稳定调用
4. 最后再追求更复杂的演出效果

一句话总结：

`先保证 AI 会正确调用，再考虑把组件做得更花。`
