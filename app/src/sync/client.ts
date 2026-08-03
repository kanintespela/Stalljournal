import PocketBase from 'pocketbase'

// Anslutning till den självhostade PocketBase-servern (t.ex. nåbar via
// Tailscale). Serveradress och inloggning sparas av PocketBase-SDK:t i
// localStorage — inget hemligt hamnar i appens källkod eller i git.

const URL_KEY = 'stalljournal_pb_url'

export function getServerUrl(): string {
  return localStorage.getItem(URL_KEY) ?? ''
}

export function setServerUrl(url: string) {
  localStorage.setItem(URL_KEY, url.replace(/\/+$/, ''))
}

export function clearServerUrl() {
  localStorage.removeItem(URL_KEY)
}

let instance: PocketBase | null = null
let instanceUrl = ''

const REQUEST_TIMEOUT_MS = 15000

/** Ger en PocketBase-klient för den sparade serveradressen (eller null om ingen är satt). */
export function pb(): PocketBase | null {
  const url = getServerUrl()
  if (!url) return null
  if (!instance || instanceUrl !== url) {
    instance = new PocketBase(url)
    instanceUrl = url
    // Varje enskild request får en egen timeout — utan den kan bakgrundssynken
    // (var 5:e minut, se App.tsx) hänga kvar tyst om servern blir onåbar
    // (t.ex. enheten lämnar Tailscale-nätet) istället för att ge upp och
    // rapportera ett fel som visas i synkresultatet.
    instance.beforeSend = (url, options) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      return { url, options: { ...options, signal: controller.signal } }
    }
  }
  return instance
}

export function isLoggedIn(): boolean {
  return pb()?.authStore.isValid ?? false
}

export function currentUserEmail(): string | null {
  const model = pb()?.authStore.model
  return (model?.email as string | undefined) ?? null
}

export async function login(email: string, password: string): Promise<void> {
  const client = pb()
  if (!client) throw new Error('Ingen server konfigurerad.')
  await client.collection('users').authWithPassword(email, password)
}

export function logout(): void {
  pb()?.authStore.clear()
}

const HEALTH_CHECK_TIMEOUT_MS = 8000

/**
 * Testar att servern svarar (utan att kräva inloggning). Tidsbegränsad —
 * annars kan ett felstavat/otillgängligt Tailscale-IP hänga kvar på
 * "Ansluter…" väldigt länge, utan felmeddelande och utan sätt att avbryta
 * (fetch saknar egen timeout, och AbortSignal räcker inte ensamt — en
 * hängande anslutning på nätverksnivå besvarar inte alltid en abort direkt).
 * Promise.race garanterar att anropet till UI:t ändå ger sig efter
 * tidsgränsen, oavsett vad den underliggande förfrågan gör.
 */
export async function checkServerReachable(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
  try {
    const client = new PocketBase(url.replace(/\/+$/, ''))
    const res = await Promise.race([
      client.health.check({ signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Tidsgräns överskriden')))
      }),
    ])
    return res.code === 200
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
