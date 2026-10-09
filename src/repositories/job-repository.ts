import { query } from '../database/connection.js';

export class JobRepository {
  async create(id: string, tenantId: string, type: string) { const result = await query('INSERT INTO seo_jobs (id,tenant_id,type) VALUES ($1,$2,$3) RETURNING *', [id, tenantId, type]); return result.rows[0]; }
  async find(tenantId: string, id: string) { const result = await query('SELECT id AS "jobId",type,status,progress,result,error,created_at AS "createdAt",updated_at AS "updatedAt" FROM seo_jobs WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
  async update(id: string, status: string, progress: number, result?: any, error?: any) { await query('UPDATE seo_jobs SET status=$1, progress=$2, result=$3, error=$4, updated_at=now() WHERE id=$5', [status, progress, result ? JSON.stringify(result) : null, error ? JSON.stringify(error) : null, id]); }
  async delete(id: string, tenantId: string) { await query('DELETE FROM seo_jobs WHERE id = $1 AND tenant_id = $2', [id, tenantId]); }
}
