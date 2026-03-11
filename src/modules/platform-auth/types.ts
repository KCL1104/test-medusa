export type PlatformAuthOptions = {
  /**
   * 平台域名（如 https://www.star-vaults.com）
   */
  platformApiUrl: string

  /**
   * ChainUp 開放平台 appKey（如 star-vaults_1692）
   */
  appKey: string

  /**
   * ChainUp 開放平台 secretKey，用於簽名
   */
  secretKey: string

  /**
   * OAuth 完成後前端的回調 URL
   */
  callbackUrl: string
}
