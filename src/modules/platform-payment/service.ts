import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import {
  isChainupSuccess,
  postChainupJson,
  type ChainupApiResponse,
} from "../../utils/chainup-client"
import { generateChainupSign, verifyChainupSign } from "../../utils/chainup-sign"
import type {
  ChainupCreateThirdOrderResponseData,
  ChainupOrderDetailResponseData,
  PlatformPaymentOptions,
} from "./types"

type InjectedDependencies = {
  logger: Logger
}

class PlatformPaymentService extends AbstractPaymentProvider<PlatformPaymentOptions> {
  static identifier = "chainup"

  protected logger_: Logger
  protected options_: PlatformPaymentOptions

  constructor(container: InjectedDependencies, options: PlatformPaymentOptions) {
    // @ts-ignore -- Medusa payment providers expect spread arguments
    super(...arguments)
    this.logger_ = container.logger
    this.options_ = options
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.platformApiUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "platformApiUrl is required in platform-payment provider options."
      )
    }

    if (!options.appKey || !options.secretKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "appKey and secretKey are required in platform-payment provider options."
      )
    }

    if (!options.returnPage || !options.notifyPage) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "returnPage and notifyPage are required in platform-payment provider options."
      )
    }

    if (!options.payCoinSymbol) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "payCoinSymbol is required in platform-payment provider options."
      )
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const sessionId = this.getStringValue(input.data?.session_id)

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing session_id when initiating ChainUp payment session."
      )
    }

    const platformUid = this.resolvePlatformUid(input)
    const orderAmount = this.toAmountString(input.amount)
    const openId =
      this.getNonEmptyStringValue(input.data?.open_id) ||
      this.getNonEmptyStringValue(this.options_.openId)
    const returnPage = this.resolveReturnPage(input)
    const goods = input.data?.goods
    const token = this.getNonEmptyStringValue(input.data?.token)
    const payerIdentifierPayload = openId ? { openId } : { userId: platformUid }

    const requestPayload: Record<string, unknown> = {
      appKey: this.options_.appKey,
      appOrderId: sessionId,
      ...payerIdentifierPayload,
      orderAmount,
      payCoinSymbol: this.options_.payCoinSymbol,
      returnPage,
      notifyPage: this.options_.notifyPage,
    }

    if (this.options_.orderSceneType) {
      requestPayload.orderSceneType = this.options_.orderSceneType
    }

    if (token) {
      requestPayload.token = token
    }

    if (goods !== undefined) {
      requestPayload.goods =
        typeof goods === "string" ? goods : JSON.stringify(goods)
    }

    requestPayload.sign = generateChainupSign(requestPayload, this.options_.secretKey)

    const { sign: _sign, token: _token, ...debugPayload } = requestPayload
    this.logger_.debug(
      `ChainUp createThirdOrder request keys=${Object.keys(debugPayload)
        .sort()
        .join(",")} has_token=${Boolean(_token)} identifier=${
        openId ? "openId" : "userId"
      } payload=${JSON.stringify(debugPayload)}`
    )

    const response = await postChainupJson<ChainupCreateThirdOrderResponseData>(
      this.getPlatformApiBaseUrl(),
      "/platformapi/chainup/open/opay/createThirdOrder",
      requestPayload
    )

    const data = this.assertChainupSuccess(
      response,
      "Failed to create ChainUp payment order"
    )

    if (!data.orderNum) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "ChainUp createThirdOrder response is missing orderNum"
      )
    }

    const payPageUrl = this.buildPayPageUrl({
      orderNum: data.orderNum,
      token,
      openId,
      userId: platformUid,
      providerPayUrl: data.payUrl ?? data.h5Url,
    })

    return {
      id: data.orderNum,
      status: PaymentSessionStatus.PENDING,
      data: {
        ...(input.data ?? {}),
        provider_payment_id: data.orderNum,
        order_num: data.orderNum,
        app_order_id: sessionId,
        order_status: "1",
        order_amount: orderAmount,
        pay_coin_symbol: this.options_.payCoinSymbol,
        platform_uid: platformUid,
        user_id: platformUid,
        ...(openId ? { open_id: openId } : {}),
        return_page: returnPage,
        pay_page_url: payPageUrl,
        chainup_response_sign: data.sign,
      },
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const orderNum = this.requireOrderNum(input.data)
    const response = await this.queryOrderDetail(orderNum, input.data)
    const data = this.assertChainupSuccess(
      response,
      `Failed to query ChainUp order detail for orderNum=${orderNum}`
    )
    const orderStatus = this.normalizeOrderStatus(data.orderStatus)
    this.logger_.debug(
      `ChainUp orderDetail status order_num=${data.orderNum ?? orderNum} app_order_id=${
        data.appOrderId ?? this.getStringValue(input.data?.app_order_id) ?? "n/a"
      } order_status=${orderStatus}`
    )

    return {
      status: this.mapOrderStatusToSessionStatus(orderStatus),
      data: {
        ...(input.data ?? {}),
        provider_payment_id: data.orderNum ?? orderNum,
        order_num: data.orderNum ?? orderNum,
        app_order_id:
          data.appOrderId ?? this.getStringValue(input.data?.app_order_id),
        order_status: orderStatus,
        order_amount:
          this.getStringValue(data.orderAmount) ??
          this.getStringValue(input.data?.order_amount),
        pay_coin_symbol:
          data.payCoinSymbol ?? this.getStringValue(input.data?.pay_coin_symbol),
        user_id: this.getStringValue(data.userId) ?? this.getStringValue(input.data?.user_id),
      },
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const status = await this.getPaymentStatus({
      data: input.data,
      context: input.context,
    })

    return { data: status.data }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const status = await this.getPaymentStatus({
      data: input.data,
      context: input.context,
    })
    const statusData = (status.data ?? {}) as Record<string, unknown>
    if (status.status !== PaymentSessionStatus.CAPTURED) {
      this.logger_.warn(
        `ChainUp payment session not authorized yet. app_order_id=${
          this.getStringValue(statusData.app_order_id) ?? "n/a"
        } order_num=${
          this.getStringValue(statusData.order_num) ??
          this.getStringValue(statusData.provider_payment_id) ??
          "n/a"
        } order_status=${this.getStringValue(statusData.order_status) ?? "n/a"} mapped_status=${
          status.status
        }`
      )
    }

    return {
      status: status.status,
      data: status.data,
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const status = await this.getPaymentStatus({
      data: input.data,
      context: input.context,
    })

    return {
      status: status.status,
      data: {
        ...(status.data ?? {}),
        requested_amount: this.toAmountString(input.amount),
        requested_currency_code: input.currency_code,
      },
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {
      data: {
        ...(input.data ?? {}),
        canceled_at: new Date().toISOString(),
      },
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Refund is not supported by ChainUp MVP provider. Requested amount: ${this.toAmountString(
        input.amount
      )}`
    )
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload?.data ?? {}) as Record<string, unknown>
    const sessionId = this.getStringValue(body.outOrderId ?? body.appOrderId ?? body.app_order_id)
    const amount = this.getStringValue(body.payAmount ?? body.orderAmount) ?? "0"

    if (!this.isValidWebhookPayload(body)) {
      this.logger_.warn("Rejected ChainUp payment webhook due to invalid signature.")
      return this.buildWebhookResult(PaymentActions.FAILED, sessionId, amount)
    }

    const orderStatus = this.normalizeOrderStatus(body.orderStatus ?? body.order_status)
    const action = this.mapOrderStatusToWebhookAction(orderStatus)

    if (!sessionId) {
      return this.buildWebhookResult(PaymentActions.NOT_SUPPORTED)
    }

    return this.buildWebhookResult(action, sessionId, amount)
  }

  private async queryOrderDetail(
    orderNum: string,
    paymentData: Record<string, unknown> = {}
  ): Promise<ChainupApiResponse<ChainupOrderDetailResponseData>> {
    const requestPayload: Record<string, unknown> = {
      appKey: this.options_.appKey,
      orderNum,
    }

    const token = this.getStringValue(paymentData.token)

    if (token) {
      requestPayload.token = token
    }

    requestPayload.sign = generateChainupSign(requestPayload, this.options_.secretKey)

    return await postChainupJson<ChainupOrderDetailResponseData>(
      this.getPlatformApiBaseUrl(),
      "/platformapi/chainup/open/opay/orderDetail",
      requestPayload
    )
  }

  private buildWebhookResult(
    action: PaymentActions,
    sessionId = "",
    amount = "0"
  ): WebhookActionResult {
    return {
      action,
      data: {
        session_id: sessionId,
        amount: new BigNumber(amount),
      },
    }
  }

  private mapOrderStatusToSessionStatus(status: string): PaymentSessionStatus {
    switch (status) {
      case "3":
        return PaymentSessionStatus.CAPTURED
      case "2":
        return PaymentSessionStatus.ERROR
      case "0":
        return PaymentSessionStatus.CANCELED
      case "1":
      default:
        return PaymentSessionStatus.PENDING
    }
  }

  private mapOrderStatusToWebhookAction(status: string): PaymentActions {
    switch (status) {
      case "3":
        return PaymentActions.SUCCESSFUL
      case "2":
        return PaymentActions.FAILED
      case "0":
        return PaymentActions.CANCELED
      case "1":
        return PaymentActions.REQUIRES_MORE
      default:
        return PaymentActions.NOT_SUPPORTED
    }
  }

  private assertChainupSuccess<TData>(
    response: ChainupApiResponse<TData>,
    fallbackMessage: string
  ): TData {
    if (!isChainupSuccess(response.code)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        response.msg || fallbackMessage
      )
    }

    if (!response.data) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, fallbackMessage)
    }

    return response.data
  }

  private isValidWebhookPayload(payload: Record<string, unknown>): boolean {
    const appKey = this.getStringValue(payload.appKey)

    if (appKey && appKey !== this.options_.appKey) {
      return false
    }

    return verifyChainupSign(payload, this.options_.secretKey)
  }

  private requireOrderNum(data: Record<string, unknown> = {}): string {
    const orderNum =
      this.getStringValue(data.order_num) ||
      this.getStringValue(data.orderNum) ||
      this.getStringValue(data.provider_payment_id)

    if (!orderNum) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing ChainUp order number in payment data."
      )
    }

    return orderNum
  }

  private normalizeOrderStatus(value: unknown): string {
    return this.getStringValue(value) ?? "1"
  }

  private resolvePlatformUid(input: InitiatePaymentInput): string {
    const data = input.data ?? {}
    const platformUid =
      this.getStringValue(data.platform_uid) ||
      this.getStringValue(data.user_id) ||
      this.getStringValue(data.userId)

    if (platformUid) {
      return platformUid
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing platform uid for ChainUp payment request."
    )
  }

  private resolveReturnPage(input: InitiatePaymentInput): string {
    const sourceReturnPage =
      this.getNonEmptyStringValue(input.data?.return_page) || this.options_.returnPage
    const normalizedReturnPage = this.normalizeReturnPage(sourceReturnPage)

    if (normalizedReturnPage !== sourceReturnPage) {
      this.logger_.debug(
        `ChainUp return_page sanitized to remove query/hash. source=${sourceReturnPage} normalized=${normalizedReturnPage}`
      )
    }

    return normalizedReturnPage
  }

  private normalizeReturnPage(returnPage: string): string {
    try {
      const fallbackBase = new URL(this.options_.returnPage)
      const normalized = new URL(returnPage, fallbackBase)
      normalized.search = ""
      normalized.hash = ""
      return normalized.toString()
    } catch {
      return returnPage.split(/[?#]/)[0]
    }
  }

  private buildPayPageUrl({
    orderNum,
    token,
    openId,
    userId,
    providerPayUrl,
  }: {
    orderNum: string
    token?: string
    openId?: string
    userId: string
    providerPayUrl?: string
  }): string {
    const fallbackPath = "/platform/pay.html"
    const rawPayUrl =
      providerPayUrl || `${this.getPlatformApiBaseUrl()}${fallbackPath}`

    let payUrl: URL
    try {
      payUrl = new URL(rawPayUrl)
    } catch {
      payUrl = new URL(rawPayUrl, this.getPlatformApiBaseUrl())
    }

    payUrl.searchParams.set("appKey", this.options_.appKey)
    payUrl.searchParams.set("orderNum", orderNum)

    if (openId) {
      payUrl.searchParams.set("openId", openId)
      payUrl.searchParams.delete("userId")
    } else {
      payUrl.searchParams.set("userId", userId)
      payUrl.searchParams.delete("openId")
    }

    if (token) {
      payUrl.searchParams.set("token", token)
    }

    return payUrl.toString()
  }

  private toAmountString(value: unknown): string {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
    ) {
      return String(value)
    }

    if (value && typeof value === "object" && "toString" in value) {
      return String(value)
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid amount value for ChainUp payment request."
    )
  }

  private getStringValue(value: unknown): string | undefined {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
    ) {
      return String(value)
    }

    return undefined
  }

  private getNonEmptyStringValue(value: unknown): string | undefined {
    const normalized = this.getStringValue(value)?.trim()
    return normalized ? normalized : undefined
  }

  private getPlatformApiBaseUrl(): string {
    return this.options_.platformApiUrl.replace(/\/+$/, "")
  }
}

export default PlatformPaymentService
