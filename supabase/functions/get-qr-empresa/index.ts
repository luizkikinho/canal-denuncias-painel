import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import {
  applyMockFallback,
  fetchWithTimeout,
  isMockInstanceName,
  isMockModeEnabled,
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

// Fallback local/mock: devolve 200 com QR fake e a flag mock.
// Preserva um instance_name real já existente; só cria um mock-<8> quando a
// empresa ainda não tem instância.
async function responderComFallbackMock(
  supabaseAdmin: any,
  empresaId: string,
  empresa: { instance_name?: string | null; whatsapp_status?: string | null },
  motivo?: string
) {
  const fallback = await applyMockFallback(supabaseAdmin, empresaId, {
    instanceName: empresa.instance_name,
    motivo,
  })

  return json({ empresaId, ...fallback })
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders })

  try {
    const { empresaId } = await req.json()
    if (!empresaId) throw new Error("Informe empresaId.")

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Header de autorização ausente.")

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

    // 2. Autorização: super_admin OU master da própria empresa
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("administradores")
      .select("cargo, empresa_id")
      .eq("id", user.id)
      .single()
    if (adminError)
      throw new Error("Falha ao ler privilégios do usuário logado.")

    const ehSuperAdmin = adminData?.cargo === "super_admin"
    const ehMasterDaEmpresa =
      adminData?.cargo === "master" && adminData?.empresa_id === empresaId
    if (!ehSuperAdmin && !ehMasterDaEmpresa) {
      throw new Error("Sem permissão para conectar esta empresa.")
    }

    // 3. Empresa precisa existir (falha de banco não é indisponibilidade da
    // Evolution; essas continuam retornando erro controlado no catch).
    const { data: empresa, error: empError } = await supabaseAdmin
      .from("empresas")
      .select("id, instance_name, whatsapp_status")
      .eq("id", empresaId)
      .maybeSingle()

    if (empError) throw new Error("Falha ao consultar a empresa.")
    if (!empresa) throw new Error("Empresa não encontrada.")

    // 4. Sem backend configurado (ou MOCK_MODE explícito): mock direto.
    if (isMockModeEnabled()) {
      return await responderComFallbackMock(
        supabaseAdmin,
        empresaId,
        empresa
      )
    }

    // 5. QR vem do Koyeb — a chave da Evolution nunca toca o navegador.
    //    Qualquer falha (HTTP, timeout, JSON inválido) vira fallback mock 200.
    try {
      const resp = await fetchWithTimeout(
        `${Deno.env.get("KOYEB_BACKEND_URL")}/qr/${empresaId}`,
        {
          headers: {
            Authorization: `Bearer ${Deno.env.get("PROVISION_SECRET")}`,
          },
        }
      )

      if (!resp.ok) {
        console.warn(
          `[GET-QR-EMPRESA] Backend indisponível (HTTP ${resp.status}). Ativando fallback local.`
        )
        return await responderComFallbackMock(
          supabaseAdmin,
          empresaId,
          empresa,
          `Backend respondeu HTTP ${resp.status} ao consultar o QR.`
        )
      }

      const corpo = await lerJson(resp)

      if (
        !corpo ||
        (!("qrBase64" in corpo) &&
          !("mock" in corpo) &&
          !("whatsapp_status" in corpo))
      ) {
        return await responderComFallbackMock(
          supabaseAdmin,
          empresaId,
          empresa,
          "Backend respondeu um JSON inválido ao consultar o QR."
        )
      }

      const instanceName =
        corpo.instanceName ?? empresa.instance_name ?? null
      const mock =
        Boolean(corpo.mock) || isMockInstanceName(instanceName)

      return json({
        empresaId,
        instanceName,
        qrBase64: corpo.qrBase64 ?? null,
        mock,
        fallback: false,
        whatsapp_status:
          corpo.whatsapp_status ?? empresa.whatsapp_status ?? null,
      })
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error)
      console.warn(
        `[GET-QR-EMPRESA] Falha ao consultar o QR (${motivo}). Ativando fallback local.`
      )
      return await responderComFallbackMock(
        supabaseAdmin,
        empresaId,
        empresa,
        motivo
      )
    }
  } catch (error: unknown) {
    const erroReal =
      error instanceof Error ? error.message : JSON.stringify(error)
    return json({ error: erroReal }, 400)
  }
})
