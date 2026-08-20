#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const TEMPLATE_DIR = path.join(SKILL_DIR, 'assets', 'templates');
const HARD_CHECKS = [
  'preserveApprovedBaseline',
  'scriptMatch',
  'rhythm',
  'composition',
  'aesthetic',
  'textDensity',
];
const ALL_CHECKS = [
  ...HARD_CHECKS,
  'continuity',
  'brandAssets',
  'audioSync',
  'normalSpeedReview',
];
const SHOT_FIELDS = [
  'id',
  'scriptSegmentIds',
  'type',
  'visualEvent',
  'visualLead',
  'transitionIn',
  'transitionOut',
  'materials',
  'avoid',
  'acceptance',
];

function usage() {
  console.log(`video-flow｜脚本驱动的视频制作避雷工作流

用法：
  video-flow doctor [--json]
  video-flow init --project <目录> --script <定稿脚本> [--title <标题>] [--platform douyin,xiaohongshu] [--json]
  video-flow verify --project <目录> [--json]
  video-flow status --project <目录> [--json]
  video-flow audit --project <目录> [--stage storyboard|video] [--json]
  video-flow check-set --project <目录> --id <检查ID> --status pass|fail --evidence <证据> [--note <说明>] [--json]
  video-flow optimize-plan --project <目录> --shot <镜头ID> --problem <问题> --keep <保留> --change <修改> --forbid <禁止> [--baseline <版本>] [--json]
  video-flow baseline-set --project <目录> --file <项目内文件> --scope <批准范围> [--json]
  video-flow next --project <目录> [--json]

高频硬检查 ID：${HARD_CHECKS.join(', ')}
其他检查 ID：${ALL_CHECKS.filter((id) => !HARD_CHECKS.includes(id)).join(', ')}

命令只验证机械证据，不评价创意质量，也不授予用户批准。`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) throw new Error(`无法解析参数：${arg}`);
    const key = arg.slice(2);
    if (key === 'json') {
      options.json = true;
      continue;
    }
    if (index + 1 >= rest.length || rest[index + 1].startsWith('--')) {
      throw new Error(`--${key} 缺少值`);
    }
    options[key] = rest[index + 1];
    index += 1;
  }
  return {command, options};
}

function requireOption(options, key) {
  if (!options[key]?.trim()) throw new Error(`缺少 --${key}`);
  return options[key].trim();
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function output(value, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (typeof value === 'string') {
    console.log(value);
    return;
  }
  const lines = [];
  if (Object.hasOwn(value, 'ok')) lines.push(`状态：${value.ok ? '通过' : '未通过'}`);
  for (const [key, item] of Object.entries(value)) {
    if (key === 'ok') continue;
    if (Array.isArray(item)) {
      lines.push(`${key}：`);
      for (const entry of item) lines.push(`  - ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`);
    } else if (item && typeof item === 'object') {
      lines.push(`${key}：${JSON.stringify(item)}`);
    } else {
      lines.push(`${key}：${item ?? '—'}`);
    }
  }
  console.log(lines.join('\n'));
}

function projectRoot(options, mustExist = true) {
  const root = path.resolve(requireOption(options, 'project'));
  if (mustExist && (!fs.existsSync(root) || !fs.statSync(root).isDirectory())) {
    throw new Error(`项目目录不存在：${root}`);
  }
  return root;
}

function ensureWithin(root, candidate, label) {
  const absolute = path.resolve(candidate);
  const prefix = `${root}${path.sep}`;
  if (!absolute.startsWith(prefix)) throw new Error(`${label} 必须位于项目目录内`);
  return absolute;
}

function projectFiles(root) {
  return {
    manifest: path.join(root, 'workflow', 'project.json'),
    lock: path.join(root, 'workflow', 'script-lock.json'),
    storyboard: path.join(root, 'workflow', 'storyboard.json'),
    check: path.join(root, 'reviews', 'storyboard-self-check.json'),
  };
}

function extractScriptSegments(source) {
  const withoutFrontmatter = source.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const lines = withoutFrontmatter
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('```'));
  return lines.map((text, index) => ({
    id: `S${String(index + 1).padStart(3, '0')}`,
    text,
    timing: {startSeconds: null, endSeconds: null},
    productionType: 'unassigned',
  }));
}

function projectAgents(title) {
  return `# ${title}\n\n- \`source/approved-script.*\` 是只读脚本真源。制作分镜、字幕、配音、动效或成片不等于获得改稿授权。\n- 未经用户明确授权，不得润色、删增、重排、纠错或覆盖脚本；获准修改时保留原稿并建立新副本。\n- 核心流程为：锁定脚本 → 分镜 → 高频踩雷自检 → 优化 → 关键短样 → 定点修改 → 连续预览 → 整片复检。\n- 前六项硬检查未通过时不得提交：基线保护、脚本匹配、节奏、构图、审美、文字密度。\n- 局部反馈只修改指定镜头和问题；未被点名的已确认内容保持不变。\n- 新渲染是候选，不得覆盖当前基线；自动检查不能代替用户批准。\n`;
}

function doctor(options) {
  const major = Number(process.versions.node.split('.')[0]);
  const requiredFiles = [
    path.join(SKILL_DIR, 'SKILL.md'),
    path.join(SKILL_DIR, 'references', 'workflow.md'),
    path.join(SKILL_DIR, 'references', 'pitfalls.md'),
    path.join(SKILL_DIR, 'references', 'audit-checklist.md'),
    path.join(TEMPLATE_DIR, 'storyboard.template.json'),
    path.join(TEMPLATE_DIR, 'storyboard-self-check.template.json'),
  ];
  const missing = requiredFiles.filter((file) => !fs.existsSync(file));
  const result = {
    ok: major >= 18 && missing.length === 0,
    node: process.versions.node,
    nodeSupported: major >= 18,
    skillDirectory: SKILL_DIR,
    missingFiles: missing,
    note: '只检查运行环境和流程文件，不证明具体视频质量。',
  };
  output(result, options);
  if (!result.ok) process.exitCode = 1;
}

function initProject(options) {
  const root = projectRoot(options, false);
  const scriptSource = path.resolve(requireOption(options, 'script'));
  if (!fs.existsSync(scriptSource) || !fs.statSync(scriptSource).isFile()) {
    throw new Error(`脚本不存在：${scriptSource}`);
  }
  if (fs.statSync(scriptSource).size > 10 * 1024 * 1024) throw new Error('脚本超过 10 MiB');
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    throw new Error('项目目录不是空目录；拒绝覆盖已有内容');
  }
  fs.mkdirSync(root, {recursive: true});
  for (const directory of ['source', 'workflow', 'reviews', 'revisions', 'previews', 'renders', 'assets']) {
    fs.mkdirSync(path.join(root, directory), {recursive: true});
  }
  const extension = ['.md', '.txt', '.srt'].includes(path.extname(scriptSource).toLowerCase())
    ? path.extname(scriptSource).toLowerCase()
    : '.txt';
  const lockedScript = path.join(root, 'source', `approved-script${extension}`);
  fs.copyFileSync(scriptSource, lockedScript);
  const title = options.title?.trim() || path.basename(root);
  const platforms = (options.platform || 'douyin,xiaohongshu').split(',').map((item) => item.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const lock = {
    schemaVersion: 1,
    mode: 'read-only',
    relativePath: path.relative(root, lockedScript),
    sha256: sha256(lockedScript),
    sourceFilename: path.basename(scriptSource),
    lockedAt: now,
    modificationAuthorization: null,
    rule: '制作分镜、字幕、配音、动效或成片不等于授权改稿；获准修改时保留原稿并建立新副本。',
  };
  const storyboard = readJson(path.join(TEMPLATE_DIR, 'storyboard.template.json'));
  storyboard.scriptSegments = extractScriptSegments(fs.readFileSync(lockedScript, 'utf8'));
  storyboard.createdAt = now;
  const checklist = readJson(path.join(TEMPLATE_DIR, 'storyboard-self-check.template.json'));
  checklist.updatedAt = now;
  const manifest = {
    schemaVersion: 1,
    title,
    platforms,
    phase: 'storyboard-draft',
    scriptLock: 'workflow/script-lock.json',
    storyboard: 'workflow/storyboard.json',
    storyboardSelfCheck: 'reviews/storyboard-self-check.json',
    currentBaseline: null,
    createdAt: now,
    updatedAt: now,
    events: [{at: now, type: 'project_initialized_and_script_locked'}],
  };
  const files = projectFiles(root);
  writeJson(files.lock, lock);
  writeJson(files.storyboard, storyboard);
  writeJson(files.check, checklist);
  writeJson(files.manifest, manifest);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), projectAgents(title), 'utf8');
  const result = {
    ok: true,
    project: root,
    lockedScript: lock.relativePath,
    scriptSha256: lock.sha256,
    scriptSegments: storyboard.scriptSegments.length,
    next: '填写 workflow/storyboard.json；先设计视觉事件，再运行 audit。',
  };
  output(result, options);
}

function verifyProject(root) {
  const files = projectFiles(root);
  const errors = [];
  for (const [label, file] of Object.entries(files)) {
    if (!fs.existsSync(file)) errors.push(`${label} missing`);
  }
  let lock = null;
  if (fs.existsSync(files.lock)) {
    lock = readJson(files.lock);
    const script = lock.relativePath ? path.join(root, lock.relativePath) : null;
    if (!script || !fs.existsSync(script)) errors.push('locked script missing');
    else if (!lock.sha256 || sha256(script) !== lock.sha256) errors.push('locked script hash mismatch');
    if (lock.mode !== 'read-only') errors.push('script lock is not read-only');
  }
  return {ok: errors.length === 0, errors, lock};
}

function verify(options) {
  const root = projectRoot(options);
  const result = verifyProject(root);
  output({ok: result.ok, project: root, errors: result.errors}, options);
  if (!result.ok) process.exitCode = 1;
}

function auditStoryboard(root, stage) {
  const verification = verifyProject(root);
  const files = projectFiles(root);
  const errors = [...verification.errors];
  const warnings = [];
  let storyboard = null;
  let checklist = null;
  if (fs.existsSync(files.storyboard)) storyboard = readJson(files.storyboard);
  if (fs.existsSync(files.check)) checklist = readJson(files.check);
  const shots = storyboard?.shots ?? [];
  if (shots.length === 0) errors.push('storyboard has no shots');
  const shotIds = new Set();
  const coveredSegments = new Set();
  for (const [index, shot] of shots.entries()) {
    const label = shot.id || `shot[${index}]`;
    if (shot.id && shotIds.has(shot.id)) errors.push(`duplicate shot id: ${shot.id}`);
    if (shot.id) shotIds.add(shot.id);
    for (const field of SHOT_FIELDS) {
      const value = shot[field];
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        errors.push(`${label} missing ${field}`);
      }
    }
    for (const segmentId of shot.scriptSegmentIds ?? []) coveredSegments.add(segmentId);
  }
  for (const segment of storyboard?.scriptSegments ?? []) {
    if (!coveredSegments.has(segment.id)) errors.push(`script segment not covered: ${segment.id}`);
  }
  for (const id of HARD_CHECKS) {
    const item = checklist?.checks?.[id];
    if (item?.status !== 'pass') errors.push(`hard check not passed: ${id}`);
    else if (!item.evidence) errors.push(`hard check evidence missing: ${id}`);
  }
  for (const id of ALL_CHECKS.filter((item) => !HARD_CHECKS.includes(item))) {
    const item = checklist?.checks?.[id];
    if (item?.status !== 'pass') warnings.push(`review check pending: ${id}`);
  }
  if (stage === 'video') {
    for (const id of ALL_CHECKS) {
      const item = checklist?.checks?.[id];
      if (item?.status !== 'pass') errors.push(`video check not passed: ${id}`);
      else if (!item.evidence) errors.push(`video check evidence missing: ${id}`);
    }
    const manifest = fs.existsSync(files.manifest) ? readJson(files.manifest) : null;
    if (!manifest?.currentBaseline) errors.push('video baseline missing');
    else {
      const baseline = path.join(root, manifest.currentBaseline.relativePath || '');
      if (!fs.existsSync(baseline)) errors.push('video baseline file missing');
      else if (manifest.currentBaseline.sha256 !== sha256(baseline)) errors.push('video baseline hash mismatch');
    }
  }
  return {
    ok: errors.length === 0,
    stage,
    shotCount: shots.length,
    coveredScriptSegments: coveredSegments.size,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    scope: '只验证脚本完整性、分镜字段、自检证据和基线；不评价创意质量。',
  };
}

function audit(options) {
  const root = projectRoot(options);
  const stage = options.stage || 'storyboard';
  if (!['storyboard', 'video'].includes(stage)) throw new Error('--stage 只能是 storyboard 或 video');
  const result = auditStoryboard(root, stage);
  output(result, options);
  if (!result.ok) process.exitCode = 1;
}

function setCheck(options) {
  const root = projectRoot(options);
  const id = requireOption(options, 'id');
  const status = requireOption(options, 'status');
  const evidence = requireOption(options, 'evidence');
  if (!ALL_CHECKS.includes(id)) throw new Error(`未知检查 ID：${id}`);
  if (!['pass', 'fail'].includes(status)) throw new Error('--status 只能是 pass 或 fail');
  const files = projectFiles(root);
  const checklist = readJson(files.check);
  checklist.checks[id] = {status, evidence, note: options.note?.trim() || null};
  checklist.updatedAt = new Date().toISOString();
  checklist.status = ALL_CHECKS.every((item) => checklist.checks[item]?.status === 'pass') ? 'complete' : 'incomplete';
  writeJson(files.check, checklist);
  output({ok: true, id, status, hardStop: HARD_CHECKS.includes(id), evidence}, options);
}

function optimizePlan(options) {
  const root = projectRoot(options);
  const shot = requireOption(options, 'shot');
  const plan = {
    schemaVersion: 1,
    id: null,
    shotId: shot,
    baseline: options.baseline?.trim() || null,
    problem: requireOption(options, 'problem'),
    keep: requireOption(options, 'keep'),
    change: requireOption(options, 'change'),
    forbid: requireOption(options, 'forbid'),
    status: 'planned',
    createdAt: new Date().toISOString(),
    rule: '只修改 change 描述的范围；keep 和 forbid 未获新授权前不可改变。',
  };
  const revisionDir = path.join(root, 'revisions');
  fs.mkdirSync(revisionDir, {recursive: true});
  const existing = fs.readdirSync(revisionDir).filter((name) => /^revision-\d{3}\.json$/.test(name));
  const number = existing.reduce((max, name) => Math.max(max, Number(name.match(/\d{3}/)[0])), 0) + 1;
  plan.id = `R${String(number).padStart(3, '0')}`;
  const target = path.join(revisionDir, `revision-${String(number).padStart(3, '0')}.json`);
  writeJson(target, plan);
  output({ok: true, revision: path.relative(root, target), plan}, options);
}

function setBaseline(options) {
  const root = projectRoot(options);
  const input = path.resolve(requireOption(options, 'file'));
  const file = ensureWithin(root, input, '--file');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('基线文件不存在');
  const scope = requireOption(options, 'scope');
  const files = projectFiles(root);
  const manifest = readJson(files.manifest);
  const now = new Date().toISOString();
  const baseline = {
    relativePath: path.relative(root, file),
    sha256: sha256(file),
    scope,
    status: 'selected-baseline',
    recordedAt: now,
    note: '只表示当前选定基线，不等于最终成片批准。',
  };
  manifest.currentBaseline = baseline;
  manifest.updatedAt = now;
  manifest.events.push({at: now, type: 'baseline_selected', path: baseline.relativePath, scope});
  writeJson(files.manifest, manifest);
  output({ok: true, baseline}, options);
}

function getStatus(root) {
  const files = projectFiles(root);
  const verification = verifyProject(root);
  const manifest = fs.existsSync(files.manifest) ? readJson(files.manifest) : null;
  const storyboard = fs.existsSync(files.storyboard) ? readJson(files.storyboard) : null;
  const checklist = fs.existsSync(files.check) ? readJson(files.check) : null;
  const hardPassed = HARD_CHECKS.filter((id) => checklist?.checks?.[id]?.status === 'pass');
  const allPassed = ALL_CHECKS.filter((id) => checklist?.checks?.[id]?.status === 'pass');
  return {
    ok: verification.ok,
    title: manifest?.title ?? null,
    scriptLocked: verification.ok,
    storyboardShots: storyboard?.shots?.length ?? 0,
    scriptSegments: storyboard?.scriptSegments?.length ?? 0,
    hardChecksPassed: `${hardPassed.length}/${HARD_CHECKS.length}`,
    allChecksPassed: `${allPassed.length}/${ALL_CHECKS.length}`,
    currentBaseline: manifest?.currentBaseline ?? null,
    errors: verification.errors,
  };
}

function status(options) {
  const root = projectRoot(options);
  output(getStatus(root), options);
}

function next(options) {
  const root = projectRoot(options);
  const files = projectFiles(root);
  const state = getStatus(root);
  let nextStep;
  if (!state.scriptLocked) nextStep = '恢复锁定脚本或修复 script-lock.json；不得继续制作。';
  else if (state.storyboardShots === 0) nextStep = '填写 workflow/storyboard.json，先设计视觉事件和镜头衔接。';
  else if (state.hardChecksPassed !== `${HARD_CHECKS.length}/${HARD_CHECKS.length}`) {
    nextStep = '按高频踩雷顺序完成前六项硬检查；未通过时先优化分镜。';
  } else if (!state.currentBaseline) {
    nextStep = '制作高风险镜头的正常速度短样；用户选择后用 baseline-set 登记当前基线。';
  } else {
    const checklist = readJson(files.check);
    const pending = ALL_CHECKS.filter((id) => checklist.checks[id]?.status !== 'pass');
    nextStep = pending.length > 0
      ? `组合连续预览并完成剩余检查：${pending.join(', ')}`
      : '运行 audit --stage video；通过后提交为待用户批准的候选，不得自动标记 final。';
  }
  output({ok: state.ok, next: nextStep, state}, options);
}

function main() {
  try {
    const {command, options} = parseArgs(process.argv.slice(2));
    if (!command || ['help', '-h', '--help'].includes(command)) return usage();
    if (command === 'doctor') return doctor(options);
    if (command === 'init') return initProject(options);
    if (command === 'verify') return verify(options);
    if (command === 'status') return status(options);
    if (command === 'audit') return audit(options);
    if (command === 'check-set') return setCheck(options);
    if (command === 'optimize-plan') return optimizePlan(options);
    if (command === 'baseline-set') return setBaseline(options);
    if (command === 'next') return next(options);
    throw new Error(`未知命令：${command}`);
  } catch (error) {
    console.error(`错误：${error.message}`);
    process.exitCode = 1;
  }
}

main();

