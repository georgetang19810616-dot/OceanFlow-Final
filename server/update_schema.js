const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'oceanflow',
  password: 'admin123',
  port: 5432,
});

async function updateSchema() {
  try {
    console.log('开始更新数据库schema...');
    
    // 检查jobs字段是否存在
    const checkJobsField = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'system_settings' AND column_name = 'jobs'
    `);
    
    // 如果jobs字段不存在，则添加
    if (checkJobsField.rows.length === 0) {
      await pool.query(`ALTER TABLE system_settings ADD COLUMN jobs JSONB DEFAULT '[]'::jsonb`);
      console.log('已添加jobs字段');
    } else {
      console.log('jobs字段已存在');
    }
    
    // 检查allocations字段是否存在
    const checkAllocationsField = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'system_settings' AND column_name = 'allocations'
    `);
    
    // 如果allocations字段不存在，则添加
    if (checkAllocationsField.rows.length === 0) {
      await pool.query(`ALTER TABLE system_settings ADD COLUMN allocations JSONB DEFAULT '[]'::jsonb`);
      console.log('已添加allocations字段');
    } else {
      console.log('allocations字段已存在');
    }
    
    console.log('数据库schema更新完成！');
    
  } catch (error) {
    console.error('更新schema时出错:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();
