import { db, newId, nowIso } from '../db/db'
import type { Animal, GroupMembership, GroupMove, Treatment } from '../db/types'

// Use cases för grupper/platser/behandling — se docs/arkitektur.md §4.
// Körs som lokala transaktioner: fungerar offline och synkas som radändringar.

export interface MemberWithAnimal {
  membership: GroupMembership
  animal: Animal
}

export async function activeMembersWithAnimals(groupId: string): Promise<MemberWithAnimal[]> {
  const ms = await db.group_memberships.where('group_id').equals(groupId).toArray()
  const open = ms.filter((m) => m.deleted_at === null && m.removed_on === null)
  const animals = await db.animals.bulkGet(open.map((m) => m.animal_id))
  return open
    .map((m, i) => ({ membership: m, animal: animals[i] }))
    .filter((x): x is MemberWithAnimal => Boolean(x.animal && x.animal.deleted_at === null))
    .sort((a, b) => a.animal.tag_number.localeCompare(b.animal.tag_number, 'sv', { numeric: true }))
}

/** Gruppens öppna flytt (= aktuell placering), eller undefined. */
export async function openMove(groupId: string): Promise<GroupMove | undefined> {
  const moves = await db.group_moves.where('group_id').equals(groupId).toArray()
  return moves
    .filter((m) => m.deleted_at === null && m.ended_on === null)
    .sort((a, b) => b.moved_on.localeCompare(a.moved_on))[0]
}

/** Flytta grupp: stäng föregående öppna flytt och skapa en ny. */
export async function moveGroup(groupId: string, placeId: string, movedOn: string, note: string): Promise<void> {
  await db.transaction('rw', db.group_moves, async () => {
    const open = await openMove(groupId)
    const now = nowIso()
    if (open) {
      await db.group_moves.update(open.id, { ended_on: movedOn, end_reason: 'Flytt', updated_at: now })
    }
    await db.group_moves.add({
      id: newId(),
      group_id: groupId,
      place_id: placeId,
      moved_on: movedOn,
      ended_on: null,
      end_reason: '',
      note,
      updated_at: now,
      deleted_at: null,
    })
  })
}

export async function addAnimalsToGroup(groupId: string, animalIds: string[], addedOn: string): Promise<void> {
  const now = nowIso()
  await db.group_memberships.bulkAdd(
    animalIds.map((animalId) => ({
      id: newId(),
      animal_id: animalId,
      group_id: groupId,
      added_on: addedOn,
      removed_on: null,
      updated_at: now,
      deleted_at: null,
    })),
  )
}

export async function endMembership(membershipId: string, removedOn: string): Promise<void> {
  await db.group_memberships.update(membershipId, { removed_on: removedOn, updated_at: nowIso() })
}

/** Gruppbehandling: en behandlingsrad per aktivt djur i gruppen. Returnerar antal. */
export async function treatGroupMembers(
  groupId: string,
  data: Omit<Treatment, 'id' | 'animal_id' | 'updated_at' | 'deleted_at'>,
): Promise<number> {
  const members = await activeMembersWithAnimals(groupId)
  const active = members.filter((x) => x.animal.status === 'active')
  const now = nowIso()
  await db.treatments.bulkAdd(
    active.map((x) => ({ ...data, id: newId(), animal_id: x.animal.id, updated_at: now, deleted_at: null })),
  )
  return active.length
}

/** Hela dygn mellan två datum (t.o.m. idag om slut saknas). */
export function daysBetween(from: string, to: string | null): number {
  const a = new Date(from)
  const b = to ? new Date(to) : new Date()
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

/** "1 dag" / "2 dagar" — svensk pluralböjning. */
export function dagarText(n: number): string {
  return `${n} ${n === 1 ? 'dag' : 'dagar'}`
}

/** Djurets aktiva gruppmedlemskap. */
export async function groupsForAnimal(animalId: string) {
  const ms = await db.group_memberships.where('animal_id').equals(animalId).toArray()
  const open = ms.filter((m) => m.deleted_at === null && m.removed_on === null)
  const groups = await db.herd_groups.bulkGet(open.map((m) => m.group_id))
  return open
    .map((m, i) => ({ membership: m, group: groups[i] }))
    .filter((x): x is { membership: GroupMembership; group: NonNullable<(typeof groups)[number]> } =>
      Boolean(x.group && x.group.deleted_at === null),
    )
}
