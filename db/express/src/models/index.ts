import sequelize, { Sequelize } from 'sequelize';
import {initModels} from "./init-models";

export type DB = {
    sequelize: Sequelize,
    Sequelize: any,
}

const seq = new Sequelize('postgres', process.env.DMD_DB_API_USER || 'diamond_api', process.env.DMD_DB_API_PASS, {
        host: 'db',
        dialect: 'postgres', // or 'mysql', 'sqlite', etc.
    });
const db: DB = {
    sequelize: seq,
    Sequelize: sequelize,
};
initModels(seq);


export default db;
