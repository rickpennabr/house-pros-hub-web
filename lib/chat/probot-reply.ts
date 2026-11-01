type ReplyLocale = "en" | "pt" | "es"

const REPLIES: Record<
  ReplyLocale,
  { talk: string; estimate: string; triggers: string[] }
> = {
  en: {
    talk: "I can connect you with a pro. Pick a contact from the list on the left to message them, or tell me what you need below.",
    estimate:
      "Got it! You can request your free estimate using our form. Our pros will reach out to you.",
    triggers: [
      "Account and Estimate",
      "Create an account and Get a FREE Estimate",
      "Create an account",
      "Get Free Estimate",
    ],
  },
  pt: {
    talk: "Posso conectá-lo com um profissional. Escolha um contato da lista à esquerda para enviar mensagem, ou me diga o que precisa abaixo.",
    estimate:
      "Entendido! Você pode solicitar seu orçamento gratuito no nosso formulário. Nossos profissionais entrarão em contato.",
    triggers: [
      "Conta e orçamento",
      "Criar conta e obter um orçamento GRATUITO",
      "Criar uma conta",
      "Obter orçamento gratuito",
    ],
  },
  es: {
    talk: "Puedo conectarte con un pro. Elige un contacto de la lista a la izquierda para escribirle, o cuéntame qué necesitas abajo.",
    estimate:
      "Entendido. Puedes solicitar tu estimado gratis en nuestro formulario. Nuestros pros te contactarán.",
    triggers: [
      "Cuenta y estimado",
      "Crear cuenta y obtener un estimado GRATIS",
      "Crear una cuenta",
      "Obtener estimado gratis",
    ],
  },
}

function localeOf(locale: string | undefined): ReplyLocale {
  if (locale === "pt" || locale === "es") return locale
  return "en"
}

/** Canned ProBot reply for a visitor message on the hub thread (not a business chat). */
export function probotAutoReply(body: string, locale: string | undefined): string {
  const lang = localeOf(locale)
  const trimmed = body.trim()
  for (const pack of Object.values(REPLIES)) {
    if (pack.triggers.includes(trimmed)) return REPLIES[lang].estimate
  }
  return REPLIES[lang].talk
}

export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = error.message ?? ""
  return message.includes("does not exist") || message.includes("Could not find")
}

export function isProbotAutoReply(body: string): boolean {
  const trimmed = body.trim()
  return Object.values(REPLIES).some(
    (pack) => pack.talk === trimmed || pack.estimate === trimmed
  )
}
