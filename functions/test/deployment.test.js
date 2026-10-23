import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const enabled of [false, true]) {
  test(`deployment discovers email secrets only when product emails are enabled=${enabled}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { declaredParams } from 'firebase-functions/params';
      const functions = await import('./src/index.js');
      console.log(JSON.stringify({
        emailWorker: typeof functions.deliverEmail === 'function',
        secrets: declaredParams.map(param => param.name),
        apiSecrets: functions.api.__endpoint.secretEnvironmentVariables.map(secret => secret.key),
      }));
    `], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, ENABLE_PRODUCT_EMAILS: String(enabled), FIREBASE_CONFIG: '{"projectId":"demo-vela-virtual"}', GCLOUD_PROJECT: 'demo-vela-virtual' },
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.emailWorker, enabled);
    assert.equal(manifest.secrets.includes('EMAIL_API_KEY'), enabled);
    assert.equal(manifest.secrets.includes('EMAIL_FROM'), enabled);
    assert.deepEqual(manifest.apiSecrets, ['ABACATE_API_KEY', 'ABACATE_WEBHOOK_SECRET']);
  });
}
