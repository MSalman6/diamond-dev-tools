import type { Sequelize } from "sequelize";
import { api_keys as _api_keys } from "./api_keys";
import type { api_keysAttributes, api_keysCreationAttributes } from "./api_keys";
import { available_event as _available_event } from "./available_event";
import type { available_eventAttributes, available_eventCreationAttributes } from "./available_event";
import { bonus_score_history as _bonus_score_history } from "./bonus_score_history";
import type { bonus_score_historyAttributes, bonus_score_historyCreationAttributes } from "./bonus_score_history";
import { delegate_reward as _delegate_reward } from "./delegate_reward";
import type { delegate_rewardAttributes, delegate_rewardCreationAttributes } from "./delegate_reward";
import { delegate_staker as _delegate_staker } from "./delegate_staker";
import type { delegate_stakerAttributes, delegate_stakerCreationAttributes } from "./delegate_staker";
import { dmd_names as _dmd_names } from "./dmd_names";
import type { dmd_namesAttributes, dmd_namesCreationAttributes } from "./dmd_names";
import { dmd_name_events as _dmd_name_events } from "./dmd_name_events";
import type { dmd_name_eventsAttributes, dmd_name_eventsCreationAttributes } from "./dmd_name_events";
import { headers as _headers } from "./headers";
import type { headersAttributes, headersCreationAttributes } from "./headers";
import { node as _node } from "./node";
import type { nodeAttributes, nodeCreationAttributes } from "./node";
import { ordered_withdrawal as _ordered_withdrawal } from "./ordered_withdrawal";
import type { ordered_withdrawalAttributes, ordered_withdrawalCreationAttributes } from "./ordered_withdrawal";
import { pending_validator_state_event as _pending_validator_state_event } from "./pending_validator_state_event";
import type { pending_validator_state_eventAttributes, pending_validator_state_eventCreationAttributes } from "./pending_validator_state_event";
import { posdao_epoch as _posdao_epoch } from "./posdao_epoch";
import type { posdao_epochAttributes, posdao_epochCreationAttributes } from "./posdao_epoch";
import { posdao_epoch_node as _posdao_epoch_node } from "./posdao_epoch_node";
import type { posdao_epoch_nodeAttributes, posdao_epoch_nodeCreationAttributes } from "./posdao_epoch_node";
import { stake_delegators as _stake_delegators } from "./stake_delegators";
import type { stake_delegatorsAttributes, stake_delegatorsCreationAttributes } from "./stake_delegators";
import { stake_history as _stake_history } from "./stake_history";
import type { stake_historyAttributes, stake_historyCreationAttributes } from "./stake_history";
import { stake_transaction as _stake_transaction } from "./stake_transaction";
import type { stake_transactionAttributes, stake_transactionCreationAttributes } from "./stake_transaction";

export {
  _api_keys as api_keys,
  _available_event as available_event,
  _bonus_score_history as bonus_score_history,
  _delegate_reward as delegate_reward,
  _delegate_staker as delegate_staker,
  _dmd_names as dmd_names,
  _dmd_name_events as dmd_name_events,
  _headers as headers,
  _node as node,
  _ordered_withdrawal as ordered_withdrawal,
  _pending_validator_state_event as pending_validator_state_event,
  _posdao_epoch as posdao_epoch,
  _posdao_epoch_node as posdao_epoch_node,
  _stake_delegators as stake_delegators,
  _stake_history as stake_history,
  _stake_transaction as stake_transaction,
};

export type {
  api_keysAttributes,
  api_keysCreationAttributes,
  available_eventAttributes,
  available_eventCreationAttributes,
  bonus_score_historyAttributes,
  bonus_score_historyCreationAttributes,
  delegate_rewardAttributes,
  delegate_rewardCreationAttributes,
  delegate_stakerAttributes,
  delegate_stakerCreationAttributes,
  dmd_namesAttributes,
  dmd_namesCreationAttributes,
  dmd_name_eventsAttributes,
  dmd_name_eventsCreationAttributes,
  headersAttributes,
  headersCreationAttributes,
  nodeAttributes,
  nodeCreationAttributes,
  ordered_withdrawalAttributes,
  ordered_withdrawalCreationAttributes,
  pending_validator_state_eventAttributes,
  pending_validator_state_eventCreationAttributes,
  posdao_epochAttributes,
  posdao_epochCreationAttributes,
  posdao_epoch_nodeAttributes,
  posdao_epoch_nodeCreationAttributes,
  stake_delegatorsAttributes,
  stake_delegatorsCreationAttributes,
  stake_historyAttributes,
  stake_historyCreationAttributes,
  stake_transactionAttributes,
  stake_transactionCreationAttributes,
};

export function initModels(sequelize: Sequelize) {
  const api_keys = _api_keys.initModel(sequelize);
  const available_event = _available_event.initModel(sequelize);
  const bonus_score_history = _bonus_score_history.initModel(sequelize);
  const delegate_reward = _delegate_reward.initModel(sequelize);
  const delegate_staker = _delegate_staker.initModel(sequelize);
  const dmd_names = _dmd_names.initModel(sequelize);
  const dmd_name_events = _dmd_name_events.initModel(sequelize);
  const headers = _headers.initModel(sequelize);
  const node = _node.initModel(sequelize);
  const ordered_withdrawal = _ordered_withdrawal.initModel(sequelize);
  const pending_validator_state_event = _pending_validator_state_event.initModel(sequelize);
  const posdao_epoch = _posdao_epoch.initModel(sequelize);
  const posdao_epoch_node = _posdao_epoch_node.initModel(sequelize);
  const stake_delegators = _stake_delegators.initModel(sequelize);
  const stake_history = _stake_history.initModel(sequelize);
  const stake_transaction = _stake_transaction.initModel(sequelize);

  delegate_staker.belongsToMany(node, { as: 'pool_address_nodes', through: stake_delegators, foreignKey: "delegator", otherKey: "pool_address" });
  delegate_staker.belongsToMany(posdao_epoch, { as: 'id_posdao_epoch_posdao_epoches', through: delegate_reward, foreignKey: "id_delegator", otherKey: "id_posdao_epoch" });
  headers.belongsToMany(node, { as: 'node_nodes', through: available_event, foreignKey: "block", otherKey: "node" });
  headers.belongsToMany(node, { as: 'node_node_bonus_score_histories', through: bonus_score_history, foreignKey: "from_block", otherKey: "node" });
  node.belongsToMany(delegate_staker, { as: 'delegator_delegate_stakers', through: stake_delegators, foreignKey: "pool_address", otherKey: "delegator" });
  node.belongsToMany(headers, { as: 'block_headers', through: available_event, foreignKey: "node", otherKey: "block" });
  node.belongsToMany(headers, { as: 'from_block_headers', through: bonus_score_history, foreignKey: "node", otherKey: "from_block" });
  node.belongsToMany(posdao_epoch, { as: 'id_posdao_epoch_posdao_epoch_posdao_epoch_nodes', through: posdao_epoch_node, foreignKey: "id_node", otherKey: "id_posdao_epoch" });
  posdao_epoch.belongsToMany(delegate_staker, { as: 'id_delegator_delegate_stakers', through: delegate_reward, foreignKey: "id_posdao_epoch", otherKey: "id_delegator" });
  posdao_epoch.belongsToMany(node, { as: 'id_node_nodes', through: posdao_epoch_node, foreignKey: "id_posdao_epoch", otherKey: "id_node" });
  delegate_reward.belongsTo(delegate_staker, { as: "id_delegator_delegate_staker", foreignKey: "id_delegator"});
  delegate_staker.hasMany(delegate_reward, { as: "delegate_rewards", foreignKey: "id_delegator"});
  stake_delegators.belongsTo(delegate_staker, { as: "delegator_delegate_staker", foreignKey: "delegator"});
  delegate_staker.hasMany(stake_delegators, { as: "stake_delegators", foreignKey: "delegator"});
  available_event.belongsTo(headers, { as: "block_header", foreignKey: "block"});
  headers.hasMany(available_event, { as: "available_events", foreignKey: "block"});
  bonus_score_history.belongsTo(headers, { as: "from_block_header", foreignKey: "from_block"});
  headers.hasMany(bonus_score_history, { as: "bonus_score_histories", foreignKey: "from_block"});
  bonus_score_history.belongsTo(headers, { as: "to_block_header", foreignKey: "to_block"});
  headers.hasMany(bonus_score_history, { as: "to_block_bonus_score_histories", foreignKey: "to_block"});
  node.belongsTo(headers, { as: "added_block_header", foreignKey: "added_block"});
  headers.hasMany(node, { as: "nodes", foreignKey: "added_block"});
  ordered_withdrawal.belongsTo(headers, { as: "claimed_on_block_header", foreignKey: "claimed_on_block"});
  headers.hasMany(ordered_withdrawal, { as: "ordered_withdrawals", foreignKey: "claimed_on_block"});
  pending_validator_state_event.belongsTo(headers, { as: "on_enter_block_number_header", foreignKey: "on_enter_block_number"});
  headers.hasMany(pending_validator_state_event, { as: "pending_validator_state_events", foreignKey: "on_enter_block_number"});
  pending_validator_state_event.belongsTo(headers, { as: "on_exit_block_number_header", foreignKey: "on_exit_block_number"});
  headers.hasMany(pending_validator_state_event, { as: "on_exit_block_number_pending_validator_state_events", foreignKey: "on_exit_block_number"});
  posdao_epoch.belongsTo(headers, { as: "block_end_header", foreignKey: "block_end"});
  headers.hasOne(posdao_epoch, { as: "posdao_epoch", foreignKey: "block_end"});
  posdao_epoch.belongsTo(headers, { as: "block_start_header", foreignKey: "block_start"});
  headers.hasOne(posdao_epoch, { as: "block_start_posdao_epoch", foreignKey: "block_start"});
  stake_history.belongsTo(headers, { as: "from_block_header", foreignKey: "from_block"});
  headers.hasMany(stake_history, { as: "stake_histories", foreignKey: "from_block"});
  stake_history.belongsTo(headers, { as: "to_block_header", foreignKey: "to_block"});
  headers.hasMany(stake_history, { as: "to_block_stake_histories", foreignKey: "to_block"});
  available_event.belongsTo(node, { as: "node_node", foreignKey: "node"});
  node.hasMany(available_event, { as: "available_events", foreignKey: "node"});
  bonus_score_history.belongsTo(node, { as: "node_node", foreignKey: "node"});
  node.hasMany(bonus_score_history, { as: "bonus_score_histories", foreignKey: "node"});
  ordered_withdrawal.belongsTo(node, { as: "from_pool_stakingAddress_node", foreignKey: "from_pool_stakingAddress"});
  node.hasMany(ordered_withdrawal, { as: "ordered_withdrawals", foreignKey: "from_pool_stakingAddress"});
  posdao_epoch_node.belongsTo(node, { as: "id_node_node", foreignKey: "id_node"});
  node.hasMany(posdao_epoch_node, { as: "posdao_epoch_nodes", foreignKey: "id_node"});
  stake_delegators.belongsTo(node, { as: "pool_address_node", foreignKey: "pool_address"});
  node.hasMany(stake_delegators, { as: "stake_delegators", foreignKey: "pool_address"});
  stake_history.belongsTo(node, { as: "node_node", foreignKey: "node"});
  node.hasMany(stake_history, { as: "stake_histories", foreignKey: "node"});
  delegate_reward.belongsTo(posdao_epoch, { as: "id_posdao_epoch_posdao_epoch", foreignKey: "id_posdao_epoch"});
  posdao_epoch.hasMany(delegate_reward, { as: "delegate_rewards", foreignKey: "id_posdao_epoch"});
  ordered_withdrawal.belongsTo(posdao_epoch, { as: "staking_epoch_posdao_epoch", foreignKey: "staking_epoch"});
  posdao_epoch.hasMany(ordered_withdrawal, { as: "ordered_withdrawals", foreignKey: "staking_epoch"});
  posdao_epoch_node.belongsTo(posdao_epoch, { as: "id_posdao_epoch_posdao_epoch", foreignKey: "id_posdao_epoch"});
  posdao_epoch.hasMany(posdao_epoch_node, { as: "posdao_epoch_nodes", foreignKey: "id_posdao_epoch"});

  return {
    api_keys: api_keys,
    available_event: available_event,
    bonus_score_history: bonus_score_history,
    delegate_reward: delegate_reward,
    delegate_staker: delegate_staker,
    dmd_names: dmd_names,
    dmd_name_events: dmd_name_events,
    headers: headers,
    node: node,
    ordered_withdrawal: ordered_withdrawal,
    pending_validator_state_event: pending_validator_state_event,
    posdao_epoch: posdao_epoch,
    posdao_epoch_node: posdao_epoch_node,
    stake_delegators: stake_delegators,
    stake_history: stake_history,
    stake_transaction: stake_transaction,
  };
}
