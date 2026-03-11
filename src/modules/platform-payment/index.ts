import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PlatformPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PlatformPaymentService],
})
