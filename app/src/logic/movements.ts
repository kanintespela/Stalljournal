import { db, newId, nowIso } from '../db/db'
import type { AnimalMovement } from '../db/types'

/** Skapar en förflyttningsrad per djur — samma mönster som treatGroupMembers. */
export async function createAnimalMovements(
  animalIds: string[],
  data: Omit<AnimalMovement, 'id' | 'animal_id' | 'updated_at' | 'deleted_at'>,
): Promise<number> {
  const now = nowIso()
  await db.animal_movements.bulkAdd(
    animalIds.map((animalId) => ({ ...data, id: newId(), animal_id: animalId, updated_at: now, deleted_at: null })),
  )
  return animalIds.length
}

// Gårdsuppgifter för förflyttningsdokumentet — sparas lokalt (app_setting,
// synkas inte, se CLAUDE.md) så de bara behöver anges en gång per enhet och
// sedan förifylls, men går alltid att justera i formuläret för en enskild flytt.
async function getAppSetting(key: string): Promise<string> {
  const row = await db.app_settings.get(key)
  return row?.value ?? ''
}
async function setAppSetting(key: string, value: string): Promise<void> {
  if (!value) return
  await db.app_settings.put({ key, value })
}

const OWN_SE_NUMBER_KEY = 'own_se_number'
const LAST_VEHICLE_REG_KEY = 'last_vehicle_reg'
const LAST_TRANSPORTER_PERMIT_KEY = 'last_transporter_permit'

export const getOwnSeNumber = () => getAppSetting(OWN_SE_NUMBER_KEY)
export const setOwnSeNumber = (value: string) => setAppSetting(OWN_SE_NUMBER_KEY, value)
export const getLastVehicleReg = () => getAppSetting(LAST_VEHICLE_REG_KEY)
export const setLastVehicleReg = (value: string) => setAppSetting(LAST_VEHICLE_REG_KEY, value)
export const getLastTransporterPermit = () => getAppSetting(LAST_TRANSPORTER_PERMIT_KEY)
export const setLastTransporterPermit = (value: string) => setAppSetting(LAST_TRANSPORTER_PERMIT_KEY, value)

/** Bästa gissning på djurets identitetskod utifrån lagrad data — användaren kan justera innan utskrift. */
export function suggestedIdentity(animal: { se_number: string; tag_number: string }): string {
  return [animal.se_number, animal.tag_number].filter(Boolean).join(' ')
}
