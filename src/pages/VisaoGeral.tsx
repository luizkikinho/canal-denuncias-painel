import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { normalizarStatusChamado, rotuloStatusChamado } from "@/lib/chamados"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface Metricas {
  total: number
  abertos: number
  emAndamento: number
  concluidos: number
}

interface ChamadoRecente {
  id: string
  protocol: string
  status: string
  data: string
  categoria: string
}

interface CategoriaData {
  name: string
  total: number
}

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function VisaoGeral() {
  const [metricas, setMetricas] = useState<Metricas>({
    total: 0,
    abertos: 0,
    emAndamento: 0,
    concluidos: 0,
  })
  const [recentes, setRecentes] = useState<ChamadoRecente[]>([])
  const [dadosGrafico, setDadosGrafico] = useState<CategoriaData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true)

      // 1. Busca as categorias para mapear o UUID para o Nome
      const { data: catData } = await supabase
        .from("categorias")
        .select("id, name")
      const categoriasDicionario = new Map<string, string>()

      interface CategoriaRow {
        id: string
        name: string
      }

      if (catData) {
        catData.forEach((cat: CategoriaRow) =>
          categoriasDicionario.set(cat.id, cat.name)
        )
      }

      // 2. Buscando métricas gerais usando apenas a view
      const { data: todos } = await supabase.from("chamados_painel").select("*")

      interface ChamadoRow {
        id: string
        protocol: string | null
        status: string | null
        data: string
        categoria_id: string | null
        agente_responsavel_id: string | null
      }

      if (todos) {
        const counts = {
          total: todos.length,
          abertos: 0,
          emAndamento: 0,
          concluidos: 0,
        }
        const categoriasGrafico: Record<string, number> = {}

        todos.forEach((c: ChamadoRow) => {
          // Contagem por status usando a atribuição como fonte de verdade
          // (registros legados podem ter status nulo ou "pendente").
          const situacao = normalizarStatusChamado(
            c.status,
            Boolean(c.agente_responsavel_id)
          )

          if (situacao === "concluido") counts.concluidos++
          else if (situacao === "em_andamento") counts.emAndamento++
          else counts.abertos++

          // Traduzindo o categoria_id para o nome usando o mapa
          const catName = c.categoria_id
            ? categoriasDicionario.get(c.categoria_id) || "Sem categoria"
            : "Sem categoria"
          categoriasGrafico[catName] = (categoriasGrafico[catName] || 0) + 1
        })

        setMetricas(counts)
        setDadosGrafico(
          Object.entries(categoriasGrafico).map(([name, total]) => ({
            name,
            total,
          }))
        )
      }

      // 3. Buscando os 5 chamados mais recentes
      const { data: ultimos } = await supabase
        .from("chamados_painel")
        .select("*")
        .order("data", { ascending: false })
        .limit(5)

      if (ultimos) {
        setRecentes(
          ultimos.map((u: ChamadoRow) => ({
            id: u.id,
            protocol: u.protocol || "",
            status: normalizarStatusChamado(
              u.status,
              Boolean(u.agente_responsavel_id)
            ),
            data: u.data,
            categoria:
              categoriasDicionario.get(u.categoria_id || "") || "Sem categoria",
          }))
        )
      }
      setLoading(false)
    }

    carregarDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground">
          Acompanhamento de métricas e chamados recentes.
        </p>
      </div>

      {/* KPIs - 2 colunas no mobile, 4 no desktop */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Denúncias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm leading-tight font-medium">
              Aguardando Atend.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.abertos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.emAndamento}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.concluidos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico e Tabela - 1 coluna no mobile, divididos no desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {/* Gráfico */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Ocorrências por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[300px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={dadosGrafico}
                margin={{ top: 30, right: 0, left: 0, bottom: 30 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(value) => value.slice(0, 12) + "..."}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="total"
                  fill="currentColor"
                  className="fill-primary"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Tabela de Recentes */}
        <Card className="flex flex-col lg:col-span-3">
          <CardHeader>
            <CardTitle>Últimas Entradas</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {/* VERSÃO MOBILE: Lista de Cards (Oculta a partir da tela média) */}
            <div className="flex flex-col gap-3 md:hidden">
              {recentes.map((chamado) => (
                <div
                  key={chamado.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tracking-tight">
                      {chamado.protocol || chamado.id.substring(0, 8)}
                    </span>
                    <Badge
                      variant={
                        chamado.status === "concluido" ? "secondary" : "default"
                      }
                    >
                      {rotuloStatusChamado(chamado.status)}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {chamado.categoria}
                  </span>
                </div>
              ))}
            </div>

            {/* VERSÃO DESKTOP: Tabela (Oculta no mobile, aparece a partir da tela média) */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentes.map((chamado) => (
                    <TableRow key={chamado.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {chamado.protocol || chamado.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            chamado.status === "concluido"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {rotuloStatusChamado(chamado.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {chamado.categoria}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
