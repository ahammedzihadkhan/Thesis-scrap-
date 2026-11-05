import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplatePayload, configProblem, sendAll, CloudApiConfig } from './whatsappCloudApi';

const cfg: CloudApiConfig = { phoneNumberId: '1234567890', accessToken: 'EAAG' + 'x'.repeat(40), templateName: 'eid_offer', languageCode: 'bn', includeCode: true };

test('config validation and template payload', () => {
  assert.equal(configProblem(cfg), null);
  assert.match(configProblem({ ...cfg, phoneNumberId: '+8801711234567' })!, /numeric ID/);
  assert.match(configProblem({ ...cfg, templateName: 'Eid Offer' })!, /Template name/);
  const p = buildTemplatePayload(cfg, { phone: '+880 1711-234567', name: 'Rahim', code: 'EID10' });
  assert.equal(p.to, '8801711234567');
  assert.equal(p.type, 'template');
  assert.deepEqual(p.template.components[0].parameters.map((x) => x.text), ['Rahim', 'EID10']);
  assert.equal(buildTemplatePayload({ ...cfg, includeCode: false }, { phone: '1', name: 'A' }).template.components[0].parameters.length, 1);
});

test('sendAll reports each result and stops when the first three all fail', async () => {
  const people = Array.from({ length: 10 }, (_, i) => ({ phone: `88017000000${i}`, name: `C${i}` }));
  let calls = 0;
  const okFetch = (async () => { calls++; return new Response('{}', { status: 200 }); }) as typeof fetch;
  const r1 = await sendAll(cfg, people, () => {}, () => false, 0, okFetch);
  assert.equal(r1.filter((x) => x.ok).length, 10);

  calls = 0;
  const badFetch = (async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Template not found' } }), { status: 400 }); }) as typeof fetch;
  const r2 = await sendAll(cfg, people, () => {}, () => false, 0, badFetch);
  assert.equal(calls, 3, 'stops after three failures instead of failing ten times');
  assert.equal(r2[0].error, 'Template not found');

  let n = 0;
  const r3 = await sendAll(cfg, people, () => { n++; }, () => n >= 4, 0, okFetch);
  assert.equal(r3.length, 4, 'Stop button halts the run');
});
