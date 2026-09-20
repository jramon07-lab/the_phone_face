'use strict';

const fs = require('node:fs');
const { setTimeout: wait } = require('node:timers/promises');
const CRM_HOST = /^the-phone-face-app-whatsapp(?:-[a-z0-9-]+)?\.vercel\.app$/;
const CANONICAL_ORIGIN = 'https://the-phone-face-app-whatsapp-fotos-y.vercel.app';

class ServiceConfigurationError extends Error {
  constructor() {
    super(`El despliegue esperado tiene CRM_STABLE_ORIGIN ausente, inválido o distinto del origen canónico ${CANONICAL_ORIGIN}. Corrige la configuración de ese entorno antes de activar los servicios.`);
    this.name = 'ServiceConfigurationError';
  }
}

function crmOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('La URL del CRM no es válida.'); }
  if (url.protocol !== 'https:' || !CRM_HOST.test(url.hostname) || url.port ||
      url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Solo se admite el origen HTTPS de un despliegue Vercel de este CRM.');
  }
  return url.origin;
}

function expectation(env = process.env) {
  const commit = String(env.E2E_EXPECTED_COMMIT || env.GITHUB_SHA || '').toLowerCase();
  const branch = String(env.E2E_EXPECTED_BRANCH || env.GITHUB_REF_NAME || '');
  const environment = String(env.E2E_EXPECTED_ENVIRONMENT || 'preview');
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Se exige el SHA completo del commit esperado.');
  if (!branch || /[\r\n]/.test(branch)) throw new Error('Falta la rama exacta esperada.');
  if (!['preview', 'production'].includes(environment)) throw new Error('Entorno esperado no permitido.');
  return { commit, branch, environment };
}

async function verifyHealth(origin, expected, bypass, fetcher = fetch, onHealth) {
  if (!bypass) throw new Error('Falta VERCEL_AUTOMATION_BYPASS_SECRET.');
  const response = await fetcher(new URL('/api/health', crmOrigin(origin)), {
    headers: { 'x-vercel-protection-bypass': bypass, Accept: 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store'
  });
  if (!response.ok) return false;
  const health = await response.json();
  if (onHealth) onHealth(health);
  const matches = health.ok === true && health.app === 'The Phone Face CRM' &&
    health.commit === expected.commit && health.branch === expected.branch &&
    health.environment === expected.environment;
  if (!matches) return false;
  if (health.service_origins?.telegram !== CANONICAL_ORIGIN) throw new ServiceConfigurationError();
  return true;
}

async function deploymentOrigins(repo, commit, token, fetcher = fetch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !token) {
    throw new Error('Falta el contexto de GitHub para localizar el despliegue.');
  }
  async function github(path) {
    const response = await fetcher(`https://api.github.com/repos/${repo}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }, redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`No se pudo consultar GitHub: HTTP ${response.status}.`);
    return response.json();
  }
  const deployments = await github(`deployments?sha=${encodeURIComponent(commit)}&per_page=100`);
  const origins = [];
  for (const deployment of deployments.filter(row => row.sha === commit).slice(0, 12)) {
    if (!Number.isSafeInteger(deployment.id)) continue;
    const statuses = await github(`deployments/${deployment.id}/statuses?per_page=20`);
    for (const status of statuses.filter(row => row.state === 'success')) {
      for (const value of [status.environment_url, status.target_url]) {
        try { origins.push(crmOrigin(value)); } catch { /* Dashboard URLs are not CRM origins. */ }
      }
    }
  }
  return [...new Set(origins)];
}

async function main() {
  const expected = expectation();
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypass) throw new Error('Falta VERCEL_AUTOMATION_BYPASS_SECRET.');
  const target = process.env.SERVICE_TARGET_URL ? crmOrigin(process.env.SERVICE_TARGET_URL) : '';
  if (expected.environment === 'production' && !target) {
    throw new Error('La comprobación de producción exige target_url explícito.');
  }
  const until = Date.now() + 12 * 60 * 1000;
  let attempt = 0;
  while (Date.now() < until) {
    attempt += 1;
    const origins = target ? [target] : await deploymentOrigins(
      process.env.GITHUB_REPOSITORY, expected.commit, process.env.GITHUB_TOKEN
    );
    for (const origin of origins) {
      let valid = false, serviceOrigins = {};
      try { valid = await verifyHealth(origin, expected, bypass, fetch, health => {
        for (const key of ['canonical', 'telegram', 'google_contacts', 'google_drive_backups', 'google_drive_documents']) {
          try { serviceOrigins[key] = crmOrigin(health.service_origins?.[key]); } catch { serviceOrigins[key] = 'unrecognized-or-missing'; }
        }
      }); } catch (error) {
        if (error instanceof ServiceConfigurationError) throw error;
        /* A cold deployment or a temporary network failure can retry. */
      }
      if (!valid) continue;
      const exported = {
        VERCEL_PREVIEW_URL: origin,
        E2E_EXPECTED_COMMIT: expected.commit,
        E2E_EXPECTED_BRANCH: expected.branch,
        E2E_EXPECTED_ENVIRONMENT: expected.environment
      };
      if (process.env.GITHUB_ENV) {
        fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(exported).map(([key, value]) => `${key}=${value}\n`).join(''));
      }
      console.log(`SERVICE_DEPLOYMENT_VERIFIED ${JSON.stringify({ ...expected, origin, serviceOrigins })}`);
      return;
    }
    console.log(`Esperando el despliegue exacto: intento ${attempt}, candidatos ${origins.length}.`);
    await wait(15000);
  }
  throw new Error('No se encontró un CRM READY con commit, rama y entorno exactos. No se ejecutan pruebas en otra versión.');
}

module.exports = { crmOrigin, expectation, verifyHealth, deploymentOrigins, ServiceConfigurationError, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
