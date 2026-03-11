-- fix_database.sql
-- 修复 system_settings 表结构

-- 1. 确保表存在
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY,
  carriers JSONB DEFAULT '[]'::jsonb,
  clients JSONB DEFAULT '[]'::jsonb,
  services JSONB DEFAULT '[]'::jsonb,
  pols JSONB DEFAULT '[]'::jsonb,
  pods JSONB DEFAULT '[]'::jsonb,
  container_types JSONB DEFAULT '[]'::jsonb,
  statuses JSONB DEFAULT '[]'::jsonb,
  gate_in_rates JSONB DEFAULT '[]'::jsonb,
  jobs JSONB DEFAULT '[]'::jsonb,
  allocations JSONB DEFAULT '[]'::jsonb,
  remarks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 修复字段类型转换问题（先更新数据，再修改类型）
-- 第一步：更新现有数据，确保所有字段都是有效的 JSONB
DO $$
BEGIN
  -- 检查表是否存在且有数据
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
    -- 更新 carriers 字段
    UPDATE system_settings 
    SET carriers = 
      CASE 
        WHEN carriers IS NULL THEN '[]'::jsonb
        WHEN carriers::text LIKE '[%]' AND carriers::text LIKE '%]' THEN 
          CASE 
            WHEN carriers::text = '[]' THEN '[]'::jsonb
            ELSE REPLACE(carriers::text, '''', '"')::jsonb
          END
        ELSE '[]'::jsonb
      END;
    
    -- 更新 clients 字段
    UPDATE system_settings 
    SET clients = 
      CASE 
        WHEN clients IS NULL THEN '[]'::jsonb
        WHEN clients::text LIKE '[%]' AND clients::text LIKE '%]' THEN 
          CASE 
            WHEN clients::text = '[]' THEN '[]'::jsonb
            ELSE REPLACE(clients::text, '''', '"')::jsonb
          END
        ELSE '[]'::jsonb
      END;
    
    -- 更新 services 字段
    UPDATE system_settings 
    SET services = 
      CASE 
        WHEN services IS NULL THEN '[]'::jsonb
        WHEN services::text LIKE '[%]' AND services::text LIKE '%]' THEN 
          CASE 
            WHEN services::text = '[]' THEN '[]'::jsonb
            ELSE REPLACE(services::text, '''', '"')::jsonb
          END
        ELSE '[]'::jsonb
      END;
    
    -- 更新 pols 字段
    UPDATE system_settings 
    SET pols = 
      CASE 
        WHEN pols IS NULL THEN '[]'::jsonb
        WHEN pols::text LIKE '[%]' AND pols::text LIKE '%]' THEN 
          CASE 
            WHEN pols::text = '[]' THEN '[]'::jsonb
            ELSE REPLACE(pols::text, '''', '"')::jsonb
          END
        ELSE '[]'::jsonb
      END;
    
    -- 更新 pods 字段
    UPDATE system_settings 
    SET pods = 
      CASE 
        WHEN pods IS NULL THEN '[]'::jsonb
        WHEN pods::text LIKE '[%]' AND pods::text LIKE '%]' THEN 
          CASE 
            WHEN pods::text = '[]' THEN '[]'::jsonb
            ELSE REPLACE(pods::text, '''', '"')::jsonb
          END
        ELSE '[]'::jsonb
      END;
  END IF;
END
$$;

-- 3. 添加缺失的字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'system_settings' AND column_name = 'jobs') THEN
    ALTER TABLE system_settings ADD COLUMN jobs JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'system_settings' AND column_name = 'allocations') THEN
    ALTER TABLE system_settings ADD COLUMN allocations JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'system_settings' AND column_name = 'remarks') THEN
    ALTER TABLE system_settings ADD COLUMN remarks JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- 确保 updated_at 字段存在
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'system_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END
$$;

-- 4. 安全地修改字段类型（使用简单的转换方式）
DO $$
BEGIN
  -- 检查每个字段是否存在，然后尝试转换
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'system_settings' AND column_name = 'carriers') THEN
    BEGIN
      ALTER TABLE system_settings ALTER COLUMN carriers TYPE jsonb USING carriers::jsonb;
    EXCEPTION WHEN OTHERS THEN
      -- 如果转换失败，设置默认值
      ALTER TABLE system_settings ALTER COLUMN carriers TYPE jsonb USING '[]'::jsonb;
    END;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'system_settings' AND column_name = 'clients') THEN
    BEGIN
      ALTER TABLE system_settings ALTER COLUMN clients TYPE jsonb USING clients::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE system_settings ALTER COLUMN clients TYPE jsonb USING '[]'::jsonb;
    END;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'system_settings' AND column_name = 'services') THEN
    BEGIN
      ALTER TABLE system_settings ALTER COLUMN services TYPE jsonb USING services::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE system_settings ALTER COLUMN services TYPE jsonb USING '[]'::jsonb;
    END;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'system_settings' AND column_name = 'pols') THEN
    BEGIN
      ALTER TABLE system_settings ALTER COLUMN pols TYPE jsonb USING pols::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE system_settings ALTER COLUMN pols TYPE jsonb USING '[]'::jsonb;
    END;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'system_settings' AND column_name = 'pods') THEN
    BEGIN
      ALTER TABLE system_settings ALTER COLUMN pods TYPE jsonb USING pods::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE system_settings ALTER COLUMN pods TYPE jsonb USING '[]'::jsonb;
    END;
  END IF;
END
$$;

-- 5. 插入或更新默认记录
INSERT INTO system_settings (id, carriers, clients, services, pols, pods, container_types, statuses, gate_in_rates, jobs, allocations, remarks)
VALUES (1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  carriers = EXCLUDED.carriers,
  clients = EXCLUDED.clients,
  services = EXCLUDED.services,
  pols = EXCLUDED.pols,
  pods = EXCLUDED.pods,
  container_types = EXCLUDED.container_types,
  statuses = EXCLUDED.statuses,
  gate_in_rates = EXCLUDED.gate_in_rates,
  jobs = EXCLUDED.jobs,
  allocations = EXCLUDED.allocations,
  remarks = EXCLUDED.remarks,
  updated_at = CURRENT_TIMESTAMP;

-- 6. 验证修复
SELECT 
  id,
  jsonb_array_length(carriers) as carriers_count,
  jsonb_array_length(clients) as clients_count,
  jsonb_array_length(services) as services_count,
  jsonb_array_length(pols) as pols_count,
  jsonb_array_length(pods) as pods_count,
  jsonb_array_length(container_types) as container_types_count,
  jsonb_array_length(statuses) as statuses_count,
  jsonb_array_length(gate_in_rates) as gate_in_rates_count,
  jsonb_array_length(jobs) as jobs_count,
  jsonb_array_length(allocations) as allocations_count,
  jsonb_array_length(remarks) as remarks_count
FROM system_settings WHERE id = 1;