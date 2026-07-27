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

/** Ger en PocketBase-klient för den sparade serveradressen (eller null om ingen är satt). */
export function pb(): PocketBase | null {
  const url = getServerUrl()
  if (!url) return null
  if (!instance || instanceUrl !== url) {
    instance = new PocketBase(url)
    instanceUrl = url
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

/** Testar att servern svarar (utan att kräva inloggning). */
export async function checkServerReachable(url: string): Promise<boolean> {
  try {
    const client = new PocketBase(url.replace(/\/+$/, ''))
    const res = await client.health.check()
    return res.code === 200
  } catch {
    return false
  }
}
