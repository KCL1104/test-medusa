import { model } from "@medusajs/framework/utils"
import { RefundRequestStatus } from "../types"

const RefundRequest = model
  .define("refund_request", {
    id: model.id().primaryKey(),
    order_id: model.text(),
    payment_id: model.text(),
    customer_id: model.text(),
    amount: model.bigNumber(),
    currency_code: model.text(),
    reason: model.text().nullable(),
    note: model.text().nullable(),
    status: model
      .enum(Object.values(RefundRequestStatus))
      .default(RefundRequestStatus.PENDING),
    idempotency_key: model.text().unique().nullable(),
    reviewed_by: model.text().nullable(),
    reviewed_at: model.dateTime().nullable(),
    review_note: model.text().nullable(),
    refunded_at: model.dateTime().nullable(),
    failed_at: model.dateTime().nullable(),
    failure_reason: model.text().nullable(),
    external_refund_order_num: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ["order_id"],
    },
    {
      on: ["payment_id"],
    },
    {
      on: ["customer_id", "status"],
    },
  ])

export default RefundRequest
