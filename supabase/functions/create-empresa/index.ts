import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import {
  applyMockFallback,
  fetchWithTimeout,
  isMockInstanceName,
  isMockModeEnabled,
  persistEvolutionState,
} from "../_shared/evolutionMock.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

async function lerJson(resp: Response): Promise<any | null> {
  try {
    return await resp.json()
  } catch {
    return null
  }
}

// Fallback local/mock: nunca apaga a empresa. Grava uma instância mock e
// devolve 200 para o painel continuar operando.
async function responderComFallbackMock(
  supabaseAdmin: any,
  empresaId: string,
  motivo?: string
) {
  const fallback = await applyMockFallback(supabaseAdmin, empresaId, { motivo })

  return json({ empresaId, ...fallback })
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders })

  try {
    const { nome } = await req.json()
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Header de autorização ausente.")
    if (typeof nome !== "string" || !nome.trim())
      throw new Error("Informe o nome da empresa.")

    const supabaseAdmin = createClient(
      Deno.env.get("VITE_SUPABASE_URL") ?? "",
      Deno.env.get("VITE_SERVICE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // 1. Autenticação: quem é?
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error("Token inválido ou acesso negado.")

    // 2. Autorização: só o topo da pirâmide
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("administradores")
      .select("cargo")
      .eq("id", user.id)
      .single()
    if (adminError)
      throw new Error("Falha ao ler privilégios do usuário logado.")
    if (adminData?.cargo !== "super_admin")
      throw new Error("Apenas o super admin pode criar empresas.")

    // 3. Cria a empresa
    const { data: empresa, error: empError } = await supabaseAdmin
      .from("empresas")
      .insert({ name: nome.trim(), status: true })
      .select("id")
      .single()
    if (empError || !empresa) throw empError ?? new Error("Falha ao criar empresa.")

    const empresaId = empresa.id as string

    // 4. Sem backend configurado (ou MOCK_MODE explícito): mock direto.
    if (isMockModeEnabled()) {
      return await responderComFallbackMock(
        supabaseAdmin,
        empresaId,
        "MOCK_MODE ativo ou KOYEB_BACKEND_URL ausente."
      )
    }

    // 5. Provisiona no Koyeb. Qualquer falha (HTTP, timeout, JSON inválido)
    //    cai no fallback local — a empresa NUNCA é apagada.
    try {
      const resp = await fetchWithTimeout(
        `${Deno.env.get("KOYEB_BACKEND_URL")}/provisionar/${empresaId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("PROVISION_SECRET")}`,
          },
        }
      )

      const corpo = await lerJson(resp)

      // 5.1. 409 (versões antigas do backend): já existe instância -> sucesso.
      if (resp.status === 409) {
        const instanceName =
          corpo?.instanceName ?? corpo?.instance_name ?? null

        if (!instanceName) {
          return await responderComFallbackMock(
            supabaseAdmin,
            empresaId,
            "Backend respondeu 409 sem informar a instância existente."
          )
        }

        const mock =
          Boolean(corpo?.mock) || isMockInstanceName(instanceName)
        const whatsappStatus =
          corpo?.whatsapp_status ?? (mock ? "connected" : "awaiting_qr")
        const persistencia = await persistEvolutionState(
          supabaseAdmin,
          empresaId,
          instanceName,
          whatsappStatus
        )

        return json({
          empresaId,
          instanceName,
          qrBase64: corpo?.qrBase64 ?? null,
          mock,
          fallback: false,
          alreadyProvisioned: true,
          whatsapp_status: whatsappStatus,
          persisted: persistencia.ok,
          ...(persistencia.error ? { warning: persistencia.error } : {}),
        })
      }

      if (!resp.ok) {
        console.warn(
          `[CREATE-EMPRESA] Backend indisponível (HTTP ${resp.status}). Ativando fallback local.`
        )
        return await responderComFallbackMock(
          supabaseAdmin,
          empresaId,
          `Backend respondeu HTTP ${resp.status} ao provisionar.`
        )
      }

      const instanceName = corpo?.instanceName ?? corpo?.instance_name ?? null

      if (!instanceName) {
        return await responderComFallbackMock(
          supabaseAdmin,
          empresaId,
          "Backend respondeu 200 sem informar a instância."
        )
      }

      const mock = Boolean(corpo?.mock) || isMockInstanceName(instanceName)
      const whatsappStatus =
        corpo?.whatsapp_status ?? (mock ? "connected" : "awaiting_qr")
      const persistencia = await persistEvolutionState(
        supabaseAdmin,
        empresaId,
        instanceName,
        whatsappStatus
      )

      return json({
        empresaId,
        instanceName,
        qrBase64: corpo?.qrBase64 ?? null,
        mock,
        fallback: false,
        alreadyProvisioned: Boolean(corpo?.alreadyProvisioned),
        whatsapp_status: whatsappStatus,
        persisted: persistencia.ok,
        ...(persistencia.error ? { warning: persistencia.error } : {}),
      })
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error)
      console.warn(
        `[CREATE-EMPRESA] Falha no provisionamento remoto (${motivo}). Ativando fallback local.`
      )
      return await responderComFallbackMock(supabaseAdmin, empresaId, motivo)
    }
  } catch (error: unknown) {
    const erroReal =
      error instanceof Error ? error.message : JSON.stringify(error)
    return json({ error: erroReal }, 400)
  }
})
