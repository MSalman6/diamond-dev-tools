import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { node, nodeId } from './node';
import type { posdao_epoch, posdao_epochId } from './posdao_epoch';

export interface posdao_epoch_nodeAttributes {
  id_node: any;
  id_posdao_epoch: number;
  owner_reward?: number;
  is_claimed?: boolean;
  epoch_apy: number;
  total_pool_reward: number;
  validator_fixed_reward: number;
  node_operator_reward: number;
  delegators_total_reward: number;
  total_staked_snapshot: number;
}

export type posdao_epoch_nodePk = "id_node" | "id_posdao_epoch";
export type posdao_epoch_nodeId = posdao_epoch_node[posdao_epoch_nodePk];
export type posdao_epoch_nodeOptionalAttributes = "owner_reward" | "is_claimed";
export type posdao_epoch_nodeCreationAttributes = Optional<posdao_epoch_nodeAttributes, posdao_epoch_nodeOptionalAttributes>;

export class posdao_epoch_node extends Model<posdao_epoch_nodeAttributes, posdao_epoch_nodeCreationAttributes> implements posdao_epoch_nodeAttributes {
  id_node!: any;
  id_posdao_epoch!: number;
  owner_reward?: number;
  is_claimed?: boolean;
  epoch_apy!: number;
  total_pool_reward!: number;
  validator_fixed_reward!: number;
  node_operator_reward!: number;
  delegators_total_reward!: number;
  total_staked_snapshot!: number;

  // posdao_epoch_node belongsTo node via id_node
  id_node_node!: node;
  getId_node_node!: Sequelize.BelongsToGetAssociationMixin<node>;
  setId_node_node!: Sequelize.BelongsToSetAssociationMixin<node, nodeId>;
  createId_node_node!: Sequelize.BelongsToCreateAssociationMixin<node>;
  // posdao_epoch_node belongsTo posdao_epoch via id_posdao_epoch
  id_posdao_epoch_posdao_epoch!: posdao_epoch;
  getId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToGetAssociationMixin<posdao_epoch>;
  setId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToSetAssociationMixin<posdao_epoch, posdao_epochId>;
  createId_posdao_epoch_posdao_epoch!: Sequelize.BelongsToCreateAssociationMixin<posdao_epoch>;

  static initModel(sequelize: Sequelize.Sequelize): typeof posdao_epoch_node {
    return posdao_epoch_node.init({
    id_node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'node',
        key: 'pool_address'
      }
    },
    id_posdao_epoch: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'posdao_epoch',
        key: 'id'
      }
    },
    owner_reward: {
      type: DataTypes.DECIMAL,
      allowNull: true
    },
    is_claimed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    epoch_apy: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    total_pool_reward: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    validator_fixed_reward: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    node_operator_reward: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    delegators_total_reward: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    total_staked_snapshot: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'posdao_epoch_node',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pk_posdao_epoch_node",
        unique: true,
        fields: [
          { name: "id_posdao_epoch" },
          { name: "id_node" },
        ]
      },
    ]
  });
  }
}
