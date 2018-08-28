import { createPoolCluster, PoolConnection, MysqlError, PoolCluster } from 'mysql';
import { SQLDatabase, ArrayAny, Request, KeyValAnyMap } from '../index';
import SecretsManager from '../aws/secrets';

// global cache where the key is the customer id and the value is the customer specific db pool cluster
const cache: KeyValAnyMap = {};

/**
 * MySQLDB is a SQLDatabase implementation for mysql
 */
export default class MySQLDB implements SQLDatabase {
    private readonly cache: KeyValAnyMap;
    private readonly req: Request;
    private readonly version: string;
    static idleTimeoutInSec:number = 30;
    constructor(req: Request) {
        if (!req.customerID) {
            throw new Error('no customer ID which is required for mysql');
        }
        this.version = req.headers['pinpt-db-version'];
        this.req = req;
        let c = cache[req.customerID];
        if (!c) {
            c = {};
            cache[req.customerID] = c;
        }
        this.cache = c;
    }
    async getConnection(master = false): Promise<PoolConnection> {
        const key = this.version || 'any';
        // see if we have already have a cached pool already
        let cluster: PoolCluster = this.cache[key] as PoolCluster;
        let setIdleTimeout = false;
        if (!cluster) {
            setIdleTimeout = true;
            // we don't have a cluster, so we need to create a new one
            cluster = createPoolCluster();
            this.cache[key] = cluster;
            if (process.env.PP_OFFLINE) {
                const host = '127.0.0.1';
                const user = process.env.PP_DB_USERNAME || 'root';
                const password = process.env.PP_DB_PASSWORD || undefined;
                const database = process.env.PP_DB_NAME;
                const port = parseInt(String(process.env.PP_DB_PORT), 10) || 3306;
                cluster.add('master', {
                    connectionLimit: 1,
                    acquireTimeout: 1000,
                    host,
                    user,
                    password,
                    database,
                    port,
                    timezone: 'UTC',
                    charset: 'utf8mb4'
                });
                cluster.add('replica0', {
                    connectionLimit: 1,
                    acquireTimeout: 1000,
                    host,
                    user,
                    password,
                    database,
                    port,
                    timezone: 'UTC',
                    charset: 'utf8mb4'
                });
            } else {
                const sm = new SecretsManager(this.req);
                const database = `${this.req.customerID}_${this.version}`;
                ['master', 'replica'].forEach(async (name: string) => {
                    const smkeyprefix = `database.${name}`;
                    const port = 3306;
                    const [user, password, host] = await Promise.all([
                        sm.get(`${smkeyprefix}.username`),
                        sm.get(`${smkeyprefix}.password`),
                        sm.get(`${smkeyprefix}.hostname`)
                    ]);
                    if (name === 'master') {
                        const ssl = host.indexOf('amazonaws') > 0 ? 'Amazon RDS' : undefined;
                        cluster.add('master', {
                            connectionLimit: 1,
                            acquireTimeout: 1000,
                            host,
                            user,
                            password,
                            database,
                            port,
                            timezone: 'UTC',
                            ssl,
                            charset: 'utf8mb4'
                        });
                    } else {
                        // add the replicas, which are comma-separated
                        host.split(',').forEach((host: string, index: number): void => {
                            const ssl = host.indexOf('amazonaws') > 0 ? 'Amazon RDS' : undefined;
                            // store each replica by index so we can round robin select more than one
                            cluster.add(`replica${index}`, {
                                connectionLimit: 1,
                                acquireTimeout: 1000,
                                host,
                                user,
                                password,
                                database,
                                port,
                                timezone: 'UTC',
                                ssl,
                                charset: 'utf8mb4'
                            });
                        });
                    }
                });
            }
        }
        return new Promise<PoolConnection>((resolve, reject) => {
            // if master, we use the name master
            // otherwise, we use a replica with wildcard so that we can fetch a round-robin one if more than one
            const name = master ? 'master' : 'replica*';
            cluster.getConnection(name, (err: MysqlError, conn: PoolConnection) => {
                if (err) {
                    reject(err);
                } else {
                    if (setIdleTimeout) {
                        // if we need to setup an idle timeout, set it up on start
                        // this will cause mysql server to drop our connection after
                        // idleTimeoutInSec ... so in the case the lambda is frozen
                        // the server can timeout the connection. this is important
                        // in highly parallel lambda environments where the number
                        // of connections can easily far exceed the number of connections
                        // allowed to mysql server
                        conn.query(`set wait_timeout=${MySQLDB.idleTimeoutInSec}`,() => resolve(conn));
                    } else {
                        resolve(conn);
                    }
                }
            });
        });
    }
    // query is readonly against replica
    query(sql: string, values?: any): Promise<ArrayAny> {
        return new Promise(async (resolve, reject) => {
            try {
                const conn = await this.getConnection(false);
                conn.query(sql, values, (err: MysqlError | null, results: any): void => {
                    conn.release();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            } catch (ex) {
                reject(ex);
            }
        });
    }
    // execute is writeable against master
    execute(sql: string, values?: any): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                const conn = await this.getConnection(true);
                conn.query(sql, values, (err: MysqlError | null, results: any): void => {
                    conn.release();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results.affectedRows);
                    }
                });
            } catch (ex) {
                reject(ex);
            }
        });
    }
}
