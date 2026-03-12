import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createChainupCoinGrantStep,
  type CreateChainupCoinGrantStepInput,
} from "./steps/create-chainup-coin-grant"

export type CreateChainupCoinGrantWorkflowInput = CreateChainupCoinGrantStepInput

const createChainupCoinGrantWorkflow = createWorkflow(
  "create-chainup-coin-grant",
  function (input: CreateChainupCoinGrantWorkflowInput) {
    const coinGrant = createChainupCoinGrantStep(input)

    return new WorkflowResponse(coinGrant)
  }
)

export default createChainupCoinGrantWorkflow
