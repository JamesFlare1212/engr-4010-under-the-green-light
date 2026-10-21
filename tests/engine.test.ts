import { describe, test, expect } from 'bun:test';
import { execute, newRoom, settle, tierFor, validateArchive, GameFault } from '../server/engine';
import { objectives, type Room, type Check, type Objective, type Tier } from '../shared/types';
import { tracks } from '../shared/content';

function setup(mode: 'full' | 'short' = 'short', count = 2) {
  const room = newRoom('1234', 'GM', { mode, gmCount: 1, dice: 'physical' });
  for (let i = 0; i < count; i++) room.members.push({ id: `player-${i}`, name: `Player ${i}`, role: 'player', character: 'engineer', leads: 0, joinedAt: Date.now() });
  const gm = room.members[0]!, players = room.members.slice(1);
  const run = (type: string, payload: unknown = {}) => execute(room, gm, type, payload);
  const vote = (option: string) => { const poll = room.polls.at(-1)!; for (const player of players) execute(room, player, 'vote', { pollId: poll.id, option }); run('close_vote', { pollId: poll.id }); };
  function roll(objective: Objective, die = 10, bonus = 2, creative = 0) {
    run('open_check', { objective, action: 'preset-plan', backup: 'backup-manual', bonus, bonusReason: '', creative });
    const check = room.checks.at(-1)!;
    for (const player of players) execute(room, player, 'volunteer', { checkId: check.id, willing: true });
    run('roll', { checkId: check.id, die }); return check;
  }
  return { room, run, vote, roll, gm, players };
}
function bareCheck(): Check {
  return { id: 'test', kind: 'execution', objective: 'access', action: 'plan', backup: 'backup', bonus: 2, bonusReason: 'engineering', creative: 0, preparation: 0, eligible: [], responses: {}, leadId: null, supportId: null, status: 'selected', result: null, narrative: '', correctionReason: '' };
}
describe('DC and five outcome tiers', () => {
  test.each([[-6, 'consequences'], [-5, 'consequences'], [-4, 'twist'], [-3, 'twist'], [-2, 'near_miss'], [-1, 'near_miss'], [0, 'success'], [1, 'success'], [2, 'success'], [3, 'boon']])('delta %s maps to %s', (delta, tier) => expect(tierFor(Number(delta))).toBe(tier as Tier));
  test('a roll of 10 plus engineering 2 meets DC 12 and uses the greater preparation or creative reduction', () => {
    const check = bareCheck(); expect(settle(check, 10)).toMatchObject({ total: 12, dc: 12, rawTier: 'success' });
    check.preparation = 2; check.creative = 2; expect(settle(check, 10).dc).toBe(10);
  });
  test('a natural 1 uses the normal delta calculation without an extra penalty', () => { const check = bareCheck(); check.bonus = 3; check.preparation = 2; expect(settle(check, 1)).toMatchObject({ die: 1, total: 4, dc: 10, delta: -6 }); });
});
describe('full and short playthroughs with independent consequences', () => {
  test('full mode has three preparation checks and three execution checks and preserves rescue options and evidence after low rolls', () => {
    const f = setup('full', 6); f.run('next'); f.run('next');
    expect(f.room.evidence).toHaveLength(3);
    expect(() => f.run('next')).toThrow();
    for (const objective of objectives) { const c = f.roll(objective, 1); expect(c.result?.tier).toBe('consequences'); }
    expect(f.room.emergencyKits).toBe(2); f.run('next'); f.vote('both'); f.run('next'); f.vote('high_line'); f.run('next');
    for (const objective of objectives) { f.roll(objective, 1); f.vote('keep'); }
    f.run('next'); expect(f.room.phase).toBe('ending'); expect(f.room.evidence).toHaveLength(3);
    expect(tracks(f.room)).toMatchObject({ evacuated: 8, waiting: 4, isolation: 'unverified-damage' });
  });
  test('short mode skips preparation rolls, preserves kits and base DCs and records partners', () => {
    const f = setup(); f.run('next'); f.run('next'); expect(() => f.roll('access')).toThrow();
    f.run('next'); f.vote('both'); f.run('next'); f.vote('quiet_water'); f.run('next');
    const c = f.roll('access', 10); expect(c.result?.dc).toBe(12); expect(c.supportId).not.toBe(c.leadId);
    expect(f.room.emergencyKits).toBe(2); expect(f.room.members.filter(m => m.leads === 1)).toHaveLength(2);
  });
  test('failed isolation never reverses successful evacuation or changes report truthfulness', () => {
    const f = setup(); f.room.phase = 'execution';
    f.roll('evacuation', 10); const before = tracks(f.room); f.roll('isolation', 1); f.vote('keep');
    expect(tracks(f.room)).toMatchObject({ evacuated: 12, waiting: 0, isolation: 'unverified-damage' });
    expect(before.evacuated).toBe(12); expect(f.room.report.truthfulness).toBe('unreviewed');
  });
  test('custom routes and reordered execution checks preserve base DCs', () => {
    const f = setup(); f.room.phase = 'route_choice'; f.run('custom_route', { plan: 'Hybrid route', costs: 'Battery replacement', assumptions: 'Check anchors' }); f.run('route_vote'); f.vote('custom'); f.run('next');
    expect(f.room.route).toBe('custom'); expect(f.roll('isolation', 11).result?.dc).toBe(13); expect(f.roll('evacuation', 10).result?.dc).toBe(12); expect(f.roll('access', 10).result?.dc).toBe(12);
  });
});
describe('kits, roll permissions and voting boundaries', () => {
  test('a delta of -3 improves from twist to near miss only once and cannot spend another kit', () => {
    const f = setup(); f.room.phase = 'execution'; const check = f.roll('access', 7); expect(check.result?.rawTier).toBe('twist');
    f.vote('spend'); expect(check.result).toMatchObject({ rawTier: 'twist', tier: 'near_miss', kitSpent: true }); expect(f.room.emergencyKits).toBe(1);
    expect(() => f.run('kit_vote', { checkId: check.id })).toThrow(); expect(f.room.emergencyKits).toBe(1);
  });
  test('successful checks cannot waste kits and failed preparation checks cannot use remediation', () => {
    const f = setup(); f.room.phase = 'execution'; const c = f.roll('access'); expect(() => f.run('kit_vote', { checkId: c.id })).toThrow(); expect(f.room.emergencyKits).toBe(2);
    const full = setup('full'); full.room.phase = 'investigation'; const p = full.roll('access', 1); expect(() => full.run('kit_vote', { checkId: p.id })).toThrow();
  });
  test('GM corrections refund the action kit while preserving its original DC and reason', () => {
    const f = setup(); f.room.phase = 'execution'; const c = f.roll('access', 7); f.vote('spend');
    f.run('correct_die', { checkId: c.id, die: 10, reason: 'Misread physical die' });
    expect(f.room.emergencyKits).toBe(2); expect(c.result).toMatchObject({ die: 10, dc: 12, tier: 'success', kitSpent: false }); expect(c.correctionReason).toBeTruthy();
  });
  test('only the selected player can roll virtual dice and GM input is limited to physical dice', () => {
    const f = setup(); f.room.phase = 'execution'; f.room.settings.dice = 'virtual';
    f.run('open_check', { objective: 'access', action: 'plan', backup: 'backup', bonus: 0, bonusReason: '', creative: 0 });
    const c = f.room.checks[0]!; execute(f.room, f.players[0]!, 'volunteer', { checkId: c.id, willing: true }); execute(f.room, f.players[1]!, 'volunteer', { checkId: c.id, willing: false });
    expect(c.leadId).toBe(f.players[0]!.id); expect(() => execute(f.room, f.players[1]!, 'roll', { checkId: c.id })).toThrow(); expect(() => f.run('roll', { checkId: c.id, die: 20 })).toThrow();
    execute(f.room, f.players[0]!, 'roll', { checkId: c.id, die: 20 }); expect(c.result!.die).toBeGreaterThanOrEqual(1); expect(c.result!.die).toBeLessThanOrEqual(20);
    expect(() => execute(f.room, f.players[0]!, 'roll', { checkId: c.id })).toThrow();
  });
  test.each([0, 21, 2.5, NaN])('physical dice reject %s', die => { const f = setup(); f.room.phase = 'execution'; f.run('open_check', { objective: 'access', action: 'plan', backup: 'backup', bonus: 0, bonusReason: '', creative: 0 }); expect(() => f.run('roll', { checkId: f.room.checks[0]!.id, die })).toThrow(); });
  test('reopening recruitment after a lead disconnects revokes roll permission for the former lead', () => {
    const f = setup(); f.room.phase = 'execution'; f.room.settings.dice = 'virtual'; f.run('open_check', { objective: 'access', action: 'plan', backup: 'backup', bonus: 0, bonusReason: '', creative: 0 });
    const c = f.room.checks[0]!; execute(f.room, f.players[0]!, 'volunteer', { checkId: c.id, willing: true }); f.run('select_lead', { checkId: c.id }); f.run('recruit_again', { checkId: c.id });
    expect(() => execute(f.room, f.players[0]!, 'roll', { checkId: c.id })).toThrow(); expect(c.responses).toEqual({});
  });
  test('ties never choose a random route and require a GM reason and a tied option', () => {
    const f = setup(); f.room.phase = 'route_choice'; f.run('route_vote'); const poll = f.room.polls[0]!;
    execute(f.room, f.players[0]!, 'vote', { pollId: poll.id, option: 'high_line' }); execute(f.room, f.players[1]!, 'vote', { pollId: poll.id, option: 'quiet_water' });
    f.run('close_vote', { pollId: poll.id });
    expect(poll.tied).toHaveLength(2); expect(f.room.route).toBeNull(); expect(() => f.run('next')).toThrow();
    expect(() => f.run('resolve_tie', { pollId: poll.id, option: 'borrowed_channel', reason: 'arbitrary' })).toThrow();
    f.run('resolve_tie', { pollId: poll.id, option: 'high_line', reason: 'Discussed anchor evidence' }); expect(f.room.route).toBe('high_line');
  });
  test('headcount and factual corrections cannot make workers disappear', () => { const f = setup(); f.room.phase = 'ending'; expect(() => f.run('override_tracks', { evacuated: 7, waiting: 4, observation: 0, isolation: 'verified', clinic: 'complete', reason: 'bad count' })).toThrow(); });
});
describe('save validation', () => {
  test('save round trips preserve action IDs, original and effective tiers, resources and reports', () => {
    const f = setup(); f.room.phase = 'execution'; const c = f.roll('access', 7); f.vote('spend'); f.room.report.statement = 'Actual words';
    const restored = validateArchive(JSON.parse(JSON.stringify({ format: 'green-light-save', version: 1, room: f.room })));
    expect(restored.checks[0]!.id).toBe(c.id); expect(restored.checks[0]!.result?.rawTier).toBe('twist'); expect(restored.checks[0]!.result?.tier).toBe('near_miss'); expect(restored.emergencyKits).toBe(1); expect(restored.report.statement).toBe('Actual words');
  });
  test('reject future save versions and tampered resources or calculations', () => {
    const f = setup(); expect(() => validateArchive({ format: 'green-light-save', version: 2, room: f.room })).toThrow();
    f.room.phase = 'execution'; f.roll('access'); f.room.emergencyKits = 1; expect(() => validateArchive({ format: 'green-light-save', version: 1, room: f.room })).toThrow();
    f.room.emergencyKits = 2; f.room.checks[0]!.result!.dc = 20; expect(() => validateArchive({ format: 'green-light-save', version: 1, room: f.room })).toThrow();
  });
});

test('editing an approved custom plan clears the route selection and automatically reopens voting', () => {
  const f = setup(); f.room.phase = 'route_choice';
  f.run('custom_route', { plan: 'Hybrid', costs: 'Battery', assumptions: 'Anchors' }); f.vote('custom'); expect(f.room.route).toBe('custom');
  f.run('custom_route', { plan: 'Revised hybrid', costs: 'Additional restoration', assumptions: 'Verify channel' });
  expect(f.room.route).toBeNull(); expect(f.room.polls.at(-1)!.status).toBe('open'); expect(f.room.polls.at(-1)!.ballots).toEqual({}); expect(() => f.run('next')).toThrow();
});
test('removing a nonvoter preserves existing ballots and still waits for the GM to close voting', () => {
  const f = setup(); f.room.phase = 'route_choice'; f.run('route_vote'); const poll = f.room.polls.at(-1)!;
  execute(f.room, f.players[0]!, 'vote', { pollId: poll.id, option: 'quiet_water' });
  f.run('role', { memberId: f.players[1]!.id, role: 'spectator' }); expect(poll.status).toBe('open'); expect(f.room.route).toBeNull();
  f.run('close_vote', { pollId: poll.id }); expect(poll.status).toBe('closed'); expect(f.room.route).toBe('quiet_water');
});

test.each(['decision', 'route', 'kit'])('%s votes remain editable after everyone votes and resolve and lock only when the GM closes voting', kind => {
  const f = setup();
  if (kind === 'decision') { f.room.phase = 'investigation'; f.run('next'); }
  else if (kind === 'route') { f.room.phase = 'route_choice'; f.run('route_vote'); }
  else { f.room.phase = 'execution'; f.roll('access', 7); }
  const poll = f.room.polls.at(-1)!, first = poll.options[0]!.id, second = poll.options[1]!.id;
  for (const p of f.players) execute(f.room, p, 'vote', { pollId: poll.id, option: first });
  expect(poll.status).toBe('open'); expect(poll.outcome).toBeNull(); expect(f.room.emergencyKits).toBe(2);
  expect(() => execute(f.room, f.players[0]!, 'close_vote', { pollId: poll.id })).toThrow();
  for (const p of f.players) execute(f.room, p, 'vote', { pollId: poll.id, option: second });
  expect(Object.values(poll.ballots)).toEqual([second, second]);
  f.run('close_vote', { pollId: poll.id });
  expect(poll.status).toBe('closed'); expect(poll.outcome).toBe(second);
  expect(() => execute(f.room, f.players[0]!, 'vote', { pollId: poll.id, option: first })).toThrow();
  if (kind === 'kit') expect(f.room.emergencyKits).toBe(2);
});

test('removing all eligible members never closes voting automatically and a GM can close an empty vote without a false outcome', () => {
  const f = setup(); f.room.phase = 'route_choice'; f.run('route_vote'); const poll = f.room.polls.at(-1)!;
  for (const p of f.players) f.run('role', { memberId: p.id, role: 'spectator' });
  expect(poll.status).toBe('open'); expect(poll.eligible).toEqual([]);
  f.run('close_vote', { pollId: poll.id });
  expect(poll.status).toBe('closed'); expect(poll.outcome).toBeNull(); expect(poll.tied).toEqual([]); expect(f.room.route).toBeNull();
});
