---
version: 0.1
last_updated: 2026-10-08
format: 1080x1920
duration: 50.3s
message: 把看过的创业案例，变成一个可验证的小计划。
arc: BAB + Demo Loop
audience: 想低成本试做项目、却不知如何开始的人
mode: autonomous
music: none
---

## Video direction

Palette from frame.md: cream暖纸底、text-dark深绿字、coral金色点缀；真实截图原色。插画同一短发女性、青绿上衣、桌面，不改变身份。中文本地Promo CJK字体。
短视频以人物困惑开头，第2镜明确价值，3–5镜用实际产品证据，6–7镜落可执行小实验，8镜收品牌与行动。
所有内容保持 y<1600；字幕另轨占底部17%。UI镜头统一短角标“本地产品演示”，图注“示例，未执行”。不要完整重复旁白作主标题。截图是演示基底，不重绘网站。
Motion grammar: 逐个揭示、沿链连接、卡片收拢；动作用paused GSAP，顺着实际旁白词边界。只在第一次揭示做镜头推进，结尾有意识停稳，禁止循环呼吸、全屏漂浮、重弹跳。Frame 7保存证据、Frame 8落版刻意持稳。第一镜到第二镜无连续物件硬交接，其余统一同底色硬切/极短crossfade，不伪装一镜到底。
Negative: 空洞创业口号、泛科技霓虹、照片真人、假UI、收益数字、上线二维码、AI分析状态条、被完成的测试、第三方Logo墙、遮住产品字的装饰、字幕与主体重叠。

## Frame 1 — 收藏以后

- scene: 卡通人物看手机，便签越堆越多，问题落在桌面
- voiceover: 又收藏一个创业案例。很心动。可第一步，到底做什么？
- duration: 5.6s
- status: animated
- src: compositions/frames/01-hook.html
- transition_in: cut
- type: hook
- persuasion: Pain validation
- beat: curiosity + uncertainty
- blueprint: compose
- asset_candidates: assets/story-atlas.png — 仅使用左侧正方形人物困惑场景
- focal: assets/story-atlas.png
- roles: story-atlas = supporting story illustration

narrativeRole: 让观众认出收藏与行动之间的断点。
keyMessage: 收藏以后，第一步是什么？
Scene 1 (0.0–1.9s): 顶部小章“轻创拼拼”；大画框呈左侧插画，人物脸不遮挡；桌面下的第一枚“案例”便签侧向落座，画框轻微push后锁定 → coordinate-target-zoom。
Scene 2 (1.9–3.0s): 下方“心动”标签落座，便签叠为3枚；不是列表幻灯片，标签靠着同一桌面边缘 → dynamic-content-sequencing。
Scene 3 (3.0–5.6s): 大字“然后呢？”从下方利落揭示，桌面的“第一步？”便签展开；此后停稳阅读，关键词一笔金色marker → css-marker-patterns。

## Frame 2 — 看清生意

- scene: 实际主页像一本打开的案例册，产品价值明确
- voiceover: 打开轻创拼拼。别只看别人做成了什么，先拆清这门生意怎么运转。
- duration: 5.9s
- status: animated
- src: compositions/frames/02-product.html
- transition_in: cut
- type: product_intro
- persuasion: Feature-to-benefit translation
- beat: relief + curiosity
- blueprint: compose
- asset_candidates: assets/01-home.png — 真实主页
- focal: assets/01-home.png
- roles: 01-home = supporting captured UI

narrativeRole: 在第二镜落价值，功能为价值服务。
keyMessage: 看懂一门生意。
Scene 1 (0.0–1.8s): 品牌“轻创拼拼”由左侧落座，真实主页以手机阅读窗出现，右上角小章“本地产品演示”；保留网页原色，不画假按钮 → dynamic-content-sequencing。
Scene 2 (1.8–3.6s): 删去式短词“只看结果”在画框旁出现，接着“看清过程”接替旁侧位置，不在截图内造功能 → discrete-text-sequence。
Scene 3 (3.6–5.878s): 主标题“看懂一门生意”落位，底部3个小步骤“选案例 → 拆链路 → 试验证”依次出现并停稳 → dynamic-content-sequencing。

## Frame 3 — 卖的是省时间

- scene: 真实模板案例旁出现纸质卖点注释
- voiceover: 比如原创任务模板。卖点不是一个文件，而是帮任务分散的人，省下搭建系统的时间。
- duration: 7.066667s
- status: animated
- src: compositions/frames/03-offer.html
- transition_in: cut
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: clarity
- blueprint: compose
- asset_candidates: assets/02-case-source-and-business.png — 真实来源与生意说明
- focal: assets/02-case-source-and-business.png
- roles: 02-case-source-and-business = captured UI

narrativeRole: 选一个足够具体的案例，证明这不是空泛创业鸡汤。
keyMessage: 不是文件，是省搭建时间。
Scene 1 (0.0–1.8s): 顶部标签“01 / 卖点”；真实截图作为主阅读窗，高度占主要空间，短标题“原创任务模板”与其同框；保留来源URL文字 → dynamic-content-sequencing。
Scene 2 (1.8–4.4s): UI窗保持稳定，下方外置注释卡“任务与笔记分散”按旁白揭示，强调实际付费者问题，不覆盖截图 → dynamic-content-sequencing。
Scene 3 (4.4–7.043s): 大字“省搭建时间”从右侧进入；金色marker划过关键词；阅读窗上方小字“公开资料示例 · 不代表盈利证明”保持可读 → css-marker-patterns。

## Frame 4 — 从入口到交付

- scene: 真正商业DNA与两组纸卡，将获客和交付串起
- voiceover: 客户从教程、博客、免费资源认识它。拿到的，是模板和使用说明。
- duration: 6.866667s
- status: animated
- src: compositions/frames/04-chain.html
- transition_in: cut
- type: feature_showcase
- persuasion: Mechanism explanation
- beat: discovery
- blueprint: compose
- asset_candidates: assets/03-dna.png — 真实商业DNA
- focal: assets/03-dna.png
- roles: 03-dna = captured UI

narrativeRole: 看见入口与交付的不同，形成完整交易视角。
keyMessage: 看见入口，也看见交付。
Scene 1 (0.0–3.2s): 顶部“02 / 获客与交付”，左上/中央真实DNA阅读窗到位；底部纸卡中“教程”“博客”“免费资源”依实际词边界依次落位 → dynamic-content-sequencing。
Scene 2 (3.2–5.4s): 纸卡从入口组连到“模板 + 使用说明”交付组，用一条外置SVG连接线自绘，不是截图内新功能 → svg-path-draw。
Scene 3 (5.4–6.85s): 全链稳定，短注“入口≠成交保证”在下沿正文安全区出现，交付卡金色短划强调 → css-marker-patterns。

## Frame 5 — 拼到画布

- scene: 实际七节点画布出现，三类经营问题连接
- voiceover: 点一下，加入画布。把卖点、获客和交付，放到一条链上。
- duration: 5.8s
- status: animated
- src: compositions/frames/05-canvas.html
- transition_in: cut
- type: feature_showcase
- persuasion: Friction reduction
- beat: control
- blueprint: compose
- asset_candidates: assets/04-canvas.png — 通过加入真实案例操作生成的七节点画布
- focal: assets/04-canvas.png
- roles: 04-canvas = captured UI

narrativeRole: 把学习内容落到同一个可检查的方案上。
keyMessage: 从案例，拼到自己的方案。
Scene 1 (0.0–1.8s): “03 / 画布”与真实画布窗入座；角标说明“本地产品演示”，顶部短词“加入画布”，不新增假点击按钮 → dynamic-content-sequencing。
Scene 2 (1.8–4.0s): 外置三个标签“卖点”“获客”“交付”由旁白逐个出现，连接线分段绘出，直观补充真实截图的字，而非重绘产品画布 → svg-path-draw。
Scene 3 (4.0–5.797s): 下方注“方案待实测”，链末端小问号出现，停止运动让观众看清未验证状态 → dynamic-content-sequencing。

## Frame 6 — 先试一小步

- scene: 卡通人物整理桌面，中间场景中的纸卡被实验步骤替换
- voiceover: 先做一页原创样张。请三个人试填，记录耗时、卡点和原话。
- duration: 6.166667s
- status: animated
- src: compositions/frames/06-experiment.html
- transition_in: cut
- type: benefit_highlight
- persuasion: Implementation intention
- beat: confidence
- blueprint: compose
- asset_candidates: assets/story-atlas.png — 仅使用中间正方形认真整理纸卡的场景
- focal: assets/story-atlas.png
- roles: story-atlas = story illustration

narrativeRole: 给出观众今晚能理解和筹备的小实验，不虚构成功。
keyMessage: 原创样张，3人试填，记录证据。
Scene 1 (0.0–2.0s): 中间插画作大画框，占上部大块空间；顶部短标题“一页原创样张”，纸卡边缘翻入，脸部无遮挡 → dynamic-content-sequencing。
Scene 2 (2.0–3.8s): “3人试填”圆章落位，下面“使用非敏感任务”说明出现；不把人物画成已经收到真实用户 → dynamic-content-sequencing。
Scene 3 (3.8–6.148s): 三枚证据标签“耗时 / 卡点 / 原话”依次合到手记中；小章“实验建议 · 未执行”落位，所有元素停稳 → css-marker-patterns。

## Frame 7 — 存下计划

- scene: 实际验证记录框已经保存未执行计划，不出现已完成的勾选
- voiceover: 把计划保存下来。试过以后，再决定继续，还是调整。不是先砸钱，是先找证据。
- duration: 8s
- status: animated
- src: compositions/frames/07-record.html
- transition_in: cut
- type: benefit_highlight
- persuasion: Evidence-before-investment
- beat: calm + agency
- blueprint: compose
- asset_candidates: assets/06-plan-saved.png — 真实未执行计划记录及保存反馈
- focal: assets/06-plan-saved.png
- roles: 06-plan-saved = captured UI

narrativeRole: 对“先试再决定”的流程留下可见依据。
keyMessage: 先找证据，再做决定。
Scene 1 (0.0–2.0s): 真实记录页作为主阅读窗到位，短标题“存下计划”；本地产品演示角标，强调“计划（未执行）”，不要重建输入框 → css-marker-patterns。
Scene 2 (2.0–5.4s): 截图不改变，外置分支“继续 / 调整 / 暂停”依次出现，全部未选，短注“试过以后再决定”，不伪造决策 → dynamic-content-sequencing。
Scene 3 (5.4–7.996s): “先找证据”成为大字落点，金色marker强调；下方小字“仅当前设备保存”，安静持稳至切点 → css-marker-patterns。

## Frame 8 — 下一步

- scene: 同一人物拿原创纸张，品牌与行动短句落位
- voiceover: 轻创拼拼。选一个案例，拼出你的下一步。
- duration: 4.9s
- status: animated
- src: compositions/frames/08-close.html
- transition_in: cut
- type: cta
- persuasion: Low-friction next action
- beat: quiet motivation
- blueprint: compose
- asset_candidates: assets/story-atlas.png — 仅使用右侧正方形微笑展示原创纸张的场景; assets/brand-mark.svg — 产品实际QP星球标记
- focal: assets/story-atlas.png
- roles: story-atlas = story illustration; brand-mark = brand identity

narrativeRole: 不编造体验入口，将品牌与一条明确行动绑定。
keyMessage: 选一个案例，拼出下一步。
Scene 1 (0.0–1.6s): 右侧卡通人物作大画框，头像身份连续；真实QP标记和“轻创拼拼”品牌落座，不动脸部 → dynamic-content-sequencing。
Scene 2 (1.6–3.4s): “选一个案例”短句先出现，接着“拼出下一步”金色手记章落位；不放假二维码 → dynamic-content-sequencing。
Scene 3 (3.4–4.875s): 成品静止落版，底部安全区小字“产品演示 · 案例学习不构成收益承诺”，正文字幕仍另轨；保留尾音，不渐隐品牌。
