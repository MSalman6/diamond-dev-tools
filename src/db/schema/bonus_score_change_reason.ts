/**
 * Bonus score change reasons table schema
 * Generated for: bonus_score_change_reasons table
 * 
 * This is ADDITIVE to existing schemas - does not modify existing types
 */

import Headers from './headers'
import Node from './node'

/**
 * Bonus score change reason record
 * Tracks why a validator's bonus score changed
 */
interface BonusScoreChangeReason {
  id: number
  node_pool_address: Node['pool_address']
  block_number: Headers['block_number']
  epoch: number
  score_change: number
  previous_score: number
  new_score: number
  reason: string
  reason_data: any | null
  created_at: Date
}
export default BonusScoreChangeReason;

/**
 * Insert parameters for bonus score change reason
 */
interface BonusScoreChangeReason_InsertParameters {
  node_pool_address: Node['pool_address']
  block_number: Headers['block_number']
  epoch: number
  score_change: number
  previous_score: number
  new_score: number
  reason: string
  reason_data?: any | null
  created_at?: Date
}
export type {BonusScoreChangeReason_InsertParameters}

/**
 * Query parameters for bonus score change reason history
 */
interface BonusScoreChangeReasonQuery {
  node_pool_address?: Node['pool_address']
  block_number?: Headers['block_number']
  epoch?: number
  reason?: string
  from_block?: Headers['block_number']
  to_block?: Headers['block_number']
  from_epoch?: number
  to_epoch?: number
  limit?: number
  offset?: number
}
export type {BonusScoreChangeReasonQuery}
