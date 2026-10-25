# 微信开发者工具走查问题清单（task-1：编译/运行/工具链）

- 执行者：devtools-runner；执行时间：2026-10-22 21:00–23:20（GMT+8）
- 范围：真实 CLI 编译/预览、页面级自动化走查、截图；**只记录，不修改源码**
- 总体结论：**没有发现“已证实的”编译错误或包体超限问题**（preview 两次均成功，包体 1.36–1.39MB < 2MB）；主要问题是**自动化工具链不可用导致页面级运行验证与截图缺失（【未验证】）**，以及**上架主体/备案/邮箱字段仍为空（【需用户提供】）**。

## P0（上架阻塞 / 必须在上线前解决）

### P0-1 主体名称、备案号、支持邮箱仍为空 → 【需用户提供】
- 位置：`miniprogram/config/env.js:6-9`
  ```js
  supportEmail: '',
  supportEmailRequiredBeforeRelease: true,
  entityName: '',
  icpNumber: ''
  ```
- 现状：仓库（README.md、docs/、项目资料/、上架素材/）检索不到真实主体名称、ICP 备案号、真实支持邮箱；用户口头“备案已完成”但无落地值。
- 影响：about/privacy 等页展示为空；隐私保护指引/审核信息/客服邮箱无法回填；按项目自身规则 `supportEmailRequiredBeforeRelease=true` 属发布前必填。
- 处理：由用户提供真实值后回填（task-2 主责，此处仅登记证据，不重复展开）。
- 状态：**【需用户提供】**

### P0-2 页面级运行验证与截图缺失（风险未覆盖，不是已发现故障）
- 现状：automator 自动化链路失败（见 P1-1），16 个注册页、5 个 tabBar 页、案例详情、法律页均**未在真实模拟器中逐页打开验证**，console/未捕获异常未收集，截图未产出。
- 影响：无法在“真实开发者工具运行态”证明无白屏/无 JS 异常；审核截图素材也缺（若上架需要真机/模拟器截图，需补拍）。
- 状态：**【未验证】**（人工点测清单见文末）

## P1（影响发布前回归效率 / 需人工复测）

### P1-1 miniprogram-automator 在本机不可用（工具链兼容问题，非项目代码）
- 复现 1（官方一步法）：
  ```
  Error: Failed to launch wechat web devTools, please make sure cliPath is correctly specified
      at Launcher.launch (.../miniprogram-automator/out/Launcher.js:1:2583)
  ```
  根因：`Launcher.js` 用 `child_process.spawn(cliPath, args)` 无 shell 直接执行 `cli.bat`；Node 22/Windows 不能直接 spawn .bat（EINVAL/ENOENT）→ 被包装成该通用错误。与项目无关。
- 复现 2（手动 `cli auto --auto-port 9421` + connect，共试 2 次）：
  - `cli auto` 输出 `√ auto`、exit 0；曾观测 9421 端口 LISTEN。
  - `automator.connect({wsEndpoint:'ws://127.0.0.1:9421'})` 第 1 次：`Cannot read properties of undefined (reading 'split')`；第 2 次：`Failed connecting to ws://127.0.0.1:9421, check if target project window is opened with automation enabled`。
- 影响：无法完成自动化遍历/截图；不直接影响线上功能与编译。
- 建议（任选，不必现在做）：① 用 Node 18 运行 walkthrough.js；② 升级/替换 automator 版本（0.13.0 为当前 npm 最新）；③ 人工在 IDE 模拟器点测（更快、零风险）。
- 状态：已按 Lead 指示停止重试

### P1-2 IDE 内部模拟器报错（preview 成功，但建议重启后人工复测）
- 日志：`C:\Users\qq345\AppData\Local\微信开发者工具\User Data\59d029dc3625ed70c05c4d12f79b78a9\WeappLog\logs\2026-10-22-21-00-35-714.log`
  - L272/285/297：`[appservice] simulator launch catch error Error: ReactiveCache: key "miniProgramAppConfig lightmode" is not registered`
  - L322：`[Devtools] appservice.js checkPluginInfo fail with error: timeout`
  - L145/147/148：`[SimulatorService] updateSimulatorCompileOptions: simulator not found s0`
- 判读：属 IDE 内部缓存/模拟器启动时序问题，**不是项目源码编译错误**（同轮 preview 成功出包）。可能是自动化失败诱因之一。
- 建议：完全退出 IDE → `cli.bat open --project "<根目录>"` 重启后人工打开模拟器复测；如需自动化，再试 automator。
- 状态：**【未验证】是否影响手动调试/真机**

## P2（观察项 / 建议清理）

### P2-1 双层 project.config.json（易误导入）
- 根：`project.config.json`（`miniprogramRoot: "miniprogram/"`，libVersion 3.17.4，appid wx031b9c2a3d1d73bb）
- 内层：`miniprogram/project.config.json`（`miniprogramRoot: "./"`，projectname qingchuang-pinpin-native）
- 风险：若用 IDE 直接打开 miniprogram/ 目录，会按内层配置导入；用目录名不同，可能产生两套项目/缓存。本次按要求只打开**根目录**。
- 建议：文档固定“只打开根目录”，或后续删除内层配置（会改变工程结构，需 Lead 决策）。

### P2-2 仍存在未注册页面目录（发布范围外）
- `miniprogram/pages/` 下 `account、login、membership、orders、practice、practice-records` 六个目录不在最新 app.json 的 16 页注册清单内（`history` 已被 Lead 新注册）。
- 风险：一般不会进入上传包（`setting.ignoreUploadUnusedFiles=true`），但目录残留容易误判范围。本次未能验证上传包实际文件清单（需 upload，按纪律未执行）。
- 状态：**【未验证】**（静态观察）

### P2-3 首次 npm 安装默认 registry 挂起
- `npm i miniprogram-automator`（registry.npmjs.org）在本机挂起 >7 分钟无进展，kill 后改用 `registry.npmmirror.com` 12 秒完成（77 packages）。
- 影响：只是本机网络/环境备注，与项目无关；若后续 CI 需要安装依赖，建议配置镜像并设 `--fetch-timeout`。

### P2-4 预览包体与三方 NPM 打包（正常，仅记录）
- `miniprogram/miniprogram_npm/threejs-miniprogram/index.js` 597,409 字节，build-npm 成功（`{"cost":9068,"warnings":[]}`）。
- preview 包体：旧版 1,385,977 字节；修复后 1,391,782 字节（均 < 2MB 主包上限）。**【已验证】**

## 证据索引

| 结论 | 证据 |
|---|---|
| IDE 已登录 | `cli.bat islogin` → `{"login":true}` |
| build-npm 成功 | 输出 `√ build-npm {"cost":9068,"warnings":[]}`；产物 index.js 597,409B 21:01:16 |
| 编译/预览成功（旧代码） | `preview-info.json` total=1,385,977；`preview-qr.png` 47,294B 21:02:43 |
| 编译/预览成功（修复后） | `preview-after-fix-info.json` total=1,391,782；`preview-after-fix.png` 47,553B 23:11:54（Lead 执行） |
| 自动化失败 | `automation-report.json`（launch.ok=false + 两段 error 原文）；端口/连接过程记录于 devtools-runbook.md 第 4 节 |
| IDE 内部报错 | 日志文件 L145/147/148、L272/285/297、L322（见 P1-2） |

## 人工点测清单（补【未验证】项，建议 15 分钟内完成）

- [ ] 5 个 tabBar：星球/案例/案例演示/画布/我的 逐个切换，无白屏、无 console 红字
- [ ] 案例列表 → 点第 1 条 → 案例详情；详情内节点/收藏/“发送到画布”/“生成验证方案”可用
- [ ] cases 页“最近浏览 ›” → 应进入 `pages/history/history`（最新 app.json 已注册；旧版会跳失败）
- [ ] 首次进入触发隐私弹窗（privacy-popup）并能同意/拒绝；拒绝后受限功能表现符合预期
- [ ] 法律页：privacy / agreement / minors / help / about 可打开；about、privacy 中主体名称/备案号/邮箱字段当前为空（P0-1）
- [ ] 画布页动画/定时器离开后不报错（可看 console）
- [ ] 弱网/空态：断网进入案例页显示错误态而非白屏
- [ ] 截图素材：5 tab + 案例详情 + 法律页，保存 PNG（本目录 shots/ 目前为空）
