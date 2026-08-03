import { db } from '../db/db'

// Gårdsuppgifter — sparas lokalt (app_setting, synkas inte, se CLAUDE.md).
// I praktiken en per-enhet-inställning (samma mönster som synkserverns URL),
// men eftersom en gård oftast delar samma fordon och SE-nummer räcker det
// att ange en gång per enhet och sedan återanvända.

async function getSetting(key: string): Promise<string> {
  const row = await db.app_settings.get(key)
  return row?.value ?? ''
}
async function setSetting(key: string, value: string): Promise<void> {
  await db.app_settings.put({ key, value })
}
async function setSettingIfNonEmpty(key: string, value: string): Promise<void> {
  if (!value) return
  await setSetting(key, value)
}

const KEYS = {
  name: 'farm_name',
  address: 'farm_address',
  phone: 'farm_phone',
  email: 'farm_email',
  seNumber: 'own_se_number',
  vehicleReg: 'last_vehicle_reg',
  transporterPermit: 'last_transporter_permit',
} as const

export interface FarmSettings {
  name: string
  address: string
  phone: string
  email: string
  seNumber: string
  vehicleReg: string
  transporterPermit: string
}

export async function getFarmSettings(): Promise<FarmSettings> {
  const entries = await Promise.all(
    (Object.entries(KEYS) as [keyof FarmSettings, string][]).map(
      async ([field, key]) => [field, await getSetting(key)] as const,
    ),
  )
  return Object.fromEntries(entries) as unknown as FarmSettings
}

export async function saveFarmSettings(settings: FarmSettings): Promise<void> {
  await Promise.all(
    (Object.entries(KEYS) as [keyof FarmSettings, string][]).map(([field, key]) => setSetting(key, settings[field])),
  )
}

// Används av förflyttningsflödet (AnimalMovementFormPage/movementDocument) —
// samma inställningar, men skriver aldrig över ett sparat värde med tomt
// (en enskild flytt utan fordon ska inte radera det ihågkomna standardfordonet).
export const getOwnSeNumber = () => getSetting(KEYS.seNumber)
export const setOwnSeNumber = (value: string) => setSettingIfNonEmpty(KEYS.seNumber, value)
export const getLastVehicleReg = () => getSetting(KEYS.vehicleReg)
export const setLastVehicleReg = (value: string) => setSettingIfNonEmpty(KEYS.vehicleReg, value)
export const getLastTransporterPermit = () => getSetting(KEYS.transporterPermit)
export const setLastTransporterPermit = (value: string) => setSettingIfNonEmpty(KEYS.transporterPermit, value)
