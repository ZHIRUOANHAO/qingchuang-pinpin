---
version: 0.1
last_updated: 2026-10-08
---

# 制作与验收记录

## 可验收任务与责任

| 执行单元 | 输入/目标 | 完成标准 | 写入边界 | 当前状态 |
| --- | --- | --- | --- | --- |
| 产品事实核查 / content_risk_review | README、当前代码，列可宣传能力与禁用声明 | 明确本地预置免费案例、画布、记录；不宣传动态AI/上线/盈利 | 只读 | 完成 |
| 具体故事 / concrete_story | real_001与现有功能，写具体使用故事 | 样张/3人/耗时卡点原话；未执行状态 | 只读提案 | 完成，主窗口改为面向观众的直接旁白 |
| 真实画面捕获 / edit_parameter_review | 本地预览真实UI | 5张适用截图、保存计划、完成标记false | 专属capture/script目录 | 完成 |
| 八镜构建 / 协作助手与主窗口 | 已冻结角色、分镜packet、frame.md | 唯一paused timeline，内容在字幕安全区上方 | 各自NN-frame.html | 完成；助手完成01–04，后续因助手用量限制由主窗口完成05–08 |
| 整合导出 / 主窗口 | 所有镜头、实测配音 | check与快照、1509帧、50.3秒、解码/声音/桌面文件摘要 | 本片工程和桌面交付目录 | 生成及技术验收完成；桌面已写入，用户内容/听感验收待反馈 |

这些是当前会话内协作助手，不是用户原有轻创拼拼项目窗口。原有窗口映射未确认，未向其他项目窗口实际发布任务。没有进行上架、付费、对外社交发布。

## 具体制作参数

1080×1920，9:16，30fps，50.3秒，8镜；最终H.264/yuv420p＋AAC 48kHz立体声；-16 LUFS参考目标，true peak≤-0.8dB验收上限。中文旁白是现成Yunxi系统音色，按镜语速与音高变化；不是对付费讲述者的克隆。词边界来自服务真实输出，不均分字幕时间。30组语义中文字幕烧录，底部1620–1830px；主内容不低于1600px。

## 素材来源与成本边界

插画：内置图像生成工具制作三联图，生成prompt见BRIEF与项目来源说明。真实UI：用户现有工程的本机预览；截图原样使用。不重新画已存在产品UI。原有favicon为品牌标记。
音效：media-use捆绑click-soft/chime，来源说明见捆绑CREDITS与本项目.media账本；低音量辅助真实动作，不营造用户已成功获客。当前无背景音乐，优先保证旁白清楚，不使用登录/付费音乐服务。
本片不会覆盖其他题材旧视频。成品位置沿用桌面“视频成品”。

## 实际交付与验收

成品：`C:/Users/qq345/Desktop/视频成品/轻创拼拼-宣传片.mp4`。2026-10-08实际写入并再次核对存在；14,359,400字节，50.300秒，1509帧，1080×1920，30/1fps，H.264 High / yuv420p / BT.709，AAC-LC 48kHz双声道。SHA256：`ED47964B7CCAB6874DCC14341BAF49B2FB056D16F3ADE66D562F4F14BEE2B2E7`，桌面副本与工程成品一致。

混音实际测量：integrated loudness -15.98 LUFS、true peak -2.72 dBTP、LRA 2.30 LU。全文件解码通过。结尾保留旁白尾音与品牌，不渐隐。渲染器因毫秒舍入，将50.301秒上取整为1510帧；交付脚本只去掉最后多出的1帧静止落版，固定1509帧，没有删掉旁白内容。

渲染前：lint 0错误0警告；运行、布局、运动0错误0警告；34/34文字对比度通过。16条布局信息为画框裁剪、边缘装饰和开场便签叠放，目视属于预定表现。检查8镜中点、7次切点前后及片尾共23张图。接头是明确切镜，不承诺一镜到底。

渲染后：抽取2.8秒和48.8秒，与预审快照SSIM分别0.981894、0.983096，并再次目视检查。记录在`renders/delivery-audit.json`与`renders/verification/encoded-review.json`；分镜图在`snapshots/contact-sheet-1.jpg`至`contact-sheet-3.jpg`。

Studio HTTP200：`http://localhost:3017/#project/qingchuang-pinpin-promo`。已提出可选导出或调整问题，未收到满意度确认；按用户制作请求及未回答可选问题时继续的协作规则导出。技术通过不等于用户批准。本片仅本地交付，未上架、未公开发布。

## 复现入口

脚本集中在本工程`scripts/`：配音生成、音轨整理、语义字幕、剩余镜头构建、选择器规范化、交付收尾和编码核查。保留已有01–04手写镜头，构建后使用产品技能`assemble-index.mjs`组装，再规范化选择器并检查。渲染命令：`npx --offline --yes hyperframes@0.8.140 render --skill product-launch-video --quality delivery --fps 30 --workers 2 --output renders/promo-master.mp4`。运行前将本工程FFmpeg/FFprobe目录加入进程PATH。随后执行`scripts/finish-delivery.ps1 -Publish`及`node scripts/verify-encoded.mjs`；同名不同摘要的既有桌面成品会被保护，不自动覆盖。
