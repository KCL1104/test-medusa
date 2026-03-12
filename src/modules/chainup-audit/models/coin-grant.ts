import { model } from "@medusajs/framework/utils"
import { CoinGrantStatus } from "../types"

const CoinGrant = model
  .define("coin_grant", {
    id: model.id().primaryKey(),
    app_order_id: model.text().unique(),
    open_id: model.text().nullable(),
    user_id: model.text().nullable(),
    amount: model.bigNumber(),
    pay_coin_symbol: model.text(),
    order_scene_type: model.text().nullable(),
    status: model.enum(Object.values(CoinGrantStatus)).default(CoinGrantStatus.PENDING),
    external_order_num: model.text().nullable(),
    error_code: model.text().nullable(),
    error_message: model.text().nullable(),
    initiated_by: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ["app_order_id"],
      unique: true,
    },
    {
      on: ["status"],
    },
  ])

export default CoinGrant
