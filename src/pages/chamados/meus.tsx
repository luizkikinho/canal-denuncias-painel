import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { ChamadoCard } from "@/components/chamado-card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useMediaQuery } from "usehooks-ts"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface ChamadoFormatado {
  id: string
  protocol: string
  horasAberto: number
  texto: string
  status: string
  isOwner: boolean
  resposta?: string
}

function RespostaForm({
  chamado,
  textoResposta,
  setTextoResposta,
  isSubmitting,
  onConfirm,
  onCancel,
  className,
}: {
  chamado: ChamadoFormatado | null
  textoResposta: string
  setTextoResposta: (t: string) => void
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
        {chamado?.texto}
      </div>

      <Textarea
        placeholder="Digite a resposta do chamado..."
        className="min-h-[150px]"
        value={textoResposta}
        onChange={(e) => setTextoResposta(e.target.value)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          disabled={!textoResposta.trim() || isSubmitting}
          onClick={onConfirm}
        >
          Responder
        </Button>
      </div>
    </div>
  )
}

export default function Chamados() {
  const [chamados, setChamados] = useState<ChamadoFormatado[]>([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<"aberto" | "concluido">("aberto")

  const [chamadoSelecionado, setChamadoSelecionado] =
    useState<ChamadoFormatado | null>(null)
  const [textoResposta, setTextoResposta] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const isDesktop = useMediaQuery("(min-width: 768px)")

  const fetchChamados = useCallback(async () => {
    setLoading(true)
    setChamados([])

    const from = (currentPage - 1) * itemsPerPage
    const to = from + itemsPerPage - 1

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData.user) {
      console.error("Usuário não encontrado")
      setLoading(false)
      return
    }

    let query = supabase
      .from("chamados_painel")
      .select("*", { count: "exact" })
      .range(from, to)
      .eq("agente_responsavel_id", authData.user.id)

    if (abaAtiva === "aberto") {
      query = query
        // Inclui status nulo (legado) e exclui apenas os concluídos.
        .or("status.is.null,status.neq.concluido")
        .order("data", { ascending: true })
    } else {
      query = query
        .eq("status", "concluido")
        .order("data", { ascending: false })
    }

    const { data, error, count } = await query

    if (error) {
      toast.error("Houve um erro ao buscar os chamados")
      console.error(error)
    } else {
      setTotalCount(count || 0)

      const chamadosMapeados =
        data?.map((chamado) => {
          const msAberto =
            new Date().getTime() - new Date(chamado.data).getTime()
          const horas = Math.floor(msAberto / (1000 * 60 * 60))

          return {
            id: chamado.id,
            protocol: chamado.protocol,
            texto: chamado.texto,
            horasAberto: horas > 0 ? horas : 0,
            status: chamado.status,
            isOwner: true,
            resposta: chamado.resposta || "",
          }
        }) || []

      setChamados(chamadosMapeados)
    }

    setLoading(false)
  }, [abaAtiva, currentPage, itemsPerPage])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }, [currentPage])

  useEffect(() => {
    let isActive = true

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsPerPage(10)
      } else {
        setItemsPerPage(20)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    Promise.resolve().then(() => {
      if (isActive) {
        void fetchChamados()
      }
    })

    return () => {
      isActive = false
      window.removeEventListener("resize", handleResize)
    }
  }, [fetchChamados])

  const handleAbrirDialog = (chamado: ChamadoFormatado) => {
    setChamadoSelecionado(chamado)
    setTextoResposta("")
    setIsDialogOpen(true)
  }

  const handleConfirmarEnvio = async () => {
    if (!chamadoSelecionado || !textoResposta.trim()) return

    setIsSubmitting(true)
    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      toast.error("Usuário não autenticado")
      setIsSubmitting(false)
      return
    }

    const { error: registroError } = await supabase
      .from("registro_chamados")
      .insert({
        id_chamado: chamadoSelecionado.id,
        texto: textoResposta,
        tipo_acao: "RESPOSTA_CONCLUSAO",
        usuario_chamado: authData.user.id,
      })

    if (registroError) {
      console.error(registroError)
      toast.error("Erro ao salvar registro da resposta")
      setIsSubmitting(false)
      return
    }

    const { data: chamadosAtualizados, error: updateError } = await supabase
      .from("chamados")
      .update({ status: "concluido" })
      .eq("id", chamadoSelecionado.id)
      .eq("agente_responsavel_id", authData.user.id)
      .select("id")

    if (updateError) {
      console.error("Erro ao atualizar status do chamado:", updateError)
      toast.error("Erro ao concluir o chamado")
      setIsSubmitting(false)
      return
    }

    if ((chamadosAtualizados?.length ?? 0) === 0) {
      toast.error(
        "Não foi possível concluir o chamado. Ele pode ter sido transferido para outro agente."
      )
      setIsSubmitting(false)
      fetchChamados()
      return
    }

    toast.success("Chamado respondido!")
    setIsSubmitting(false)
    setIsAlertOpen(false)
    setIsDialogOpen(false)
    setChamadoSelecionado(null)
    setCurrentPage(1)
    fetchChamados()
  }

  const renderPageNumbers = () => {
    const getVisiblePages = (current: number, total: number) => {
      if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
      if (current <= 3) return [1, 2, 3, 4, "...", total]
      if (current >= total - 2)
        return [1, "...", total - 3, total - 2, total - 1, total]
      return [1, "...", current - 1, current, current + 1, "...", total]
    }

    const visiblePages = getVisiblePages(currentPage, totalPages)

    return visiblePages.map((page, index) => {
      if (page === "...") {
        return (
          <PaginationItem key={`ellipsis-${index}`}>
            <PaginationEllipsis />
          </PaginationItem>
        )
      }

      return (
        <PaginationItem key={page}>
          <PaginationLink
            href="#"
            isActive={currentPage === page}
            onClick={(e) => {
              e.preventDefault()
              setCurrentPage(page as number)
            }}
          >
            {page}
          </PaginationLink>
        </PaginationItem>
      )
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Chamados</h1>
          <p className="text-muted-foreground">
            Gerencie e filtre os tickets atribuídos ao seu usuário.
          </p>
        </div>

        <Tabs
          value={abaAtiva}
          onValueChange={(v) => {
            setAbaAtiva(v as "aberto" | "concluido")
            setCurrentPage(1)
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-2 sm:w-[300px]">
            <TabsTrigger value="aberto">Em andamento</TabsTrigger>
            <TabsTrigger value="concluido">Concluídos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex h-[180px] flex-col justify-between space-y-4 rounded-xl border p-4"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : chamados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum chamado encontrado.
        </p>
      ) : (
        <>
          <div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {chamados.map((chamado) => (
              <ChamadoCard
                key={chamado.id}
                id={chamado.protocol || chamado.id.substring(0, 8)}
                horasAberto={chamado.horasAberto}
                texto={chamado.texto}
                status={chamado.status}
                atribuido={true}
                isOwner={chamado.isOwner}
                resposta={chamado.resposta}
                onResponder={() => handleAbrirDialog(chamado)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-auto flex w-full items-center justify-center border-t border-border/40 bg-transparent pt-6 pb-2">
              <Pagination>
                <PaginationContent className="flex-wrap gap-1 sm:gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      text="Anterior"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage > 1) setCurrentPage(currentPage - 1)
                      }}
                      className={
                        currentPage <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {renderPageNumbers()}

                  <PaginationItem>
                    <PaginationNext
                      text="Próximo"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage < totalPages)
                          setCurrentPage(currentPage + 1)
                      }}
                      className={
                        currentPage >= totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {isDesktop ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                Responder Chamado {chamadoSelecionado?.protocol}
              </DialogTitle>
            </DialogHeader>
            <RespostaForm
              chamado={chamadoSelecionado}
              textoResposta={textoResposta}
              setTextoResposta={setTextoResposta}
              isSubmitting={isSubmitting}
              onConfirm={() => setIsAlertOpen(true)}
              onCancel={() => setIsDialogOpen(false)}
              className="py-4"
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>
                Responder Chamado {chamadoSelecionado?.protocol}
              </DrawerTitle>
              <DrawerDescription>
                Forneça a solução para este ticket.
              </DrawerDescription>
            </DrawerHeader>
            <RespostaForm
              chamado={chamadoSelecionado}
              textoResposta={textoResposta}
              setTextoResposta={setTextoResposta}
              isSubmitting={isSubmitting}
              onConfirm={() => setIsAlertOpen(true)}
              onCancel={() => setIsDialogOpen(false)}
              className="px-4 pb-8"
            />
          </DrawerContent>
        </Drawer>
      )}

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O chamado será marcado como concluído e
              a resposta será registrada de forma permanente no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmarEnvio()
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Confirmar e Concluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
