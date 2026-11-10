import type { ArchivedMember, Member } from './types';

export const maxActiveMembers = 40;
type Identities = { members: Member[]; archivedMembers?: ArchivedMember[] };

/** Attribution lookup, not an authorization or recruitment lookup. Also accepts old cached views. */
export function memberById(room: Identities, id: string | null | undefined): Member | ArchivedMember | undefined {
  return room.members.find(member => member.id === id) ?? room.archivedMembers?.find(member => member.id === id);
}
export function memberName(room: Identities, id: string | null | undefined, fallback = '?'): string {
  return memberById(room, id)?.name ?? fallback;
}
