---
version: 0.6
last_updated: 2026-09-21
---

# 开发、验收与发布准备

## 本地路径

`C:\Users\qq345\Desktop\qingchuang-pinpin`

项目脚本、测试、文档和输出均保存在项目目录内。

## 当前运行模式

`miniprogram/config/env.js` 固定为 `runtimeMode: 'local_case_library'`，并关闭云能力。当前五个 Tab 为星球、案例、案例演示、画布和我的；不需要 API 密钥、云环境、支付或广告配置。

## 网页预览

双击根目录 `start-preview.cmd`，或运行：

```powershell
cd C:\Users\qq345\Desktop\qingchuang-pinpin
npm.cmd install
npm.cmd run preview
```

默认地址为 `http://127.0.0.1:4173/preview/`。网页预览用于视觉和交互验收，不能替代微信开发者工具编译或真机验收。

## 微信开发者工具

1. 导入项目根目录，不要导入 `preview/`。
2. 正式上传前，把 `project.config.json` 的测试 AppID 替换为运营主体名下的正式 AppID。
3. 执行“工具 -> 构建 npm”，生成或刷新 `miniprogram_npm/threejs-miniprogram`。
4. 重新编译，不沿用旧版本编译结论。
5. 逐页检查五个 Tab、案例详情、阶段资产卡、画布、验证和三份法律说明。
6. 至少在一台 iOS 与一台 Android 微信真机完成全流程验收。

## 自动化命令

```powershell
npm.cmd test
npm.cmd run test:dna
npm.cmd run test:native-ui
npm.cmd run test:native-dna
npm.cmd run test:browser
npm.cmd run check:release
```

`test:browser` 运行前应先启动本地预览。`test:native-dna` 使用浏览器画布和微信 API 测试替身，不能替代 WXML / WXSS 官方编译或真机性能测试。

## 数据入口

- 轻量目录：`miniprogram/data/case-summaries.js`
- 完整案例：`miniprogram/data/cases.js`
- 七阶段映射与资产卡：`miniprogram/config/business-stages.js`
- 画布模块：`miniprogram/data/modules.js`
- DNA 色表和阶段映射：`miniprogram/config/dna-theme.js`
- 共享 DNA 渲染：`miniprogram/utils/dna-renderer.js`
- 7 天验证规则：`miniprogram/utils/validation.js`
- 发布预检：`scripts/release-preflight.mjs`

## 3D 性能策略

- 高性能设备使用 `threejs-miniprogram` WebGL，像素比最高限制为 2。
- 低性能设备自动切换 Canvas 2D 星球 / DNA 视图。
- 页面隐藏时停止动画帧，组件销毁时释放几何体、材质和事件。
- 原生端与网页端共享阶段色表和模型规则，避免两端含义不一致。
- 首页和列表使用轻量摘要，详情按需读取，避免把完整案例库写入页面初始数据。

## 当前发布阻塞项

自动化发布预检目前只保留两项代码配置阻塞：正式 AppID 和真实支持邮箱。取得后仍需人工完成备案、服务类目、微信后台隐私保护指引、正式工具编译、真机验收、上传和审核。详见 [上架问题清单.md](上架问题清单.md) 与 [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)。

## 历史脚手架边界

仓库中的 `cloudfunctions/`、登录、会员、订单、支付和旧 AI 服务未进入当前发布路由，不应部署。若未来恢复在线能力，应重新立项并同步更新架构、隐私、类目、测试和发布材料。

