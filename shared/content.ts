import { bi, type Text, type Objective, type RouteId, type Tier, type Phase, type Room, type RoomView, type Tracks } from './types';

export const title = bi('绿灯之下', 'Under the Green Light');
export const phaseLabels: Record<Phase, Text> = {
  lobby: bi('集结室', 'Assembly'), briefing: bi('危机开场', 'The alarm'),
  investigation: bi('调查与准备', 'Investigate'), negotiation: bi('公会协商', 'Coordinate'),
  route_choice: bi('决定路线', 'Choose a route'), execution: bi('救援行动', 'The rescue'),
  ending: bi('事故交接', 'The handover'), debrief: bi('退出角色 · 复盘', 'Reflect together')
};
export const objectiveLabels: Record<Objective, Text> = {
  access: bi('建立通路', 'Open a route'), evacuation: bi('转移人员', 'Move the people'), isolation: bi('隔离危险', 'Isolate the hazard')
};
export const prepareLabels: Record<Objective, Text> = {
  access: bi('结构与路线', 'Structure & routes'), evacuation: bi('人员与交接', 'People & handover'), isolation: bi('能源与证据', 'Power & evidence')
};
export const tierLabels: Record<Tier, Text> = {
  consequences: bi('失败并有后果', 'Setback with consequences'), twist: bi('失败但有转机', 'Setback with an opening'),
  near_miss: bi('部分成功', 'Partial success'), success: bi('成功', 'Success'), boon: bi('成功并获益', 'Success with a benefit')
};
export const roles = { gm: bi('主持人', 'GM'), player: bi('玩家', 'Player'), spectator: bi('观察者', 'Observer') };
export const characters = [
  { id: 'engineer', name: bi('工程顾问', 'Engineer'), description: bi('检验结构、设备与适用条件', 'Check structures, equipment and limits') },
  { id: 'coordinator', name: bi('行动协调', 'Coordinator'), description: bi('组织分工，留意每个人的声音', 'Coordinate the team and hear every voice') },
  { id: 'medic', name: bi('医疗联络', 'Care liaison'), description: bi('协助行动不便者，确认医疗交接', 'Arrange assisted movement and clinical handover') },
  { id: 'scout', name: bi('环境观察', 'Scout'), description: bi('观察潮流、通路和生态影响', 'Observe currents, routes and ecological impact') },
  { id: 'communicator', name: bi('通信记录', 'Communicator'), description: bi('核实信息，保留事实与未知', 'Verify messages and record uncertainty') },
  { id: 'logistics', name: bi('物资保障', 'Quartermaster'), description: bi('准备绳索、运载与备用方案', 'Prepare equipment, transport and contingencies') }
];
export const scenes: Record<Exclude<Phase, 'lobby'>, { title: Text; body: Text; prompt: Text }> = {
  briefing: {
    title: bi('灯还是绿的。海水已经进来了。', 'The light is green. The water is rising.'),
    body: bi('The Shell 在 Luminis Sea 上方低鸣。地图闪烁，水轮机旋转，桌上还放着七把瑞士军刀。门外，你们的 Maid-Mer 守卫扔下一只恶海鸥。警报突然响起：外围潮汐泵站正在进水，十二名维修人员被困。而屏幕上，始终闪着同一句话：绿灯——可以安全运行。', 'The Shell hums above the Luminis Sea. Inside, maps flicker, water turbines spin, and somebody has left seven Swiss Army knives on the same table. Outside, your Maid-Mer guard drops an evil seagull beside the door. Then the alarm begins. The coastal pump station is flooding. Twelve maintenance workers are inside. On your screen, one message keeps blinking: GREEN — SAFE TO OPERATE.'),
    prompt: bi('下一轮暴潮将在故事中的十二分钟后抵达。你们需要建立通路、转移人员、隔离危险，并向其他公会如实通报。首先做什么？', 'The next storm surge will reach the station in twelve minutes. You have three action windows once your plan is ready. Your job is to open a rescue route, move the workers, and isolate the station safely. You also need to tell the other guilds what is actually happening. What do you do first?')
  },
  investigation: {
    title: bi('绿灯是一种说法，海水才是证据。', 'A claim on a screen. Evidence on the floor.'),
    body: bi('三份现场记录已共享给所有人。旧测试覆盖什么？哪项仍未验证？关键线索始终可查，准备检定决定的是实地准备质量。', 'Three field records are now shared with everyone. What did the old test establish? What still needs verification? Essential evidence stays available; preparation checks determine the quality of your field work.'),
    prompt: bi('说出你要验证什么、谁能协助，以及第一种方法失败时怎么办。', 'The green light is a claim. The water on the floor is evidence. Tell me what you would verify, who can help, and what you will do if your first method fails.')
  },
  negotiation: {
    title: bi('三个频道，同一个救援目标。', 'Three channels. One shared rescue.'),
    body: bi('Mira 准备协助现场验证；Tavi 等待可执行的事实通告；Dr. Vale 需要医疗交接的时间与负责人。阅读他们的消息，选择沟通方案，也可以写下自己的安排。', 'Mira can help verify the station. Tavi needs an actionable warning. Dr. Vale needs a handover time and a named contact. Read their messages and agree on a communication plan, or propose your own.'),
    prompt: bi('我们知道什么？不知道什么？需要别人现在做什么？诚实通报和合理请求无需说服骰。', 'What do we know? What remains uncertain? What do we need others to do now? Honest updates and practical requests do not require persuasion rolls.')
  },
  route_choice: {
    title: bi('先看代价，再选方向。', 'Understand the cost. Choose the way.'),
    body: bi('崖壁、海面与泄洪渠，都能到达泵站。每条路线都完成相同的三个目标，基础 DC 为 12 / 12 / 13。你们接受的代价会保留在最终交接里。', 'The cliff, the sea and the channel all offer a way to the station. Every route uses the same three objectives, with base DCs of 12 / 12 / 13. The costs you accept remain part of your final handover.'),
    prompt: bi('选择你支持的方案，GM 结束前可随时更改。全员投完也会等待 GM 结束并公开计票；平票由 GM 根据讨论裁决，也可以重新投票。', 'Choose the plan you support and change it until a GM closes the vote. Even after everyone votes, results stay hidden until then. A GM resolves a tie after discussion, or starts a new vote.')
  },
  execution: {
    title: bi('第一浪已经抵达。让十二个人回家。', 'The first wave hits. Bring twelve people home.'),
    body: bi('三个潮浪窗口，三个救援目标。先确认行动与备用方案，再申请主导。每次只有一人掷骰；多人申请时由系统随机选出。', 'Three wave windows. Three rescue objectives. Confirm your action and contingency, then volunteer to lead. Only one person rolls each check; the server draws a random lead when several people volunteer.'),
    prompt: bi('即使主通路失败，也启用预置备用通路。后续 DC 不会因前次失败而增加。', 'If the main route fails, a prepared backup keeps the rescue moving. A failed check does not increase later DCs.')
  },
  ending: {
    title: bi('浪退之后，责任留下。', 'The wave passes. Responsibility remains.'),
    body: bi('最后一道浪拍在崖壁上。The Shell 仍然矗立。现在向其他公会说明：多少人已经清点，什么仍不安全，谁负责下一步。故事以这份责任交接收尾。', 'The last wave breaks against the cliffs. The Shell still stands. Now tell the guilds: how many people are accounted for, what remains unsafe, and who owns the next action. The story ends with that responsibility, not with the green light.'),
    prompt: bi('人员、设施和通报分别确认。骰点不代表伦理质量，也不是课程成绩。', 'Review people, facilities and the public statement separately. Dice totals are neither ethical scores nor course grades.')
  },
  debrief: {
    title: bi('退出角色，把经历带回现实。', 'Step out of character. Take something with you.'),
    body: bi('先留一点时间独立思考，再邀请每个人分享。写下一次判断、一个未被听见的声音，以及下次工程协作想改变的流程。', 'Take a moment to think independently, then invite everyone to share. Record a decision, a voice that went unheard, and a process you would change in your next engineering collaboration.'),
    prompt: bi('也说一件队友做得好的具体事情。两位 Co-GM 可以分别记录一个想改进的主持动作。', 'Name one specific thing a teammate did well. Each Co-GM can also record one facilitation habit to improve.')
  }
};

export const evidence = [
  { id: 'evidence-status', title: bi('冻住的绿灯', 'The frozen green light'), category: bi('控制记录', 'Control log'),
    facts: [bi('最后回传 17:10，仅覆盖低负荷测试。', 'Last received status: 17:10. Test condition: low load.'), bi('现在 17:40；17:52 暴潮抵达。满负荷验证待完成。', 'It is now 17:40. Surge expected at 17:52. Full-surge verification is pending.'), bi('海鸥损坏回传线；本地机械指示仍可读取。', 'A gull damaged the return cable. The local mechanical indicator is still readable.')],
    prompt: bi('旧测试证明了什么？还应验证什么？', 'What did the old test prove? What still needs verification?') },
  { id: 'evidence-routes', title: bi('三条可走的路', 'Three possible routes'), category: bi('现场勘查', 'Field survey'),
    facts: [bi('崖壁锚点、安全绳和手摇绞盘可用。', 'Cliff anchors, safety lines and a hand winch are available.'), bi('背风平水区支持两趟工作艇：每趟 2 船员 + 6 人。', 'A lee-side calm window supports two boat trips: 2 crew and 6 evacuees each.'), bi('外侧手动闸门可达；泄洪渠经过育幼浅滩。', 'The exterior manual gate is accessible. Its channel crosses nursery shallows.')],
    prompt: bi('谁承担方案代价？通路如何验证？', 'Who bears the cost? How will you verify the route?') },
  { id: 'evidence-people', title: bi('十二个人与交接', 'Twelve people & a handover'), category: bi('人员与保障', 'People & safeguards'),
    facts: [bi('12 名维修人员，2 人需要协助移动。', '12 maintenance workers. Two need assisted movement.'), bi('独立干燥避难室可容纳 4 人，保障约两小时。', 'An independent dry upper refuge holds 4 people for roughly two hours.'), bi('诊所有 20 分钟独立备用电源，需要具名联系人交接。', 'The clinic has 20 minutes of independent backup power and needs a named handover contact.'), bi('通报中的适用条件、未验证项与责任人仍为空白。', 'The notice still lacks its operating limits, unverified items and responsible owner.')],
    prompt: bi('怎样清点人数、安排照护，并明确承诺？', 'How will you count everyone, arrange care and make clear commitments?') }
];
export const npcs = [
  { id: 'mira', name: 'Mira', guild: 'Builders', job: bi('工程负责人', 'Engineering lead'),
    dialogue: bi('我批准了临时旁路。低负荷测试通过了，但暴潮负荷测试还没完成。如果放弃泵站，就会丢掉备用电机。你们能签署绿色安全状态，让其他公会别恐慌吗？', 'I approved the temporary bypass. The low-load test passed, but I did not finish the surge test. If we abandon the station, we lose the spare motor. Could you sign the green status so the other guilds do not panic?'),
    boundary: bi('拒绝无条件安全签字，她仍会协助救人。', 'She will still help rescue people if you decline an unconditional safety sign-off.') },
  { id: 'tavi', name: 'Tavi', guild: 'Linkers', job: bi('通信协调', 'Communications'),
    dialogue: bi('告诉我三件事：你们知道什么，不知道什么，以及需要大家做什么。我现在就能发警报，之后再更新。', 'Give me three things: what you know, what you do not know, and what you need people to do. I can transmit a warning now and update it later.'),
    boundary: bi('事实通报不需要说服检定。', 'A factual update does not require a persuasion check.') },
  { id: 'vale', name: 'Dr. Vale', guild: 'Life Weavers', job: bi('医疗联络', 'Clinical liaison'),
    dialogue: bi('两名工人需要协助移动。我的备用电源能撑二十分钟。给我交接时间和一位具名联系人。没有验证过，就不要承诺持续供电。', 'Two workers need assisted movement. My backup power lasts twenty minutes. Give me the handover time and a named contact. Do not promise continuous power unless you have verified it.'),
    boundary: bi('按需求安排照护，有可执行交接即可合作。', 'Arrange care by need and provide an actionable handover.') }
];
export interface Route { id: RouteId; title: Text; english: string; method: Text; costs: Text[]; label: string }
export const routes: Route[] = [
  { id: 'high_line', label: 'A', title: bi('崖壁吊运', 'The High Line'), english: 'The High Line', method: bi('高位锚点、安全绳与手摇绞盘，将人员接上 The Shell 平台。', 'Use high anchors, safety lines and a hand winch to lift people onto The Shell platform.'), costs: [bi('备用电机留在下层，后续检修或更换。', 'Leave the spare motor below; repair or replace it later.'), bi('总部非关键实验室停用到次日。', 'Noncritical Shell labs stay offline until tomorrow.')] },
  { id: 'quiet_water', label: 'B', title: bi('海上转运', 'The Quiet Water'), english: 'The Quiet Water', method: bi('工作艇两趟各运 6 人，从海侧检修口将电机固定到高位架。', 'Make two boat trips with 6 evacuees each. Secure the motor to its high rack from the sea-side hatch.'), costs: [bi('损耗一组移动电池，低层工具箱留下。', 'Use up a mobile battery pack; leave low-level tool crates.'), bi('非关键实验室停用到次日；诊所备用电源独立保留。', 'Noncritical labs stay offline until tomorrow. Clinic backup remains separate.')] },
  { id: 'borrowed_channel', label: 'C', title: bi('外部泄洪', 'The Borrowed Channel'), english: 'The Borrowed Channel', method: bi('操作外侧手动闸门分流，沿检修步道撤离，再隔离危险。', 'Divert water using the exterior manual gate, evacuate along the walkway and isolate the hazard.'), costs: [bi('扰动部分育幼浅滩一季，需生态修复。', 'Disturb part of the nursery shallows for a season; arrange restoration.'), bi('清理受泥沙污染的电机；非关键实验室停用到次日。', 'Clean the silted motor. Noncritical labs stay offline until tomorrow.')] },
  { id: 'custom', label: 'D', title: bi('你们的方案', 'Your own plan'), english: 'A different way', method: bi('混合或替换现有路线，说明三个目标如何完成、假设与公开代价。', 'Combine or replace the routes. Explain all three objectives, assumptions and accepted costs.'), costs: [bi('由团队与 GM 共同明确，三个基础 DC 保持不变。', 'Agree the costs with your GMs. The three base DCs stay the same.')] }
];
export const baseDC: Record<Objective, number> = { access: 12, evacuation: 12, isolation: 13 };
export const outcomes: Record<Objective, Record<Tier, Text>> = {
  access: {
    boon: bi('稳固通路开放，额外取回个人工具或故障记录。', 'A stable route opens. Recover a personal tool or a fault record as well.'),
    success: bi('按计划开放通路，十二名工人可以开始转移。', 'The route opens as planned. The twelve workers can start moving.'),
    near_miss: bi('通路开放，一件可替换的公共装备损坏；保留基本工具。', 'The route opens; one replaceable shared item is damaged. Basic tools remain available.'),
    twist: bi('改用预置慢速手动备用通路；普通物资被卷走，仍可转移。', 'Use the prepared slow manual backup route. Some ordinary supplies wash away; evacuation continues.'),
    consequences: bi('主通路损坏，改用狭窄备用通路；下层工棚需修复，仍可转移。', 'The main route is damaged. Use the narrow backup. The lower workshop needs repair; evacuation continues.')
  },
  evacuation: {
    boon: bi('12 人安全撤离，额外带回基本医疗物资。', 'All 12 evacuate safely, bringing back basic medical supplies.'),
    success: bi('12 人安全撤离并完成清点。', 'All 12 evacuate safely and are accounted for.'),
    near_miss: bi('12 人全部撤离，其中 2 人需要观察及医疗交接。', 'All 12 evacuate. Two need observation and clinical handover.'),
    twist: bi('8 人撤离，4 人在上层避难室待援，双向联系保持；保障约两小时。', '8 evacuate; 4 wait in the upper refuge with two-way radio and roughly two hours of protection.'),
    consequences: bi('8 人撤离，4 人在避难室待援；无线电失效，位置与名单保留，保障约两小时。', '8 evacuate; 4 wait in the refuge. Radio fails, but their names and location are recorded. Protection lasts roughly two hours.')
  },
  isolation: {
    boon: bi('隔离验证和诊所交接完成；保存原始日志并找到备件。', 'Isolation is verified and clinic handover complete. Preserve original logs and recover spare parts.'),
    success: bi('隔离和备用供电交接完成；报告真实性取决于实际表达。', 'Isolation and backup-power handover are complete. The statement’s accuracy depends on what you actually report.'),
    near_miss: bi('隔离完成，临时封堵需次日复核；由具名负责人接手。', 'Isolation is complete with a temporary seal. A named owner must recheck it tomorrow.'),
    twist: bi('隔离尚未验证，外围封锁；独立备用供电正常，保留机械指示检修线索。', 'Isolation is unverified; cordon the site. Independent backup power works; the mechanical indicator guides follow-up repairs.'),
    consequences: bi('泵站封锁，部分设备被淹；诊所备用保障仍在，必须在 20 分钟保障结束前安排后续供电。', 'Cordon the station; some equipment floods. Clinic backup remains available. Arrange further power before its 20-minute protection ends.')
  }
};
export const preparationOutcomes: Record<Tier, Text> = {
  boon: bi('实地准备充分，对应执行 DC 降低 2；NPC 主动提供协助。全部线索保留。', 'Preparation is verified: reduce the corresponding execution DC by 2. An NPC offers support. All evidence remains.'),
  success: bi('准备验证完成，对应执行 DC 降低 2。', 'Preparation is verified: reduce the corresponding execution DC by 2.'),
  near_miss: bi('线索全部获得；准备尚不足以降低执行 DC。', 'All evidence is available; preparation is not sufficient to lower execution DC.'),
  twist: bi('尝试受阻，NPC 提供备用办法。线索全部保留，执行 DC 不追加罚点。', 'The attempt stalls; an NPC offers a backup. All evidence remains. Later DCs do not increase.'),
  consequences: bi('验证工具暂时失灵。关键线索仍公开，使用基本设备继续，执行 DC 不变。', 'A test tool temporarily fails. Essential evidence stays public. Continue with basic equipment and unchanged execution DCs.')
};
export const planPresets: Record<Objective, { id: string; label: Text }[]> = {
  access: [
    { id: 'access-anchor', label: bi('检查锚点与绞盘，建立标记安全线', 'Check anchors and winch; mark a safe line') },
    { id: 'access-boat', label: bi('确认背风窗口与系泊，固定高位电机', 'Verify the lee-side window and moorings; secure the motor') },
    { id: 'access-gate', label: bi('从外侧操作闸门，验证检修步道', 'Operate the exterior gate; verify the walkway') }
  ],
  evacuation: [
    { id: 'evacuation-assisted', label: bi('优先协助两名工人，逐一清点交接', 'Assist the two workers first; count and hand over everyone') },
    { id: 'evacuation-boat', label: bi('两趟各 6 人，接收点双人核对名单', 'Two trips of 6; two people check the receiving roster') },
    { id: 'evacuation-pairs', label: bi('结伴移动，安排吊带与接收点照护', 'Move in pairs with harnesses and receiving-point care') }
  ],
  isolation: [
    { id: 'isolation-local', label: bi('Mira 验证本地停机，Vale 确认供电交接', 'Mira verifies local shutdown; Vale confirms power handover') },
    { id: 'isolation-record', label: bi('手动隔离并保存原始日志，Tavi 发布限制', 'Isolate manually and preserve logs; Tavi broadcasts restrictions') }
  ]
};
export const backups = [
  { id: 'backup-manual', label: bi('启用慢速手动备用通路，标记边界', 'Use the slow manual backup route and mark boundaries') },
  { id: 'backup-refuge', label: bi('上层避难室安置 4 人，保留位置与名单', 'Shelter 4 in the upper refuge; retain names and location') },
  { id: 'backup-cordon', label: bi('封锁外围，安排独立供电与具名复查', 'Cordon the site; arrange independent power and a named recheck') }
];
export const negotiationOptions = [
  { id: 'verify', label: bi('说明未知，请 Mira 现场验证、Tavi 发布警报', 'Disclose uncertainty; ask Mira to verify and Tavi to warn') },
  { id: 'handover', label: bi('先安排医疗与供电交接，再同步风险', 'Arrange care and power handover, then update the risk notice') },
  { id: 'both', label: bi('并行分工：验证、医疗、真实通报同时推进', 'Work in parallel: verification, care and a factual update') }
];
export const debriefPrompts = [
  bi('我们先相信了哪些证据？什么改变了判断？', 'Which evidence did we trust first? What changed our judgment?'),
  bi('谁承担方案代价？谁的声音没有被听见？', 'Who bore the costs? Whose voice went unheard?'),
  bi('我们怎样处理公众安全、能力边界与真实通报？', 'How did we handle public safety, competence limits and truthful reporting?'),
  bi('下次真实工程协作，要改变哪个流程？', 'What process would we change in our next real engineering collaboration?')
];
export const isolationLabels: Record<string, Text> = {
  pending: bi('待验证', 'Pending verification'), verified: bi('已验证隔离', 'Isolation verified'),
  'temporary-recheck-required': bi('临时隔离，次日复核', 'Temporary isolation; recheck tomorrow'),
  'unverified-cordon': bi('未验证，外围封锁', 'Unverified; cordon in place'),
  'unverified-damage': bi('未验证，设备受损', 'Unverified; equipment damaged')
};
export const clinicLabels: Record<string, Text> = {
  pending: bi('20 分钟独立备用，待交接', '20-minute independent backup; handover pending'),
  complete: bi('备用供电交接完成', 'Backup-power handover complete'),
  'follow-up-required': bi('备用正常，待后续供电', 'Backup active; follow-up power needed'),
  'urgent-follow-up-required': bi('需在备用结束前接续供电', 'Arrange power before backup ends')
};
export function tracks(room: Pick<Room, 'checks' | 'override'> | Pick<RoomView, 'checks' | 'override'>): Tracks {
  if (room.override) return room.override;
  const people = room.checks.find(c => c.kind === 'execution' && c.objective === 'evacuation')?.result?.tier;
  const facility = room.checks.find(c => c.kind === 'execution' && c.objective === 'isolation')?.result?.tier;
  return {
    evacuated: people ? (people === 'twist' || people === 'consequences' ? 8 : 12) : 0,
    waiting: people ? (people === 'twist' || people === 'consequences' ? 4 : 0) : 12,
    observation: people === 'near_miss' ? 2 : 0,
    isolation: !facility ? 'pending' : facility === 'boon' || facility === 'success' ? 'verified' : facility === 'near_miss' ? 'temporary-recheck-required' : facility === 'twist' ? 'unverified-cordon' : 'unverified-damage',
    clinic: !facility ? 'pending' : facility === 'twist' ? 'follow-up-required' : facility === 'consequences' ? 'urgent-follow-up-required' : 'complete'
  };
}
export function displayPlan(value: string): Text {
  return [...Object.values(planPresets).flat(), ...backups].find(p => p.id === value)?.label ?? bi(value, value);
}
