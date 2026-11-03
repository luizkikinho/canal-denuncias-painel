import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import {
  ehInstanciaMock,
  qrParaSrc,
  rotuloWhatsapp,
} from "@/lib/whatsapp"
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type RespostaWhatsapp = {
  instanceName?: string | null
  qrBase64?: string | null
  mock?: boolean
  fallback?: boolean
  whatsapp_status?: string | null
  persisted?: boolean
}

export default function Empresas() {
  // Gate de UX (segurança de verdade continua nas EFs)
  const [cargo, setCargo] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // Criar empresa
  const [nomeEmpresa, setNomeEmpresa] = useState("")
  const [creatingEmpresa, setCreatingEmpresa] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrBase64, setQrBase64] = useState("")
  const [instanceName, setInstanceName] = useState("")
  const [qrMock, setQrMock] = useState(false)
  const [qrFallback, setQrFallback] = useState(false)
  const [qrStatus, setQrStatus] = useState<string | null>(null)

  // Criar master
  const [nomeMaster, setNomeMaster] = useState("")
  const [emailMaster, setEmailMaster] = useState("")
  const [empresaSelecionada, setEmpresaSelecionada] = useState("")
  const [creatingMaster, setCreatingMaster] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [generatedLink, setGeneratedLink] = useState("")
  const [copied, setCopied] = useState(false)

  // Tabela
  const [empresas, setEmpresas] = useState<any[]>([])

  const [empresaToDelete, setEmpresaToDelete] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCargo(null)
        setChecking(false)
        return
      }
      const { data } = await supabase
        .from("administradores")
        .select("cargo")
        .eq("id", user.id)
        .single()
      setCargo(data?.cargo ?? null)
      setChecking(false)
    }
    check()
  }, [])

  const fetchEmpresas = async () => {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, name, status, instance_name, whatsapp_status")
      .order("name")
    if (data) setEmpresas(data)
    if (error) console.error("Erro ao buscar empresas:", error)
  }

  useEffect(() => {
    if (cargo === "super_admin") fetchEmpresas()
  }, [cargo])

  const abrirDialogQr = (
    data: RespostaWhatsapp,
    instanceFallback = ""
  ) => {
    const nomeInstancia = data.instanceName ?? instanceFallback ?? ""

    setQrBase64(data.qrBase64 ?? "")
    setInstanceName(nomeInstancia)
    setQrMock(Boolean(data.mock) || ehInstanciaMock(nomeInstancia))
    setQrFallback(Boolean(data.fallback))
    setQrStatus(data.whatsapp_status ?? null)
    setQrDialogOpen(true)
  }

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingEmpresa(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-empresa",
        {
          body: { nome: nomeEmpresa },
        }
      )
      if (error) throw new Error(error.message || "Erro ao criar empresa.")
      const resposta: RespostaWhatsapp = data ?? {}
      abrirDialogQr(resposta)
      setNomeEmpresa("")
      fetchEmpresas()

      if (resposta.persisted === false) {
        toast.warning(
          "Empresa criada, mas o vínculo da instância não foi salvo. Verifique o banco."
        )
      } else if (resposta.fallback) {
        toast.warning(
          "Backend indisponível: empresa criada em modo local (mock)."
        )
      } else if (resposta.mock) {
        toast.info("Empresa criada em modo local (mock).")
      } else {
        toast.success("Empresa criada com sucesso.")
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCreatingEmpresa(false)
    }
  }

  const handleCreateMaster = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingMaster(true)
    try {
      const redirectTo = `${window.location.origin}/definir-senha`
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          nome: nomeMaster,
          email: emailMaster,
          redirectTo,
          empresaId: empresaSelecionada,
          cargoDestino: "master",
        },
      })
      if (error) throw new Error(error.message || "Erro ao criar master.")
      setGeneratedLink(data.link)
      setLinkDialogOpen(true)
      setNomeMaster("")
      setEmailMaster("")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setCreatingMaster(false)
    }
  }

  const handleDisableEmpresa = async () => {
    if (!empresaToDelete) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ status: false })
        .eq("id", empresaToDelete.id)
      if (error) throw new Error(error.message)
      toast.success(`Empresa "${empresaToDelete.name}" desativada`)
      fetchEmpresas()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsDeleting(false)
      setEmpresaToDelete(null)
    }
  }

  const handleReenableEmpresa = async (emp: any) => {
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ status: true })
        .eq("id", emp.id)
      if (error) throw new Error(error.message)
      toast.success(`Empresa "${emp.name}" reativada.`)
      fetchEmpresas()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleConnectWhats = async (emp: any) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-qr-empresa",
        {
          body: { empresaId: emp.id },
        }
      )
      if (error) throw new Error(error.message)

      const resposta: RespostaWhatsapp = data ?? {}
      abrirDialogQr(resposta, emp.instance_name ?? "")
      fetchEmpresas()

      if (resposta.persisted === false) {
        toast.warning(
          "Conexão em modo local, mas o vínculo não foi salvo no banco."
        )
      } else if (resposta.fallback) {
        toast.warning(
          "Evolution indisponível: conexão aplicada em modo local (mock)."
        )
      } else if (resposta.mock) {
        toast.info("Conexão em modo local (mock).")
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    toast.success("Link copiado!")
    setTimeout(() => setCopied(false), 2000)
  }

  // dentro do componente, antes do return
  const renderAcoes = (emp: any) =>
    emp.status !== false ? (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEmpresaToDelete(emp)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">Desativar empresa</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {emp.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa para de responder no WhatsApp e sai do seletor de
              convites. Os dados permanecem no banco para auditoria (soft
              delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableEmpresa}
              disabled={isDeleting}
            >
              {isDeleting ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleReenableEmpresa(emp)}
      >
        <RotateCcw className="mr-1 h-4 w-4" /> Reativar
      </Button>
    )

  if (checking) return <div className="p-8">Verificando acesso...</div>
  if (cargo !== "super_admin") {
    return <div className="p-8 text-muted-foreground">Acesso restrito.</div>
  }

  const qrSrc = qrParaSrc(qrBase64)

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Gerenciar Empresas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Provisione empresas, conecte o WhatsApp e convide os masters.
        </p>
      </div>

      {/* ===== Formulários (empilham no mobile) ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Nova Empresa</CardTitle>
            </div>
            <CardDescription>
              Cria a empresa e provisiona a instância do WhatsApp; se o backend
              estiver indisponível, usa o modo local (mock).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEmpresa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
                <Input
                  id="nomeEmpresa"
                  required
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  disabled={creatingEmpresa}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={creatingEmpresa}
              >
                {creatingEmpresa && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {creatingEmpresa ? "Provisionando..." : "Criar empresa"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <CardTitle>Primeiro Master</CardTitle>
            </div>
            <CardDescription>
              Gera o convite do master (ele define a própria senha).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMaster} className="space-y-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select
                  value={empresaSelecionada}
                  onValueChange={setEmpresaSelecionada}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas
                      .filter((e) => e.status !== false)
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomeMaster">Nome completo</Label>
                <Input
                  id="nomeMaster"
                  required
                  value={nomeMaster}
                  onChange={(e) => setNomeMaster(e.target.value)}
                  disabled={creatingMaster}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailMaster">E-mail</Label>
                <Input
                  id="emailMaster"
                  type="email"
                  required
                  value={emailMaster}
                  onChange={(e) => setEmailMaster(e.target.value)}
                  disabled={creatingMaster}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={creatingMaster}
              >
                {creatingMaster && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {creatingMaster ? "Gerando convite..." : "Gerar convite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ===== MUNDO MOBILE: um card por empresa ===== */}
      <div className="space-y-3 md:hidden">
        {empresas.map((emp) => (
          <Card key={emp.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{emp.name}</span>
                <Badge variant={emp.status ? "default" : "secondary"}>
                  {emp.status ? "Ativa" : "Desativada"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="truncate">
                  {emp.instance_name ?? "sem instância"}
                </span>
                {ehInstanciaMock(emp.instance_name) && (
                  <Badge variant="outline">mock</Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={emp.status === false}
                  onClick={() => handleConnectWhats(emp)}
                >
                  {rotuloWhatsapp(emp.whatsapp_status)}
                </Button>
                {renderAcoes(emp)}
              </div>
            </CardContent>
          </Card>
        ))}
        {empresas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma empresa encontrada.
          </p>
        )}
      </div>

      {/* ===== MUNDO DESKTOP: tabela completa ===== */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate">
                          {emp.instance_name ?? "—"}
                        </span>
                        {ehInstanciaMock(emp.instance_name) && (
                          <Badge variant="outline">mock</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={emp.status === false}
                        onClick={() => handleConnectWhats(emp)}
                      >
                        {rotuloWhatsapp(emp.whatsapp_status)}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.status ? "default" : "secondary"}>
                        {emp.status ? "Ativa" : "Desativada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {renderAcoes(emp)}
                    </TableCell>
                  </TableRow>
                ))}
                {empresas.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Dialog do QR ===== */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {qrStatus === "connected" && !qrBase64
                ? "WhatsApp conectado"
                : "Conectar WhatsApp"}
              {instanceName ? ` — ${instanceName}` : ""}
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
              onClick={() => setQrDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog do link do master ===== */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Master criado com sucesso</DialogTitle>
            <DialogDescription>
              Copie o link e envie para o master definir a senha.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input defaultValue={generatedLink} readOnly />
            </div>
            <Button type="button" size="icon" onClick={handleCopyLink}>
              <span className="sr-only">Copiar</span>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLinkDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
