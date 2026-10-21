export type Locale = 'zh-CN' | 'en';
export type Text = Record<Locale, string>;
export const bi = (zh: string, en: string): Text => ({ 'zh-CN': zh, en });
export const phases = ['lobby', 'briefing', 'investigation', 'negotiation', 'route_choice', 'execution', 'ending', 'debrief'] as const;
export type Phase = typeof phases[number];
export const objectives = ['access', 'evacuation', 'isolation'] as const;
export type Objective = typeof objectives[number];
export const tiers = ['consequences', 'twist', 'near_miss', 'success', 'boon'] as const;
export type Tier = typeof tiers[number];
export type Role = 'gm' | 'player' | 'spectator';
export type RouteId = 'high_line' | 'quiet_water' | 'borrowed_channel' | 'custom';
export interface Settings { mode: 'full' | 'short'; gmCount: number; dice: 'virtual' | 'physical' }
export interface Member { id: string; name: string; role: Role; character: string; leads: number; joinedAt: number }
export interface Result { die: number; total: number; dc: number; delta: number; rawTier: Tier; tier: Tier; kitSpent: boolean; rolledAt: number }
export interface Check {
  id: string; kind: 'preparation' | 'execution'; objective: Objective;
  action: string; backup: string; bonus: number; bonusReason: string; creative: number; preparation: number;
  eligible: string[]; responses: Record<string, boolean>; leadId: string | null; supportId: string | null;
  status: 'recruiting' | 'selected' | 'resolved'; result: Result | null;
  narrative: string; correctionReason: string;
}
export interface Poll {
  id: string; kind: 'route' | 'kit' | 'decision'; question: Text;
  options: { id: string; label: Text }[]; eligible: string[]; ballots: Record<string, string>;
  status: 'open' | 'closed'; outcome: string | null; tied: string[];
  checkId: string | null; closeReason: string;
}
export interface Report {
  observations: string; uncertainty: string; owner: string; nextUpdate: string; statement: string;
  restrictions: string; backup: string; truthfulness: 'unreviewed' | 'accurate' | 'incomplete' | 'misleading';
}
export interface Tracks { evacuated: number; waiting: number; observation: number; isolation: string; clinic: string }
export interface Log { id: string; at: number; actorId: string; text: Text }
export interface Room {
  schemaVersion: 1; scenarioVersion: '1.0.0'; id: string; code: string; revision: number; createdAt: number;
  hostId: string; settings: Settings; phase: Phase; members: Member[]; evidence: string[];
  checks: Check[]; polls: Poll[]; route: RouteId | null;
  customRoute: { plan: string; costs: string; assumptions: string };
  emergencyKits: number; report: Report; override: Tracks | null; overrideReason: string;
  reflections: Record<string, Record<string, string>>; gmNotes: string;
  clock: { runningSince: number | null; elapsed: number };
  logs: Log[];
}
export interface PublicPoll extends Omit<Poll, 'ballots'> { voted: string[]; myVote: string | null; counts: Record<string, number> | null }
export interface RoomView extends Omit<Room, 'polls' | 'gmNotes'> {
  polls: PublicPoll[]; gmNotes?: string; me: string; online: string[];
  gmContext?: { name: string; context: Text }[];
}
export interface Session { code: string; token: string; memberId: string; name: string }
export interface Command { id: string; revision: number; type: string; payload?: Record<string, unknown> }
export interface GameError { error: string; message: Text; state?: RoomView }
