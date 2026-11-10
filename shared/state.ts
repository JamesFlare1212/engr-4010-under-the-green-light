import type { Check, Poll, Report, Room } from './types';

export const maxPollHistory = 300;
type PollState = Pick<Poll, 'status' | 'tied' | 'outcome'>;
export function isPendingPoll(poll: PollState): boolean {
  return poll.status === 'open' || (poll.tied.length > 0 && !poll.outcome);
}
export function handoverComplete(report: Pick<Report, 'statement' | 'owner' | 'nextUpdate'>): boolean {
  return Boolean(report.statement.trim() && report.owner.trim() && report.nextUpdate.trim());
}
export function canOpenKitVote(room: Pick<Room, 'phase' | 'checks' | 'emergencyKits' | 'members'> & { polls: PollState[] }, check: Check | undefined): boolean {
  return Boolean(room.phase === 'execution' && check && room.checks.at(-1)?.id === check.id && check.kind === 'execution'
    && check.status === 'resolved' && check.result && check.result.delta < 0 && !check.result.kitSpent && room.emergencyKits > 0
    && room.members.some(member => member.role === 'player') && !room.polls.some(isPendingPoll));
}
