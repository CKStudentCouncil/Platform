import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

// Run against the Firestore emulator after loading firebase/firestore.rules:
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 node --test firebase/tests/proposal-rules.test.mjs
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(host, 'FIRESTORE_EMULATOR_HOST must point to a running Firestore emulator');
const project = process.env.FIREBASE_PROJECT_ID ?? 'demo-platform-rules';
const documents = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const run = randomUUID();
const ownerId = `proposal-owner-${run}`;
const types = ['law', 'general', 'presentation'];

function token(uid, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    sub: uid,
    user_id: uid,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    firebase: { identities: {}, sign_in_provider: 'custom' },
    ...claims,
  })}.`;
}

const owner = token(ownerId, { role: 25, clazz: '101' });
const secretary = token(`secretary-${run}`, { role: 100, clazz: '102' });
const classRep = token(`class-rep-${run}`, { role: 50, clazz: '103' });
const department = token(`department-${run}`, { role: 25, clazz: '104' });
const unprovisioned = token(`unprovisioned-${run}`);
const anonymousRole = token(`anonymous-role-${run}`, { role: 0 });

function value(data) {
  if (data === null) return { nullValue: null };
  if (data instanceof Date) return { timestampValue: data.toISOString() };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(value) } };
  if (typeof data === 'object') return { mapValue: { fields: fields(data) } };
  if (typeof data === 'boolean') return { booleanValue: data };
  if (typeof data === 'number') return { integerValue: String(data) };
  return { stringValue: data };
}

const fields = (data) => Object.fromEntries(Object.entries(data).map(([key, entry]) => [key, value(entry)]));

async function request(method, path, auth, data, partial = false) {
  const url = new URL(`${documents}/${path}`);
  if (partial) Object.keys(data).forEach((key) => url.searchParams.append('updateMask.fieldPaths', key));
  const response = await fetch(url, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify({ fields: fields(data) }) } : {}),
  });
  const body = await response.json();
  return { status: response.status, body, description: `${method} ${path}` };
}

function allowed(result) {
  assert.equal(result.status, 200, `${result.description}: ${JSON.stringify(result.body)}`);
  return result.body;
}

function denied(result) {
  assert.equal(result.status, 403, `${result.description} should be denied: ${JSON.stringify(result.body)}`);
}

const get = (path, auth) => request('GET', path, auth);
const put = (path, auth, data) => request('PATCH', path, auth, data);
const patch = (path, auth, data) => request('PATCH', path, auth, data, true);
const remove = (path, auth) => request('DELETE', path, auth);
const seed = async (path, data) => allowed(await put(path, 'owner', data));
const proposalPath = (type, id) => `proposal/${type}/${ownerId}/${id}`;
const proposal = () => ({
  title: 'Test proposal',
  content: 'Proposal explanation',
  proposer: 'Owner',
  reign: 'test',
  uploadedAt: new Date(),
  done: false,
  cosigners: [],
});
const previousSigner = { classNum: '101', jobTitle: '班代', name: 'Existing signer' };
const ownSigner = { classNum: '103', jobTitle: '班代', name: 'New signer' };

test('proposal access matches the owner, management, and shared-link workflows', async (t) => {
  for (const type of types) {
    await t.test(`${type}: owner can create, list, submit, and delete`, async () => {
      const path = proposalPath(type, 'owner-lifecycle');
      allowed(await put(path, owner, proposal()));
      const listed = allowed(await get(`proposal/${type}/${ownerId}`, owner));
      assert.ok(listed.documents.some((document) => document.name.endsWith('/owner-lifecycle')));
      allowed(await patch(path, owner, { submittedAt: new Date(), done: false }));
      assert.ok(allowed(await get(path, owner)).fields.submittedAt.timestampValue);
      allowed(await remove(path, owner));
    });

    await t.test(`${type}: secretary can list, read, mark done, and delete another owner's proposal`, async () => {
      const path = proposalPath(type, 'management');
      await seed(path, proposal());
      const listed = allowed(await get(`proposal/${type}/${ownerId}`, secretary));
      assert.ok(listed.documents.some((document) => document.name.endsWith('/management')));
      allowed(await get(path, secretary));
      allowed(await patch(path, secretary, { done: true }));
      assert.equal(allowed(await get(path, secretary)).fields.done.booleanValue, true);
      denied(await put(proposalPath(type, 'manager-created'), secretary, proposal()));
      allowed(await remove(path, secretary));
    });

    await t.test(`${type}: unauthenticated and unprovisioned callers cannot access proposals`, async () => {
      const path = proposalPath(type, 'protected');
      await seed(path, proposal());
      for (const auth of [undefined, unprovisioned, anonymousRole]) {
        denied(await get(path, auth));
        denied(await get(`proposal/${type}/${ownerId}`, auth));
        denied(await put(proposalPath(type, 'unauthorized-create'), auth, proposal()));
        denied(await patch(path, auth, { title: 'Changed' }));
        denied(await remove(path, auth));
      }
    });

    await t.test(`${type}: a shared link permits a get, without granting another owner's collection or edits`, async () => {
      const path = proposalPath(type, 'shared');
      await seed(path, proposal());
      for (const auth of [classRep, department]) {
        allowed(await get(path, auth));
        denied(await get(`proposal/${type}/${ownerId}`, auth));
        denied(await put(proposalPath(type, 'foreign-create'), auth, proposal()));
        denied(await patch(path, auth, { title: 'Changed' }));
        denied(await remove(path, auth));
      }
      denied(await patch(path, department, { cosigners: [{ ...ownSigner, classNum: '104' }] }));
    });

    await t.test(`${type}: a class representative can append only their own co-signature`, async () => {
      const path = proposalPath(type, 'cosign');
      await seed(path, { ...proposal(), cosigners: [previousSigner] });
      allowed(await patch(path, classRep, { cosigners: [previousSigner, ownSigner] }));
      const actual = allowed(await get(path, classRep)).fields.cosigners.arrayValue.values;
      assert.deepEqual(actual, [value(previousSigner), value(ownSigner)]);

      const legacyPath = proposalPath(type, 'no-cosigners-field');
      const legacy = proposal();
      delete legacy.cosigners;
      await seed(legacyPath, legacy);
      allowed(await patch(legacyPath, classRep, { cosigners: [ownSigner] }));
    });

    await t.test(`${type}: malformed or wider co-signature changes are rejected`, async () => {
      const path = proposalPath(type, 'invalid-cosign');
      await seed(path, { ...proposal(), cosigners: [previousSigner] });
      const invalid = [
        { cosigners: [previousSigner, { ...ownSigner, classNum: '999' }] },
        { cosigners: [{ ...previousSigner, name: 'Rewritten' }, ownSigner] },
        { cosigners: [previousSigner, ownSigner], title: 'Changed too' },
        { cosigners: [previousSigner, ownSigner, { ...ownSigner, name: 'Second' }] },
        { cosigners: [] },
        { cosigners: [previousSigner] },
        { cosigners: [previousSigner, 'Not a person record'] },
        { cosigners: [previousSigner, { classNum: '103', name: 'Missing job title' }] },
        { cosigners: [previousSigner, { ...ownSigner, extra: true }] },
        { cosigners: [previousSigner, { ...ownSigner, jobTitle: 50 }] },
        { cosigners: [previousSigner, { ...ownSigner, name: '' }] },
        { cosigners: [previousSigner, { ...ownSigner, name: 123 }] },
      ];
      for (const change of invalid) denied(await patch(path, classRep, change));
    });
  }

  await t.test('unknown proposal types remain inaccessible', async () => {
    const path = proposalPath('unknown', 'unsupported');
    await seed(path, proposal());
    denied(await get(path, secretary));
    denied(await get(`proposal/unknown/${ownerId}`, secretary));
    denied(await put(proposalPath('unknown', 'owner-create'), owner, proposal()));
    denied(await patch(path, owner, { title: 'Changed' }));
    denied(await remove(path, secretary));
  });
});

test('existing meeting permissions still allow management and narrow own-class participation', async (t) => {
  const meetingPath = `meetings/rules-${run}`;
  const agendaPath = `${meetingPath}/proposals/agenda`;
  const votePath = `${agendaPath}/votables/vote`;

  await t.test('provisioned users can read meetings; management can write them', async () => {
    allowed(
      await put(meetingPath, secretary, {
        name: 'Rules smoke test',
        start: new Date('2099-01-01T00:00:00Z'),
        active: true,
        activeProposal: 'agenda',
        participants: ['102'],
        absences: {},
      }),
    );
    allowed(await get(meetingPath, owner));
    allowed(await get(meetingPath, classRep));
    for (const auth of [undefined, unprovisioned, anonymousRole]) denied(await get(meetingPath, auth));
    denied(await patch(meetingPath, owner, { name: 'Not management' }));
    denied(await patch(meetingPath, classRep, { name: 'Not management' }));
    allowed(await patch(meetingPath, secretary, { name: 'Managed meeting' }));
  });

  await t.test('class representatives can punch in and schedule absence only for their own class', async () => {
    allowed(await patch(meetingPath, classRep, { participants: ['102', '103'] }));
    denied(await patch(meetingPath, classRep, { participants: ['102', '103', '104'] }));
    const absence = { reason: 'Test absence', scheduledAt: new Date() };
    allowed(await patch(meetingPath, classRep, { absences: { 103: absence } }));
    denied(await patch(meetingPath, classRep, { absences: { 103: absence, 104: absence } }));
  });

  await t.test('class representatives can request to speak and vote only for their own class', async () => {
    allowed(await put(agendaPath, secretary, { activeVotable: 'vote', speakRequests: [] }));
    allowed(await patch(agendaPath, classRep, { speakRequests: ['103'] }));
    denied(await patch(agendaPath, classRep, { speakRequests: ['103', '104'] }));
    allowed(await put(votePath, secretary, { choices: ['approve', 'reject'], results: { approve: [], reject: [] }, voters: {} }));
    denied(await patch(votePath, classRep, { results: { approve: ['104'], reject: [] }, voters: { 104: 'approve' } }));
    allowed(await patch(votePath, classRep, { results: { approve: ['103'], reject: [] }, voters: { 103: 'approve' } }));
    denied(await patch(votePath, classRep, { results: { approve: [], reject: ['103'] }, voters: { 103: 'reject' } }));
    denied(await remove(votePath, classRep));
    allowed(await remove(votePath, secretary));
    allowed(await remove(agendaPath, secretary));
    allowed(await remove(meetingPath, secretary));
  });
});
