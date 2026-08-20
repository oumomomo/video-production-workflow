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
const library = path.join(temp, 'library');

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
  if (!fs.existsSync(path.join(project, 'workflow', 'asset-manifest.json'))) throw new Error('asset manifest was not created');

  run(['library-init', '--library', library, '--name', '测试素材库', '--id', 'team-test', '--json']);
  const sourceAsset = path.join(temp, 'reference.mp4');
  fs.writeFileSync(sourceAsset, 'reference-video-bytes', 'utf8');
  run([
    'asset-register', '--library', library, '--id', 'ref-001', '--name', '对象接力参考',
    '--type', 'reference-video', '--uri', 'team://references/ref-001.mp4', '--license', 'review-only',
    '--status', 'review-only', '--tags', '对象接力,转场', '--source-file', sourceAsset, '--json',
  ]);
  const search = run(['asset-search', '--library', library, '--query', '对象接力', '--json']);
  if (!search.stdout.includes('ref-001')) throw new Error('asset search did not return registered asset');
  if (!fs.existsSync(path.join(library, 'derived', 'ref-001', 'analysis-pack.json'))) throw new Error('analysis pack was not created');
  const localPathRejected = run([
    'asset-register', '--library', library, '--id', 'ref-local', '--name', '错误路径',
    '--type', 'reference-video', '--uri', sourceAsset, '--license', 'review-only', '--json',
  ], 1);
  if (!localPathRejected.stderr.includes('本地绝对路径')) throw new Error('absolute local asset URI was not blocked');

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

  const visualContractPath = path.join(project, 'workflow', 'visual-reference-contract.json');
  const visualContract = JSON.parse(fs.readFileSync(visualContractPath, 'utf8'));
  visualContract.status = 'ready';
  visualContract.visualWorld.sourceMaterials = [{
    id: 'real-ui-001', type: 'real-product-recording', source: 'team://product/real-ui-001.mp4', evidence: 'asset:real-ui-001',
  }];
  visualContract.visualWorld.continuityMechanism = '同一个真实数据对象贯穿镜头';
  visualContract.visualWorld.colorSource = {
    kind: 'real-material', sourceId: 'real-ui-001', evidence: 'frame-review:001', rule: '只取真实界面和现场材料中已有颜色',
  };
  visualContract.referencePolicy.selectedReferences = [{
    id: 'ref-001', source: 'team://references/ref-001.mp4', evidence: 'contact-sheet:ref-001',
    inherit: ['对象接力'], change: ['替换原品牌和原文'], reject: ['原片表面配色'],
  }];
  visualContract.shotBindings = [{
    shotId: 'A01', origin: 'remix', materialIds: ['real-ui-001'], referenceIds: ['ref-001'],
  }];
  fs.writeFileSync(visualContractPath, `${JSON.stringify(visualContract, null, 2)}\n`, 'utf8');
  run(['visual-contract', '--project', project, '--json']);

  const aiAestheticPass = run([
    'check-set', '--project', project, '--id', 'aesthetic', '--status', 'pass',
    '--evidence', 'self:AI 自评审美通过', '--json',
  ], 1);
  if (!aiAestheticPass.stderr.includes('不得由 AI 自行判定通过')) throw new Error('AI aesthetic approval was not blocked');

  for (const id of ['preserveApprovedBaseline', 'scriptMatch', 'visualReferenceContract', 'rhythm', 'composition', 'aesthetic', 'textDensity']) {
    const evidence = ['aesthetic', 'textDensity'].includes(id) ? `human:test:${id}` : `test:${id}`;
    run(['check-set', '--project', project, '--id', id, '--status', 'pass', '--evidence', evidence, '--json']);
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
    teamAssetRegistry: true,
    analysisCacheInitialized: true,
    absoluteAssetPathBlocked: true,
    humanReviewGate: true,
  }}, null, 2));
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
