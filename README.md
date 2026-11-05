# LLM Translator for Flow Launcher

English | [简体中文](README.zh-CN.md)

An AI translation plugin for Flow Launcher written in Node.js. It supports the following three HTTP API styles, each configurable independently on the plugin's settings page:

- OpenAI-compatible Chat Completions API
- OpenAI Responses API
- Anthropic-compatible Claude Messages API

The plugin uses `tt` as its default action keyword. To avoid calling a billable API on every keystroke, a plain query only shows a confirmation result; a single translation request is sent after you press Enter.

## Installation

The project requires Flow Launcher 2.x and Node.js 16.17 or later. The repository pins Node 16 through mise using `.mise.toml`. The release package has no external runtime dependencies, so `npm install` is not required.

During development you can have Flow Launcher install from a local directory:

```text
pm install C:\path\to\Flow.Launcher.Plugin.LLMTranslator
```

Alternatively, run `npm run package` and install the ZIP file generated in `dist`.

## Configuration

Open `LLM Translator` in the Flow Launcher settings. The settings page uses an English interface: quick start and common queries at the top, followed by basic settings, language direction, advanced options, and three fixed API profiles.

The default translation mode is "Smart bilingual": the plugin asks the selected model to detect the input language, translating Chinese (Simplified or Traditional) into natural English and other languages into Simplified Chinese. The source and target language fields are only used after you select "Custom language pair".

Each profile contains:

- Profile name: the short name used in queries, for example `@chat`
- Base URL: the service root address
- API key: a password input
- Model: a model ID supported by the service

Default Base URLs and the actual request endpoints:

| Profile | Default Base URL | Appended endpoint | Authentication |
| --- | --- | --- | --- |
| Chat Completions | `https://api.openai.com/v1` | `/chat/completions` | `Authorization: Bearer` |
| Responses | `https://api.openai.com/v1` | `/responses` | `Authorization: Bearer` |
| Claude | `https://api.anthropic.com/v1` | `/messages` | `x-api-key` |

If the Base URL already ends with the matching endpoint, the plugin does not append it again. Custom services must use `http` or `https` and return the response structure of the selected API type.

API keys are stored by Flow Launcher's plugin settings system. The plugin never writes keys into the language state file, search results, or logs.

## Usage

```text
tt Hello, world
```

Smart bilingual by default: English is translated into Simplified Chinese and Chinese into English. A confirmation item is shown; press Enter to translate.

```text
tt r 你好
```

Temporarily swaps the source and target languages from "Custom language pair" for this query.

```text
tt ja>en こんにちは
```

Uses an explicit language direction for this query only.

```text
tt @claude en>zh-CN Translate this text
```

Uses the specified API profile for this query only. `@chat`, `@responses`, and `@claude` are always available; profile names configured on the settings page work as well.

```text
tt :set en zh-CN
tt :set reset
```

The first command persists a custom language direction after you press Enter; the second clears the override and restores the custom languages from the settings page. Language state is stored in `.llm-translator-state.json` inside the plugin directory and never contains API keys.

After a successful translation:

- Press Enter to copy the translation to the clipboard and close Flow Launcher.
- Press `Ctrl+C` to copy through Flow Launcher's `CopyText` support.

## Error handling

- When the Base URL, API key, or model is missing, no network request is sent; pressing Enter opens the Flow Launcher settings.
- The request timeout defaults to 30 seconds and is configurable from 1 to 120 seconds.
- HTTP errors, invalid JSON, and responses without text are shown as regular Flow results.
- Error messages are truncated to 500 characters and redact the configured API key and Bearer token.

## Development

```powershell
mise install
npm test
npm run check
npm run package
```

If mise does not switch the Node version automatically, use `mise exec -- npm test`.

The code relies on Node.js built-in `http`/`https` (Node 16 compatible, no global `fetch`), `node:test`, and the PowerShell `Set-Clipboard` command, with no npm runtime dependencies.

Key files:

```text
main.js                 Flow Launcher JSON-RPC entry point
src/application.js      Query orchestration and single-request control
src/adapters.js         Request and response adapters for the three APIs
SettingsTemplate.yaml   Flow Launcher visual settings
test/                   Command, settings, HTTP adapter, and state tests
```

Reference documentation:

- [Flow Launcher JSON-RPC](https://github.com/Flow-Launcher/docs/blob/main/json-rpc.md)
- [Flow Launcher plugin settings](https://github.com/Flow-Launcher/docs/blob/main/json-rpc-settings.md)
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions)
- [OpenAI Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Anthropic Claude Messages](https://platform.claude.com/docs/en/api/messages/create)
