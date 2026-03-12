import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import createChainupCoinGrantWorkflow from "../../../../workflows/create-chainup-coin-grant"
import { PostAdminCoinGrantSchemaType } from "./middlewares"

export async function POST(
  req: AuthenticatedMedusaRequest<PostAdminCoinGrantSchemaType>,
  res: MedusaResponse
) {
  const initiatedBy = req.auth_context?.actor_id ?? "system"

  const defaultCoinSymbol =
    process.env.CHAINUP_GRANT_DEFAULT_COIN_SYMBOL?.trim() ||
    process.env.CHAINUP_PAY_COIN_SYMBOL?.trim()
  const payCoinSymbol = req.validatedBody.pay_coin_symbol ?? defaultCoinSymbol

  if (!payCoinSymbol) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing pay coin symbol. Provide pay_coin_symbol or set CHAINUP_GRANT_DEFAULT_COIN_SYMBOL / CHAINUP_PAY_COIN_SYMBOL."
    )
  }

  const { result } = await createChainupCoinGrantWorkflow(req.scope).run({
    input: {
      app_order_id: req.validatedBody.app_order_id,
      amount: req.validatedBody.amount,
      pay_coin_symbol: payCoinSymbol,
      open_id: req.validatedBody.open_id,
      user_id: req.validatedBody.user_id,
      order_scene_type: req.validatedBody.order_scene_type,
      initiated_by: initiatedBy,
      metadata: req.validatedBody.metadata,
    },
  })

  return res.status(200).json({
    coin_grant: result,
  })
}
