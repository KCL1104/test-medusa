import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
  Logger,
} from "@medusajs/framework/types"
import type { PlatformAuthOptions } from "./types"

type InjectedDependencies = {
  logger: Logger
}

class PlatformAuthService extends AbstractAuthModuleProvider {
  static identifier = "platform"
  static DISPLAY_NAME = "Platform Auth"

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
    if (!options.clientId || !options.clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "clientId and clientSecret are required in platform-auth provider options."
      )
    }
  }

  /**
   * 認證入口：
   * - 帶 token → 場景 1（平台內轉，直接驗證 token 取得 UID）
   * - 不帶 token → 場景 2（OAuth 重導向）
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

  /**
   * OAuth callback 處理（場景 2）
   * 前端收到 code 後呼叫 POST /auth/customer/platform/callback?code=xxx
   */
  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const code = data.query?.code as string

    if (!code) {
      return { success: false, error: "Missing authorization code" }
    }

    try {
      const uid = await this.exchangeCodeForUid(code)
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
      this.logger_.error(`Platform token verification failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * TODO: 呼叫平台 API 驗證 token，回傳 UID
   *
   * 預期實作範例：
   *   const res = await fetch(`${this.options_.platformApiUrl}/api/verify-token`, {
   *     headers: { Authorization: `Bearer ${token}` },
   *   })
   *   if (!res.ok) throw new Error("Invalid platform token")
   *   const data = await res.json()
   *   return data.uid
   */
  private async verifyPlatformToken(token: string): Promise<string> {
    // TODO: 替換為實際的平台 API 呼叫
    throw new Error("verifyPlatformToken not implemented")
  }

  // ========================================
  // 場景 2：OAuth
  // ========================================

  private handleOAuthRedirect(
    data: AuthenticationInput
  ): AuthenticationResponse {
    const callbackUrl = (data.body?.callback_url as string) ?? this.options_.callbackUrl

    /**
     * TODO: 建構平台 OAuth 授權 URL
     *
     * 預期實作範例：
     *   const authUrl = `${this.options_.platformApiUrl}/oauth/authorize` +
     *     `?client_id=${this.options_.clientId}` +
     *     `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
     *     `&response_type=code` +
     *     `&scope=openid`
     *   return { success: true, location: authUrl }
     */
    throw new Error("handleOAuthRedirect not implemented")
  }

  /**
   * TODO: 用 OAuth authorization code 向平台換取 UID
   *
   * 預期實作範例：
   *   // 1. 用 code 換 access_token
   *   const tokenRes = await fetch(`${this.options_.platformApiUrl}/oauth/token`, {
   *     method: "POST",
   *     headers: { "Content-Type": "application/json" },
   *     body: JSON.stringify({
   *       grant_type: "authorization_code",
   *       code,
   *       client_id: this.options_.clientId,
   *       client_secret: this.options_.clientSecret,
   *       redirect_uri: this.options_.callbackUrl,
   *     }),
   *   })
   *   const tokenData = await tokenRes.json()
   *
   *   // 2. 用 access_token 取得 UID
   *   const userRes = await fetch(`${this.options_.platformApiUrl}/api/userinfo`, {
   *     headers: { Authorization: `Bearer ${tokenData.access_token}` },
   *   })
   *   const userData = await userRes.json()
   *   return userData.uid
   */
  private async exchangeCodeForUid(code: string): Promise<string> {
    // TODO: 替換為實際的平台 OAuth 呼叫
    throw new Error("exchangeCodeForUid not implemented")
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
    } catch (error) {
      // 不存在 → 自動建立（註冊 + 登入）
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
}

export default PlatformAuthService
