# 视频制作避雷工作流

这是一套从定稿脚本进入分镜、按高频踩雷点自检、定点优化、制作关键短样、组合连续预览并完成整片复检的流程。它不会把制作视频理解成改稿授权，也不会用自动检查冒充创意批准。

## 适合谁

- 已有脚本，需要交给 AI 或剪辑同事做分镜和视频；
- 经常遇到节奏静止、画面与脚本不匹配、版本被换、构图混乱、AI 味和文字过多；
- 希望每轮反馈只修改指定问题，不破坏已确认镜头；
- 需要保留脚本、基线、候选和自检证据。

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
video-flow status --project ./my-video
```

编辑 `my-video/workflow/storyboard.json` 完成分镜，然后登记高频自检：

```bash
video-flow check-set --project ./my-video --id scriptMatch --status pass --evidence "逐镜核对脚本"
video-flow check-set --project ./my-video --id rhythm --status pass --evidence "正常速度检查"
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

## 命令能做与不能做的事

命令能够检查脚本哈希、文件完整性、分镜字段、自检证据和基线版本。它不能判断视频是否高级、是否真正好看、是否有吸引力或是否完全消除了 AI 味；这些仍需要正常速度人工观看和用户批准。
