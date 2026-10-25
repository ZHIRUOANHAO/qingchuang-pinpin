# 微信开发者工具真实调试 Runbook（task-1）

- 执行者：devtools-runner（Team Lead: lead）
- 执行时间：2026-10-22 21:00–23:20（GMT+8）
- 项目根目录：`D:\UserFolders\Desktop\qingchuang-pinpin`（不是 miniprogram/）
- 结论一句话：**CLI 编译链路可用（islogin/open/build-npm/preview 全部成功，包体约 1.36MB < 2MB）；但 miniprogram-automator 自动化链路在本机不可用，页面级走查与截图未完成（【未验证】）。**

## 1. 环境与版本

| 项 | 值 | 证据 |
|---|---|---|
| 微信开发者工具 CLI | `D:\应用\微信web开发者工具\cli.bat` | Test-Path=True；`cli.bat -h` exit 0 |
| IDE 版本 | 2.02.2607161 | IDE 日志每行版本号字段，如 `[...][2.02.2607161][...]` |
| AppID | wx031b9c2a3d1d73bb | preview/build-npm 输出 “Using AppID: wx031b9c2a3d1d73bb” |
| 基础库 libVersion | 3.17.4 | `project.config.json` / `project.private.config.json`（Lead 已于 23:0x 更新） |
| Node / npm | v22.23.1 / 10.9.8 | `node -v` / `npm -v` |
| 登录状态 | 已登录（无需扫码） | islogin 返回 `{"login":true}` |
| IDE 进程 | 微信开发者工具 多进程（观测 PID 2260/4920/6576/19164） | Get-Process；CLI 端口 9400+ 有监听 |

> 说明：`cli.bat` 各子命令帮助里没有 `--auto-port`，但 auto 实际接受该参数（隐藏参数）。

## 2. 已执行的 CLI 命令与原始输出

### 2.1 islogin（确认 IDE 启动 + 登录）

```powershell
& "D:\应用\微信web开发者工具\cli.bat" islogin --port 9420
```

原始输出（首跑，节选）：

```
× IDE may already started at port 16829, trying to connect
√ IDE server started successfully, listening on http://127.0.0.1:9420
- preparing

{"login":true}
√ islogin
```

→ **已登录**，无需用户扫码。IDE 未运行时该命令会拉起 IDE。

### 2.2 open（打开项目根目录）

```powershell
& "D:\应用\微信web开发者工具\cli.bat" open --project "D:\UserFolders\Desktop\qingchuang-pinpin" --port 9420
```

```
√ IDE server has started, listening on http://127.0.0.1:9420
- preparing
√ open
CLI_EXIT=0
```

### 2.3 build-npm（threejs-miniprogram 需要）

```powershell
& "D:\应用\微信web开发者工具\cli.bat" build-npm --project "D:\UserFolders\Desktop\qingchuang-pinpin" --port 9420
```

```
- Fetching AppID () permissions
√ Using AppID: wx031b9c2a3d1d73bb
√ build-npm

{
  "cost": 9068,
  "warnings": []
}
CLI_EXIT=0
```

产物：`miniprogram/miniprogram_npm/threejs-miniprogram/index.js`（597,409 字节，2026-10-22 21:01:16 生成）。

### 2.4 preview（触发真实编译 + 生成预览二维码）

```powershell
& "D:\应用\微信web开发者工具\cli.bat" preview --project "D:\UserFolders\Desktop\qingchuang-pinpin" --port 9420 `
  --qr-format image --qr-output "...\项目资料\上架调试\devtools\preview-qr.png" `
  --info-output "...\项目资料\上架调试\devtools\preview-info.json"
```

原始输出（21:02:43）：

```
√ Using AppID: wx031b9c2a3d1d73bb
- Preview
√ preview

┌─────────┬──────────┬─────────────┐
│ (index) │ size     │ size (Byte) │
├─────────┼──────────┼─────────────┤
│ TOTAL   │ '1.3 MB' │ 1385977     │
└─────────┴──────────┴─────────────┘
CLI_EXIT=0
```

- `preview-info.json`：`{"size":{"total":1385977,"packages":[{"name":"TOTAL","size":1385977}]}}`
- `preview-qr.png`：47,294 字节，2026-10-22 21:02:43（**可扫码真机验收**）
- 预编译通过、无编译报错文本输出 → 当时版本（app.json 15 页）**编译成功**。

### 2.5 修复后复验（由 Lead 在 23:11:54 执行，产物留存在本目录）

- `preview-after-fix.png`（47,553 字节）+ `preview-after-fix-info.json`
- 包体：**1,391,782 字节（约 1.33MB，< 2MB 主包上限）**，说明 Lead 修复后（app.json 16 页、隐私弹窗、case-detail 等）**再次编译成功并生成预览码**。
- 该次执行的完整 stdout 未回传给我，此处仅引用产物；命令可复现：
  `cli.bat preview --project "<根目录>" --port 9420 --qr-format image --qr-output ... --info-output ...`

## 3. IDE 日志中的真实报错（原文）

日志文件：`C:\Users\qq345\AppData\Local\微信开发者工具\User Data\59d029dc3625ed70c05c4d12f79b78a9\WeappLog\logs\2026-10-22-21-00-35-714.log`

| 行 | 原文（截断） | 判读 |
|---|---|---|
| L64 | `[BackendInitEnv] [backend initEnv] isMiniAppProject=false, starting compiler` | 内部标志，preview 正常，暂观察 |
| L145/147/148 | `[SimulatorService] updateSimulatorCompileOptions: simulator not found s0` | 模拟器未就绪时序 |
| L272/285/297 | `[appservice] simulator launch catch error Error: ReactiveCache: key "miniProgramAppConfig lightmode" is not registered` | IDE 内部缓存错误（重复 3 次） |
| L322 | `[Devtools] appservice.js checkPluginInfo fail with error: timeout` | 插件信息超时（项目无插件） |
| L137/341 | `[SimulatorService] simulator app compile` | 编译动作确实发生 |

注：这些是 **IDE 内部日志**，不是项目源码编译报错；preview 能成功出包说明编译产物有效。但可能是本机模拟器/自动化链路异常的原因之一（见 issues.md P1）。

## 4. 自动化走查尝试（失败，已按 Lead 指示停止重试）

### 4.1 依赖安装

- 安装目录：`项目资料/上架调试/devtools/`（未污染项目根 node_modules）。
- `npm i miniprogram-automator` 走默认 registry.npmjs.org **挂起 >7 分钟无进展**（无 node_modules 产出），已 kill；改用：
  `npm i miniprogram-automator@0.13.0 --registry=https://registry.npmmirror.com --no-audit --no-fund` → **added 77 packages in 12s**。

### 4.2 方案 A：automator.launch()（官方一步法）——失败

```
Error: Failed to launch wechat web devTools, please make sure cliPath is correctly specified
    at Launcher.launch (.../miniprogram-automator/out/Launcher.js:1:2583)
```

根因（已读 `node_modules/miniprogram-automator/out/Launcher.js` 源码确认）：Launcher 用 `child_process.spawn(cliPath, args, {stdio:...})` **不加 shell** 直接执行 `cli.bat`；Node 22/Windows 不允许直接 spawn .bat → spawn error 事件 → Launcher 抛出上述通用错误。**这是工具链兼容问题，不是项目问题。**

### 4.3 方案 B：手动 `cli auto` + `automator.connect`——两次均失败

```powershell
& "D:\应用\微信web开发者工具\cli.bat" auto --project "D:\UserFolders\Desktop\qingchuang-pinpin" --port 9420 --auto-port 9421
```

CLI 输出：`√ IDE server has started, listening on http://127.0.0.1:9420` … `√ auto`，exit code **0**。

- 端口观测：`Get-NetTCPConnection` 曾看到 `:: :9421 LISTEN (PID 24452)`。
- **但** `automator.connect({wsEndpoint:'ws://127.0.0.1:9421'})` 报：
  - 第 1 次：`Cannot read properties of undefined (reading 'split')`（preConnect，疑似拿到非 automator 协议的监听/版本握手失败）
  - 第 2 次（脚本内改用 shell:true 自行 spawn cli auto 后）：`Failed connecting to ws://127.0.0.1:9421, check if target project window is opened with automation enabled`
- 按 Lead 指示**最多 2 次后停止**，未再重试。automation-report.json 记录 `launch.ok=false`、`pages: []`、`screenshots: []`。

### 4.4 未完成项（明确标注【未验证】）

- 五个 tabBar 页、16 个注册页的逐页打开与截图：**【未验证】**（shots/ 为空目录，原因见 `shots/README.md`）
- cases 页“最近浏览”按钮跳转：**【未验证】**（最新 app.json 已注册 `pages/history/history`，静态看链接目标已存在；运行时未验证）
- 页面 console / 未捕获异常收集：**【未验证】**
- 真机扫码验收：预览二维码已生成（preview-qr.png / preview-after-fix.png），**扫码与真机走查【未验证】**，需人工执行。

## 5. 复现步骤（最短路径）

1. 确认 IDE：`cli.bat islogin --port 9420`，期望 `{"login":true}`。
2. 打开项目根目录：`cli.bat open --project "D:\UserFolders\Desktop\qingchuang-pinpin" --port 9420`。
3. 构建 NPM：`cli.bat build-npm --project "<根目录>" --port 9420`，期望 `{"cost":...,"warnings":[]}`。
4. 编译 + 出预览码：
   `cli.bat preview --project "<根目录>" --port 9420 --qr-format image --qr-output <dir>\preview.png --info-output <dir>\preview.json`
   期望输出 TOTAL 体积（当前约 1,391,782 字节）且 exit 0。
5. （可选，本机当前不可用）自动化：先 `cli.bat auto --project "<根目录>" --auto-port 9421`，再 `automator.connect({wsEndpoint:'ws://127.0.0.1:9421'})`。
   若失败，改用人工在 IDE 模拟器点测；不建议在本机继续折腾 automator（见 issues.md P1）。

## 6. 产物清单（本目录）

| 文件 | 说明 |
|---|---|
| `preview-qr.png` | 21:02 旧版本（15 页）预览二维码，47,294B |
| `preview-info.json` | 旧版本包体：1,385,977 字节 |
| `preview-after-fix.png` | 23:11 Lead 修复后预览二维码，47,553B |
| `preview-after-fix-info.json` | 修复后包体：1,391,782 字节 |
| `walkthrough.js` | miniprogram-automator 走查脚本（已写好，可在兼容环境复用；本机未跑通） |
| `automation-report.json` | 走查失败的真实记录（launch error 原文） |
| `inspect-launcher.js` | 排查 automator Launcher 兼容性的辅助脚本 |
| `shots/` | 空（截图未产出，见 shots/README.md） |
| `package.json / package-lock.json / node_modules/` | 本目录独立依赖（miniprogram-automator@0.13.0），不影响项目根 |
