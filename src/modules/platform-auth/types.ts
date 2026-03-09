export type PlatformAuthOptions = {
  /**
   * 平台 API base URL，用於驗證 token 和 OAuth
   */
  platformApiUrl: string

  /**
   * OAuth client ID（場景 2 用）
   */
  clientId: string

  /**
   * OAuth client secret（場景 2 用）
   */
  clientSecret: string

  /**
   * OAuth 完成後前端的回調 URL
   */
  callbackUrl: string
}
