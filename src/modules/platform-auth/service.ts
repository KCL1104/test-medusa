import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
  Logger,
} from "@medusajs/framework/types"
import type { PlatformAuthOptions } from "./types"
import { generateChainupSign } from "../../utils/chainup-sign"

type InjectedDependencies = {
  logger: Logger
}

class PlatformAuthService extends AbstractAuthModuleProvider {
  static identifier = "platform"
  static DISPLAY_NAME = "Star Vaults Auth"

  protected logger_: Logger
  protected options_: PlatformAuthOptions

  constructor(container: InjectedDependencies, options: PlatformAuthOptions) {
    // @ts-ignore -- Medusa's AbstractAuthModuleProvider expects spread arguments
    super(...arguments)
    this.logger_ = container.logger
    this.options_ = options
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.platformApiUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "platformApiUrl is required in platform-auth provider options."
      )
    }
    if (!options.appKey || !options.secretKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "appKey and secretKey are required in platform-auth provider options."
      )
    }
    if (!options.callbackUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "callbackUrl is required in platform-auth provider options."
      )
    }
  }

  /**
   * 認證入口：
   * - 帶 token → 場景 1（平台內轉，用 exchange-token 驗證取得 UID）
   * - 不帶 token → 場景 2（重導向到 ChainUp OAuth 登入頁）
   */
  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const token = data.body?.token as string | undefined

    if (token) {
      return this.handlePlatformRedirect(token, authIdentityProviderService)
    }

    return this.handleOAuthRedirect(data)
  }

  async register(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const token = data.body?.token as string | undefined
    const code = (data.query?.code as string) || (data.body?.code as string)

    if (token) {
      return this.handlePlatformRedirect(token, authIdentityProviderService)
    }

    if (code) {
      return this.validateCallback(
        {
          ...data,
          query: {
            ...data.query,
            code,
          },
        },
        authIdentityProviderService
      )
    }

    return {
      success: false,
      error: "Missing token or authorization code",
    }
  }

  /**
   * OAuth callback 處理（場景 2）
   * 前端收到 code 後呼叫 POST /auth/customer/platform/callback?code=xxx
   */
  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const code = (data.query?.code as string) || (data.body?.code as string)

    if (!code) {
      return { success: false, error: "Missing authorization code" }
    }

    try {
      const { token, openId } = await this.exchangeCodeForToken(code)

      // 優先用 token 查 UID，若平台不支援該 token 的 user_info 查詢，回退到 openId。
      let uid: string
      try {
        uid = await this.verifyPlatformToken(token)
      } catch (error: any) {
        if (!openId) {
          throw error
        }
        this.logger_.warn(
          `OAuth token user_info lookup failed, fallback to openId identity: ${error.message}`
        )
        uid = String(openId)
      }

      return this.findOrCreateIdentity(uid, authIdentityProviderService)
    } catch (error: any) {
      this.logger_.error(`OAuth callback failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // ========================================
  // 場景 1：平台內轉
  // ========================================

  private async handlePlatformRedirect(
    token: string,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    try {
      const uid = await this.verifyPlatformToken(token)
      return this.findOrCreateIdentity(uid, authIdentityProviderService)
    } catch (error: any) {
      this.logger_.error(`Star Vaults token verification failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 呼叫平台 API 驗證 exchange-token，回傳 user id
   */
  private async verifyPlatformToken(token: string): Promise<string> {
    const res = await fetch(
      `${this.getPlatformApiBaseUrl()}/fe-ex-api/common/user_info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "exchange-token": token,
        },
        body: "{}",
      }
    )

    if (!res.ok) {
      let detail = ""
      try { detail = await res.text() } catch {}
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        `Star Vaults token verification (/fe-ex-api/common/user_info) failed with status ${res.status}: ${detail}`
      )
    }

    const json = await res.json()
    const uid = json.data?.id ?? json.data?.uid

    if ((json.code !== "0" && json.code !== 0) || !uid) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        json.msg || "Invalid Star Vaults token"
      )
    }

    return String(uid)
  }

  // ========================================
  // 場景 2：ChainUp OAuth
  // ========================================

  /**
   * 建構 ChainUp OAuth 登入頁 URL 並回傳重導向
   */
  private handleOAuthRedirect(
    data: AuthenticationInput
  ): AuthenticationResponse {
    const callbackUrl =
      (data.body?.callback_url as string) ??
      (data.query?.callback_url as string) ??
      this.options_.callbackUrl

    if (!callbackUrl) {
      return { success: false, error: "Missing callback URL" }
    }

    const loginUrl =
      `${this.getPlatformApiBaseUrl()}/platform/login.html` +
      `?appKey=${encodeURIComponent(this.options_.appKey)}` +
      `&redirectUrl=${encodeURIComponent(callbackUrl)}`

    return {
      success: true,
      location: loginUrl,
    }
  }

  /**
   * 用 OAuth authorization code 向 ChainUp 換取 token 和 openId
   *
   * POST /platformapi/chainup/open/auth/token
   * body: { appKey, code, sign }
   * sign = MD5(排序後 key+value 拼接 + secretKey)
   */
  private async exchangeCodeForToken(
    code: string
  ): Promise<{ token: string; openId: string }> {
    const params: Record<string, string> = {
      appKey: this.options_.appKey,
      code,
    }

    const sign = generateChainupSign(params, this.options_.secretKey)

    const res = await fetch(
      `${this.getPlatformApiBaseUrl()}/platformapi/chainup/open/auth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, sign }),
      }
    )

    if (!res.ok) {
      let detail = ""
      try { detail = await res.text() } catch {}
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        `Failed to exchange authorization code (/platformapi/chainup/open/auth/token) with status ${res.status}: ${detail}`
      )
    }

    const json = await res.json()

    if (json.code !== "0" && json.code !== 0) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        json.msg || "OAuth token exchange failed"
      )
    }

    if (!json.data?.token) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "OAuth token response is missing token"
      )
    }

    return {
      token: json.data.token,
      openId: json.data.openId,
    }
  }

  // ========================================
  // 共用：查找或建立 auth identity
  // ========================================

  private async findOrCreateIdentity(
    uid: string,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    let authIdentity

    try {
      authIdentity = await authIdentityProviderService.retrieve({
        entity_id: uid,
      })
    } catch (error: any) {
      if (error?.type !== MedusaError.Types.NOT_FOUND) {
        throw error
      }

      authIdentity = await authIdentityProviderService.create({
        entity_id: uid,
        provider_metadata: {},
        user_metadata: {
          platform_uid: uid,
        },
      })
    }

    return { success: true, authIdentity }
  }

  private getPlatformApiBaseUrl(): string {
    return this.options_.platformApiUrl.replace(/\/+$/, "")
  }
}

export default PlatformAuthService
