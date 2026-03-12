import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { CHAINUP_AUDIT_MODULE } from "../../../modules/chainup-audit"
import type ChainupAuditModuleService from "../../../modules/chainup-audit/service"
import { RefundRequestStatus } from "../../../modules/chainup-audit/types"
import { PostStoreRefundRequestSchemaType } from "./middlewares"

const getOrderPaymentIds = (order: Record<string, unknown>): string[] => {
  const paymentCollections = Array.isArray(order.payment_collections)
    ? order.payment_collections
    : []

  return paymentCollections.flatMap((collection) => {
    if (!collection || typeof collection !== "object") {
      return []
    }

    const payments = (collection as Record<string, unknown>).payments
    if (!Array.isArray(payments)) {
      return []
    }

    return payments
      .map((payment) => {
        if (!payment || typeof payment !== "object") {
          return undefined
        }

        const paymentId = (payment as Record<string, unknown>).id
        return typeof paymentId === "string" ? paymentId : undefined
      })
      .filter((id): id is string => Boolean(id))
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostStoreRefundRequestSchemaType>,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer authentication is required."
    )
  }

  const chainupAuditModuleService: ChainupAuditModuleService = req.scope.resolve(
    CHAINUP_AUDIT_MODULE
  )
  const {
    order_id,
    payment_id,
    amount,
    currency_code,
    reason,
    note,
    idempotency_key,
  } = req.validatedBody

  if (idempotency_key) {
    const existingRequests = await chainupAuditModuleService.listRefundRequests({
      idempotency_key,
    })
    const existingRequest = existingRequests.find(
      (request) => request.customer_id === customerId
    )

    if (existingRequest) {
      return res.status(200).json({
        refund_request: existingRequest,
        idempotent: true,
      })
    }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "currency_code",
      "payment_collections.id",
      "payment_collections.payments.id",
    ],
    filters: {
      id: order_id,
      customer_id: customerId,
    },
  })
  const order = orders[0] as Record<string, unknown> | undefined

  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order ${order_id} was not found for this customer.`
    )
  }

  const paymentIds = getOrderPaymentIds(order)
  if (!paymentIds.includes(payment_id)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Payment ${payment_id} is not part of order ${order_id}.`
    )
  }

  const orderCurrencyCode =
    typeof order.currency_code === "string" ? order.currency_code : undefined
  const normalizedCurrencyCode = (currency_code ?? orderCurrencyCode)?.toLowerCase()

  if (!normalizedCurrencyCode) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Unable to resolve currency code for refund request."
    )
  }

  const normalizedAmount = Number(amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "amount must be a positive number."
    )
  }

  const createdRefundRequest = await chainupAuditModuleService.createRefundRequests({
    order_id,
    payment_id,
    customer_id: customerId,
    amount: normalizedAmount,
    currency_code: normalizedCurrencyCode,
    reason: reason ?? null,
    note: note ?? null,
    idempotency_key: idempotency_key ?? null,
    status: RefundRequestStatus.PENDING,
    metadata: {
      source: "store",
    },
  })
  const refundRequest = Array.isArray(createdRefundRequest)
    ? createdRefundRequest[0]
    : createdRefundRequest

  return res.status(201).json({
    refund_request: refundRequest,
  })
}
