-- ============================================
-- PostgreSQL 数据库初始化脚本
-- 匹配您的 API 和服务端代码
-- 默认管理员账户：admin / 123456
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 删除现有表（如果存在，按依赖顺序删除）
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS databases CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. 用户表 (匹配 server.js 中的 users 表)
-- ============================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- 注意：server.js 中使用的是 password，不是 password_hash
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER', 'AGENT')),
    permissions JSONB DEFAULT '[]'::jsonb,
    is_approved BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. 数据库表 (对应 server.js 中的 databases 表)
-- ============================================
CREATE TABLE databases (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'database',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_databases_name ON databases(name);
CREATE INDEX idx_databases_sort_order ON databases(sort_order);

-- ============================================
-- 3. 订舱表 (匹配 server.js 中的 bookings 表)
-- ============================================
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    database_id VARCHAR(50) NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    
    -- 核心字段（与 server.js 中的字段匹配）
    booking_ref VARCHAR(100) NOT NULL,
    week VARCHAR(20),
    etd DATE,
    state VARCHAR(50),
    is_locked BOOLEAN DEFAULT FALSE,
    
    -- 财务信息（存储为 JSONB）
    finance JSONB DEFAULT '{}'::jsonb,
    
    -- 动态数据字段（存储所有其他字段）
    data JSONB DEFAULT '{}'::jsonb,
    
    -- 系统字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_bookings_database_id ON bookings(database_id);
CREATE INDEX idx_bookings_booking_ref ON bookings(booking_ref);
CREATE INDEX idx_bookings_state ON bookings(state);
CREATE INDEX idx_bookings_etd ON bookings(etd);
CREATE INDEX idx_bookings_week ON bookings(week);
CREATE INDEX idx_bookings_finance ON bookings USING gin(finance);
CREATE INDEX idx_bookings_data ON bookings USING gin(data);

-- ============================================
-- 4. 报价表 (匹配 server.js 中的 quotations 表)
-- ============================================
CREATE TABLE quotations (
    id VARCHAR(50) PRIMARY KEY,
    
    -- 核心字段（与 server.js 中的字段匹配）
    region VARCHAR(100),
    carrier VARCHAR(100),
    pol VARCHAR(100),
    pod VARCHAR(100),
    vessel VARCHAR(100),
    etd DATE,
    
    -- 动态数据字段（存储所有其他字段）
    data JSONB DEFAULT '{}'::jsonb,
    
    -- 系统字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id),
    updated_by VARCHAR(50) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_quotations_region ON quotations(region);
CREATE INDEX idx_quotations_carrier ON quotations(carrier);
CREATE INDEX idx_quotations_pol ON quotations(pol);
CREATE INDEX idx_quotations_pod ON quotations(pod);
CREATE INDEX idx_quotations_etd ON quotations(etd);
CREATE INDEX idx_quotations_data ON quotations USING gin(data);

-- ============================================
-- 5. 系统设置表 (匹配 server.js 中的 system_settings 表)
-- ============================================
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    
    -- 下拉选项字段（存储为 JSONB 数组）
    carriers JSONB DEFAULT '[]'::jsonb,
    clients JSONB DEFAULT '[]'::jsonb,
    services JSONB DEFAULT '[]'::jsonb,
    pols JSONB DEFAULT '[]'::jsonb,
    pods JSONB DEFAULT '[]'::jsonb,
    container_types JSONB DEFAULT '[]'::jsonb,
    statuses JSONB DEFAULT '[]'::jsonb,
    jobs JSONB DEFAULT '[]'::jsonb,
    allocations JSONB DEFAULT '[]'::jsonb,
    
    -- 门到门费率
    gate_in_rates JSONB DEFAULT '[]'::jsonb,
    
    -- 系统字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_system_settings_carriers ON system_settings USING gin(carriers);
CREATE INDEX idx_system_settings_clients ON system_settings USING gin(clients);

-- ============================================
-- 创建函数和触发器（用于自动更新 updated_at）
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为每个表创建触发器
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_databases_updated_at 
    BEFORE UPDATE ON databases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at 
    BEFORE UPDATE ON quotations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 插入默认数据
-- ============================================

-- 插入默认管理员账户
-- 注意：server.js 使用简单密码存储，不是哈希
INSERT INTO users (
    id, 
    username, 
    password, 
    first_name, 
    email, 
    role, 
    permissions,
    is_approved,
    is_active
) VALUES (
    'admin-' || REPLACE(uuid_generate_v4()::text, '-', ''),
    'admin',
    '123456',  -- 注意：这是明文密码，server.js 中直接存储
    'Admin',
    'admin@example.com',
    'ADMIN',
    '["admin", "user", "booking", "quotation", "settings"]'::jsonb,
    TRUE,
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- 插入默认数据库（匹配 constants.ts 中的 INITIAL_DATABASES）
INSERT INTO databases (id, name, description, color, icon, sort_order) VALUES
('db-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Ocean', 'Ocean shipments', '#3B82F6', 'anchor', 1),
('db-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Air', 'Air freight', '#10B981', 'plane', 2),
('db-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Rail', 'Rail transport', '#F59E0B', 'train', 3),
('db-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Truck', 'Trucking', '#EF4444', 'truck', 4)
ON CONFLICT (id) DO NOTHING;

-- 插入默认系统设置（匹配 storageService.ts 中的 DEFAULT_SETTINGS）
INSERT INTO system_settings (
    carriers, 
    clients, 
    services, 
    pols, 
    pods, 
    container_types, 
    statuses,
    jobs,
    allocations,
    gate_in_rates
) VALUES (
    '["COSCO", "Maersk", "MSC", "ONE", "HMM", "ZIM", "CMA CGM"]'::jsonb,
    '["Amazon", "Walmart", "Target", "Best Buy", "Home Depot", "Lowe''s"]'::jsonb,
    '["FCL", "LCL", "Air", "Rail", "Truck"]'::jsonb,
    '["Shanghai", "Ningbo", "Shenzhen", "Hong Kong", "Singapore", "Rotterdam"]'::jsonb,
    '["Los Angeles", "Long Beach", "New York", "Savannah", "Hamburg", "Antwerp"]'::jsonb,
    '["20GP", "40GP", "40HQ", "45HQ"]'::jsonb,
    '["Draft", "Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 插入示例报价（匹配 constants.ts 中的 INITIAL_QUOTATIONS）
INSERT INTO quotations (id, region, carrier, pol, pod, vessel, etd, data) VALUES
('q-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Asia-USWC', 'COSCO', 'Shanghai', 'Los Angeles', 'COSCO VIRGINIA', CURRENT_DATE + INTERVAL '7 days', 
 '{"validUntil": "' || (CURRENT_DATE + INTERVAL '30 days')::text || '", "20GP": 1200, "40GP": 1800, "40HQ": 1900, "transitTime": 18, "remarks": "Direct service"}'::jsonb),
('q-' || REPLACE(uuid_generate_v4()::text, '-', ''), 'Asia-USEC', 'Maersk', 'Ningbo', 'New York', 'MAERSK EMMA', CURRENT_DATE + INTERVAL '10 days',
 '{"validUntil": "' || (CURRENT_DATE + INTERVAL '35 days')::text || '", "20GP": 1500, "40GP": 2200, "40HQ": 2300, "transitTime": 25, "remarks": "Via Suez"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 创建视图（方便查询）
-- ============================================

-- 订舱详情视图
CREATE OR REPLACE VIEW booking_details AS
SELECT 
    b.*,
    d.name as database_name,
    d.color as database_color,
    u.first_name as created_by_name,
    u2.first_name as updated_by_name
FROM bookings b
LEFT JOIN databases d ON b.database_id = d.id
LEFT JOIN users u ON b.created_by = u.id
LEFT JOIN users u2 ON b.updated_by = u2.id;

-- 报价详情视图
CREATE OR REPLACE VIEW quotation_details AS
SELECT 
    q.*,
    u.first_name as created_by_name,
    u2.first_name as updated_by_name
FROM quotations q
LEFT JOIN users u ON q.created_by = u.id
LEFT JOIN users u2 ON q.updated_by = u2.id;

-- 用户详情视图（不包含密码）
CREATE OR REPLACE VIEW user_details AS
SELECT 
    id,
    username,
    first_name,
    last_name,
    email,
    role,
    permissions,
    is_approved,
    avatar_url,
    is_active,
    last_login,
    created_at,
    updated_at
FROM users;

-- ============================================
-- 创建函数（用于生成ID）
-- ============================================

-- 生成用户ID的函数
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'user-' || REPLACE(uuid_generate_v4()::text, '-', '');
END;
$$ LANGUAGE plpgsql;

-- 生成数据库ID的函数
CREATE OR REPLACE FUNCTION generate_database_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'db-' || REPLACE(uuid_generate_v4()::text, '-', '');
END;
$$ LANGUAGE plpgsql;

-- 生成订舱ID的函数
CREATE OR REPLACE FUNCTION generate_booking_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'booking-' || REPLACE(uuid_generate_v4()::text, '-', '');
END;
$$ LANGUAGE plpgsql;

-- 生成报价ID的函数
CREATE OR REPLACE FUNCTION generate_quotation_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'quote-' || REPLACE(uuid_generate_v4()::text, '-', '');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 完成信息
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '';
    RAISE NOTICE '表结构：';
    RAISE NOTICE '- users (用户表)';
    RAISE NOTICE '- databases (数据库表)';
    RAISE NOTICE '- bookings (订舱表)';
    RAISE NOTICE '- quotations (报价表)';
    RAISE NOTICE '- system_settings (系统设置表)';
    RAISE NOTICE '';
    RAISE NOTICE '默认管理员账户：';
    RAISE NOTICE '用户名: admin';
    RAISE NOTICE '密码: 123456 (注意：这是明文密码)';
    RAISE NOTICE '名字: Admin';
    RAISE NOTICE '';
    RAISE NOTICE '已创建的视图：';
    RAISE NOTICE '- booking_details';
    RAISE NOTICE '- quotation_details';
    RAISE NOTICE '- user_details';
    RAISE NOTICE '============================================';
END $$;