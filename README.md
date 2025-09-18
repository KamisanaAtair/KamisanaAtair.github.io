# 🎯 爬虫练习靶场 - MySQL版

## 项目简介
这是一个用于学习爬虫和自动化的练习网站，使用MySQL数据库真实记录所有访问信息。

## 功能特性
- ✅ 真实IP访问记录
- ✅ MySQL数据库持久化存储
- ✅ RESTful API接口
- ✅ 实时访问统计
- ✅ 数据导出功能
- ✅ IP访问排行

## 快速开始

### 1. 克隆项目
\`\`\`bash
git clone https://github.com/你的用户名/crawler-target-project.git
cd crawler-target-project
\`\`\`

### 2. 安装依赖
\`\`\`bash
npm install
\`\`\`

### 3. 配置数据库
1. 复制配置文件：\`cp .env.example .env\`
2. 编辑 \`.env\` 文件，填入你的MySQL信息
3. 运行SQL初始化脚本：\`mysql -u root -p < sql/init.sql\`

### 4. 启动服务器
\`\`\`bash
npm start
\`\`\`

访问：http://localhost:3000

## API 接口

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/stats | 获取访问统计 |
| GET | /api/logs | 获取访问日志 |
| POST | /api/visit | 记录访问 |
| GET | /api/ip-stats | IP访问统计 |
| DELETE | /api/logs | 清空日志 |

## 学习建议

### 初学者
1. 使用浏览器访问，观察数据变化
2. 使用Postman测试API接口

### 进阶者
1. 编写Python爬虫脚本
2. 实现并发访问测试
3. 分析访问数据模式

### 高级挑战
1. 实现分布式爬虫
2. 数据库性能优化
3. 反爬虫机制研究

## 技术栈
- **前端**: HTML5, CSS3, JavaScript ES6+
- **后端**: Node.js, Express.js
- **数据库**: MySQL 8.0+
- **工具**: npm, Git

## 安全提醒
⚠️ 本项目仅用于学习目的，请勿用于非法用途！

## 贡献指南
欢迎提交Issue和Pull Request！

## 许可证
MIT License