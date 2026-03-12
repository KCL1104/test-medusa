import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CHAINUP_AUDIT_MODULE } from "../../modules/chainup-audit"
import type ChainupAuditModuleService from "../../modules/chainup-audit/service"
import { CoinGrantStatus } from "../../modules/chainup-audit/types"
import { createChainupRefundOrder } from "../../utils/chainup-refund-order"

export type CreateChainupCoinGrantStepInput = {
  app_order_id: string
  amount: string
  pay_coin_symbol: string
  open_id?: string
  user_id?: string
  order_scene_type?: string
  initiated_by?: string
  metadata?: Record<string, unknown>
}

type EnvConfig = {
  platformApiUrl: string
  appKey: string
  secretKey: string
}

const getRequiredEnvConfig = (): EnvConfig => {
  const platformApiUrl = process.env.PLATFORM_API_URL?.trim()
  const appKey = process.env.PLATFORM_APP_KEY?.trim()
  const secretKey = process.env.PLATFORM_SECRET_KEY?.trim()

  if (!platformApiUrl || !appKey || !secretKey) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing Star Vaults environment configuration. PLATFORM_API_URL, PLATFORM_APP_KEY, and PLATFORM_SECRET_KEY are required."
    )
  }

  return {
    platformApiUrl,
    appKey,
    secretKey,
  }
}

export const createChainupCoinGrantStep = createStep(
  "create-chainup-coin-grant-step",
  async (input: CreateChainupCoinGrantStepInput, { container }) => {
    if (!input.open_id && !input.user_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Coin grant requires open_id or user_id."
      )
    }

    const chainupAuditModuleService: ChainupAuditModuleService = container.resolve(
      CHAINUP_AUDIT_MODULE
    )
    const existingCoinGrants = await chainupAuditModuleService.listCoinGrants({
      app_order_id: input.app_order_id,
    })
    const existingCoinGrant = existingCoinGrants[0]

    if (existingCoinGrant) {
      if (existingCoinGrant.status === CoinGrantStatus.SUCCESS) {
        return new StepResponse(existingCoinGrant)
      }

      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Coin grant app_order_id=${input.app_order_id} already exists with status=${existingCoinGrant.status}.`
      )
    }

    const normalizedAmount = Number(input.amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "amount must be a positive number."
      )
    }

    const createdCoinGrant = await chainupAuditModuleService.createCoinGrants({
      app_order_id: input.app_order_id,
      open_id: input.open_id ?? null,
      user_id: input.user_id ?? null,
      amount: normalizedAmount,
      pay_coin_symbol: input.pay_coin_symbol,
      order_scene_type: input.order_scene_type ?? null,
      status: CoinGrantStatus.PENDING,
      initiated_by: input.initiated_by ?? null,
      metadata: input.metadata ?? {},
    })
    const coinGrant = Array.isArray(createdCoinGrant)
      ? createdCoinGrant[0]
      : createdCoinGrant
    const { platformApiUrl, appKey, secretKey } = getRequiredEnvConfig()

    try {
      const refundOrder = await createChainupRefundOrder({
        platformApiUrl,
        appKey,
        secretKey,
        appOrderId: input.app_order_id,
        openId: input.open_id,
        userId: input.user_id,
        orderAmount: input.amount,
        payCoinSymbol: input.pay_coin_symbol,
        orderSceneType: input.order_scene_type,
      })

      const updatedCoinGrant = await chainupAuditModuleService.updateCoinGrants({
        id: coinGrant.id,
        status: CoinGrantStatus.SUCCESS,
        external_order_num: refundOrder.orderNum,
        error_code: null,
        error_message: null,
      })

      return new StepResponse(updatedCoinGrant)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Star Vaults coin grant request failed."

      await chainupAuditModuleService.updateCoinGrants({
        id: coinGrant.id,
        status: CoinGrantStatus.FAILED,
        error_message: message,
      })

      throw error
    }
  }
)
