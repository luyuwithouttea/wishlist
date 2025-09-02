const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'wishlist-db-mysql.ns-lj96orkc.svc',
  port: 3306,
  user: 'root',
  password: 'wm7sgmfj',
  database: 'wishlist_db'
};

// 创建数据库连接池
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 初始化数据库和表结构
async function initDatabase() {
  try {
    // 创建数据库（如果不存在）
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    await connection.execute('CREATE DATABASE IF NOT EXISTS wishlist_db');
    await connection.end();
    
    console.log('数据库创建成功');
    
    // 创建表结构
    await createTables();
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 创建表结构
async function createTables() {
  const connection = await pool.getConnection();
  
  try {
    // 待实现愿望表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wishes (
        id BIGINT PRIMARY KEY,
        text TEXT NOT NULL,
        votes INT DEFAULT 0,
        timestamp DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 实现中愿望表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS implementing_wishes (
        id BIGINT PRIMARY KEY,
        text TEXT NOT NULL,
        votes INT DEFAULT 0,
        timestamp DATETIME NOT NULL,
        moved_to_implementing_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 已实现愿望表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS implemented_wishes (
        id BIGINT PRIMARY KEY,
        text TEXT NOT NULL,
        votes INT DEFAULT 0,
        timestamp DATETIME NOT NULL,
        url VARCHAR(500),
        completed_at DATETIME,
        moved_to_implementing_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 系统配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 初始化系统配置
    await connection.execute(`
      INSERT IGNORE INTO system_config (config_key, config_value) 
      VALUES ('lastWeeklyCheck', '0')
    `);
    
    console.log('数据库表创建完成');
  } finally {
    connection.release();
  }
}

// 数据迁移：从JSON文件迁移到数据库
async function migrateFromJson() {
  const dataFile = path.join(__dirname, 'data.json');
  
  if (!fs.existsSync(dataFile)) {
    console.log('没有找到data.json文件，跳过数据迁移');
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 迁移待实现愿望
      for (const wish of data.wishes || []) {
        await connection.execute(
          'INSERT IGNORE INTO wishes (id, text, votes, timestamp) VALUES (?, ?, ?, ?)',
          [wish.id, wish.text, wish.votes || 0, new Date(wish.timestamp)]
        );
      }
      
      // 迁移实现中愿望
      for (const wish of data.implementingWishes || []) {
        await connection.execute(
          'INSERT IGNORE INTO implementing_wishes (id, text, votes, timestamp) VALUES (?, ?, ?, ?)',
          [wish.id, wish.text, wish.votes || 0, new Date(wish.timestamp)]
        );
      }
      
      // 迁移已实现愿望
      for (const wish of data.implementedWishes || []) {
        await connection.execute(
          'INSERT IGNORE INTO implemented_wishes (id, text, votes, timestamp, url, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            wish.id, 
            wish.text, 
            wish.votes || 0, 
            new Date(wish.timestamp),
            wish.url || null,
            wish.completedAt ? new Date(wish.completedAt) : null
          ]
        );
      }
      
      // 迁移系统配置
      if (data.lastWeeklyCheck) {
        await connection.execute(
          'UPDATE system_config SET config_value = ? WHERE config_key = ?',
          [data.lastWeeklyCheck.toString(), 'lastWeeklyCheck']
        );
      }
      
      await connection.commit();
      console.log('数据迁移完成');
      
      // 备份原文件
      const backupFile = `data.json.backup.${Date.now()}`;
      fs.copyFileSync(dataFile, path.join(__dirname, backupFile));
      console.log(`原数据文件已备份为: ${backupFile}`);
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('数据迁移失败:', error);
    throw error;
  }
}

// 数据库操作类
class WishDatabase {
  // 获取所有数据
  static async getAllData() {
    const connection = await pool.getConnection();
    
    try {
      const [wishes] = await connection.execute('SELECT * FROM wishes ORDER BY votes DESC, timestamp DESC');
      const [implementingWishes] = await connection.execute('SELECT * FROM implementing_wishes ORDER BY timestamp DESC');
      const [implementedWishes] = await connection.execute('SELECT * FROM implemented_wishes ORDER BY completed_at DESC');
      const [config] = await connection.execute('SELECT config_value FROM system_config WHERE config_key = ?', ['lastWeeklyCheck']);
      
      return {
        wishes: wishes.map(this.formatWish),
        implementingWishes: implementingWishes.map(this.formatWish),
        implementedWishes: implementedWishes.map(this.formatWish),
        lastWeeklyCheck: config[0] ? parseInt(config[0].config_value) : 0
      };
    } finally {
      connection.release();
    }
  }
  
  // 添加新愿望
  static async addWish(wishData) {
    const connection = await pool.getConnection();
    
    try {
      const wish = {
        id: Date.now(),
        text: wishData.text,
        votes: 0,
        timestamp: new Date().toISOString()
      };
      
      await connection.execute(
        'INSERT INTO wishes (id, text, votes, timestamp) VALUES (?, ?, ?, ?)',
        [wish.id, wish.text, wish.votes, new Date(wish.timestamp)]
      );
      
      return wish;
    } finally {
      connection.release();
    }
  }
  
  // 投票
  static async voteWish(wishId) {
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.execute(
        'UPDATE wishes SET votes = votes + 1 WHERE id = ?',
        [wishId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('愿望不存在');
      }
      
      const [wishes] = await connection.execute('SELECT votes FROM wishes WHERE id = ?', [wishId]);
      return wishes[0].votes;
    } finally {
      connection.release();
    }
  }
  
  // 删除愿望（站长功能）
  static async deleteWish(wishId) {
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.execute('DELETE FROM wishes WHERE id = ?', [wishId]);
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }
  
  // 移动愿望到实现中（站长功能）
  static async moveToImplementing(wishId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 获取愿望信息
      const [wishes] = await connection.execute('SELECT * FROM wishes WHERE id = ?', [wishId]);
      if (wishes.length === 0) {
        throw new Error('愿望不存在');
      }
      
      const wish = wishes[0];
      
      // 插入到实现中表
      await connection.execute(
        'INSERT INTO implementing_wishes (id, text, votes, timestamp) VALUES (?, ?, ?, ?)',
        [wish.id, wish.text, wish.votes, wish.timestamp]
      );
      
      // 从待实现表删除
      await connection.execute('DELETE FROM wishes WHERE id = ?', [wishId]);
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 完成愿望
  static async completeWish(wishId, url) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 获取实现中的愿望
      const [wishes] = await connection.execute('SELECT * FROM implementing_wishes WHERE id = ?', [wishId]);
      if (wishes.length === 0) {
        throw new Error('愿望不存在');
      }
      
      const wish = wishes[0];
      const completedAt = new Date();
      
      // 插入到已实现表
      await connection.execute(
        'INSERT INTO implemented_wishes (id, text, votes, timestamp, url, completed_at, moved_to_implementing_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [wish.id, wish.text, wish.votes, wish.timestamp, url, completedAt, wish.moved_to_implementing_at]
      );
      
      // 从实现中表删除
      await connection.execute('DELETE FROM implementing_wishes WHERE id = ?', [wishId]);
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 周检查
  static async weeklyCheck() {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 获取当前时间和上次检查时间
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      
      const [config] = await connection.execute('SELECT config_value FROM system_config WHERE config_key = ?', ['lastWeeklyCheck']);
      const lastCheck = config[0] ? parseInt(config[0].config_value) : 0;
      
      if (now - lastCheck <= oneWeek) {
        await connection.commit();
        return { success: true, movedWish: null };
      }
      
      // 获取票数最高的愿望
      const [wishes] = await connection.execute('SELECT * FROM wishes WHERE votes > 0 ORDER BY votes DESC, timestamp ASC LIMIT 1');
      
      if (wishes.length === 0) {
        // 更新检查时间
        await connection.execute('UPDATE system_config SET config_value = ? WHERE config_key = ?', [now.toString(), 'lastWeeklyCheck']);
        await connection.commit();
        return { success: true, movedWish: null };
      }
      
      const topWish = wishes[0];
      
      // 移动到实现中
      await connection.execute(
        'INSERT INTO implementing_wishes (id, text, votes, timestamp) VALUES (?, ?, ?, ?)',
        [topWish.id, topWish.text, topWish.votes, topWish.timestamp]
      );
      
      await connection.execute('DELETE FROM wishes WHERE id = ?', [topWish.id]);
      
      // 更新检查时间
      await connection.execute('UPDATE system_config SET config_value = ? WHERE config_key = ?', [now.toString(), 'lastWeeklyCheck']);
      
      await connection.commit();
      return { success: true, movedWish: this.formatWish(topWish) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 格式化愿望数据
  static formatWish(wish) {
    return {
      id: wish.id,
      text: wish.text,
      votes: wish.votes,
      timestamp: wish.timestamp.toISOString(),
      url: wish.url || undefined,
      completedAt: wish.completed_at ? wish.completed_at.toISOString() : undefined
    };
  }
}

// 测试数据库连接
async function testConnection() {
  try {
    // 先测试MySQL服务器连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await connection.execute('SELECT 1');
    await connection.end();
    console.log('MySQL服务器连接成功');
    return true;
  } catch (error) {
    console.error('MySQL服务器连接失败:', error);
    return false;
  }
}

module.exports = {
  pool,
  initDatabase,
  migrateFromJson,
  testConnection,
  WishDatabase
};