import { Module } from "@medusajs/framework/utils"
import ChainupAuditModuleService from "./service"

export const CHAINUP_AUDIT_MODULE = "chainup_audit"

export default Module(CHAINUP_AUDIT_MODULE, {
  service: ChainupAuditModuleService,
})
