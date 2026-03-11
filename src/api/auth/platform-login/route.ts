import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import jwt from "jsonwebtoken"
import type { AuthenticationInput } from "@medusajs/framework/types"

/**
 * /auth/platform-login
 *
 * 一站式登入端點：認證 + 自動建立 Customer
 *
 * 場景 1（平台內轉）: body = { "token": "xxx" }（POST）
 *   → 驗證 token → 取得 UID → 建立 auth identity + Customer → 回傳 JWT
 *
 * 場景 2（OAuth 重導向）: body/query = {} 或 { "callback_url": "xxx" }
 *   → 回傳 { location: "https://..." }（前端重導向到 OAuth 登入頁）
 *
 * 場景 3（OAuth callback）: query/body = { "code": "xxx" }（GET/POST）
 *   → 驗證 code → 建立/查找 auth identity + Customer → 回傳 JWT
 */
async function handlePlatformLogin(req: MedusaRequest, res: MedusaResponse) {
  try {
    const authModule = req.scope.resolve(Modules.AUTH)
    const authData: AuthenticationInput = {
      url: req.url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      body: req.body as Record<string, string> | undefined,
      protocol: req.protocol,
    }
    const code = getStringValue(req.query?.code) ?? getStringValue((req.body as Record<string, unknown>)?.code)

    // Step 1: 呼叫 auth provider 認證 / callback 驗證
    const authResult = code
      ? await authModule.validateCallback("platform", {
          ...authData,
          query: {
            ...authData.query,
            code,
          },
        })
      : await authModule.authenticate("platform", authData)

    // OAuth 重導向（場景 2 第一步）
    if (authResult.location) {
      return res.json({ location: authResult.location })
    }

    // 認證失敗
    if (!authResult.success || !authResult.authIdentity) {
      return res.status(401).json({
        message: authResult.error || "Authentication failed",
      })
    }

    const authIdentity = authResult.authIdentity

    // Step 2: 檢查 auth identity 是否已綁定 Customer
    const existingCustomerId = (
      authIdentity.app_metadata as Record<string, any>
    )?.customer?.actor_id

    if (!existingCustomerId) {
      // 從 auth identity 取得 UID，產生 email
      const fullIdentity = await authModule.retrieveAuthIdentity(
        authIdentity.id,
        { relations: ["provider_identities"] }
      )
      const platformProviderIdentity = fullIdentity.provider_identities?.find(
        (providerIdentity) => providerIdentity.provider === "platform"
      )
      const uid =
        platformProviderIdentity?.entity_id || authIdentity.id
      const customerEmail = `${uid}@platform.star-vaults.com`

      // Step 3: 先查是否已有此 email 的 Customer
      const customerModule = req.scope.resolve(Modules.CUSTOMER)
      const [existingCustomers] = await customerModule.listAndCountCustomers({
        email: customerEmail,
      })

      if (existingCustomers.length > 0) {
        // 已有帳號 → 直接綁定到當前 auth identity
        await authModule.updateAuthIdentities({
          id: authIdentity.id,
          app_metadata: {
            customer: { actor_id: existingCustomers[0].id },
          },
        })
      } else {
        // 沒有帳號 → 建立新 Customer 並綁定
        await createCustomerAccountWorkflow(req.scope).run({
          input: {
            authIdentityId: authIdentity.id,
            customerData: {
              email: customerEmail,
              has_account: true,
            },
          },
        })
      }
    }

    // Step 4: 重新取得 auth identity（現在有 actor_id 了）
    const updatedIdentity = await authModule.retrieveAuthIdentity(authIdentity.id, {
      relations: ["provider_identities"],
    })

    // Step 5: 產生包含 actor_id 的 JWT
    const { jwtSecret } = req.scope.resolve(
      ContainerRegistrationKeys.CONFIG_MODULE
    ).projectConfig.http

    const appMeta = updatedIdentity.app_metadata as Record<string, any>
    const customerId = appMeta?.customer?.actor_id ?? appMeta?.customer_id
    const platformUid = updatedIdentity.provider_identities?.find(
      (providerIdentity) => providerIdentity.provider === "platform"
    )?.entity_id
    const platformToken =
      getStringValue((req.body as Record<string, unknown>)?.token) ?? getStringValue(req.query?.token)

    if (!customerId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Failed to link customer account to this auth identity"
      )
    }

    const token = jwt.sign(
      {
        actor_id: customerId,
        actor_type: "customer",
        auth_identity_id: updatedIdentity.id,
      },
      jwtSecret
    )

    return res.json({
      token,
      platform_uid: platformUid,
      platform_token: platformToken,
    })
  } catch (error: any) {
    if (error instanceof MedusaError) {
      throw error
    }
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Platform login failed: ${error.message}`
    )
  }
}

function getStringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined
  }

  return typeof value === "string" ? value : undefined
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return handlePlatformLogin(req, res)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handlePlatformLogin(req, res)
}
