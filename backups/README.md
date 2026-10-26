---
version: 0.1
last_updated: 2026-10-26
---

# 备份索引与恢复说明

当前主仓库为私有仓库 [ZHIRUOANHAO/qingchuang-pinpin](https://github.com/ZHIRUOANHAO/qingchuang-pinpin)。当前源代码由 Git 提交保存，历史大文件备份集中在对应的 GitHub Release，避免将多份 ZIP 和视频反复放入代码历史。

## 当前快照

- 当前备份标签：`backup-2026-10-26`。
- [GitHub 备份归档](https://github.com/ZHIRUOANHAO/qingchuang-pinpin/releases/tag/backup-2026-10-26)。
- [逐文件目录、来源、SHA256、去重与排除记录](catalog.json)。
- `historical-backups-2026-10-26.zip`：本地历史代码和视频备份、历史文档及知识库，以及独立网站工作副本，按原相对目录归档。私有配置从上传副本中排除。
- `project-history-2026-10-26.bundle`：主仓库提交和标签的离线恢复副本。
- `document-history-2026-10-26.bundle`：独立历史文档仓库的 Git 历史；当前工作副本另外包含在 ZIP 中，不与主仓库压平合并。
- `catalog.json`、`SHA256SUMS.txt`：同一 Release 中的目录与资产校验清单。

这是代码和历史备份归档，不是微信小程序上传或发布。当前快照保留了[本轮审核确认但尚未整改的七项问题](../docs/其他问题审核测试-2026-10-26.md)。

## 既有历史

保留全部原有提交，未重写仓库历史。为原有备份建立以下检索标签：

| 标签或提交 | 日期 | 内容 |
| --- | --- | --- |
| `backup-2026-09-21-baseline` / `c2cec61` | 2026-09-21 | 优化前代码基线 |
| `backup-2026-09-23` / `0e4f1b5` | 2026-09-23 | 原项目快照 |
| `backup-2026-10-08` / `2a8e9cc` | 2026-10-08 | 原本地项目更新备份 |
| `69b4764` | 2026-10-25 | 自然行星系统与入场动效 |
| `7db1a50` | 2026-10-25 | 合并原远端备份历史 |
| `4a86785` | 2026-10-25 | 首页星球亮度与氛围调整 |
| `checkpoint-2026-10-25-gold-planet` / `7b6fc6d` | 2026-10-25 | 金色线框主球品牌外观 |
| `backup-2026-10-26` | 2026-10-26 | 首页手机布局整改、回归测试、其他问题审核及统一备份目录 |

## 整理规则

- 本机原始备份不删除、不覆盖；原有历史文档及独立仓库维持原目录。
- 相同内容在上传 ZIP 中只保存一次，目录记录 `duplicateOf`，恢复时按对应记录复制回原相对路径。
- 净化 ZIP 同时记录原文件校验值和上传副本校验值；原始文件与净化副本内容不同属预期行为。
- 不上传真实 `.env`、本机私有配置、认证缓存、令牌或私钥。`project.private.config.json` 可根据公开的 `project.config.json` 在微信开发者工具中重新生成。
- 依赖包、临时日志、自动化浏览器缓存等可重建内容不纳入代码版本。当前宣传视频工程的一般素材不等同于历史备份；本归档范围以目录逐项记录为准。
- 新备份使用日期和用途命名，代码提交记录版本，大归档放 Release；不要使用“最终版”等含糊名称。

## 恢复到新目录

从 GitHub 恢复当前代码（保留现有工作区）：

```powershell
git clone --branch backup-2026-10-26 https://github.com/ZHIRUOANHAO/qingchuang-pinpin.git qingchuang-pinpin-restored
```

离线恢复主仓库：

```powershell
git bundle verify .\project-history-2026-10-26.bundle
git clone .\project-history-2026-10-26.bundle qingchuang-pinpin-restored
```

恢复历史资料时，将 ZIP 解压到新的空目录；按 `catalog.json` 的映射恢复重复文件。若需要独立文档仓库的历史，再将 `document-history-2026-10-26.bundle` 克隆到另一个新目录，并对照 ZIP 中的工作副本补回未提交资料。网站原仓库没有既有提交，其工作副本以 ZIP 为准。

下载后先计算 `Get-FileHash -Algorithm SHA256`，与 `SHA256SUMS.txt` 比较；不要将未经核对的归档直接覆盖正在开发的项目。

## 辅助工具

- `scripts/prepare-github-backup.py`：根据盘点清单生成净化归档和目录，并逐项校验内容。
- `scripts/upload-github-backup.ps1`：复用现有 Git Credential Manager 授权，核对账号、私有仓库及远端标签，上传归档并检查 GitHub SHA256 或下载内容。不会启动账号登录，也不会覆盖同名但不同内容的远端资产。

盘点输入和实际上传回执放在本机 `output/`，不包含认证凭据。仓库内 `catalog.json` 是备份内容的持久索引，执行状态以远端提交、标签、Release 及本机校验回执为准。
