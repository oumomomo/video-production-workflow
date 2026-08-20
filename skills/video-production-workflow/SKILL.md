---
name: video-production-workflow
description: Turn a user-provided locked video script into a storyboard, run evidence-based self-checks against recurring production pitfalls, optimize only the rejected parts, validate risky motion probes, and assemble a polished candidate without silently rewriting the script or replacing approved shots. Use when creating or revising short-form product videos, motion graphics, screen-recording-plus-animation videos, storyboards, editor handoffs, or video QA from an existing script.
---

# Video Production Workflow

Treat the user-provided script as immutable unless the user explicitly authorizes a separate edited copy. A request for storyboards, captions, voiceover, motion, editing, or a finished video is not permission to rewrite it.

## Route the task

- If the user provides a finished script, preserve it byte-for-byte and start this workflow.
- If the user asks for script writing, use an appropriate writing workflow first; do not mix script invention into production without permission.
- If the user asks only for a motion test, make the shortest normal-speed probe that can validate the risky relationship. Do not expand it into a full video.
- If a prior shot or version is approved, treat it as a baseline. Modify only the named problem and preserve everything outside the stated scope.

## Execute the core loop

1. Lock the script and identify voiceover timing, screen-recording segments, animation segments, required assets, forbidden assets, and approved baselines.
2. Build the storyboard from visual events, not sentence-by-sentence illustration. A shot may cover several script segments; a segment may need several shots.
3. Self-check in the order of the user's highest-frequency failure modes: baseline preservation, script match, rhythm, composition, aesthetic quality, then text density. These six are hard stops.
4. Optimize the storyboard before full rendering. Remove repeats, reduce clutter, correct proportions, create meaningful state changes, and repair transitions without changing the script.
5. Render normal-speed probes for high-risk shots such as openings, device perspective, in-frame text, screen-to-animation transitions, hand-drawing, and complex camera moves.
6. Convert feedback into a targeted revision contract: baseline, problem, what to preserve, what to change, and what must not change.
7. Assemble only current accepted fragments. Never reintroduce rejected or superseded shots.
8. Watch the full candidate at normal speed and run the full-video check before presenting it as ready for approval.

Read [references/workflow.md](references/workflow.md) when planning or executing a complete video. Read [references/pitfalls.md](references/pitfalls.md) before the first storyboard and whenever optimizing. Read [references/audit-checklist.md](references/audit-checklist.md) before presenting a storyboard, probe, assembled preview, or final candidate.

## Use the command helper

The bundled command records mechanical evidence; it does not judge taste or grant approval.

```bash
node scripts/video-flow.mjs init --project <目录> --script <定稿脚本> --title <标题>
node scripts/video-flow.mjs verify --project <目录>
node scripts/video-flow.mjs status --project <目录>
node scripts/video-flow.mjs audit --project <目录> --stage storyboard
node scripts/video-flow.mjs check-set --project <目录> --id rhythm --status pass --evidence <证据>
node scripts/video-flow.mjs optimize-plan --project <目录> --shot <镜头ID> --problem <问题> --keep <保留> --change <修改> --forbid <禁止>
node scripts/video-flow.mjs baseline-set --project <目录> --file <项目内候选文件> --scope <批准范围>
node scripts/video-flow.mjs next --project <目录>
```

Use templates from `assets/templates/` when the command cannot run.

## Preserve approval integrity

- Never label a candidate `approved`, `final`, or `ready` without explicit user evidence.
- Never treat a technical check, rendered file, screenshot, or self-review as user approval.
- Never overwrite the locked script, accepted baseline, or earlier candidate.
- Never fix a local complaint by silently switching the entire style or rebuilding unrelated shots.
- Never claim the automatic audit proves the video is attractive, clear, polished, or free of AI-looking defaults. Report those as human review questions.

