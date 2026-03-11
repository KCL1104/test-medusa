import { createHash } from "crypto"

const normalizeValueForSigning = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ""
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  return JSON.stringify(value)
}

export const generateChainupSign = (
  params: Record<string, unknown>,
  secretKey: string
): string => {
  const signingString = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => [key, normalizeValueForSigning(params[key])] as const)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}${value}`)
    .join("")

  return createHash("md5")
    .update(`${signingString}${secretKey}`)
    .digest("hex")
}

export const verifyChainupSign = (
  params: Record<string, unknown>,
  secretKey: string
): boolean => {
  const providedSign = params.sign

  if (typeof providedSign !== "string" || !providedSign) {
    return false
  }

  return generateChainupSign(params, secretKey) === providedSign.toLowerCase()
}
