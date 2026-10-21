import { z } from 'zod';
import { randomInt } from 'node:crypto';
import { bi, phases, objectives, tiers, type Room, type Member, type Objective, type Tier, type Check, type Poll, type Text, type Settings } from '../shared/types';
import { baseDC, phaseLabels, objectiveLabels, routes, evidence, negotiationOptions, tracks, isolationLabels, clinicLabels } from '../shared/content';

export class GameFault extends Error {
  constructor(public code: string, public messageText: Text, public status = 400) { super(messageText.en); }
}
export function requireThat(condition: unknown, zh: string, en: string, code = 'invalid', status = 400): asserts condition {
  if (!condition) throw new GameFault(code, bi(zh, en), status);
}
export const settingsSchema = z.object({ mode: z.enum(['full', 'short']), gmCount: z.number().int().min(1).max(4), dice: z.enum(['virtual', 'physical']) });
export const nameSchema = z.string().trim().min(1).max(32);
const text = z.string().max(3000);
const id = z.string().min(1).max(100);
const objectiveSchema = z.enum(objectives);
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  requireThat(result.success, '输入不完整或超出允许范围，请检查后重试。', 'Some input is missing or outside the allowed range. Check it and try again.');
  return result.data;
}
export function log(room: Room, actorId: string, message: Text) {
  room.logs.push({ id: crypto.randomUUID(), at: Date.now(), actorId, text: message });
  if (room.logs.length > 1500) room.logs.shift();
}
export function newRoom(code: string, name: string, settings: Settings): Room {
  const hostId = crypto.randomUUID();
  return {
    schemaVersion: 1, scenarioVersion: '1.0.0', id: crypto.randomUUID(), code, revision: 0, createdAt: Date.now(), hostId, settings,
    phase: 'lobby', members: [{ id: hostId, name, role: 'gm', character: 'coordinator', leads: 0, joinedAt: Date.now() }],
    evidence: [], checks: [], polls: [], route: null, customRoute: { plan: '', costs: '', assumptions: '' }, emergencyKits: 2,
    report: { observations: '', uncertainty: '', owner: '', nextUpdate: '', statement: '', restrictions: '', backup: '', truthfulness: 'unreviewed' },
    override: null, overrideReason: '', reflections: {}, gmNotes: '', clock: { runningSince: null, elapsed: 0 }, logs: []
  };
}
export function tierFor(delta: number): Tier {
  return delta >= 3 ? 'boon' : delta >= 0 ? 'success' : delta >= -2 ? 'near_miss' : delta >= -4 ? 'twist' : 'consequences';
}
export function settle(check: Check, die: number) {
  const dc = (check.kind === 'preparation' ? 11 : baseDC[check.objective]) - Math.max(check.preparation, check.creative);
  const total = die + check.bonus;
  const rawTier = tierFor(total - dc);
  return { die, dc, total, delta: total - dc, rawTier, tier: rawTier, kitSpent: false, rolledAt: Date.now() };
}
export function activeCheck(room: Room) { return room.checks.find(c => c.status !== 'resolved'); }
export function unresolvedPoll(room: Room) { return room.polls.find(p => p.status === 'open' || (p.status === 'closed' && p.tied.length > 0 && !p.outcome)); }
function playerIds(room: Room) { return room.members.filter(m => m.role === 'player').map(m => m.id); }
function newPoll(room: Room, kind: Poll['kind'], question: Text, options: Poll['options'], checkId: string | null = null) {
  requireThat(!unresolvedPoll(room), '先结束当前投票或处理平票。', 'Close the current vote or resolve its tie first.');
  requireThat(playerIds(room).length, '至少需要一名玩家参与投票。', 'At least one player is needed to vote.');
  const poll: Poll = { id: crypto.randomUUID(), kind, question, options, eligible: playerIds(room), ballots: {}, status: 'open', outcome: null, tied: [], checkId, closeReason: '' };
  room.polls.push(poll);
  return poll;
}
function applyPollOutcome(room: Room, poll: Poll) {
  if (poll.kind === 'route' && poll.outcome) room.route = poll.outcome as Room['route'];
  if (poll.kind === 'kit' && poll.outcome === 'spend') {
    const check = room.checks.find(c => c.id === poll.checkId);
    requireThat(check?.result && check.kind === 'execution', '找不到可补救的行动。', 'No eligible action was found.');
    const result = check.result;
    requireThat(!result.kitSpent && room.emergencyKits > 0 && tiers.indexOf(result.tier) < 3, '这个行动已不能再使用应急物资。', 'This action cannot use another emergency kit.');
    result.kitSpent = true;
    result.tier = tiers[Math.min(3, tiers.indexOf(result.tier) + 1)];
    room.emergencyKits--;
    log(room, 'system', bi('团队使用 1 份应急物资，行动结果提升一档。', 'The team used 1 emergency kit to improve the result by one tier.'));
  }
}
export function closePoll(room: Room, poll: Poll, reason = '', actorId = 'system') {
  requireThat(poll.status === 'open', '投票已经结束。', 'This vote has already closed.');
  if (Object.keys(poll.ballots).length === 0) {
    poll.status = 'closed'; poll.closeReason = reason; poll.outcome = null; poll.tied = [];
    log(room, actorId, bi('GM 结束空投票，本轮没有产生决定。', 'A GM closed the empty vote. No decision was made.'));
    return;
  }
  const counts = poll.options.map(o => ({ id: o.id, count: Object.values(poll.ballots).filter(v => v === o.id).length }));
  const max = Math.max(...counts.map(o => o.count));
  const winners = counts.filter(o => o.count === max).map(o => o.id);
  poll.status = 'closed'; poll.closeReason = reason;
  poll.tied = winners.length > 1 ? winners : [];
  poll.outcome = winners.length === 1 ? winners[0] : null;
  applyPollOutcome(room, poll);
  const winnerLabel = poll.options.find(o => o.id === poll.outcome)?.label;
  log(room, actorId, winnerLabel ? bi(`GM 结束投票。结果：${winnerLabel['zh-CN']}`, `A GM closed the vote. Result: ${winnerLabel.en}`) : bi('GM 结束投票，结果平票，等待根据讨论裁决。', 'A GM closed the vote. It is tied and awaits a decision after discussion.'));
}
function selectLead(room: Room, check: Check) {
  const candidates = check.eligible.filter(memberId => check.responses[memberId] === true);
  requireThat(candidates.length, '还没有人申请，请至少一名玩家申请。', 'Nobody has volunteered yet. At least one player must volunteer.');
  check.leadId = candidates[randomInt(candidates.length)];
  if (room.settings.mode === 'short' && check.kind === 'execution' && check.eligible.length > 1 && !check.supportId) {
    check.supportId = room.members.filter(m => check.eligible.includes(m.id) && m.id !== check.leadId).sort((a, b) => a.leads - b.leads)[0]?.id ?? null;
  }
  if (check.supportId === check.leadId) check.supportId = check.eligible.find(i => i !== check.leadId) ?? null;
  check.status = 'selected';
  const lead = room.members.find(m => m.id === check.leadId)!;
  log(room, 'system', bi(`系统从 ${candidates.length} 位申请者中随机选出 ${lead.name} 掷骰。`, `The server randomly selected ${lead.name} from ${candidates.length} volunteer(s) to roll.`));
}
function resolveCheck(room: Room, check: Check, die: number) {
  requireThat(check.status === 'selected' && !check.result, '此检定已结算或尚未选出主导人。', 'The check is already resolved or has no selected lead.');
  check.result = settle(check, die); check.status = 'resolved';
  for (const memberId of [check.leadId, check.supportId]) {
    const member = room.members.find(m => m.id === memberId);
    if (member) member.leads++;
  }
  log(room, check.leadId!, bi(`${objectiveLabels[check.objective]['zh-CN']}：D20 ${die} + ${check.bonus}，DC ${check.result.dc}，差额 ${check.result.delta}。`, `${objectiveLabels[check.objective].en}: D20 ${die} + ${check.bonus}, DC ${check.result.dc}, delta ${check.result.delta}.`));
  if (check.kind === 'execution' && check.result.delta < 0 && room.emergencyKits > 0) {
    newPoll(room, 'kit', bi('使用 1 份应急物资，将本次结果提升一档？', 'Use 1 emergency kit to improve this result by one tier?'), [{ id: 'spend', label: bi('使用物资', 'Use a kit') }, { id: 'keep', label: bi('接受结果，保留物资', 'Accept the result; keep the kit') }], check.id);
  }
}
export function execute(room: Room, member: Member, type: string, input: unknown) {
  const gm = () => requireThat(member.role === 'gm', '此操作需要主持人身份。', 'This action requires a GM.', 'forbidden', 403);
  const player = () => requireThat(member.role === 'player', '只有玩家可以参与。', 'Only players can participate.', 'forbidden', 403);
  const payload = input ?? {};
  switch (type) {
    case 'next': {
      gm();
      requireThat(!activeCheck(room) && !unresolvedPoll(room), '先完成当前检定和投票。', 'Complete the current check and vote first.');
      if (room.phase === 'lobby') {
        requireThat(room.members.filter(m => m.role === 'gm').length >= room.settings.gmCount, '主持人数尚未到齐，可在设置中调整。', 'The configured GMs have not all joined. You can adjust the room settings.');
        requireThat(playerIds(room).length > 0, '至少加入一名玩家后开始。', 'At least one player must join before starting.');
        room.clock.runningSince = Date.now();
      }
      if (room.phase === 'investigation' && room.settings.mode === 'full') requireThat(objectives.every(o => room.checks.some(c => c.kind === 'preparation' && c.objective === o && c.result)), '完整版需要完成三项准备检定。', 'Complete all three preparation checks in full mode.');
      if (room.phase === 'route_choice') requireThat(room.route, '请先投票确定路线。', 'Choose a route through the vote first.');
      if (room.phase === 'execution') requireThat(objectives.every(o => room.checks.some(c => c.kind === 'execution' && c.objective === o && c.result)), '请先结算三个救援目标。', 'Resolve all three rescue objectives first.');
      if (room.phase === 'ending') requireThat(room.report.statement.trim() && room.report.owner.trim() && room.report.nextUpdate.trim(), '先保存通报原话、下一步负责人及更新时间，再进入复盘。', 'Save the actual statement, next-action owner and update time before the debrief.');
      const index = phases.indexOf(room.phase);
      requireThat(index < phases.length - 1, '已经到达复盘阶段。', 'You are already in the debrief.');
      room.phase = phases[index + 1];
      if (room.phase === 'investigation') room.evidence = evidence.map(e => e.id);
      if (room.phase === 'negotiation') newPoll(room, 'decision', bi('优先采用怎样的协商安排？', 'How should we coordinate first?'), negotiationOptions);
      if (room.phase === 'route_choice') newPoll(room, 'route', bi('你支持哪条救援路线？', 'Which rescue route do you support?'), routes.filter(r => r.id !== 'custom' || room.customRoute.plan).map(r => ({ id: r.id, label: r.title })));
      log(room, member.id, bi(`进入「${phaseLabels[room.phase]['zh-CN']}」。`, `Entered ${phaseLabels[room.phase].en}.`));
      break;
    }
    case 'settings': {
      gm(); requireThat(room.phase === 'lobby', '开始后不能修改房间规则。', 'Room rules cannot be changed after starting.');
      const settings = parse(settingsSchema, payload);
      requireThat(settings.gmCount >= room.members.filter(m => m.role === 'gm').length, '先调整成员身份，再减少主持人数。', 'Change member roles before reducing the GM count.');
      room.settings = settings; log(room, member.id, bi('更新房间规则。', 'Updated room rules.')); break;
    }
    case 'profile': {
      const data = parse(z.object({ name: nameSchema, character: z.enum(['engineer', 'coordinator', 'medic', 'scout', 'communicator', 'logistics']) }), payload);
      member.name = data.name; member.character = data.character; break;
    }
    case 'role': {
      gm(); requireThat(member.id === room.hostId, '由房主分配成员身份。', 'Only the room owner can assign roles.', 'forbidden', 403);
      const data = parse(z.object({ memberId: id, role: z.enum(['gm', 'player', 'spectator']) }), payload);
      const target = room.members.find(m => m.id === data.memberId);
      requireThat(target, '成员不存在。', 'Member not found.');
      requireThat(target.id !== room.hostId || data.role === 'gm', '房主需要保留主持人身份。', 'The room owner must remain a GM.');
      requireThat(data.role !== 'gm' || target.role === 'gm' || room.members.filter(m => m.role === 'gm').length < room.settings.gmCount, '主持席位已满，请先调整房间设置。', 'All GM seats are filled. Adjust room settings first.');
      requireThat(!activeCheck(room) || ![activeCheck(room)?.leadId, activeCheck(room)?.supportId].includes(target.id), '该成员正在主导行动，请先结算或重新招募。', 'This member is leading a check. Resolve it or reopen recruitment first.');
      target.role = data.role;
      if (data.role !== 'player') {
        const check = activeCheck(room);
        if (check) { check.eligible = check.eligible.filter(i => i !== target.id); delete check.responses[target.id]; }
        for (const poll of room.polls.filter(p => p.status === 'open')) { poll.eligible = poll.eligible.filter(i => i !== target.id); delete poll.ballots[target.id]; }
      }
      log(room, member.id, bi(`调整了 ${target.name} 的身份。`, `Changed ${target.name}’s role.`)); break;
    }
    case 'custom_route': {
      gm(); requireThat(room.phase === 'route_choice', '请在选择路线阶段编辑方案。', 'Edit this during route selection.');
      room.customRoute = parse(z.object({ plan: z.string().trim().min(1).max(2000), costs: z.string().trim().min(1).max(2000), assumptions: z.string().trim().min(1).max(2000) }), payload);
      for (const poll of room.polls.filter(p => p.kind === 'route')) { poll.status = 'closed'; poll.tied = []; poll.closeReason ||= 'custom-route-updated'; }
      room.route = null;
      newPoll(room, 'route', bi('你支持哪条救援路线？', 'Which rescue route do you support?'), routes.map(r => ({ id: r.id, label: r.title })));
      log(room, member.id, bi('保存自创路线并重新开放投票，团队需确认新的方案与代价。', 'Saved a custom route and reopened voting. The team must approve the new plan and costs.')); break;
    }
    case 'route_vote': {
      gm(); requireThat(room.phase === 'route_choice', '当前不在路线决定阶段。', 'This is not the route-selection stage.');
      for (const poll of room.polls.filter(p => p.kind === 'route')) { poll.status = 'closed'; poll.tied = []; poll.closeReason ||= 'restarted'; }
      room.route = null;
      newPoll(room, 'route', bi('你支持哪条救援路线？', 'Which rescue route do you support?'), routes.filter(r => r.id !== 'custom' || room.customRoute.plan).map(r => ({ id: r.id, label: r.title })));
      log(room, member.id, bi('重新发起路线投票，所有人需重新确认。', 'Restarted the route vote. Everyone must vote again.')); break;
    }
    case 'vote': {
      player(); const data = parse(z.object({ pollId: id, option: id }), payload);
      const poll = room.polls.find(p => p.id === data.pollId);
      requireThat(poll?.status === 'open' && poll.eligible.includes(member.id), '你无法参与这个投票，或投票已结束。', 'You are not eligible for this vote, or it has closed.');
      requireThat(poll.options.some(o => o.id === data.option), '投票选项不存在。', 'Vote option not found.');
      poll.ballots[member.id] = data.option;
      break;
    }
    case 'close_vote': {
      gm(); const data = parse(z.object({ pollId: id, reason: z.string().trim().max(300).default('') }), payload);
      const poll = room.polls.find(p => p.id === data.pollId); requireThat(poll, '投票不存在。', 'Vote not found.');
      closePoll(room, poll, data.reason, member.id); break;
    }
    case 'resolve_tie': {
      gm(); const data = parse(z.object({ pollId: id, option: id, reason: z.string().trim().min(1).max(300) }), payload);
      const poll = room.polls.find(p => p.id === data.pollId);
      requireThat(poll?.status === 'closed' && !poll.outcome && poll.tied.includes(data.option), '这不是待裁决的平票选项。', 'This is not an unresolved tied option.');
      poll.outcome = data.option; poll.closeReason = data.reason; poll.tied = [];
      applyPollOutcome(room, poll);
      log(room, member.id, bi(`GM 裁决平票：${data.reason}`, `GM resolved the tie: ${data.reason}`)); break;
    }
    case 'open_check': {
      gm(); requireThat(!activeCheck(room) && !unresolvedPoll(room), '先完成当前行动或投票。', 'Complete the current check or vote first.');
      const data = parse(z.object({ objective: objectiveSchema, action: z.string().trim().min(1).max(2000), backup: z.string().trim().min(1).max(2000), bonus: z.number().int().min(0).max(3), bonusReason: z.string().max(500).default(''), creative: z.number().int().min(0).max(2), supportId: id.nullable().optional() }), payload);
      requireThat(room.phase === 'execution' || (room.phase === 'investigation' && room.settings.mode === 'full'), '当前阶段不进行检定。', 'Checks are not available at this stage.');
      const kind = room.phase === 'execution' ? 'execution' : 'preparation';
      requireThat(!room.checks.some(c => c.kind === kind && c.objective === data.objective), '该目标已经检定过。', 'This objective already has a check.');
      const eligible = playerIds(room);
      requireThat(eligible.length, '需要至少一名玩家。', 'At least one player is needed.');
      requireThat(!data.supportId || eligible.includes(data.supportId), '搭档需要是当前玩家。', 'The partner must be a current player.');
      const prepared = room.checks.some(c => c.kind === 'preparation' && c.objective === data.objective && c.result && ['success', 'boon'].includes(c.result.tier));
      room.checks.push({ id: crypto.randomUUID(), kind, objective: data.objective, action: data.action, backup: data.backup, bonus: data.bonus, bonusReason: data.bonusReason, creative: kind === 'execution' ? data.creative : 0, preparation: kind === 'execution' && prepared ? 2 : 0, eligible, responses: {}, leadId: null, supportId: data.supportId ?? null, status: 'recruiting', result: null, narrative: '', correctionReason: '' });
      log(room, member.id, bi(`公开${objectiveLabels[data.objective]['zh-CN']}的行动与难度，开始申请。`, `Published the plan and DC for ${objectiveLabels[data.objective].en}. Recruitment is open.`)); break;
    }
    case 'volunteer': {
      player(); const data = parse(z.object({ checkId: id, willing: z.boolean() }), payload);
      const check = room.checks.find(c => c.id === data.checkId);
      requireThat(check?.status === 'recruiting' && check.eligible.includes(member.id), '申请已结束或你不在本次名单中。', 'Recruitment has closed or you are not eligible for this check.');
      check.responses[member.id] = data.willing;
      if (check.eligible.every(i => i in check.responses) && Object.values(check.responses).some(Boolean)) selectLead(room, check);
      break;
    }
    case 'select_lead': {
      gm(); const data = parse(z.object({ checkId: id }), payload);
      const check = room.checks.find(c => c.id === data.checkId); requireThat(check?.status === 'recruiting', '当前没有等待抽选的检定。', 'No check is waiting for lead selection.');
      selectLead(room, check); break;
    }
    case 'recruit_again': {
      gm(); const data = parse(z.object({ checkId: id }), payload);
      const check = room.checks.find(c => c.id === data.checkId); requireThat(check && !check.result, '已结算的行动不能重新申请。', 'A resolved check cannot recruit again.');
      check.status = 'recruiting'; check.eligible = playerIds(room); check.responses = {}; check.leadId = null; check.supportId = null;
      log(room, member.id, bi('重新开放本次行动申请，原先主导不再有掷骰权限。', 'Reopened recruitment. The previous lead can no longer roll.')); break;
    }
    case 'roll': {
      const data = parse(z.object({ checkId: id, die: z.number().int().min(1).max(20).optional() }), payload);
      const check = room.checks.find(c => c.id === data.checkId); requireThat(check, '检定不存在。', 'Check not found.');
      if (room.settings.dice === 'physical') { gm(); requireThat(data.die !== undefined, '请输入实体 D20 的 1–20 点数。', 'Enter the physical D20 result from 1 to 20.'); resolveCheck(room, check, data.die); }
      else { player(); requireThat(check.leadId === member.id, '只有系统选中的玩家可以掷骰。', 'Only the selected player can roll.', 'forbidden', 403); resolveCheck(room, check, randomInt(1, 21)); }
      break;
    }
    case 'kit_vote': {
      gm(); const data = parse(z.object({ checkId: id }), payload);
      const check = room.checks.at(-1);
      requireThat(room.phase === 'execution' && check?.id === data.checkId && check.kind === 'execution' && check.result && check.result.delta < 0 && !check.result.kitSpent && room.emergencyKits > 0, '此行动没有可用的补救机会。', 'This action is not eligible for an emergency kit.');
      newPoll(room, 'kit', bi('使用 1 份应急物资，将本次结果提升一档？', 'Use 1 emergency kit to improve this result by one tier?'), [{ id: 'spend', label: bi('使用物资', 'Use a kit') }, { id: 'keep', label: bi('接受结果，保留物资', 'Accept the result; keep the kit') }], check.id); break;
    }
    case 'correct_die': {
      gm(); const data = parse(z.object({ checkId: id, die: z.number().int().min(1).max(20), reason: z.string().trim().min(1).max(500) }), payload);
      const check = room.checks.at(-1);
      requireThat(check?.id === data.checkId && check.result && !unresolvedPoll(room) && ((check.kind === 'preparation' && room.phase === 'investigation') || (check.kind === 'execution' && room.phase === 'execution')), '只可更正当前阶段最后一次已结算的检定；先完成投票。', 'Only the last resolved check in this stage can be corrected. Close any vote first.');
      if (check.result.kitSpent) room.emergencyKits++;
      const previous = check.result.die;
      check.result = settle(check, data.die); check.correctionReason = data.reason;
      log(room, member.id, bi(`更正骰点 ${previous} → ${data.die}；退回本次物资并重算。原因：${data.reason}`, `Corrected die ${previous} → ${data.die}; refunded this check’s kit and recalculated. Reason: ${data.reason}`)); break;
    }
    case 'narrative': {
      gm(); const data = parse(z.object({ checkId: id, narrative: z.string().trim().min(1).max(3000) }), payload);
      const check = room.checks.find(c => c.id === data.checkId); requireThat(check?.result, '先结算行动再补充叙述。', 'Resolve the check before adding its narrative.');
      check.narrative = data.narrative; log(room, member.id, bi('补充了行动实际后果。', 'Added the action’s fictional consequences.')); break;
    }
    case 'override_tracks': {
      gm(); const data = parse(z.object({ evacuated: z.number().int().min(0).max(12), waiting: z.number().int().min(0).max(12), observation: z.number().int().min(0).max(12), isolation: z.enum(['pending', 'verified', 'temporary-recheck-required', 'unverified-cordon', 'unverified-damage']), clinic: z.enum(['pending', 'complete', 'follow-up-required', 'urgent-follow-up-required']), reason: z.string().trim().min(1).max(1000) }), payload);
      requireThat(['execution', 'ending', 'debrief'].includes(room.phase), '救援执行后再调整实际结果。', 'Adjust fictional outcomes during or after execution.');
      requireThat(data.evacuated + data.waiting === 12 && data.observation <= data.evacuated, '撤离与待援人数之和应为 12，观察人数不能超过撤离人数。', 'Evacuated plus waiting must equal 12; observation cannot exceed evacuated.');
      const { reason, ...override } = data; room.override = override; room.overrideReason = reason;
      log(room, member.id, bi(`调整实际结果：${reason}`, `Adjusted fictional outcomes: ${reason}`)); break;
    }
    case 'report': {
      room.report = parse(z.object({ observations: text, uncertainty: text, owner: z.string().max(200), nextUpdate: z.string().max(200), statement: text, restrictions: text, backup: text, truthfulness: z.enum(['unreviewed', 'accurate', 'incomplete', 'misleading']) }), payload);
      log(room, member.id, bi('保存事故通报与具名交接。', 'Saved the public statement and named handover.')); break;
    }
    case 'report_preset': {
      const data = parse(z.object({ locale: z.enum(['zh-CN', 'en']) }), payload); const l = data.locale;
      const t = tracks(room);
      room.report.observations = bi(`${t.evacuated} 人已撤离，${t.waiting} 人待援，${t.observation} 人需观察。设施：${isolationLabels[t.isolation]['zh-CN']}。`, `${t.evacuated} evacuated, ${t.waiting} awaiting rescue, ${t.observation} need observation. Facility: ${isolationLabels[t.isolation].en}.`)[l];
      room.report.uncertainty = bi('绿灯最后回传 17:10，仅验证低负荷。尚未确认的事项需要现场复核。', 'The green status is from a 17:10 low-load test. Unconfirmed conditions need local verification.')[l];
      room.report.restrictions = bi('海岸保持净空；非关键实验室停用到次日。', 'Keep the coast clear. Noncritical labs remain offline until tomorrow.')[l];
      room.report.backup = clinicLabels[t.clinic][l];
      room.report.statement = `${room.report.observations} ${room.report.uncertainty} ${room.report.restrictions} ${room.report.backup}`;
      room.report.truthfulness = 'unreviewed';
      log(room, member.id, bi('按当前已结算事实生成通报草稿，待人工确认。', 'Generated a statement draft from current results; review is pending.')); break;
    }
    case 'reflection': {
      requireThat(room.phase === 'debrief', '复盘阶段再填写反思。', 'Reflections open in the debrief.');
      const data = parse(z.object({ prompt: z.enum(['0', '1', '2', '3']), text: z.string().trim().min(1).max(2000) }), payload);
      room.reflections[member.id] ??= {}; room.reflections[member.id][data.prompt] = data.text; break;
    }
    case 'notes': { gm(); const data = parse(z.object({ text: z.string().max(8000) }), payload); room.gmNotes = data.text; break; }
    case 'clock': {
      gm(); if (room.clock.runningSince === null) room.clock.runningSince = Date.now();
      else { room.clock.elapsed += Date.now() - room.clock.runningSince; room.clock.runningSince = null; }
      break;
    }
    default: throw new GameFault('unknown_command', bi('不支持这个操作，请刷新页面。', 'Unsupported action. Refresh the page.'));
  }
}

const memberSchema = z.object({ id, name: nameSchema, role: z.enum(['gm', 'player', 'spectator']), character: z.string().max(40), leads: z.number().int().nonnegative(), joinedAt: z.number() });
const resultSchema = z.object({ die: z.number().int().min(1).max(20), total: z.number().int(), dc: z.number().int(), delta: z.number().int(), rawTier: z.enum(tiers), tier: z.enum(tiers), kitSpent: z.boolean(), rolledAt: z.number() });
const textSchema = z.object({ 'zh-CN': text, en: text });
export const archiveSchema = z.object({
  format: z.literal('green-light-save'), version: z.literal(1),
  room: z.object({
    schemaVersion: z.literal(1), scenarioVersion: z.literal('1.0.0'), id, code: z.string().regex(/^\d{4}$/), revision: z.number().int().nonnegative(), createdAt: z.number(),
    hostId: id, settings: settingsSchema, phase: z.enum(phases), members: z.array(memberSchema).min(1).max(40), evidence: z.array(z.string()).max(3),
    checks: z.array(z.object({ id, kind: z.enum(['preparation', 'execution']), objective: objectiveSchema, action: text, backup: text, bonus: z.number().int().min(0).max(3), bonusReason: z.string().max(500), creative: z.number().int().min(0).max(2), preparation: z.number().int().min(0).max(2), eligible: z.array(id).max(40), responses: z.record(z.string(), z.boolean()), leadId: id.nullable(), supportId: id.nullable(), status: z.enum(['recruiting', 'selected', 'resolved']), result: resultSchema.nullable(), narrative: text, correctionReason: z.string().max(500) })).max(6),
    polls: z.array(z.object({ id, kind: z.enum(['route', 'kit', 'decision']), question: textSchema, options: z.array(z.object({ id, label: textSchema })).max(10), eligible: z.array(id).max(40), ballots: z.record(z.string(), z.string()), status: z.enum(['open', 'closed']), outcome: id.nullable(), tied: z.array(id).max(10), checkId: id.nullable(), closeReason: z.string().max(500) })).max(300),
    route: z.enum(['high_line', 'quiet_water', 'borrowed_channel', 'custom']).nullable(), customRoute: z.object({ plan: text, costs: text, assumptions: text }), emergencyKits: z.number().int().min(0).max(2),
    report: z.object({ observations: text, uncertainty: text, owner: z.string().max(200), nextUpdate: z.string().max(200), statement: text, restrictions: text, backup: text, truthfulness: z.enum(['unreviewed', 'accurate', 'incomplete', 'misleading']) }),
    override: z.object({ evacuated: z.number().int().min(0).max(12), waiting: z.number().int().min(0).max(12), observation: z.number().int().min(0).max(12), isolation: z.enum(['pending', 'verified', 'temporary-recheck-required', 'unverified-cordon', 'unverified-damage']), clinic: z.enum(['pending', 'complete', 'follow-up-required', 'urgent-follow-up-required']) }).nullable(), overrideReason: z.string().max(1000),
    reflections: z.record(z.string(), z.record(z.string(), z.string().max(2000))), gmNotes: z.string().max(8000), clock: z.object({ runningSince: z.number().nullable(), elapsed: z.number().nonnegative() }),
    logs: z.array(z.object({ id, at: z.number(), actorId: id, text: textSchema })).max(1500)
  })
});
export function validateArchive(data: unknown): Room {
  const result = archiveSchema.safeParse(data);
  requireThat(result.success, '存档版本不受支持或内容损坏；需要 green-light-save v1 / 剧本 1.0.0。', 'Unsupported or damaged save. Expected green-light-save v1 / scenario 1.0.0.');
  const room: Room = result.data.room;
  requireThat(new Set(room.members.map(m => m.id)).size === room.members.length && room.members.some(m => m.id === room.hostId && m.role === 'gm'), '存档成员身份不完整。', 'The save has invalid member identities.');
  requireThat(room.members.filter(m => m.role === 'gm').length <= room.settings.gmCount, '存档主持人数超过配置。', 'The save has more GMs than configured seats.');
  requireThat(room.emergencyKits === 2 - room.checks.filter(c => c.result?.kitSpent).length, '存档物资与行动记录不一致。', 'Save resources do not match its action history.');
  requireThat(new Set(room.checks.map(c => `${c.kind}:${c.objective}`)).size === room.checks.length && room.checks.filter(c => c.status !== 'resolved').length <= 1, '存档存在重复或冲突检定。', 'The save contains duplicate or conflicting checks.');
  for (const check of room.checks) {
    requireThat(check.eligible.every(i => room.members.some(m => m.id === i)) && (!check.leadId || check.eligible.includes(check.leadId)) && (!check.supportId || check.eligible.includes(check.supportId)), '存档行动参与者不一致。', 'The save has inconsistent check participants.');
    requireThat(check.kind !== 'preparation' || (room.settings.mode === 'full' && check.preparation === 0 && check.creative === 0), '存档准备规则不一致。', 'The save has inconsistent preparation rules.');
    requireThat((check.status === 'resolved') === Boolean(check.result), '存档检定状态不一致。', 'Save check status is inconsistent.');
    if (check.result) {
      const expected = settle(check, check.result.die);
      const tier = check.result.kitSpent ? tiers[Math.min(3, tiers.indexOf(expected.rawTier) + 1)] : expected.rawTier;
      requireThat(expected.dc === check.result.dc && expected.total === check.result.total && expected.delta === check.result.delta && expected.rawTier === check.result.rawTier && tier === check.result.tier && (!check.result.kitSpent || (check.kind === 'execution' && expected.delta < 0)), '存档算式或补救记录无效。', 'The save has an invalid formula or kit record.');
    }
  }
  requireThat(new Set(room.polls.map(p => p.id)).size === room.polls.length && new Set(room.checks.map(c => c.id)).size === room.checks.length, '存档存在重复操作 ID。', 'The save contains duplicate operation IDs.');
  for (const poll of room.polls) requireThat(poll.options.length >= 2 && poll.eligible.every(i => room.members.some(m => m.id === i)) && Object.entries(poll.ballots).every(([i, choice]) => poll.eligible.includes(i) && poll.options.some(o => o.id === choice)) && (!poll.outcome || poll.options.some(o => o.id === poll.outcome)), '存档投票记录无效。', 'The save has an invalid voting record.');
  if (room.override) requireThat(room.override.evacuated + room.override.waiting === 12 && room.override.observation <= room.override.evacuated, '存档人数记录不一致。', 'The save has inconsistent headcounts.');
  return room;
}
