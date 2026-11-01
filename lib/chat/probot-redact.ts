const REDACTED = '[private]'

const EMAIL =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

const PHONE =
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g

const STREET =
  /\b\d{1,6}\s+[A-Za-z0-9.'#-]+(?:\s+[A-Za-z0-9.'#-]+){0,5}\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy|Trail|Trl)\b\.?/gi

/** Remove email, phone, and street lines before a turn is sent to the model. */
export function redactForModel(text: string): string {
  return text.replace(EMAIL, REDACTED).replace(PHONE, REDACTED).replace(STREET, REDACTED)
}
