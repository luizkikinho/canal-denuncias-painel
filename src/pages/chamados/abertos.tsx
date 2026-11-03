import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { ChamadoCard } from "@/components/chamado-card"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface ChamadoFormatado {
  id: string
  protocol: string
  horasAberto: number
  texto: string
  status: string
  isOwner: boolean
}

export default function Chamados() {
  const navigate = useNavigate()
  const [chamados, setChamados] = useState<ChamadoFormatado[]>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const fetchChamados = useCallback(async () => {
    setLoading(true)
    setChamados([])

    const {data: {user}} = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const {data: adminData, error: adminError} = await supabase
      .from("administradores")
      .select("empresa_id")
      .eq("id", user.id)
      .single()
    
      if (adminError || !adminData) {
        console.error("Erro ao buscar dados do administrador:", adminError)
        setLoading(false)
        return
      }
    
    const empresaId = adminData.empresa_id

    const from = (currentPage - 1) * itemsPerPage
    const to = from + itemsPerPage - 1

    const { data, error, count } = await supabase
      .from("chamados_painel")
      .select("*", { count: "exact" })
      .is("agente_responsavel_id", null)
      .eq("empresa_id", empresaId)
      .range(from, to)
      .order("data", { ascending: true })

    if (error) {
      toast.error("Houve um erro ao tentar buscar chamados abertos")
      console.error("Erro ao buscar chamados:", error)
    } else {
      setTotalCount(count || 0)

      const chamadosSLA =
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
            isOwner: false,
          }
        }) || []

      setChamados(chamadosSLA)
    }
    setLoading(false)
  }, [currentPage, itemsPerPage])

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

  const handleAtender = async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return console.error("Usuário não autenticado")

    const { data, error } = await supabase
      .from("chamados")
      .update({ agente_responsavel_id: user.id, status: "em_andamento" })
      .eq("id", id)
      .select("id")

    if (error) {
      toast.error("Houve um erro ao assumir o chamado")
      console.error(error)
      return
    }

    const linhasAfetadas = data?.length ?? 0

    if (linhasAfetadas === 0) {
      toast.error(
        "Não foi possível assumir o chamado. Ele pode já ter sido atribuído a outro agente."
      )
      fetchChamados()
      return
    }

    toast.success("Chamado atribuido a você", {
      action: (
        <Button onClick={() => navigate("/chamados/meus")}>
          Meus chamados
        </Button>
      ),
    })
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Todos os Chamados</h1>
        <p className="text-muted-foreground">
          Listagem de tickets aguardando atendimento.
        </p>
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
          Nenhum chamado pendente no momento.
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
                isOwner={chamado.isOwner}
                onAtender={() => handleAtender(chamado.id)}
                onResponder={() =>
                  console.log("Abrir dialog do chamado", chamado.id)
                }
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
    </div>
  )
}
