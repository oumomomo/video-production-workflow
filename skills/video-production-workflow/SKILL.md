---
name: video-production-workflow
description: Turn a user-provided locked video script into a storyboard, run evidence-based self-checks, optimize only rejected parts, manage portable team asset references and analysis caches, validate risky motion probes, and assemble a candidate without silently rewriting the script or replacing approved shots. Use for short-form product videos, motion graphics, storyboards, editor handoffs, team asset libraries, video revision, or video QA from an existing script.
---

# Video Production Workflow

Treat the user-provided script as immutable unless the user explicitly authorizes a separate edited copy. A request for storyboards, captions, voiceover, motion, editing, or a finished video is not permission to rewrite it.

## Route the task

- If the user provides a finished script, preserve it byte-for-byte and start this workflow.
- If the user asks for script writing, use an appropriate writing workflow first; do not mix script invention into production without permission.
- If the user asks only for a motion test, make the shortest normal-speed probe that can validate the risky relationship. Do not expand it into a full video.
- If a prior shot or version is approved, treat it as a baseline. Modify only the named problem and preserve everything outside the stated scope.
- If a team needs shared assets, register stable asset IDs and portable storage URIs. Never make another teammate depend on one person's absolute local path.

## Execute the core loop

1. Lock the script and identify voiceover timing, screen-recording segments, animation segments, required assets, forbidden assets, and approved baselines.
2. Before designing the storyboard, complete `workflow/visual-reference-contract.json`: bind real source materials, declare where color comes from, select references, and record what to inherit, change, and reject. Real source material alone is not a visual direction.
3. Build the storyboard from visual events, not sentence-by-sentence illustration. A shot may cover several script segments; a segment may need several shots.
4. Self-check in the order of the user's highest-frequency failure modes: baseline preservation, script match, visual reference contract, rhythm, composition, aesthetic quality, then text density. These seven are hard stops. Apply a first-glance rejection gate before showing any visual: reject unsourced default AI packaging or an unfinished draft internally. Do not infer AI-looking style from isolated surface traits such as a zoomed product interface, negative space, native small text, or brand colors; judge whether each choice has a real source and a specific narrative, composition, or timing role. AI review may fail aesthetic or text density, but may not mark either one passed; passing evidence must come from the user or a named human editor.
5. Optimize the storyboard before full rendering. Remove repeats, reduce clutter, correct proportions, create meaningful state changes, and repair transitions without changing the script.
6. Render normal-speed probes for high-risk shots such as openings, device perspective, in-frame text, screen-to-animation transitions, hand-drawing, and complex camera moves.
7. Convert feedback into a targeted revision contract: baseline, problem, what to preserve, what to change, and what must not change.
8. Assemble only current accepted fragments. Never reintroduce rejected or superseded shots.
9. Watch the full candidate at normal speed and run the full-video check before presenting it as ready for approval.

## Enforce material and text discipline

- Default to adding no on-screen text. Allowed exceptions are exact locked-script wording, text already present in an approved real interface, or evidence without which the shot cannot be understood. Record why every exception is necessary.
- Remotion/AI may faithfully rebuild approved real screenshots, recordings, product states, or brand assets as animation. Preserve the source interface structure, wording, icons, data meaning, and product behavior; record the source asset ID or hash.
- Do not invent a dashboard, chat window, report editor, spreadsheet, feature state, or result without a real source. If the required state is absent from the source, stop at an asset gap or mark the extrapolation as a concept requiring explicit approval.
- Replacing one generic AI style with another does not count as optimization. The shot must grow from real footage, real product behavior, approved brand assets, a specific physical object, or a declared metaphor.

Read [references/workflow.md](references/workflow.md) when planning or executing a complete video. Read [references/pitfalls.md](references/pitfalls.md) before the first storyboard and whenever optimizing. Read [references/audit-checklist.md](references/audit-checklist.md) before presenting a storyboard, probe, assembled preview, or final candidate.

Read [references/team-workflow.md](references/team-workflow.md) when distributing the workflow, onboarding teammates, registering shared assets, or configuring AI analysis reuse.

## Use the command helper

The bundled command records mechanical evidence; it does not judge taste or grant approval.

```bash
video-flow init --project <目录> --script <定稿脚本> --title <标题>
video-flow verify --project <目录>
video-flow visual-contract --project <目录>
video-flow status --project <目录>
video-flow audit --project <目录> --stage storyboard
video-flow check-set --project <目录> --id rhythm --status pass --evidence <证据>
video-flow optimize-plan --project <目录> --shot <镜头ID> --problem <问题> --keep <保留> --change <修改> --forbid <禁止>
video-flow baseline-set --project <目录> --file <项目内候选文件> --scope <批准范围>
video-flow next --project <目录>

video-flow library-init --library <团队素材库目录> --name <名称>
video-flow asset-register --library <目录> --id <素材ID> --name <名称> --type <类型> --uri <团队URI> --license <权限>
video-flow asset-search --library <目录> --query <关键词>
```

Use templates from `assets/templates/` when the command cannot run.

## Preserve approval integrity

- Never label a candidate `approved`, `final`, or `ready` without explicit user evidence.
- Never treat a technical check, rendered file, screenshot, or self-review as user approval.
- Never overwrite the locked script, accepted baseline, or earlier candidate.
- Never fix a local complaint by silently switching the entire style or rebuilding unrelated shots.
- Never claim the automatic audit proves the video is attractive, clear, polished, or free of AI-looking defaults. Report those as human review questions.
- Never store copyrighted source media in the public workflow repository. Keep originals in team storage and register only portable URIs, hashes, permissions, previews, and evidence.
- Reuse transcript, keyframes, contact sheets, shot maps, and human analysis when `sourceSha256` is unchanged. Do not repeatedly send the same full source video to AI without a stated reason.
