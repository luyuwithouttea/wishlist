# 愿望清单（Wishlist）

一个基于 Node.js 与 MySQL 的轻量级愿望清单网站，支持用户提交愿望、投票，站长可将愿望流转为“实现中/已实现”，并提供每周检查的自动流转逻辑。

## 功能特性
- 提交愿望与投票（前台）
- 站长操作：删除愿望、移动到“实现中”、设置为“已实现”并附带链接
- 每周检查：根据票数阈值将最高票愿望自动移动到“实现中”（可由前端按钮触发）
- 启动时自动初始化数据库与数据表
- 首次启动自动从 data.json 迁移历史数据至数据库，并备份原数据文件

## 技术栈
- Node.js 原生 http 服务（无框架）
- MySQL（使用 mysql2/promise 驱动）

## 项目结构
```
/home/devbox/project
├── database.js        # 数据库连接、表结构、数据迁移与业务方法
├── hello.js           # HTTP 服务器与 API 路由、静态文件服务
├── index.html         # 前端页面（调用后端 API 渲染）
├── data.json          # 旧版数据文件（启动时自动迁移）
├── package.json       # 项目依赖（仅 mysql2）
└── package-lock.json
```

## 快速开始
### 前置要求
- Node.js 与 npm
- 可用的 MySQL 实例

默认数据库配置位于 database.js 顶部的 dbConfig：
```
host: 'wishlist-db-mysql.ns-lj96orkc.svc',
port: 3306,
user: 'root',
password: 'wm7sgmfj',
database: 'wishlist_db'
```
请根据你的环境修改上述配置（生产环境建议改为环境变量管理，见下方“开发建议”）。

### 安装依赖
```
npm install
```

### 启动服务
```
node hello.js
```
启动成功后，访问：http://localhost:8080

首次启动会：
- 自动创建数据库与数据表（若不存在）
- 从 data.json 迁移历史数据至 MySQL，并在项目根目录生成 data.json.backup.<timestamp> 备份

## API 说明（简要）
- GET /api/data
  - 获取所有数据：待实现愿望、实现中、已实现、lastWeeklyCheck
- POST /api/wishes
  - 新增愿望，Body: { text }
- POST /api/vote
  - 为愿望投票，Body: { wishId }
- POST /api/move-to-implementing
  - 站长操作：将愿望移动到“实现中”，Body: { wishId }
- POST /api/complete
  - 站长操作：将愿望标记为“已实现”，Body: { wishId, url }
- POST /api/delete-wish
  - 站长操作：删除愿望，Body: { wishId }
- POST /api/weekly-check
  - 触发每周检查逻辑：若本周有满足阈值的最高票愿望，则移动到“实现中”

说明：前端 index.html 已对以上 API 做了集成，你也可以用 curl/Postman 直接调用。

## 数据库与迁移
- 启动时执行 initDatabase：创建数据库与表结构
- 执行 migrateFromJson：将 data.json 中的 wishes、implementingWishes、implementedWishes、lastWeeklyCheck 迁移到 MySQL
- 迁移完成后会备份 data.json 为 data.json.backup.<timestamp>
- 系统配置保存在表 system_config（键：lastWeeklyCheck）

## 常见问题
1) 无法连接数据库 / 启动失败
- 检查 database.js 中 dbConfig 是否与实际数据库一致（地址、端口、用户、密码、库名）

2) 端口被占用
- 默认监听 8080，可在 hello.js 末尾修改端口

3) 页面空白或无数据
- 首次运行数据库为空属正常，可在页面提交愿望进行验证

## 开发建议（生产环境）
- 使用环境变量管理数据库凭据（例如通过 process.env 读取），避免硬编码敏感信息
- 在前端与后端之间增加反向代理（Nginx 等），并启用 HTTPS
- 针对 /api/* 路由增加基础鉴权与限流（尤其是站长操作路由）
- 将日志输出对接到集中式日志系统，便于排查问题

——
如需我继续：
- 将数据库配置改为从环境变量读取并保留本地默认值
- 增加 npm scripts（如 npm start）
- 提交并推送本 README 到 GitHub 仓库
请告诉我你的偏好。