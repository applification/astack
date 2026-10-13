import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const roles = ['research', 'design', 'implementation', 'review'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateConfig(config) {
  if (config === undefined) return;
  if (!isRecord(config) || Object.keys(config).some((key) => !['roles', 'reviewPanel'].includes(key)) || !isRecord(config.roles)) {
    throw new Error('Expected an object with a roles map and optional reviewPanel.');
  }
  for (const [role, target] of Object.entries(config.roles)) {
    if (!roles.includes(role)) throw new Error(`Unknown model role: ${role}`);
    validateTarget(target, role, true);
  }
  if (config.reviewPanel !== undefined && config.reviewPanel !== null) {
    if (!Array.isArray(config.reviewPanel) || config.reviewPanel.length !== 2) {
      throw new Error('reviewPanel must contain exactly two pinned targets, or null to select roles.review.');
    }
    config.reviewPanel.forEach((target, index) => validateTarget(target, `reviewPanel[${index}]`, false));
    if (config.reviewPanel[0].providerInstanceId === config.reviewPanel[1].providerInstanceId) {
      throw new Error('reviewPanel targets must use different provider instances.');
    }
  }
}

function validateTarget(target, label, allowInherit) {
  if (allowInherit && target === 'inherit') return;
  if (!isRecord(target) || Object.keys(target).some((key) => !['providerInstanceId', 'model', 'options'].includes(key)) ||
      !nonempty(target.providerInstanceId) || !nonempty(target.model)) {
    throw new Error(`Invalid target for ${label}: use ${allowInherit ? 'inherit or ' : ''}providerInstanceId/model/options.`);
  }
  if (target.options !== undefined && (!isRecord(target.options) ||
      Object.values(target.options).some((value) => typeof value !== 'string' && typeof value !== 'boolean'))) {
    throw new Error(`Invalid options for ${label}: use string or boolean values.`);
  }
}

export function resolveRole(config, role, catalog) {
  validateConfig(config);
  validateCatalog(catalog);
  if (!roles.includes(role)) throw new Error(`Unknown model role: ${role}`);
  if (role === 'review' && Array.isArray(config?.reviewPanel)) {
    return config.reviewPanel.map((target, index) => resolveTarget(target, `reviewPanel[${index}]`, catalog));
  }
  return resolveTarget(config?.roles[role], role, catalog);
}

function resolveTarget(target, label, catalog) {
  if (target === undefined || target === 'inherit') return null;
  const provider = catalog?.providers?.find((item) => item.providerInstanceId === target.providerInstanceId);
  if (!provider || provider.canRunChildTask !== true) {
    const reason = provider?.constraints?.join(' ') || (catalog ? 'Not runnable in the live catalog.' : 'Supply the live host catalog.');
    throw new Error(`Provider unavailable for ${label}: ${target.providerInstanceId}. ${reason}`);
  }
  if (catalog.inheritedProviderInstanceId && catalog.inheritedProviderInstanceId !== target.providerInstanceId &&
      provider.canRunCrossProviderChildTask !== true) {
    throw new Error(`Cross-provider delegation unavailable for ${label}: ${target.providerInstanceId}`);
  }
  const model = provider.models?.find((item) => item.id === target.model);
  if (!model) throw new Error(`Model unavailable for ${label}: ${target.providerInstanceId}/${target.model}. Available models: ${provider.models?.map((item) => item.id).join(', ') || 'none'}`);
  for (const [id, value] of Object.entries(target.options ?? {})) {
    const option = model.options?.find((item) => item.id === id);
    const valid = option?.type === 'boolean' ? typeof value === 'boolean' :
      option?.type === 'select' && typeof value === 'string' && option.options?.some((item) => item.id === value);
    if (!valid) {
      const allowed = option?.type === 'boolean' ? 'boolean' : option?.type === 'select' ? option.options?.map((item) => item.id).join(', ') : 'unknown option ID';
      throw new Error(`Unsupported model option for ${label} (${target.providerInstanceId}/${target.model}): ${id}=${value}. Allowed: ${allowed}`);
    }
  }
  return { ...target, ...(target.options ? { options: { ...target.options } } : {}) };
}

export function resolveConfig(config, catalog) {
  validateConfig(config);
  validateCatalog(catalog);
  const resolved = Object.fromEntries(roles.map((role) => [role, resolveRole(config, role, catalog)]));
  if (Array.isArray(config?.reviewPanel)) resolveTarget(config.roles.review, 'roles.review', catalog);
  return resolved;
}

function projectFile(project) {
  if (!project || !existsSync(project) || !statSync(project).isDirectory()) throw new Error(`Project directory unavailable: ${project}`);
  return resolve(project, '.astack/models.json');
}

function validateCatalog(catalog) {
  if (catalog !== undefined && (!isRecord(catalog) || !Array.isArray(catalog.providers))) {
    throw new Error('Invalid host catalog: expected a providers array from orchestrator_capabilities.');
  }
}

function readJson(file, validate) {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    validate(value);
    return value;
  } catch (error) { throw new Error(`${file}: ${error.message}`); }
}

const readConfig = (file) => existsSync(file) ? readJson(file, validateConfig) : undefined;

export function setupProject(project, choices = { roles: {} }, catalog) {
  const file = projectFile(project);
  if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`Setup will not replace symlinked model settings: ${file}. Update the project-owned target explicitly.`);
  }
  const saved = readConfig(file);
  validateConfig(choices);
  const config = {
    ...saved,
    roles: { ...Object.fromEntries(roles.map((role) => [role, 'inherit'])), ...saved?.roles, ...choices.roles },
  };
  if (choices.reviewPanel !== undefined) config.reviewPanel = choices.reviewPanel;
  resolveConfig(config, catalog);
  const directory = resolve(project, '.astack');
  mkdirSync(directory, { recursive: true });
  const temporary = mkdtempSync(join(directory, '.models-'));
  try {
    const staged = join(temporary, 'models.json');
    writeFileSync(staged, JSON.stringify(config, null, 2) + '\n');
    resolveConfig(readConfig(staged), catalog);
    renameSync(staged, file);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  const written = readConfig(file);
  return { config: written, resolved: resolveConfig(written, catalog) };
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    const setup = args[0] === '--setup';
    const [project, roleOrChoices, catalogFile] = setup ? args.slice(1) : args;
    if (!project || !roleOrChoices || args.length > (setup ? 4 : 3)) {
      throw new Error('Usage: models.mjs <project-dir> <role|--check> [catalog.json]\n       models.mjs --setup <project-dir> <choices.json> [catalog.json]');
    }
    const catalog = catalogFile ? readJson(catalogFile, validateCatalog) : undefined;
    let result;
    if (setup) result = setupProject(project, readJson(roleOrChoices, validateConfig), catalog);
    else {
      const file = projectFile(project);
      const config = readConfig(file);
      if (roleOrChoices === '--check' && config === undefined) throw new Error(`Model settings unavailable: ${file}. Run setup first.`);
      result = roleOrChoices === '--check' ? resolveConfig(config, catalog) : resolveRole(config, roleOrChoices, catalog);
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
