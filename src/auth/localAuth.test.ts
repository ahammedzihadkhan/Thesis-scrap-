import test from 'node:test';
import assert from 'node:assert/strict';
import { register, login, currentSession, logout, listUsers, passwordProblem, MAX_ATTEMPTS, LOCKOUT_MS, TEST_ACCOUNT, ensureTestAccount, hasOwner, hasTestAccount, removeTestAccount } from './localAuth';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test('password policy: length only', () => {
  assert.ok(passwordProblem('abc'), 'fewer than 4 characters is rejected');
  for (const pw of ['1234', 'abcd', 'rahim2024']) assert.equal(passwordProblem(pw), null);
});

test('register stores only a salted hash, login works, wrong password fails', async () => {
  const ls = mem(), ss = mem();
  await register('Owner', 'shop-secret-9', ls, ss);
  const [u] = listUsers(ls);
  assert.equal(u.username, 'owner');
  assert.ok(!JSON.stringify(listUsers(ls)).includes('shop-secret-9'), 'plain password is never stored');
  assert.equal(Buffer.from(u.salt, 'base64').length, 16);

  await assert.rejects(login('owner', 'wrong-pass-1', ls, ss), /Wrong username or password/);
  await assert.rejects(login('nobody', 'shop-secret-9', ls, ss), /Wrong username or password/, 'same message for unknown users');
  const s = await login('OWNER ', 'shop-secret-9', ls, ss);
  assert.equal(currentSession(ss)?.username, 'owner');
  assert.equal(currentSession(ss, s.expiresAt + 1), null, 'session expires');
  logout(ss);
  assert.equal(currentSession(ss), null);
});

test('only a signed-in user can add more accounts', async () => {
  const ls = mem(), ss = mem();
  await register('owner', 'shop-secret-9', ls, ss);
  await assert.rejects(register('intruder', 'other-pass-11', ls, ss), /signed-in/);
  await login('owner', 'shop-secret-9', ls, ss);
  await register('Staff One', '1234', ls, ss);
  assert.deepEqual(listUsers(ls).map((u) => u.username), ['owner', 'staff one']);
});

test('test account: created once, cannot add accounts once an owner exists, stays removed', async () => {
  const ls = mem(), ss = mem();
  await Promise.all([ensureTestAccount(ls), ensureTestAccount(ls)]);
  assert.deepEqual(listUsers(ls).map((u) => u.username), ['test'], 'one test account, even with two parallel calls');
  assert.ok(hasTestAccount(ls) && !hasOwner(ls));
  await login(TEST_ACCOUNT.username, TEST_ACCOUNT.password, ls, ss);
  logout(ss);

  await register('owner', 'shop-secret-9', ls, ss); // the first real account needs no sign-in
  assert.ok(hasOwner(ls));
  await login('test', 'test1234', ls, ss);
  await assert.rejects(register('friend', '1234', ls, ss), /test account cannot/);

  removeTestAccount(ls);
  await ensureTestAccount(ls);
  assert.deepEqual(listUsers(ls).map((u) => u.username), ['owner'], 'a removed test account does not come back');
  await assert.rejects(login('test', 'test1234', ls, ss), /Wrong username or password/);
});

test('lockout after repeated failures', async () => {
  const ls = mem(), ss = mem();
  await register('owner', 'shop-secret-9', ls, ss);
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_ATTEMPTS; i++) await assert.rejects(login('owner', 'nope-nope-1', ls, ss, t0));
  await assert.rejects(login('owner', 'shop-secret-9', ls, ss, t0 + 1000), /Too many attempts/, 'even the right password waits');
  await login('owner', 'shop-secret-9', ls, ss, t0 + LOCKOUT_MS + 1);
});
