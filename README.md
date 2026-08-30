# LLM Translator for Flow Launcher

一个使用 Node.js 编写的 Flow Launcher AI 翻译插件。支持以下三类 HTTP API，并可在 Flow Launcher 设置页中分别配置：

- OpenAI-compatible Chat Completions API
- OpenAI Responses API
- Anthropic-compatible Claude Messages API

插件默认使用 `tt` 作为触发词。为了避免 Flow Launcher 在每次键入时重复调用计费 API，普通查询只显示确认结果；按 Enter 后才会发送一次翻译请求。

## 安装

项目要求 Flow Launcher 2.x 和 Node.js 18 或更高版本。发布包不含外部运行时依赖，不需要执行 `npm install`。

开发时可以让 Flow Launcher 从本地目录安装：

```text
pm install C:\path\to\Flow.Launcher.Plugin.LLMTranslator
```

也可以运行 `npm run package`，然后安装 `dist` 中生成的 ZIP 文件。

## 配置

在 Flow Launcher 设置中打开 `LLM Translator`。设置页采用中英双语分区，包含基础设置、自定义语言方向以及三套固定 API 配置。

默认翻译模式是“智能双向”：插件让所选模型识别输入语言，中文（简体或繁体）译为自然英文，其他语言译为简体中文。选择“自定义语言方向”后，才会使用源语言和目标语言字段。

每套配置包括：

- Profile name：查询中的短名称，例如 `@chat`
- Base URL：服务根地址
- API key：密码输入框
- Model：服务支持的模型 ID

默认 Base URL 与实际请求端点如下：

| 配置 | 默认 Base URL | 追加端点 | 鉴权方式 |
| --- | --- | --- | --- |
| Chat Completions | `https://api.openai.com/v1` | `/chat/completions` | `Authorization: Bearer` |
| Responses | `https://api.openai.com/v1` | `/responses` | `Authorization: Bearer` |
| Claude | `https://api.anthropic.com/v1` | `/messages` | `x-api-key` |

如果 Base URL 已经以对应端点结尾，插件不会重复追加。自定义服务必须使用 `http` 或 `https`，并返回所选 API 类型对应的响应结构。

API Key 由 Flow Launcher 的插件设置系统保存。插件不会把密钥写入语言状态文件、搜索结果或日志。

## 使用

```text
tt Hello, world
```

默认智能双向：英文会译为简体中文；中文会译为英文。显示确认项，按 Enter 后翻译。

```text
tt r 你好
```

临时反转“自定义语言方向”中的源语言和目标语言。

```text
tt ja>en こんにちは
```

仅本次使用显式语言方向。

```text
tt @claude en>zh-CN Translate this text
```

仅本次使用指定 API 配置。`@chat`、`@responses` 和 `@claude` 始终可用；也可以使用设置页填写的 Profile name。

```text
tt :set en zh-CN
tt :set reset
```

第一条命令在按 Enter 后持久化自定义语言方向，第二条清除覆盖并恢复设置页中的自定义语言。语言状态存放在插件目录的 `.llm-translator-state.json`，其中不含 API Key。

翻译成功后：

- 按 Enter 将译文复制到剪贴板并关闭 Flow Launcher。
- 按 `Ctrl+C` 使用 Flow Launcher 的 `CopyText` 支持复制。

## 错误处理

- 缺少 Base URL、API Key 或模型时，不会发送网络请求；按 Enter 可打开 Flow Launcher 设置。
- 请求超时默认是 30 秒，可配置为 1–120 秒。
- HTTP 错误、无效 JSON 和缺失文本响应会显示为普通 Flow 结果。
- 错误消息最多显示 500 个字符，并对已配置 API Key 和 Bearer Token 进行脱敏。

## 开发

```powershell
npm test
npm run check
npm run package
```

代码使用 Node.js 内置 `fetch`、`node:test` 和 PowerShell `Set-Clipboard`，没有 npm 运行时依赖。

主要目录：

```text
main.js                 Flow Launcher JSON-RPC 入口
src/application.js      查询编排与一次请求控制
src/adapters.js         三种 API 请求与响应适配
SettingsTemplate.yaml   Flow Launcher 可视化设置
test/                   命令、配置、HTTP 适配和状态测试
```

接口参考：

- [Flow Launcher JSON-RPC](https://github.com/Flow-Launcher/docs/blob/main/json-rpc.md)
- [Flow Launcher plugin settings](https://github.com/Flow-Launcher/docs/blob/main/json-rpc-settings.md)
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions)
- [OpenAI Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Anthropic Claude Messages](https://platform.claude.com/docs/en/api/messages/create)
