// Helpers compartilhados de fallback/mock da Evolution.
// Usado pelas Edge Functions quando o backend remoto (Koyeb) ou a Evolution
// estão indisponíveis, para que o painel continue funcionando em modo local.

export const MOCK_PREFIX = "mock-"

const TIMEOUT_PADRAO_MS = 10_000

export interface MockEvolutionState {
  instanceName: string
  whatsappStatus: "connected"
  qrBase64: string
  mock: true
}

export interface PersistenciaResultado {
  ok: boolean
  error?: string
}

export interface MockFallbackResult {
  instanceName: string
  qrBase64: string
  mock: true
  fallback: boolean
  whatsapp_status: "connected"
  persisted: boolean
  fallbackReason: string | null
  warning?: string
}

export function isMockModeEnabled(): boolean {
  return (
    Deno.env.get("MOCK_MODE") === "true" || !Deno.env.get("KOYEB_BACKEND_URL")
  )
}

export function buildMockInstanceName(empresaId: string): string {
  const limpo = String(empresaId ?? "")
    .replace(/-/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
  return `${MOCK_PREFIX}${limpo.slice(0, 8) || "local"}`
}

export function isMockInstanceName(instanceName?: string | null): boolean {
  return (
    typeof instanceName === "string" && instanceName.startsWith(MOCK_PREFIX)
  )
}

// QR fake porém válido: um SVG em data URI, aceito diretamente em <img src>.
export function buildMockQrCode(instanceName?: string | null): string {
  const nome = String(instanceName ?? "mock-local").replace(/[<>&"']/g, "")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="QR Code simulado">
  <rect width="320" height="320" fill="#ffffff"/>
  <rect x="12" y="12" width="296" height="296" rx="12" fill="none" stroke="#111827" stroke-width="8"/>
  <rect x="36" y="36" width="72" height="72" fill="#111827"/>
  <rect x="52" y="52" width="40" height="40" fill="#ffffff"/>
  <rect x="212" y="36" width="72" height="72" fill="#111827"/>
  <rect x="228" y="52" width="40" height="40" fill="#ffffff"/>
  <rect x="36" y="212" width="72" height="72" fill="#111827"/>
  <rect x="52" y="228" width="40" height="40" fill="#ffffff"/>
  <rect x="136" y="36" width="16" height="16" fill="#111827"/>
  <rect x="168" y="36" width="16" height="16" fill="#111827"/>
  <rect x="136" y="68" width="16" height="16" fill="#111827"/>
  <rect x="168" y="68" width="16" height="16" fill="#111827"/>
  <rect x="136" y="136" width="48" height="48" fill="#111827"/>
  <rect x="144" y="144" width="32" height="32" fill="#ffffff"/>
  <rect x="136" y="212" width="16" height="16" fill="#111827"/>
  <rect x="168" y="212" width="16" height="16" fill="#111827"/>
  <rect x="200" y="212" width="16" height="16" fill="#111827"/>
  <rect x="232" y="212" width="16" height="16" fill="#111827"/>
  <rect x="264" y="212" width="16" height="16" fill="#111827"/>
  <rect x="136" y="244" width="16" height="16" fill="#111827"/>
  <rect x="200" y="244" width="16" height="16" fill="#111827"/>
  <rect x="264" y="244" width="16" height="16" fill="#111827"/>
  <rect x="136" y="276" width="16" height="16" fill="#111827"/>
  <rect x="168" y="276" width="16" height="16" fill="#111827"/>
  <rect x="232" y="276" width="16" height="16" fill="#111827"/>
  <text x="160" y="154" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#111827">MODO LOCAL</text>
  <text x="160" y="180" text-anchor="middle" font-family="monospace" font-size="11" fill="#374151">${nome}</text>
</svg>`

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function buildMockEvolutionState(
  empresaId: string,
  instanceName?: string | null
): MockEvolutionState {
  const nome = instanceName?.trim() || buildMockInstanceName(empresaId)

  return {
    instanceName: nome,
    whatsappStatus: "connected",
    qrBase64: buildMockQrCode(nome),
    mock: true,
  }
}

// Grava o vínculo da empresa com a instância. Nunca lança: o fallback não
// pode derrubar a Edge Function por causa de uma falha de update.
export async function persistEvolutionState(
  supabaseAdmin: any,
  empresaId: string,
  instanceName: string,
  whatsappStatus: string
): Promise<PersistenciaResultado> {
  try {
    const { error } = await supabaseAdmin
      .from("empresas")
      .update({ instance_name: instanceName, whatsapp_status: whatsappStatus })
      .eq("id", empresaId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Aplica o fallback local/mock e devolve os campos prontos para a resposta.
// Preserva um instance_name real já existente; só gera mock-<8> se não houver.
export async function applyMockFallback(
  supabaseAdmin: any,
  empresaId: string,
  options: { instanceName?: string | null; motivo?: string } = {}
): Promise<MockFallbackResult> {
  const state = buildMockEvolutionState(empresaId, options.instanceName)
  const persistencia = await persistEvolutionState(
    supabaseAdmin,
    empresaId,
    state.instanceName,
    state.whatsappStatus
  )

  return {
    instanceName: state.instanceName,
    qrBase64: state.qrBase64,
    mock: true,
    fallback: Boolean(options.motivo),
    whatsapp_status: state.whatsappStatus,
    persisted: persistencia.ok,
    fallbackReason: options.motivo ?? null,
    ...(persistencia.error ? { warning: persistencia.error } : {}),
  }
}

// fetch com timeout para que uma indisponibilidade da Evolution não deixe a
// Edge Function pendurada. O tempo pode ser ajustado por env (testes/dev).
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  const envTimeout = Number(Deno.env.get("EVOLUTION_TIMEOUT_MS"))
  const duracao =
    timeoutMs ??
    (Number.isFinite(envTimeout) && envTimeout > 0
      ? envTimeout
      : TIMEOUT_PADRAO_MS)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), duracao)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
