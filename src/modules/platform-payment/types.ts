export type PlatformPaymentOptions = {
  /**
   * ChainUp platform API base URL, e.g. https://www.star-vaults.com
   */
  platformApiUrl: string

  /**
   * ChainUp open platform app key.
   */
  appKey: string

  /**
   * ChainUp open platform secret key used for signing.
   */
  secretKey: string

  /**
   * Default payment coin symbol used in createThirdOrder.
   */
  payCoinSymbol: string

  /**
   * URL users return to after payment.
   */
  returnPage: string

  /**
   * ChainUp server-to-server callback URL.
   */
  notifyPage: string

  /**
   * Optional ChainUp order scene type.
   */
  orderSceneType?: string

  /**
   * openId to send to ChainUp.
   * MVP keeps this empty by default.
   */
  openId?: string
}

export type ChainupCreateThirdOrderResponseData = {
  orderNum?: string
  sign?: string
  payUrl?: string
  h5Url?: string
}

export type ChainupOrderDetailResponseData = {
  orderNum?: string
  appOrderId?: string
  orderStatus?: string | number
  orderAmount?: string | number
  payCoinSymbol?: string
  userId?: string | number
}
