import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface dmd_name_eventsAttributes {
  id: number;
  label_hash: any;
  label?: string;
  event_type: string;
  actor_address?: any;
  from_address?: any;
  to_address?: any;
  expiration?: string;
  blocked?: boolean;
  block_number: number;
  block_timestamp: number;
  tx_hash?: any;
  created_at?: Date;
}

export type dmd_name_eventsPk = "id";
export type dmd_name_eventsId = dmd_name_events[dmd_name_eventsPk];
export type dmd_name_eventsOptionalAttributes =
  | "id"
  | "label"
  | "actor_address"
  | "from_address"
  | "to_address"
  | "expiration"
  | "blocked"
  | "tx_hash"
  | "created_at";
export type dmd_name_eventsCreationAttributes = Optional<dmd_name_eventsAttributes, dmd_name_eventsOptionalAttributes>;

export class dmd_name_events
  extends Model<dmd_name_eventsAttributes, dmd_name_eventsCreationAttributes>
  implements dmd_name_eventsAttributes
{
  id!: number;
  label_hash!: any;
  label?: string;
  event_type!: string;
  actor_address?: any;
  from_address?: any;
  to_address?: any;
  expiration?: string;
  blocked?: boolean;
  block_number!: number;
  block_timestamp!: number;
  tx_hash?: any;
  created_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof dmd_name_events {
    return dmd_name_events.init(
      {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        label_hash: {
          type: DataTypes.BLOB,
          allowNull: false,
        },
        label: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        event_type: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },
        actor_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        from_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        to_address: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        expiration: {
          type: DataTypes.DECIMAL,
          allowNull: true,
        },
        blocked: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
        },
        block_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        block_timestamp: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        tx_hash: {
          type: DataTypes.BLOB,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: 'dmd_name_events',
        schema: 'public',
        timestamps: false,
        indexes: [
          { name: 'dmd_name_events_pkey', unique: true, fields: [{ name: 'id' }] },
          { name: 'idx_dmd_name_events_label_hash', fields: [{ name: 'label_hash' }, { name: 'block_number' }, { name: 'id' }] },
          { name: 'idx_dmd_name_events_block_number', fields: [{ name: 'block_number' }, { name: 'id' }] },
        ],
      }
    );
  }
}
