import { MedusaService } from "@medusajs/framework/utils"
import RefundRequest from "./models/refund-request"
import CoinGrant from "./models/coin-grant"

class ChainupAuditModuleService extends MedusaService({
  RefundRequest,
  CoinGrant,
}) {}

export default ChainupAuditModuleService
