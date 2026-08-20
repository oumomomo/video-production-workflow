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
  'visualReferenceContract',
  'rhythm',
  'composition',
  'aesthetic',
  'textDensity',
];
const HUMAN_GATED_CHECKS = ['aesthetic', 'textDensity'];
const ALL_CHECKS = [
  ...HARD_CHECKS,
  'continuity',
  'brandAssets',
  'audioSync',
  'normalSpeedReview',
];
const ASSET_STATUSES = ['candidate', 'tested', 'recommended', 'deprecated', 'review-only'];
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
  video-flow visual-contract --project <目录> [--json]
  video-flow audit --project <目录> [--stage storyboard|video] [--json]
  video-flow check-set --project <目录> --id <检查ID> --status pass|fail --evidence <证据> [--note <说明>] [--json]
  video-flow optimize-plan --project <目录> --shot <镜头ID> --problem <问题> --keep <保留> --change <修改> --forbid <禁止> [--baseline <版本>] [--json]
  video-flow baseline-set --project <目录> --file <项目内文件> --scope <批准范围> [--json]
  video-flow next --project <目录> [--json]
  video-flow library-init --library <目录> --name <名称> [--id <稳定ID>] [--json]
  video-flow asset-register --library <目录> --id <素材ID> --name <名称> --type <类型> --uri <团队URI> --license <权限> [--status candidate|tested|recommended|deprecated|review-only] [--tags <逗号分隔>] [--source-file <仅用于计算哈希的本地文件>] [--json]
  video-flow asset-search --library <目录> --query <关键词> [--status <状态>] [--json]

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

function libraryRoot(options, mustExist = true) {
  const root = path.resolve(requireOption(options, 'library'));
  if (mustExist && (!fs.existsSync(root) || !fs.statSync(root).isDirectory())) {
    throw new Error(`素材库目录不存在：${root}`);
  }
  return root;
}

function libraryFiles(root) {
  return {
    registry: path.join(root, 'registry.json'),
    derived: path.join(root, 'derived'),
    previews: path.join(root, 'previews'),
  };
}

function assertPortableUri(uri) {
  if (path.isAbsolute(uri) || /^[A-Za-z]:[\\/]/.test(uri) || uri.startsWith('~') || uri.startsWith('file:')) {
    throw new Error('--uri 不得使用某台电脑的本地绝对路径；请使用 oss://、cos://、s3://、drive://、nas://、univer://、team:// 或 https://');
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(uri)) throw new Error('--uri 必须是带协议的团队可迁移 URI');
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
    assetManifest: path.join(root, 'workflow', 'asset-manifest.json'),
    visualContract: path.join(root, 'workflow', 'visual-reference-contract.json'),
  };
}

function auditVisualReferenceContract(root, storyboard = null) {
  const files = projectFiles(root);
  const errors = [];
  if (!fs.existsSync(files.visualContract)) return {ok: false, errors: ['visual reference contract missing']};
  const contract = readJson(files.visualContract);
  if (contract.schemaVersion !== 1) errors.push('visual reference contract schemaVersion must be 1');
  if (contract.status !== 'ready') errors.push('visual reference contract status must be ready');
  const world = contract.visualWorld ?? {};
  if (!Array.isArray(world.sourceMaterials) || world.sourceMaterials.length === 0) {
    errors.push('visual reference contract has no source materials');
  }
  for (const [index, material] of (world.sourceMaterials ?? []).entries()) {
    if (!material?.id || !material?.type || !material?.source || !material?.evidence) {
      errors.push(`source material ${index + 1} is incomplete`);
    }
  }
  if (!world.continuityMechanism?.trim()) errors.push('visual continuity mechanism missing');
  const color = world.colorSource ?? {};
  if (!['real-material', 'brand', 'selected-reference'].includes(color.kind)) errors.push('color source kind is invalid');
  if (!color.sourceId?.trim() || !color.evidence?.trim() || !color.rule?.trim()) errors.push('color source evidence is incomplete');
  if (world.genericAIPaletteAllowed !== false) errors.push('generic AI palette must remain blocked');
  const references = contract.referencePolicy?.selectedReferences ?? [];
  if (references.length === 0 && !contract.referencePolicy?.originalReason?.trim()) {
    errors.push('select at least one visual reference or record an original direction reason');
  }
  for (const [index, reference] of references.entries()) {
    if (!reference?.id || !reference?.source || !reference?.evidence) errors.push(`visual reference ${index + 1} is incomplete`);
    for (const field of ['inherit', 'change', 'reject']) {
      if (!Array.isArray(reference?.[field]) || reference[field].length === 0) {
        errors.push(`visual reference ${index + 1} missing ${field}`);
      }
    }
  }
  const shotIds = new Set((storyboard?.shots ?? []).map((shot) => shot.id).filter(Boolean));
  const bindings = contract.shotBindings ?? [];
  const boundShotIds = new Set();
  for (const [index, binding] of bindings.entries()) {
    if (!binding?.shotId || !['reference', 'remix', 'invent'].includes(binding?.origin)) {
      errors.push(`shot binding ${index + 1} is incomplete`);
      continue;
    }
    boundShotIds.add(binding.shotId);
    if (!Array.isArray(binding.materialIds) || binding.materialIds.length === 0) errors.push(`shot ${binding.shotId} has no material binding`);
    if (['reference', 'remix'].includes(binding.origin) && (!Array.isArray(binding.referenceIds) || binding.referenceIds.length === 0)) {
      errors.push(`shot ${binding.shotId} has no reference binding`);
    }
    if (binding.origin === 'invent' && !binding.originalHypothesis?.trim()) errors.push(`shot ${binding.shotId} has no original hypothesis`);
  }
  for (const shotId of shotIds) if (!boundShotIds.has(shotId)) errors.push(`storyboard shot not bound in visual contract: ${shotId}`);
  return {ok: errors.length === 0, errors};
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
  return `# ${title}\n\n- \`source/approved-script.*\` 是只读脚本真源。制作分镜、字幕、配音、动效或成片不等于获得改稿授权。\n- 未经用户明确授权，不得润色、删增、重排、纠错或覆盖脚本；获准修改时保留原稿并建立新副本。\n- 核心流程为：锁定脚本 → 视觉参考合同 → 分镜 → 高频踩雷自检 → 优化 → 关键短样 → 定点修改 → 连续预览 → 整片复检。\n- 七项硬检查未通过时不得提交：基线保护、脚本匹配、视觉参考合同、节奏、构图、审美、文字密度。\n- 真实素材不等于视觉方向成立；配色、构图和动效前必须登记真实材料、配色来源，以及参考的继承、改变与拒绝项。不得从空白画布调用 AI 默认颜色。\n- 画面文字默认不新增；只允许锁定脚本原话、真实界面原生文字或不出现就无法理解的必要证据。每项例外必须说明必要性。\n- 允许 Remotion/AI 基于获准的真实截图、录屏、产品状态或品牌资产做忠实动画化；必须记录源素材 ID/哈希，并保持结构、原文、图标、数据含义与产品行为一致。\n- 禁止无来源地发明产品界面、功能状态、数据或结果；真实素材中不存在的状态只能标为概念候选并单独获得用户批准。\n- 审美与文字密度不得由 AI 自行判定通过；必须记录 \`user:\`、\`human:\` 或 \`editor:\` 开头的真人证据。\n- 局部反馈只修改指定镜头和问题；未被点名的已确认内容保持不变。\n- 新渲染是候选，不得覆盖当前基线；自动检查不能代替用户批准。\n- 项目只通过 \`workflow/asset-manifest.json\` 引用稳定素材 ID；不得登记某位同事电脑的绝对路径。\n- AI 默认复用转写、关键帧和分析包；相同素材哈希不得无理由重新分析整段原片。\n`;
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
    path.join(TEMPLATE_DIR, 'asset-library.template.json'),
    path.join(TEMPLATE_DIR, 'asset-manifest.template.json'),
    path.join(TEMPLATE_DIR, 'analysis-pack.template.json'),
    path.join(TEMPLATE_DIR, 'visual-reference-contract.template.json'),
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
  const assetManifest = readJson(path.join(TEMPLATE_DIR, 'asset-manifest.template.json'));
  assetManifest.updatedAt = now;
  const visualContract = readJson(path.join(TEMPLATE_DIR, 'visual-reference-contract.template.json'));
  const manifest = {
    schemaVersion: 1,
    title,
    platforms,
    phase: 'storyboard-draft',
    scriptLock: 'workflow/script-lock.json',
    storyboard: 'workflow/storyboard.json',
    storyboardSelfCheck: 'reviews/storyboard-self-check.json',
    assetManifest: 'workflow/asset-manifest.json',
    visualReferenceContract: 'workflow/visual-reference-contract.json',
    currentBaseline: null,
    createdAt: now,
    updatedAt: now,
    events: [{at: now, type: 'project_initialized_and_script_locked'}],
  };
  const files = projectFiles(root);
  writeJson(files.lock, lock);
  writeJson(files.storyboard, storyboard);
  writeJson(files.check, checklist);
  writeJson(files.assetManifest, assetManifest);
  writeJson(files.visualContract, visualContract);
  writeJson(files.manifest, manifest);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), projectAgents(title), 'utf8');
  const result = {
    ok: true,
    project: root,
    lockedScript: lock.relativePath,
    scriptSha256: lock.sha256,
    scriptSegments: storyboard.scriptSegments.length,
    next: '填写 workflow/storyboard.json 和 workflow/visual-reference-contract.json；先锁定真实材料、参考语法与配色来源，再运行 audit。',
  };
  output(result, options);
}

function verifyProject(root) {
  const files = projectFiles(root);
  const errors = [];
  for (const [label, file] of Object.entries(files).filter(([key]) => key !== 'assetManifest')) {
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

function visualContract(options) {
  const root = projectRoot(options);
  const files = projectFiles(root);
  const storyboard = fs.existsSync(files.storyboard) ? readJson(files.storyboard) : null;
  const result = auditVisualReferenceContract(root, storyboard);
  output({ok: result.ok, contract: path.relative(root, files.visualContract), errors: result.errors}, options);
  if (!result.ok) process.exitCode = 1;
}

function auditStoryboard(root, stage) {
  const verification = verifyProject(root);
  const files = projectFiles(root);
  const errors = [...verification.errors];
  const warnings = [];
  let storyboard = null;
  let checklist = null;
  let assetManifest = null;
  if (fs.existsSync(files.storyboard)) storyboard = readJson(files.storyboard);
  if (fs.existsSync(files.check)) checklist = readJson(files.check);
  if (fs.existsSync(files.assetManifest)) assetManifest = readJson(files.assetManifest);
  else warnings.push('asset manifest missing; legacy project can continue, but team handoff is incomplete');
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
  const visualContractResult = auditVisualReferenceContract(root, storyboard);
  for (const error of visualContractResult.errors) errors.push(error);
  for (const id of HARD_CHECKS) {
    const item = checklist?.checks?.[id];
    if (item?.status !== 'pass') errors.push(`hard check not passed: ${id}`);
    else if (!item.evidence) errors.push(`hard check evidence missing: ${id}`);
  }
  for (const id of ALL_CHECKS.filter((item) => !HARD_CHECKS.includes(item))) {
    const item = checklist?.checks?.[id];
    if (item?.status !== 'pass') warnings.push(`review check pending: ${id}`);
  }
  for (const [index, asset] of (assetManifest?.assets ?? []).entries()) {
    const label = asset.assetId || `asset[${index}]`;
    if (!asset.assetId) errors.push(`${label} missing assetId`);
    if (!asset.shotId) errors.push(`${label} missing shotId`);
    if (!['reuse', 'remix', 'invent'].includes(asset.mode)) errors.push(`${label} invalid mode`);
    if (!['planned', 'candidate', 'accepted', 'rejected', 'superseded', 'blocked'].includes(asset.status)) {
      errors.push(`${label} invalid project status`);
    }
    if (asset.localPath && (path.isAbsolute(asset.localPath) || /^[A-Za-z]:[\\/]/.test(asset.localPath))) {
      errors.push(`${label} contains absolute local path`);
    }
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
  if (id === 'visualReferenceContract' && status === 'pass') {
    const files = projectFiles(root);
    const storyboard = fs.existsSync(files.storyboard) ? readJson(files.storyboard) : null;
    const visualResult = auditVisualReferenceContract(root, storyboard);
    if (!visualResult.ok) throw new Error(`视觉参考合同未成立：${visualResult.errors.join('; ')}`);
  }
  if (status === 'pass' && HUMAN_GATED_CHECKS.includes(id) && !/^(user|human|editor):/i.test(evidence)) {
    throw new Error(`${id} 不得由 AI 自行判定通过；--evidence 必须以 user:、human: 或 editor: 开头，并记录真人审阅证据`);
  }
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
    nextStep = '先完成视觉参考合同，再按高频踩雷顺序完成七项硬检查；未通过时先优化分镜。';
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

function initLibrary(options) {
  const root = libraryRoot(options, false);
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) throw new Error('素材库目录不是空目录；拒绝覆盖已有内容');
  fs.mkdirSync(root, {recursive: true});
  const files = libraryFiles(root);
  fs.mkdirSync(files.derived, {recursive: true});
  fs.mkdirSync(files.previews, {recursive: true});
  const now = new Date().toISOString();
  const registry = readJson(path.join(TEMPLATE_DIR, 'asset-library.template.json'));
  registry.libraryId = options.id?.trim() || `library-${crypto.randomUUID()}`;
  registry.name = requireOption(options, 'name');
  registry.createdAt = now;
  registry.updatedAt = now;
  writeJson(files.registry, registry);
  output({ok: true, library: root, libraryId: registry.libraryId, next: '使用 asset-register 登记素材；原文件继续保存在团队存储。'}, options);
}

function registerAsset(options) {
  const root = libraryRoot(options);
  const files = libraryFiles(root);
  if (!fs.existsSync(files.registry)) throw new Error('registry.json 不存在；请先运行 library-init');
  const registry = readJson(files.registry);
  const id = requireOption(options, 'id');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new Error('--id 只能包含字母、数字、点、下划线和短横线');
  if ((registry.assets ?? []).some((asset) => asset.id === id)) throw new Error(`素材 ID 已存在：${id}`);
  const uri = requireOption(options, 'uri');
  assertPortableUri(uri);
  const status = options.status?.trim() || 'candidate';
  if (!ASSET_STATUSES.includes(status)) throw new Error(`--status 必须是：${ASSET_STATUSES.join(', ')}`);
  let sourceSha256 = options.sha256?.trim() || null;
  if (options['source-file']) {
    const sourceFile = path.resolve(options['source-file']);
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) throw new Error('--source-file 不存在');
    sourceSha256 = sha256(sourceFile);
  }
  if (sourceSha256 && !/^[a-f0-9]{64}$/i.test(sourceSha256)) throw new Error('--sha256 必须是 64 位 SHA-256');
  const now = new Date().toISOString();
  const asset = {
    id,
    name: requireOption(options, 'name'),
    type: requireOption(options, 'type'),
    status,
    tags: (options.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    uri,
    previewUri: options.preview?.trim() || null,
    sourceSha256,
    license: requireOption(options, 'license'),
    usageScope: options.scope?.trim() || null,
    owner: options.owner?.trim() || null,
    createdAt: now,
    updatedAt: now,
    successEvidence: [],
    failureNotes: [],
  };
  registry.assets ??= [];
  registry.assets.push(asset);
  registry.updatedAt = now;
  writeJson(files.registry, registry);
  const analysis = readJson(path.join(TEMPLATE_DIR, 'analysis-pack.template.json'));
  analysis.assetId = id;
  analysis.sourceSha256 = sourceSha256;
  const analysisPath = path.join(files.derived, id, 'analysis-pack.json');
  writeJson(analysisPath, analysis);
  output({ok: true, asset, analysisPack: path.relative(root, analysisPath), note: '未复制原文件；分析包按 sourceSha256 复用。'}, options);
}

function searchAssets(options) {
  const root = libraryRoot(options);
  const registryPath = libraryFiles(root).registry;
  if (!fs.existsSync(registryPath)) throw new Error('registry.json 不存在');
  const registry = readJson(registryPath);
  const query = requireOption(options, 'query').toLowerCase();
  const requestedStatus = options.status?.trim() || null;
  if (requestedStatus && !ASSET_STATUSES.includes(requestedStatus)) throw new Error(`--status 必须是：${ASSET_STATUSES.join(', ')}`);
  const matches = (registry.assets ?? []).filter((asset) => {
    if (requestedStatus && asset.status !== requestedStatus) return false;
    const haystack = [asset.id, asset.name, asset.type, asset.status, ...(asset.tags ?? [])].join(' ').toLowerCase();
    return haystack.includes(query);
  });
  output({ok: true, query, count: matches.length, assets: matches}, options);
}

function main() {
  try {
    const {command, options} = parseArgs(process.argv.slice(2));
    if (!command || ['help', '-h', '--help'].includes(command)) return usage();
    if (command === 'doctor') return doctor(options);
    if (command === 'init') return initProject(options);
    if (command === 'verify') return verify(options);
    if (command === 'visual-contract') return visualContract(options);
    if (command === 'status') return status(options);
    if (command === 'audit') return audit(options);
    if (command === 'check-set') return setCheck(options);
    if (command === 'optimize-plan') return optimizePlan(options);
    if (command === 'baseline-set') return setBaseline(options);
    if (command === 'next') return next(options);
    if (command === 'library-init') return initLibrary(options);
    if (command === 'asset-register') return registerAsset(options);
    if (command === 'asset-search') return searchAssets(options);
    throw new Error(`未知命令：${command}`);
  } catch (error) {
    console.error(`错误：${error.message}`);
    process.exitCode = 1;
  }
}

main();
