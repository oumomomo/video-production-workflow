import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(ROOT, 'skills', 'video-production-workflow', 'scripts', 'video-flow.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-flow-test-'));
const script = path.join(temp, 'script.md');
const project = path.join(temp, 'project');

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args], {encoding: 'utf8'});
  if (result.status !== expected) {
    throw new Error(`command failed: ${args.join(' ')}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return result;
}

try {
  fs.writeFileSync(script, '第一句口播。\n第二句口播。\n', 'utf8');
  run(['doctor', '--json']);
  run(['init', '--project', project, '--script', script, '--title', '测试视频', '--json']);
  run(['verify', '--project', project, '--json']);

  const locked = path.join(project, 'source', 'approved-script.md');
  fs.appendFileSync(locked, '未经授权的改动', 'utf8');
  const blocked = run(['verify', '--project', project, '--json'], 1);
  if (!blocked.stdout.includes('hash mismatch')) throw new Error('script mutation was not blocked');
  fs.writeFileSync(locked, '第一句口播。\n第二句口播。\n', 'utf8');

  const storyboardPath = path.join(project, 'workflow', 'storyboard.json');
  const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
  storyboard.shots = [{
    id: 'A01',
    scriptSegmentIds: storyboard.scriptSegments.map((segment) => segment.id),
    type: 'animation',
    visualEvent: '两个真实对象先分离，再因为同一数据变化建立联系。',
    visualLead: '源数据对象',
    transitionIn: '由上一镜真实界面的数据变化接入',
    transitionOut: '同步结果占满画面并接下一镜',
    materials: ['真实界面录屏'],
    avoid: ['通用卡片', '伪数据'],
    acceptance: ['正常速度可看清关系变化', '没有重复解释口播'],
  }];
  fs.writeFileSync(storyboardPath, `${JSON.stringify(storyboard, null, 2)}\n`, 'utf8');

  for (const id of ['preserveApprovedBaseline', 'scriptMatch', 'rhythm', 'composition', 'aesthetic', 'textDensity']) {
    run(['check-set', '--project', project, '--id', id, '--status', 'pass', '--evidence', `test:${id}`, '--json']);
  }
  run(['audit', '--project', project, '--stage', 'storyboard', '--json']);
  run([
    'optimize-plan', '--project', project, '--shot', 'A01', '--baseline', 'V1',
    '--problem', '停留太短', '--keep', '构图与真实素材', '--change', '增加停留', '--forbid', '新增卡片', '--json',
  ]);

  const preview = path.join(project, 'previews', 'opening-v1.mp4');
  fs.writeFileSync(preview, 'test-preview-bytes', 'utf8');
  run(['baseline-set', '--project', project, '--file', preview, '--scope', '开头动作方向', '--json']);
  run(['status', '--project', project, '--json']);
  const next = run(['next', '--project', project, '--json']);
  if (!next.stdout.includes('continuity')) throw new Error('next did not report remaining checks');

  console.log(JSON.stringify({ok: true, checks: {
    doctor: true,
    scriptMutationBlocked: true,
    storyboardAudit: true,
    targetedRevision: true,
    baselineRecorded: true,
    nextStepReported: true,
  }}, null, 2));
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}

