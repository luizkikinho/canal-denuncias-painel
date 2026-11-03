export type StatusChamado = "aberto" | "em_andamento" | "concluido"

/**
 * Normaliza o status do chamado usando a atribuição como fonte de verdade.
 *
 * O backend grava "aberto", mas existem registros legados com status nulo ou
 * "pendente". Um chamado atribuído a um agente deve ser tratado como em
 * andamento mesmo que o status esteja desatualizado.
 */
export function normalizarStatusChamado(
  status: string | null | undefined,
  atribuido = false
): StatusChamado {
  if (status === "concluido") return "concluido"
  if (atribuido) return "em_andamento"
  return "aberto"
}

export function rotuloStatusChamado(
  status: string | null | undefined,
  atribuido = false
): string {
  const normalizado = normalizarStatusChamado(status, atribuido)

  if (normalizado === "concluido") return "Concluído"
  if (normalizado === "em_andamento") return "Em andamento"
  return "Aberto"
}
