import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
  ehInstanciaMock,
  qrParaSrc,
  rotuloWhatsapp,
} from "@/lib/whatsapp"
import { toast } from "sonner"
import {
  QrCode,
  Loader2,
  Pencil,
  Check,
  CheckCircle2,
  X,
  Power,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import MensagensBot from "@/pages/admin/MensagensBot"

type EmpresaConexao = {
  id: string
  name: string
  status?: boolean | null
  instance_name?: string | null
  whatsapp_status?: string | null
}

export default function WhatsappBot() {
  // ===== identidade =====
  const [checking, setChecking] = useState(true)
  const [cargo, setCargo] = useState<string | null>(null)
  const [minhaEmpresaId, setMinhaEmpresaId] = useState<string | null>(null)
  const [empresaSelecionada, setEmpresaSelecionada] = useState("") // super_admin
  const [empresas, setEmpresas] = useState<any[]>([])

  const empresaId =
    cargo === "super_admin" ? empresaSelecionada : minhaEmpresaId

  // ===== empresa (conexão) =====
  const [empresa, setEmpresa] = useState<EmpresaConexao | null>(null)

  // ===== QR =====
  const [qrOpen, setQrOpen] = useState(false)
  const [qrBase64, setQrBase64] = useState("")
  const [qrInstanceName, setQrInstanceName] = useState("")
  const [qrMock, setQrMock] = useState(false)
  const [qrFallback, setQrFallback] = useState(false)
  const [qrStatus, setQrStatus] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // ===== categorias =====
  const [categorias, setCategorias] = useState<any[]>([])
  const [novoNome, setNovoNome] = useState("")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setChecking(false)
        return
      }
      const { data } = await supabase
        .from("administradores")
        .select("cargo, empresa_id")
        .eq("id", user.id)
        .single()
      setCargo(data?.cargo ?? null)
      setMinhaEmpresaId(data?.empresa_id ?? null)
      if (data?.cargo === "super_admin") {
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, name")
          .order("name")
        setEmpresas(emps ?? [])
      }
      setChecking(false)
    }
    load()
  }, [])

  const fetchEmpresa = async () => {
    if (!empresaId) return setEmpresa(null)
    const { data } = await supabase
      .from("empresas")
      .select("id, name, status, instance_name, whatsapp_status")
      .eq("id", empresaId)
      .single()
    setEmpresa(data)
  }

  const fetchCategorias = async () => {
    if (!empresaId) return setCategorias([])
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("name")
    setCategorias(data ?? [])
  }

  useEffect(() => {
    if (empresaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEmpresa()
      fetchCategorias()
    }
  }, [empresaId])

  // ===== handlers =====
  const handleConnect = async () => {
    if (!empresaId) return toast.error("Selecione uma empresa.")
    setConnecting(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-qr-empresa",
        {
          body: { empresaId },
        }
      )
      if (error) throw new Error(error.message)

      const resposta = data ?? {}
      const nomeInstancia =
        resposta.instanceName ?? empresa?.instance_name ?? ""
      const statusRecebido = resposta.whatsapp_status ?? null
      const mock = Boolean(resposta.mock) || ehInstanciaMock(nomeInstancia)

      setQrBase64(resposta.qrBase64 ?? "")
      setQrInstanceName(nomeInstancia)
      setQrMock(mock)
      setQrFallback(Boolean(resposta.fallback))
      setQrStatus(statusRecebido)
      setQrOpen(true)

      // Reflete a resposta imediatamente, sem esperar o próximo fetch.
      setEmpresa((atual) =>
        atual
          ? {
              ...atual,
              instance_name: nomeInstancia || atual.instance_name,
              whatsapp_status: statusRecebido ?? atual.whatsapp_status,
            }
          : atual
      )
      fetchEmpresa()

      if (resposta.persisted === false) {
        toast.warning(
          "Conexão em modo local, mas o vínculo não foi salvo no banco."
        )
      } else if (resposta.fallback) {
        toast.warning(
          "Evolution indisponível: conexão aplicada em modo local (mock)."
        )
      } else if (mock) {
        toast.info("Conexão em modo local (mock).")
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleCreateCategoria = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const { error } = await supabase
        .from("categorias")
        .insert({ name: novoNome.trim(), empresa_id: empresaId, active: true })
      if (error) throw new Error(error.message)
      toast.success("Categoria criada.")
      setNovoNome("")
      fetchCategorias()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRename = async (cat: any) => {
    try {
      const { error } = await supabase
        .from("categorias")
        .update({ name: editName.trim() })
        .eq("id", cat.id)
      if (error) throw new Error(error.message)
      toast.success("Categoria renomeada.")
      setEditingId(null)
      fetchCategorias()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleToggle = async (cat: any) => {
    setTogglingId(cat.id)
    try {
      const { error } = await supabase
        .from("categorias")
        .update({ active: !cat.active })
        .eq("id", cat.id)
      if (error) throw new Error(error.message)
      toast.success(cat.active ? "Categoria desativada." : "Categoria ativada.")
      fetchCategorias()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTogglingId(null)
    }
  }

  // ===== gates =====
  if (checking) return <div className="p-8">Verificando acesso...</div>
  if (cargo !== "master" && cargo !== "super_admin") {
    return <div className="p-8 text-muted-foreground">Acesso restrito.</div>
  }
  if (cargo === "master" && !minhaEmpresaId) {
    return (
      <div className="p-8 text-muted-foreground">
        Sua conta não possui empresa vinculada.
      </div>
    )
  }

  const qrSrc = qrParaSrc(qrBase64)

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          WhatsApp Bot
        </h1>
        <p className="text-sm text-muted-foreground">
          Conexão, catálogo e voz do assistente da sua empresa.
        </p>
        {cargo === "super_admin" && (
          <Select
            value={empresaSelecionada}
            onValueChange={setEmpresaSelecionada}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Gerenciar qual empresa?" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* ===== Conexão ===== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              <CardTitle>Conexão</CardTitle>
            </div>
            <CardDescription>
              {empresa?.name ?? "Selecione uma empresa para começar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-1">
                <div className="text-sm">
                  {rotuloWhatsapp(empresa?.whatsapp_status)}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span className="truncate">
                    {empresa?.instance_name ?? "sem instância"}
                  </span>
                  {ehInstanciaMock(empresa?.instance_name) && (
                    <Badge variant="outline">mock</Badge>
                  )}
                </div>
              </div>
              <Badge
                variant={
                  empresa?.whatsapp_status === "connected"
                    ? "default"
                    : "secondary"
                }
              >
                {rotuloWhatsapp(empresa?.whatsapp_status)}
              </Badge>
            </div>
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={connecting || !empresaId || empresa?.status === false}
            >
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="mr-2 h-4 w-4" />
              )}
              {connecting ? "Gerando QR..." : "Conectar WhatsApp"}
            </Button>
          </CardContent>
        </Card>

        {/* ===== Categorias ===== */}
        <Card>
          <CardHeader>
            <CardTitle>Categorias de denúncia</CardTitle>
            <CardDescription>
              O que o bot oferece no menu. Desativadas somem do bot, mas ficam
              no histórico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreateCategoria} className="flex gap-2">
              <Input
                placeholder="Nova categoria"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                required
                disabled={!empresaId || creating}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!empresaId || creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </form>

            <div className="space-y-2">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  {editingId === cat.id ? (
                    <>
                      <Input
                        className="h-8"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRename(cat)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{cat.name}</span>
                        <Badge variant={cat.active ? "default" : "secondary"}>
                          {cat.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(cat.id)
                            setEditName(cat.name)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={togglingId === cat.id}
                          onClick={() => handleToggle(cat)}
                          title={cat.active ? "Desativar" : "Ativar"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {categorias.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma categoria ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Mensagens do Bot (voz do assistente) ===== */}
      <MensagensBot empresaId={empresaId} />

      {/* ===== Dialog QR ===== */}
      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          setQrOpen(open)
          if (!open) fetchEmpresa()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {qrStatus === "connected" && !qrBase64
                ? "WhatsApp conectado"
                : "Conectar WhatsApp"}
              {qrInstanceName ? ` — ${qrInstanceName}` : ""}
            </DialogTitle>
            <DialogDescription>
              {qrStatus === "connected" && !qrBase64
                ? "A instância já está conectada. Nenhuma ação é necessária."
                : qrMock
                  ? "Modo local: o QR é simulado e a conexão é aplicada instantaneamente."
                  : "Escaneie com o WhatsApp da empresa para vincular a instância."}
            </DialogDescription>
          </DialogHeader>

          {qrMock && (
            <div className="rounded-md border border-dashed p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">mock</Badge>
                <span className="text-muted-foreground">
                  {qrFallback
                    ? "Evolution indisponível — fallback local aplicado."
                    : "Modo local ativo."}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-center p-4">
            {qrBase64 ? (
              <img
                src={qrSrc}
                alt="QR Code da instância"
                className="h-52 w-52 rounded-lg border sm:h-64 sm:w-64"
              />
            ) : qrStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <p>Instância conectada. Nada para escanear.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                QR não disponível. Tente conectar novamente.
              </p>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQrOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
