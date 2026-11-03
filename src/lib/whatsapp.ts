export function rotuloWhatsapp(status?: string | null): string {
  if (!status) return "—"

  const rotulos: Record<string, string> = {
    connected: "Conectado",
    awaiting_qr: "Aguardando QR",
    disconnected: "Desconectado",
    connecting: "Conectando",
  }

  return rotulos[status] ?? status
}

export function ehInstanciaMock(instanceName?: string | null): boolean {
  return (
    typeof instanceName === "string" && instanceName.startsWith("mock-")
  )
}

export function qrParaSrc(qrBase64?: string | null): string {
  if (!qrBase64) return ""
  return qrBase64.startsWith("data:")
    ? qrBase64
    : `data:image/png;base64,${qrBase64}`
}
