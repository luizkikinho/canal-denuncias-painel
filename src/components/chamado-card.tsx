import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { TicketIcon, CornerDownRight, Lock } from "lucide-react"
import { normalizarStatusChamado, rotuloStatusChamado } from "@/lib/chamados"

interface ChamadoCardProps {
  id: string
  horasAberto: number
  texto: string
  status?: string | null
  /** O chamado está atribuído a algum agente. */
  atribuido?: boolean
  /** O chamado está atribuído ao usuário logado. */
  isOwner?: boolean
  resposta?: string
  onAtender?: (id: string) => void
  onResponder?: (id: string) => void
}

export function ChamadoCard({
  id,
  horasAberto,
  texto,
  status,
  atribuido = false,
  isOwner = false,
  resposta,
  onAtender,
  onResponder,
}: ChamadoCardProps) {
  const statusNormalizado = normalizarStatusChamado(status, atribuido)
  const concluido = statusNormalizado === "concluido"
  const emAndamento = statusNormalizado === "em_andamento"

  const variant: "default" | "secondary" | "destructive" | "outline" = "outline"
  const corClasses = concluido
    ? "bg-muted text-muted-foreground"
    : emAndamento
      ? "bg-yellow-500/8 text-orange-300 hover:bg-yellow-500/20"
      : ""

  const podeAtender = !concluido && !atribuido && Boolean(onAtender)
  const podeResponder = !concluido && isOwner && Boolean(onResponder)

  const isConfidential = texto === "******"

  return (
    <Card className="flex flex-col transition-colors hover:bg-muted/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Badge variant={variant} className={corClasses}>
          {rotuloStatusChamado(status, atribuido)}
        </Badge>

        {!concluido && (
          <span className="text-xs text-muted-foreground">
            {horasAberto}h atrás
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <CardTitle
          className={`line-clamp-2 text-base leading-snug ${
            isConfidential
              ? "flex items-center gap-2 text-sm font-normal text-muted-foreground italic"
              : ""
          }`}
        >
          {isConfidential ? (
            <>
              <Lock className="size-4 shrink-0" />
              Conteúdo protegido
            </>
          ) : (
            texto
          )}
        </CardTitle>

        {concluido && resposta && (
          <div className="mt-2 flex gap-2 rounded-sm bg-muted/70 p-2.5 text-xs text-muted-foreground">
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                Sua resposta:
              </span>
              <p className="line-clamp-3">{resposta}</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
          <TicketIcon className="size-4" />#{id}
        </div>

        {podeAtender && onAtender && (
          <Button
            size="sm"
            className="font-semibold"
            onClick={() => onAtender(id)}
          >
            Atender
          </Button>
        )}

        {podeResponder && onResponder && (
          <Button
            size="sm"
            variant="outline"
            className="bg-white font-semibold"
            onClick={() => onResponder(id)}
          >
            Responder
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
