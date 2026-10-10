import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const roles = ['research', 'design', 'implementation', 'review'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateConfig(config) {
  if (config === undefined) return;
  if (!isRecord(config) || Object.keys(config).some((key) => key !== 'roles') || !isRecord(config.roles)) {
    throw new Error('Expected an object with a roles map.');
  }
  for (const [role, target] of Object.entries(config.roles)) {
    if (!roles.includes(role)) throw new Error(`Unknown model role: ${role}`);
    if (target === 'inherit') continue;
    if (!isRecord(target) || Object.keys(target).some((key) => !['providerInstanceId', 'model', 'options'].includes(key)) ||
        !nonempty(target.providerInstanceId) || !nonempty(target.model)) {
      throw new Error(`Invalid target for ${role}: use inherit or providerInstanceId/model/options.`);
    }
    if (target.options !== undefined && (!isRecord(target.options) ||
        Object.values(target.options).some((value) => typeof value !== 'string' && typeof value !== 'boolean'))) {
      throw new Error(`Invalid options for ${role}: use string or boolean values.`);
    }
  }
}

export function resolveRole(config, role, catalog) {
  validateConfig(config);
  if (!roles.includes(role)) throw new Error(`Unknown model role: ${role}`);
  const target = config?.roles[role];
  if (target === undefined || target === 'inherit') return null;
  const provider = catalog?.providers?.find((item) => item.providerInstanceId === target.providerInstanceId);
  if (!provider || provider.canRunChildTask !== true) throw new Error(`Provider unavailable for ${role}: ${target.providerInstanceId}`);
  const model = provider.models?.find((item) => item.id === target.model);
  if (!model) throw new Error(`Model unavailable for ${role}: ${target.model}`);
  for (const [id, value] of Object.entries(target.options ?? {})) {
    const option = model.options?.find((item) => item.id === id);
    const valid = option?.type === 'boolean' ? typeof value === 'boolean' :
      option?.type === 'select' && typeof value === 'string' && option.options?.some((item) => item.id === value);
    if (!valid) throw new Error(`Unsupported model option for ${role}: ${id}=${value}`);
  }
  return { ...target, ...(target.options ? { options: { ...target.options } } : {}) };
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const [project, role, catalogFile] = process.argv.slice(2);
    if (!project || !role) throw new Error('Usage: models.mjs <project-dir> <role> [catalog.json]');
    if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error(`Project directory unavailable: ${project}`);
    const file = resolve(project, '.astack/models.json');
    const config = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
    const catalog = catalogFile ? JSON.parse(readFileSync(catalogFile, 'utf8')) : undefined;
    console.log(JSON.stringify(resolveRole(config, role, catalog)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
