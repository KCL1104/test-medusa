import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { CHAINUP_AUDIT_MODULE } from "../../../../modules/chainup-audit"
import type ChainupAuditModuleService from "../../../../modules/chainup-audit/service"
import { RefundRequestStatus } from "../../../../modules/chainup-audit/types"
import { PostAdminRefundRequestReviewSchemaType } from "../middlewares"

export async function POST(
  req: AuthenticatedMedusaRequest<PostAdminRefundRequestReviewSchemaType>,
  res: MedusaResponse
) {
  const reviewerId = req.auth_context?.actor_id ?? "system"

  const chainupAuditModuleService: ChainupAuditModuleService = req.scope.resolve(
    CHAINUP_AUDIT_MODULE
  )
  const refundRequestId = req.params.id
  const refundRequests = await chainupAuditModuleService.listRefundRequests({
    id: refundRequestId,
  })
  const refundRequest = refundRequests[0]

  if (!refundRequest) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Refund request ${refundRequestId} was not found.`
    )
  }

  if (refundRequest.status !== RefundRequestStatus.PENDING) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `Refund request ${refundRequestId} is not pending. Current status=${refundRequest.status}.`
    )
  }

  if (req.validatedBody.action === "reject") {
    const rejectedRefundRequest = await chainupAuditModuleService.updateRefundRequests({
      id: refundRequest.id,
      status: RefundRequestStatus.REJECTED,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      review_note: req.validatedBody.note ?? null,
    })

    return res.status(200).json({
      refund_request: rejectedRefundRequest,
    })
  }

  const approvedRefundRequest = await chainupAuditModuleService.updateRefundRequests({
    id: refundRequest.id,
    status: RefundRequestStatus.APPROVED,
    reviewed_by: reviewerId,
    reviewed_at: new Date(),
    review_note: req.validatedBody.note ?? refundRequest.review_note ?? null,
  })
  const approvedRequest = Array.isArray(approvedRefundRequest)
    ? approvedRefundRequest[0]
    : approvedRefundRequest
  const refundAmount = req.validatedBody.amount ?? String(approvedRequest.amount)

  try {
    await refundPaymentWorkflow(req.scope).run({
      input: {
        payment_id: approvedRequest.payment_id,
        amount: refundAmount,
        created_by: reviewerId,
        note: req.validatedBody.note ?? approvedRequest.note ?? undefined,
      },
    })

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "data"],
      filters: {
        id: approvedRequest.payment_id,
      },
    })
    const paymentData =
      (payments[0] as Record<string, unknown> | undefined)?.data ?? {}
    const externalRefundOrderNum =
      typeof (paymentData as Record<string, unknown>).refund_order_num === "string"
        ? ((paymentData as Record<string, unknown>).refund_order_num as string)
        : null
    const refundedRefundRequest = await chainupAuditModuleService.updateRefundRequests({
      id: approvedRequest.id,
      status: RefundRequestStatus.REFUNDED,
      refunded_at: new Date(),
      external_refund_order_num: externalRefundOrderNum,
    })

    return res.status(200).json({
      refund_request: refundedRefundRequest,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Refund execution failed."

    await chainupAuditModuleService.updateRefundRequests({
      id: approvedRequest.id,
      status: RefundRequestStatus.FAILED,
      failed_at: new Date(),
      failure_reason: message,
    })

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Failed to execute refund request ${approvedRequest.id}: ${message}`
    )
  }
}
