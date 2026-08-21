# 视频制作避雷工作流

这是一套可分发给团队的脚本驱动视频流程：锁稿、视觉参考合同、分镜、自检、定点优化、关键短样、连续预览和整片复检。它同时提供轻量素材注册表与 AI 分析缓存，不把制作视频理解成改稿授权，也不让团队依赖某个人电脑的绝对路径。

## 适合谁

- 已有脚本，需要交给 AI 或剪辑同事做分镜和视频；
- 经常遇到节奏静止、画面与脚本不匹配、版本被换、构图混乱、AI 味和文字过多；
- 希望每轮反馈只修改指定问题，不破坏已确认镜头；
- 需要保留脚本、基线、候选和自检证据。
- 希望团队共享参考视频、动效、品牌资产与分析结果，但不把大文件塞进 GitHub。

## 安装命令

需要 Node.js 18 或更高版本。

直接安装命令行工具：

```bash
npm install -g github:oumomomo/video-production-workflow
video-flow doctor
```

同时安装 Codex Skill：

```bash
git clone https://github.com/oumomomo/video-production-workflow.git
cp -R video-production-workflow/skills/video-production-workflow ~/.codex/skills/video-production-workflow
```

也可以克隆仓库后从本地安装：

```bash
git clone https://github.com/oumomomo/video-production-workflow.git
cd video-production-workflow
npm install -g .
video-flow doctor
```

把 `skills/video-production-workflow` 复制到朋友的 Codex skills 目录，即可让 Codex 自动使用这套规则：

```text
~/.codex/skills/video-production-workflow/
```

## 最常用流程

```bash
video-flow init --project ./my-video --script ./script.md --title "我的视频"
video-flow verify --project ./my-video
video-flow visual-contract --project ./my-video
video-flow status --project ./my-video
```

先编辑 `my-video/workflow/visual-reference-contract.json`，把真实材料、配色来源、所选参考的继承/改变/拒绝项和逐镜绑定写清；再编辑 `storyboard.json` 完成分镜并登记高频自检。真实素材不等于视觉方向已经成立。

```bash
video-flow check-set --project ./my-video --id scriptMatch --status pass --evidence "逐镜核对脚本"
video-flow check-set --project ./my-video --id rhythm --status pass --evidence "正常速度检查"
video-flow check-set --project ./my-video --id graphicElementPurpose --status pass --evidence "逐条完成线条三问；删除无职责边框、下划线和连接器"
video-flow audit --project ./my-video --stage storyboard
```

收到修改意见时先建立定点优化单：

```bash
video-flow optimize-plan \
  --project ./my-video \
  --shot A07 \
  --baseline V3 \
  --problem "主体放大后停留太短" \
  --keep "构图、Logo、文字和进入动作" \
  --change "增加可读停留并调整退出时机" \
  --forbid "新增卡片、换背景、改其他镜头"
```

把关键短样或连续预览放入项目后，可登记为当前基线：

```bash
video-flow baseline-set --project ./my-video --file previews/opening-v3.mp4 --scope "开头构图与动作方向"
video-flow next --project ./my-video
```

新项目会自动生成 `workflow/asset-manifest.json`。项目只引用稳定素材 ID，不复制整个素材库，也不登记某位同事电脑的绝对路径。

## 团队素材库

初始化一个只保存索引和分析缓存的团队素材库：

```bash
video-flow library-init --library ./team-assets --name "团队视频素材库" --id team-video-assets
```

原片继续放在团队云盘、NAS、Univer、OSS/COS 或其他共享存储，注册表只保存可迁移 URI、哈希、权限和状态：

```bash
video-flow asset-register \
  --library ./team-assets \
  --id ref-object-relay-001 \
  --name "对象接力参考" \
  --type reference-video \
  --uri team://references/ref-object-relay-001.mp4 \
  --license review-only \
  --status review-only \
  --tags "对象接力,转场" \
  --source-file ./incoming/reference.mp4

video-flow asset-search --library ./team-assets --query "对象接力"
```

`--source-file` 只计算 SHA-256，不上传、不复制、也不记录本地路径。每条素材会建立一个 `analysis-pack.json`；相同哈希默认复用转写、关键帧和人工分析，避免 AI 重复读取整段原片。

团队实施细节见 `skills/video-production-workflow/references/team-workflow.md`，无媒体示范项目见 `examples/team-demo/`。

## 命令能做与不能做的事

命令能够检查脚本哈希、文件完整性、分镜字段、自检证据、素材路径与基线版本。它不能判断视频是否高级、是否真正好看、是否有吸引力或是否完全消除了 AI 味；这些仍需要正常速度人工观看和用户批准。
