-- 爬虫靶场数据库初始化脚本

-- 创建数据库 (如果不存在)
CREATE DATABASE IF NOT EXISTS crawler_target 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crawler_target;

-- 创建访问记录表
CREATE TABLE IF NOT EXISTS visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    referer VARCHAR(500),
    visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    screen_resolution VARCHAR(20),
    language VARCHAR(10),
    INDEX idx_ip (ip_address),
    INDEX idx_time (visit_time)
);

-- 创建IP统计表 (用于快速查询)
CREATE TABLE IF NOT EXISTS ip_stats (
    ip_address VARCHAR(45) PRIMARY KEY,
    visit_count INT DEFAULT 1,
    first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建触发器：每次插入访问记录时更新IP统计
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_ip_stats 
AFTER INSERT ON visits
FOR EACH ROW
BEGIN
    INSERT INTO ip_stats (ip_address, visit_count, first_visit, last_visit)
    VALUES (NEW.ip_address, 1, NEW.visit_time, NEW.visit_time)
    ON DUPLICATE KEY UPDATE
        visit_count = visit_count + 1,
        last_visit = NEW.visit_time;
END//
DELIMITER ;

-- 插入一些示例数据 (可选)
INSERT INTO visits (ip_address, user_agent, referer) VALUES
('192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '直接访问'),
('10.0.0.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'https://google.com'),
('172.16.0.25', 'Python-requests/2.28.1', '直接访问');