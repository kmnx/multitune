import './env';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://multitune:multitune@localhost:5432/multitune',
});

export default pool;
