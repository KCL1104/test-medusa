import { MedusaError } from "@medusajs/framework/utils"

export type ChainupApiResponse<TData> = {
  code: string | number
  msg?: string
  data?: TData
}

export const isChainupSuccess = (code: unknown): boolean => {
  return code === 0 || code === "0"
}

export const normalizeChainupBaseUrl = (baseUrl: string): string => {
  return baseUrl.replace(/\/+$/, "")
}

export const postChainupJson = async <TData>(
  baseUrl: string,
  path: string,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<ChainupApiResponse<TData>> => {
  const response = await fetch(`${normalizeChainupBaseUrl(baseUrl)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let responseBody = ""
    try {
      responseBody = await response.text()
    } catch {}

    const showSign = process.env.CHAINUP_DEBUG_SIGN === "true"
    const redactedPayload = showSign ? payload : { ...payload, sign: "[REDACTED]" }
    const fullUrl = `${normalizeChainupBaseUrl(baseUrl)}${path}`
    const requestInfo =
      `Star Vaults request failed:\n` +
      `POST ${fullUrl}\n` +
      `Content-Type: application/json\n\n` +
      `${JSON.stringify(redactedPayload, null, 2)}\n\n` +
      `Response: ${response.status} ${response.statusText}\n` +
      responseBody

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      requestInfo
    )
  }

  return (await response.json()) as ChainupApiResponse<TData>
}
