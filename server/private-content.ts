import { bi } from '../shared/types';
// 仅服务端导入；玩家快照不包含这些主持提示。
export const gmContext = [
  { name: 'Mira', context: bi('批准过临时旁路，担心工程信誉。不要把她演成必须击败的反派；拒绝虚假签字仍可合作。', 'She approved the temporary bypass and fears losing trust. She is not an adversary to defeat; refusing a false sign-off does not stop her cooperation.') },
  { name: 'Tavi', context: bi('保留原始通报及修正。说真话不掷骰；是否隐瞒由实际发言决定。', 'Retain the original message and corrections. Truthful updates require no roll; concealment depends on what is actually said.') },
  { name: 'Dr. Vale', context: bi('备用保障独立于泵站和避难室。不要因为隔离低骰就突然取消医疗保障或制造死亡。', 'Clinic backup is independent of station and refuge protection. A poor isolation roll must not suddenly cancel care or cause deaths.') }
];
