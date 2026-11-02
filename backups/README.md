---
version: 0.3
last_updated: 2026-11-02
---

# 两个版本的备份与恢复

当前私有仓库为 [ZHIRUOANHAO/qingchuang-pinpin](https://github.com/ZHIRUOANHAO/qingchuang-pinpin)。主要版本统一为 **1.0** 和 **2.0**，不再把每次调试、日期备份和宣传素材都列成独立产品版本。

| 版本 | 源码入口 | 收纳范围 |
| --- | --- | --- |
| **1.0 · 已上线版归档** | [v1.0](https://github.com/ZHIRUOANHAO/qingchuang-pinpin/releases/tag/v1.0) | 09-21、09-23、10-08 的早期源码；代表提交 `2a8e9cc` |
| **2.0 · 体验版** | [v2.0](https://github.com/ZHIRUOANHAO/qingchuang-pinpin/releases/tag/v2.0) | 10-25 起的首页行星、手机布局与资产卡等优化，及 `91b2c75` 的模型随页面滚动修复 |

1.0 下载发布页的 **Source code (zip)**。**恢复含新手引导的 2.0 当前代码时，下载同页的 `qingchuang-pinpin-2.0-source.zip`，无需历史分卷。** 两个标签仍保留原冻结快照；日常改动保存在主分支，本次补充源码附件与主分支对应，不强推旧标签。

2.0 当前备份还附 `qingchuang-pinpin-2.0-video-project.zip`（教程视频可编辑工程、真实预览素材与母版）、`qingchuang-pinpin-2.0-backup.json`（源提交和逐文件校验清单）、`qingchuang-pinpin-2.0-SHA256SUMS.txt`（附件 SHA256）。这些归在原有 2.0 入口中，没有新增版本。备份不含本机私有配置、认证资料、开发缓存或无关后台截图。

## 版本对应依据

1.0 采用目前最有依据的完整旧快照 `2a8e9cc617341d2cd7e67c75a95f0ebabc114878`。它与 2026-10-21 优化前备份共有的 168 个文件一致（忽略 CRLF 差异）；备份另有依赖、构建产物和辅助配置。现有资料没有微信上传包校验值或完整上传回执，因此不能断言这个快照与微信线上 1.0 完全一致。

2.0 按用户指定版本命名，包含前期优化及最新模型滚动修复。用户于 2026-11-01 确认：1.0 已上线，2.0 为体验版；GitHub 2.0 标为预发布，不列为最新正式版本。此次只整理 GitHub，不代替微信审核或发布；[七项已知问题](../docs/其他问题审核测试-2026-10-26.md)仍按原审核报告保留，不宣称全部修复。

[version-map.json](version-map.json) 保存两个版本的来源、五个旧标签的原标签对象与目标提交。旧日期标签从远端入口移除，提交历史、本地原标签和原始备份仍保留。

## 配套历史资料统一放在 2.0 下

2.0 发布页保留原备份页的 **26 个附件**。这些附件共同保存 1.0 / 2.0 的历史过程、文档和独立工作资料，不是 26 个版本：

- `historical-backups-2026-10-26.zip.part001` 至 `.part017`：历史 ZIP 分卷；目录见 [catalog.json](catalog.json)。
- `project-history-2026-10-26.bundle.part001` 至 `.part004`：截至 `180da46` 的主仓库历史，含五个旧标签；**不含后续提交及最新 2.0 修复**。
- `document-history-2026-10-26.bundle`：独立文档仓库历史。
- `catalog.json`、`archive-parts.json`、`restore-github-backup.py`、`SHA256SUMS.txt`：目录、分卷清单、恢复工具和校验值。

旧归档盘点 599 个源文件，上传 582 个唯一文件，合并 16 份重复内容、排除 1 份本机私有配置；原始本地文件维持原样。原清单、分卷内容和历史上传回执冻结，不将旧 bundle 冒充当前源码。

需要恢复历史资料时，从 **v2.0** 发布页下载上述 26 个附件到同一新目录，使用 Python 3.11 或以上执行：

```powershell
python .\restore-github-backup.py .\archive-parts.json
```

工具核对分卷顺序、各卷 SHA256 和合并后的 SHA256，再生成 ZIP 与 bundle，不覆盖已有文件。需要全部旧标签时，可在新目录运行：

```powershell
git clone .\project-history-2026-10-26.bundle qingchuang-pinpin-history
```

恢复 ZIP 时也应解压到新空目录，依据 `catalog.json` 的 `duplicateOf` 恢复重复路径。独立文档仓库与网站工作副本保持独立，不与小程序源码压平合并。

## 直接恢复某个版本

```powershell
git clone --branch v1.0 https://github.com/ZHIRUOANHAO/qingchuang-pinpin.git qingchuang-pinpin-1.0
git clone --branch master https://github.com/ZHIRUOANHAO/qingchuang-pinpin.git qingchuang-pinpin-2.0
```

选择需要的一个命令即可；不要覆盖当前开发目录。`master` 获取当前开发代码；精确恢复本次备份，应下载源码附件，或按 `qingchuang-pinpin-2.0-backup.json` 的 `commit` 检出对应提交。两个标签均冻结，后续不要强推覆盖。

## 维护和本轮交付

- README 和两个 Release 是日常入口；Git 提交用于追溯，不再额外创建日期 Release。
- 推送时明确写出分支或指定版本标签，**不要执行 `git push --tags`**，以免把本地保留的旧标签重新推回远端。
- `scripts/organize-github-versions.mjs` 用于本次迁移：核对 GitHub 账号、仓库、目标提交和附件，改挂原 Release、新建 1.0，核验后清理旧远端标签；遇到不一致就停止。
- `scripts/upload-github-backup.ps1` 只给已经建立的 1.0 / 2.0 发布页补齐已校验附件，不再自行创建日期发布页。`output/` 中旧上传脚本作为历史原件，不再运行。
- 本轮原文件副本、迁移前状态及最终回执放在 `output/version-consolidation-2026-10-27/`，不含认证凭据。历史提交与标签映射另保存在仓库内，便于恢复。
- 已有原生界面 20 项、体验逻辑 15 项回归通过。此次不新增产品功能、不更改微信后台版本，也不将内部依赖版本号作为产品版本依据。

分工：`version_mapping` 协作代理只读核对源码对应关系；`backup_consolidation_review` 只读核对恢复依赖；主窗口负责文件、标签、远端修改与验收。当前无侧栏旧聊天发送工具，未向这些窗口发布消息。
