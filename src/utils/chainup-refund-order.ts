import { MedusaError } from "@medusajs/framework/utils"
import { isChainupSuccess, postChainupJson } from "./chainup-client"
import { generateChainupSign } from "./chainup-sign"

export type ChainupRefundOrderResponseData = {
  orderNum?: string
}

export type CreateChainupRefundOrderInput = {
  platformApiUrl: string
  appKey: string
  secretKey: string
  appOrderId: string
  orderAmount: string
  payCoinSymbol: string
  openId?: string
  userId?: string
  orderSceneType?: string
}

export const createChainupRefundOrder = async (
  input: CreateChainupRefundOrderInput
): Promise<ChainupRefundOrderResponseData> => {
  if (!input.openId && !input.userId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Star Vaults refundOrder requires openId or userId."
    )
  }

  const requestPayload: Record<string, unknown> = {
    appKey: input.appKey,
    appOrderId: input.appOrderId,
    orderAmount: input.orderAmount,
    payCoinSymbol: input.payCoinSymbol,
    ...(input.openId ? { openId: input.openId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.orderSceneType ? { orderSceneType: input.orderSceneType } : {}),
  }

  requestPayload.sign = generateChainupSign(requestPayload, input.secretKey)

  const response = await postChainupJson<ChainupRefundOrderResponseData>(
    input.platformApiUrl,
    "/platformapi/chainup/open/opay/refundOrder",
    requestPayload
  )

  if (!isChainupSuccess(response.code)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      response.msg || "Failed to create Star Vaults refund order"
    )
  }

  if (!response.data?.orderNum) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Star Vaults refundOrder response is missing orderNum"
    )
  }

  return response.data
}
