// server.js - 爬虫靶场后端服务器
require('dotenv').config(); // 加载环境变量

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // 静态文件服务

// MySQL连接池配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crawler_target',
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    timezone: '+08:00',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 获取客户端真实IP的中间件
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    if (remoteAddr) {
        // 移除IPv4映射的IPv6前缀
        return remoteAddr.replace(/^::ffff:/, '');
    }
    
    return '未知IP';
}

// 数据库连接测试
async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('✅ 数据库连接成功');
        return true;
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        return false;
    }
}

// 初始化数据库表
async function initializeTables() {
    try {
        const connection = await pool.getConnection();
        
        // 创建访问记录表
        await connection.execute(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建IP统计表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ip_stats (
                ip_address VARCHAR(45) PRIMARY KEY,
                visit_count INT DEFAULT 1,
                first_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        connection.release();
        console.log('✅ 数据库表初始化完成');
    } catch (error) {
        console.error('❌ 数据库表初始化失败:', error.message);
    }
}

// ==================== API 路由 ====================

// 健康检查接口
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        res.json({
            status: 'ok',
            message: '服务器运行正常',
            timestamp: new Date().toISOString(),
            database: '已连接'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: '数据库连接失败',
            error: error.message
        });
    }
});

// 记录访问接口
app.post('/api/visit', async (req, res) => {
    try {
        const clientIP = getClientIP(req);
        const userAgent = req.headers['user-agent'] || '未知浏览器';
        const { referer, screenResolution, language } = req.body;
        
        const connection = await pool.getConnection();
        
        // 插入访问记录
        const [result] = await connection.execute(
            'INSERT INTO visits (ip_address, user_agent, referer, screen_resolution, language) VALUES (?, ?, ?, ?, ?)',
            [clientIP, userAgent, referer || '直接访问', screenResolution, language]
        );
        
        // 更新IP统计
        await connection.execute(`
            INSERT INTO ip_stats (ip_address, visit_count, first_visit, last_visit)
            VALUES (?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                visit_count = visit_count + 1,
                last_visit = NOW()
        `, [clientIP]);
        
        connection.release();
        
        res.json({
            success: true,
            message: '访问记录成功',
            visitId: result.insertId,
            ip: clientIP,
            timestamp: new Date().toISOString()
        });
        
        console.log(`📝 新访问记录: ${clientIP} - ${userAgent.substring(0, 50)}...`);
        
    } catch (error) {
        console.error('记录访问出错:', error);
        res.status(500).json({
            success: false,
            message: '记录访问失败',
            error: error.message
        });
    }
});

// 获取访问统计
app.get('/api/stats', async (req, res) => {
    try {
        const clientIP = getClientIP(req);
        const connection = await pool.getConnection();
        
        // 总访问次数
        const [totalResult] = await connection.execute('SELECT COUNT(*) as count FROM visits');
        const totalVisits = totalResult[0].count;
        
        // 独立IP数
        const [uniqueResult] = await connection.execute('SELECT COUNT(DISTINCT ip_address) as count FROM visits');
        const uniqueIPs = uniqueResult[0].count;
        
        // 当前IP访问次数
        const [yourResult] = await connection.execute(
            'SELECT visit_count FROM ip_stats WHERE ip_address = ?',
            [clientIP]
        );
        const yourVisits = yourResult.length > 0 ? yourResult[0].visit_count : 0;
        
        // 今日访问次数
        const [todayResult] = await connection.execute(
            'SELECT COUNT(*) as count FROM visits WHERE DATE(visit_time) = CURDATE()'
        );
        const todayVisits = todayResult[0].count;
        
        connection.release();
        
        res.json({
            totalVisits,
            uniqueIPs,
            yourVisits,
            todayVisits,
            currentIP: clientIP,
            updateTime: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取统计出错:', error);
        res.status(500).json({
            error: '获取统计失败',
            message: error.message
        });
    }
});

// 获取访问日志
app.get('/api/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM visits ORDER BY visit_time DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        connection.release();
        
        res.json(rows);
        
    } catch (error) {
        console.error('获取日志出错:', error);
        res.status(500).json({
            error: '获取日志失败',
            message: error.message
        });
    }
});

// 获取IP访问统计
app.get('/api/ip-stats', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM ip_stats ORDER BY visit_count DESC, last_visit DESC LIMIT ?',
            [limit]
        );
        connection.release();
        
        res.json(rows);
        
    } catch (error) {
        console.error('获取IP统计出错:', error);
        res.status(500).json({
            error: '获取IP统计失败',
            message: error.message
        });
    }
});

// 导出数据
app.get('/api/export', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // 获取所有访问记录
        const [visits] = await connection.execute('SELECT * FROM visits ORDER BY visit_time DESC');
        
        // 获取IP统计
        const [ipStats] = await connection.execute('SELECT * FROM ip_stats ORDER BY visit_count DESC');
        
        connection.release();
        
        const exportData = {
            exportTime: new Date().toISOString(),
            totalRecords: visits.length,
            visits: visits,
            ipStats: ipStats,
            summary: {
                totalVisits: visits.length,
                uniqueIPs: ipStats.length,
                dateRange: {
                    earliest: visits.length > 0 ? visits[visits.length - 1].visit_time : null,
                    latest: visits.length > 0 ? visits[0].visit_time : null
                }
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=crawler_data_${new Date().toISOString().split('T')[0]}.json`);
        res.json(exportData);
        
        console.log(`📊 数据导出完成: ${visits.length} 条记录`);
        
    } catch (error) {
        console.error('导出数据出错:', error);
        res.status(500).json({
            error: '导出数据失败',
            message: error.message
        });
    }
});

// 清空访问日志 (危险操作)
app.delete('/api/logs', async (req, res) => {
    try {
        // 简单的管理员验证 (生产环境应该使用更强的认证)
        const adminPassword = req.headers['admin-password'];
        if (adminPassword !== process.env.ADMIN_PASSWORD && adminPassword !== 'admin123') {
            return res.status(403).json({
                error: '权限不足',
                message: '需要管理员权限才能执行此操作'
            });
        }
        
        const connection = await pool.getConnection();
        
        // 清空访问记录
        await connection.execute('DELETE FROM visits');
        await connection.execute('DELETE FROM ip_stats');
        
        // 重置自增ID
        await connection.execute('ALTER TABLE visits AUTO_INCREMENT = 1');
        
        connection.release();
        
        res.json({
            success: true,
            message: '所有访问日志已清空',
            timestamp: new Date().toISOString()
        });
        
        console.log('🗑️ 管理员清空了所有访问日志');
        
    } catch (error) {
        console.error('清空日志出错:', error);
        res.status(500).json({
            error: '清空日志失败',
            message: error.message
        });
    }
});

// 静态文件路由 - 主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        error: '接口不存在',
        message: `路径 ${req.originalUrl} 未找到`,
        availableEndpoints: [
            'GET /api/health',
            'GET /api/stats', 
            'GET /api/logs',
            'POST /api/visit',
            'GET /api/ip-stats',
            'GET /api/export',
            'DELETE /api/logs'
        ]
    });
});

// 全局错误处理
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        error: '服务器内部错误',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 服务器启动
async function startServer() {
    try {
        // 测试数据库连接
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            console.error('❌ 无法连接数据库，请检查配置');
            console.error('📝 请确保：');
            console.error('   1. MySQL服务已启动');
            console.error('   2. .env文件中的数据库配置正确');
            console.error('   3. 数据库用户有足够的权限');
            process.exit(1);
        }
        
        // 初始化数据库表
        await initializeTables();
        
        // 启动HTTP服务器
        app.listen(PORT, () => {
            console.log('🚀 ================================');
            console.log(`🎯 爬虫靶场服务器启动成功!`);
            console.log(`📍 本地访问: http://localhost:${PORT}`);
            console.log(`📍 网络访问: http://你的IP:${PORT}`);
            console.log(`📊 数据库: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
            console.log('🚀 ================================');
            console.log('💡 提示：按 Ctrl+C 停止服务器');
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ 服务器启动失败:', error.message);
        process.exit(1);
    }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('\n🛑 收到关闭信号，正在优雅关闭...');
    try {
        await pool.end();
        console.log('✅ 数据库连接池已关闭');
        process.exit(0);
    } catch (error) {
        console.error('❌ 关闭过程中出错:', error);
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
    process.exit(1);
});

// 启动服务器
startServer();