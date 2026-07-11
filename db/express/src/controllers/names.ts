import { QueryTypes } from 'sequelize';
import { dmd_names } from '../models/init-models';

// Convert a BYTEA buffer column to a 0x-prefixed hex string (address, label_hash or tx_hash).
function bufToHex(buf: Buffer | null | undefined): string | null {
    if (!buf) return null;
    return '0x' + buf.toString('hex');
}

// SQL expression deriving the display status of a name from its stored flags.
const STATUS_SQL = `CASE
    WHEN COALESCE(blocked, false) THEN 'blocked'
    WHEN expiration IS NOT NULL AND expiration <= EXTRACT(EPOCH FROM NOW()) THEN 'expired'
    WHEN COALESCE(active, false) THEN 'active'
    ELSE 'inactive'
END`;

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
    name: 'label',
    owner: 'owner',
    created_at: 'created_timestamp',
    expires_at: 'expiration',
};

// Accepts either a unix-seconds string or an ISO8601 date string.
function parseTimestamp(value: string): number | null {
    if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

// GET /name/:label/history
//
// Returns creator/owner/status plus the full event timeline and a transfer-history table
// for a single .dmd name.
const getNameHistory = async (req: any, res: any) => {
    const { label } = req.params;

    try {
        const nameRows: any[] = await dmd_names.sequelize!.query(
            `SELECT
                label_hash,
                label,
                owner,
                creator,
                created_block,
                created_timestamp,
                expiration,
                blocked,
                ${STATUS_SQL} AS status
             FROM dmd_names
             WHERE LOWER(label) = LOWER($1)
             LIMIT 1`,
            { bind: [label], type: QueryTypes.SELECT }
        );

        if (nameRows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'No name found for that label' });
        }

        const nameRow = nameRows[0];

        const eventRows: any[] = await dmd_names.sequelize!.query(
            `SELECT
                event_type,
                actor_address,
                from_address,
                to_address,
                expiration,
                blocked,
                block_number,
                block_timestamp,
                tx_hash
             FROM dmd_name_events
             WHERE label_hash = $1
             ORDER BY block_number ASC, id ASC`,
            { bind: [nameRow.label_hash], type: QueryTypes.SELECT }
        );

        const events = eventRows.map((row) => ({
            type: row.event_type,
            actor: bufToHex(row.actor_address),
            from: bufToHex(row.from_address),
            to: bufToHex(row.to_address),
            expiration: row.expiration,
            blocked: row.blocked,
            block_number: row.block_number,
            timestamp: row.block_timestamp,
            tx_hash: bufToHex(row.tx_hash),
        }));

        const transfers = eventRows
            .filter((row) => row.event_type === 'Transfer')
            .map((row) => ({
                timestamp: row.block_timestamp,
                from: bufToHex(row.from_address),
                to: bufToHex(row.to_address),
                tx_hash: bufToHex(row.tx_hash),
            }));

        res.json({
            name: nameRow.label,
            label_hash: bufToHex(nameRow.label_hash),
            creator: bufToHex(nameRow.creator),
            created_at: nameRow.created_timestamp,
            created_block: nameRow.created_block,
            owner: bufToHex(nameRow.owner),
            status: nameRow.status,
            expiration: nameRow.expiration,
            blocked: nameRow.blocked ?? false,
            events,
            transfers,
        });
    } catch (error) {
        console.error('Error fetching name history:', error);
        res.status(500).json({ error: 'Failed to fetch name history' });
    }
};

// GET /owner/:address/names
//
// Every name currently owned by an address.
const listOwnedNames = async (req: any, res: any) => {
    const { address } = req.params;
    const { limit = '200', offset = '0' } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const countResult: any[] = await dmd_names.sequelize!.query(
            `SELECT COUNT(*) as total FROM dmd_names WHERE '0x' || encode(owner, 'hex') = lower($1)`,
            { bind: [address], type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await dmd_names.sequelize!.query(
            `SELECT
                label,
                expiration,
                blocked,
                last_action_type,
                last_action_block,
                last_action_timestamp,
                ${STATUS_SQL} AS status
             FROM dmd_names
             WHERE '0x' || encode(owner, 'hex') = lower($1)
             ORDER BY label ASC
             LIMIT $2 OFFSET $3`,
            { bind: [address, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows.map((row) => ({
                name: row.label,
                status: row.status,
                expiration: row.expiration,
                dns: null,
                last_action: {
                    type: row.last_action_type,
                    block_number: row.last_action_block,
                    timestamp: row.last_action_timestamp,
                },
            })),
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching owned names:', error);
        res.status(500).json({ error: 'Failed to fetch owned names' });
    }
};

// GET /names
//
// Searchable/paginated public directory of every registered name.
const listNames = async (req: any, res: any) => {
    const {
        search,
        status,
        created_from,
        created_to,
        expires_from,
        expires_to,
        sort = 'created_at',
        order = 'desc',
        limit = '50',
        offset = '0',
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 50, 500);
    const offsetNum = parseInt(offset as string) || 0;
    const sortColumn = ALLOWED_SORT_COLUMNS[sort as string] || 'created_timestamp';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    try {
        const conditions: string[] = [];
        const bind: any[] = [];
        let paramIdx = 1;

        if (search) {
            conditions.push(`(label ILIKE $${paramIdx} OR '0x' || encode(owner, 'hex') = lower($${paramIdx + 1}))`);
            bind.push(`%${search}%`, search);
            paramIdx += 2;
        }
        if (created_from) {
            conditions.push(`created_timestamp >= $${paramIdx++}`);
            bind.push(parseTimestamp(created_from as string));
        }
        if (created_to) {
            conditions.push(`created_timestamp <= $${paramIdx++}`);
            bind.push(parseTimestamp(created_to as string));
        }
        if (expires_from) {
            conditions.push(`expiration >= $${paramIdx++}`);
            bind.push(parseTimestamp(expires_from as string));
        }
        if (expires_to) {
            conditions.push(`expiration <= $${paramIdx++}`);
            bind.push(parseTimestamp(expires_to as string));
        }
        if (status) {
            conditions.push(`(${STATUS_SQL}) = $${paramIdx++}`);
            bind.push(status);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult: any[] = await dmd_names.sequelize!.query(
            `SELECT COUNT(*) as total FROM dmd_names ${where}`,
            { bind, type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await dmd_names.sequelize!.query(
            `SELECT
                label,
                owner,
                created_timestamp,
                expiration,
                blocked,
                ${STATUS_SQL} AS status
             FROM dmd_names
             ${where}
             ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            { bind: [...bind, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows.map((row) => ({
                name: row.label,
                owner: bufToHex(row.owner),
                status: row.status,
                created_at: row.created_timestamp,
                expiration: row.expiration,
                blocked: row.blocked ?? false,
            })),
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching names directory:', error);
        res.status(500).json({ error: 'Failed to fetch names directory' });
    }
};

// GET /names/blacklisted
//
// Every name currently blocked (registrar NameBlockedSet events).
const listBlacklistedNames = async (req: any, res: any) => {
    const { limit = '50', offset = '0' } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 50, 500);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const countResult: any[] = await dmd_names.sequelize!.query(
            `SELECT COUNT(*) as total FROM dmd_names WHERE blocked = true`,
            { type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await dmd_names.sequelize!.query(
            `SELECT label, owner, created_timestamp, expiration, last_action_timestamp
             FROM dmd_names
             WHERE blocked = true
             ORDER BY last_action_timestamp DESC NULLS LAST
             LIMIT $1 OFFSET $2`,
            { bind: [limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows.map((row) => ({
                name: row.label,
                owner: bufToHex(row.owner),
                created_at: row.created_timestamp,
                expiration: row.expiration,
                blocked_at: row.last_action_timestamp,
            })),
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching blacklisted names:', error);
        res.status(500).json({ error: 'Failed to fetch blacklisted names' });
    }
};

export default {
    getNameHistory,
    listOwnedNames,
    listNames,
    listBlacklistedNames,
};
