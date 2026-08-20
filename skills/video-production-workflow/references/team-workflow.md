# 团队分发与素材复用

## 分发边界

团队成员只需取得三项内容：已安装的 `video-flow`、团队素材库目录、原文件存储权限。工作流仓库保存规则、模板和命令；素材注册表保存 ID、URI、哈希、权限与证据；大文件保存在团队存储，不进入公共仓库。

Univer、云盘、NAS、OSS、COS 或 S3 都是可替换的存储/浏览适配器。项目内 JSON 与稳定素材 ID 保持可迁移，不把任一服务设为唯一真源。

## 团队流程

```text
锁定脚本 → 分镜 → 高频自检 → 优化 → 关键短样/粗剪 → 时间码反馈 → 用户验收与归档
```

- 内容负责人锁定脚本与范围。
- 导演或分镜负责人确认视觉合同与高风险镜头。
- 素材管理员维护来源、版权、成熟度和失效链接。
- 剪辑/动效人员只使用当前项目清单中的素材版本。
- 审核人按时间码反馈；最终批准人明确批准主体、范围和证据。

一人可以兼任多个角色，但批准状态仍需显式记录。

## 初始化素材库

```bash
video-flow library-init --library ./team-assets --name "团队视频素材库" --id team-video-assets
```

登记素材时，`--uri` 使用团队可解析的 URI，例如 `team://`、`nas://`、`drive://`、`univer://`、`oss://`、`cos://`、`s3://` 或 `https://`。不得登记 `/Users/...`、`C:\\...` 或 `file://...`。

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
  --source-file ./incoming/ref-object-relay-001.mp4
```

`--source-file` 只用于计算哈希，不把本地路径写入注册表，也不复制原文件。登记后自动建立 `derived/<assetId>/analysis-pack.json`。

## 素材状态

- `candidate`：尚未验证。
- `tested`：至少在一个真实项目中完成验收。
- `recommended`：可进入团队默认推荐。
- `deprecated`：保留历史但不再推荐。
- `review-only`：仅用于研究，不得直接进入成片。

项目内另用 `planned | candidate | accepted | rejected | superseded | blocked`。单项目 `accepted` 不自动升级为团队 `recommended`。

## AI 分析缓存

对每个稳定 `sourceSha256` 完整分析一次，保存转写、字幕、关键帧、接触表、镜头图、标签、人工分析和低清预览。后续 AI 默认读取分析包；只有哈希变化、分析包缺失或任务明确需要核查原片动作/声音时，才重新读取原片。

## 项目引用

每个新项目自动生成 `workflow/asset-manifest.json`。只登记本条视频实际使用的素材 ID、镜头 ID、`reuse | remix | invent`、项目状态和修改说明。不要把整个素材库复制进视频项目。
