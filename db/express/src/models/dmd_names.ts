import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface dmd_namesAttributes {
  label_hash: any;
  label?: string;
  owner?: any;
  creator?: any;
  created_block?: number;
  created_timestamp?: number;
  expiration?: string;
  active?: boolean;
  blocked?: boolean;
  last_action_type?: string;
  last_action_block?: number;
  last_action_timestamp?: number;
  updated_at?: Date;
}

export type dmd_namesPk = "label_hash";
export type dmd_namesId = dmd_names[dmd_namesPk];
export type dmd_namesOptionalAttributes =
  | "label"
  | "owner"
  | "creator"
  | "created_block"
  | "created_timestamp"
  | "expiration"
  | "active"
  | "blocked"
  | "last_action_type"
  | "last_action_block"
  | "last_action_timestamp"
  | "updated_at";
export type dmd_namesCreationAttributes = Optional<dmd_namesAttributes, dmd_namesOptionalAttributes>;

export class dmd_names
  extends Model<dmd_namesAttributes, dmd_namesCreationAttributes>
  implements dmd_namesAttributes
{
  label_hash!: any;
  label?: string;
  owner?: any;
  creator?: any;
  created_block?: number;
  created_timestamp?: number;
  expiration?: string;
  active?: boolean;
  blocked?: boolean;
  last_action_type?: string;
  last_action_block?: number;
  last_action_timestamp?: number;
  updated_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof dmd_names {
    return dmd_names.init(
      {
        label_hash: {
          type: DataTypes.BLOB,
          allowNull: false,
          primaryKey: true,
        },
        label: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        owner: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        creator: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        created_block: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        created_timestamp: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        expiration: {
          type: DataTypes.DECIMAL,
          allowNull: true,
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        blocked: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        last_action_type: {
          type: DataTypes.STRING(30),
          allowNull: true,
        },
        last_action_block: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        last_action_timestamp: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'dmd_names',
        schema: 'public',
        timestamps: false,
        indexes: [
          { name: 'dmd_names_pkey', unique: true, fields: [{ name: 'label_hash' }] },
          { name: 'idx_dmd_names_owner', fields: [{ name: 'owner' }] },
          { name: 'idx_dmd_names_expiration', fields: [{ name: 'expiration' }] },
        ],
      }
    );
  }
}
