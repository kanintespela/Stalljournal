import { db, nowIso } from '../db/db'

// Gårdsuppgifter — synkas mellan enheter (farm_settings, en rad per nyckel
// med nyckeln som id, se types.ts). Fylls i en gång och delas av hela gården.

async function getSetting(key: string): Promise<string> {
  const row = await db.farm_settings.get(key)
  return row && row.deleted_at === null ? row.value : ''
}
async function setSetting(key: string, value: string): Promise<void> {
  // Skriv bara om värdet faktiskt ändrats — annars skulle varje "Spara" ge
  // ett nytt updated_at och kunna vinna över en annan enhets nyare ändring.
  if ((await getSetting(key)) === value) return
  await db.farm_settings.put({ id: key, value, updated_at: nowIso(), deleted_at: null })
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
