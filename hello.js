var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
const { initDatabase, migrateFromJson, testConnection, WishDatabase } = require('./database');

// 初始化数据库
async function initApp() {
  try {
    console.log('正在初始化数据库...');
    
    // 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
      throw new Error('无法连接到数据库');
    }
    
    // 初始化数据库结构
    await initDatabase();
    
    // 迁移现有数据
    await migrateFromJson();
    
    console.log('数据库初始化完成，启动服务器...');
    startServer();
  } catch (error) {
    console.error('应用初始化失败:', error);
    process.exit(1);
  }
}

// 读取数据（兼容性函数，现在从数据库读取）
async function readData() {
  try {
    return await WishDatabase.getAllData();
  } catch (err) {
    console.error('读取数据库数据失败:', err);
    return {
      wishes: [],
      implementingWishes: [],
      implementedWishes: [],
      lastWeeklyCheck: 0
    };
  }
}

// 写入数据（兼容性函数，现在不需要）
function writeData(data) {
  // 数据库操作不需要此函数，保留用于兼容性
  return true;
}

// 设置CORS头
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function startServer() {
  http.createServer(async function (req, res) {
    setCORSHeaders(res);
    
    var parsedUrl = url.parse(req.url, true);
    var pathname = parsedUrl.pathname;
    var method = req.method;
    
    // 处理OPTIONS请求
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      // API路由
      if (pathname === '/api/data' && method === 'GET') {
        // 获取所有数据
        var data = await readData();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data));
        return;
      }
  
      if (pathname === '/api/wishes' && method === 'POST') {
        // 添加新愿望
        var body = '';
        req.on('data', function(chunk) {
          body += chunk.toString();
        });
        req.on('end', async function() {
          try {
            var newWishData = JSON.parse(body);
            var newWish = await WishDatabase.addWish(newWishData);
            
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: true, wish: newWish}));
          } catch (err) {
            console.error('添加愿望失败:', err);
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: false, error: err.message || '添加愿望失败'}));
          }
        });
        return;
      }
  
      if (pathname === '/api/vote' && method === 'POST') {
        // 投票
        var body = '';
        req.on('data', function(chunk) {
          body += chunk.toString();
        });
        req.on('end', async function() {
          try {
            var voteData = JSON.parse(body);
            var votes = await WishDatabase.voteWish(voteData.wishId);
            
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: true, votes: votes}));
          } catch (err) {
            console.error('投票失败:', err);
            if (err.message === '愿望不存在') {
              res.writeHead(404, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: '愿望不存在'}));
            } else {
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: err.message || '投票失败'}));
            }
          }
        });
        return;
      }
  
      if (pathname === '/api/complete' && method === 'POST') {
        // 完成愿望
        var body = '';
        req.on('data', function(chunk) {
          body += chunk.toString();
        });
        req.on('end', async function() {
          try {
            var completeData = JSON.parse(body);
            await WishDatabase.completeWish(completeData.wishId, completeData.url);
            
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: true}));
          } catch (err) {
            console.error('完成愿望失败:', err);
            if (err.message === '愿望不存在') {
              res.writeHead(404, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: '愿望不存在'}));
            } else {
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: err.message || '完成愿望失败'}));
            }
          }
        });
        return;
      }
  
      if (pathname === '/api/weekly-check' && method === 'POST') {
        // 周检查
        try {
          const result = await WishDatabase.weeklyCheck();
          
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({success: true, movedWish: result}));
        } catch (err) {
          console.error('周检查失败:', err);
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({success: false, error: err.message || '周检查失败'}));
        }
        return;
      }
  
      if (pathname === '/api/delete-wish' && method === 'POST') {
        // 删除愿望（站长功能）
        var body = '';
        req.on('data', function(chunk) {
          body += chunk.toString();
        });
        req.on('end', async function() {
          try {
            var deleteData = JSON.parse(body);
            await WishDatabase.deleteWish(deleteData.wishId);
            
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: true}));
          } catch (err) {
            console.error('删除愿望失败:', err);
            if (err.message === '愿望不存在') {
              res.writeHead(404, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: '愿望不存在'}));
            } else {
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: err.message || '删除愿望失败'}));
            }
          }
        });
        return;
      }
  
      if (pathname === '/api/move-to-implementing' && method === 'POST') {
        // 移动愿望到实现中（站长功能）
        var body = '';
        req.on('data', function(chunk) {
          body += chunk.toString();
        });
        req.on('end', async function() {
          try {
            var moveData = JSON.parse(body);
            await WishDatabase.moveToImplementing(moveData.wishId);
            
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({success: true}));
          } catch (err) {
            console.error('移动愿望失败:', err);
            if (err.message === '愿望不存在') {
              res.writeHead(404, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: '愿望不存在'}));
            } else {
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({success: false, error: err.message || '移动愿望失败'}));
            }
          }
        });
        return;
      }
      
      // 静态文件服务
      var filePath = pathname === '/' ? '/index.html' : pathname;
      var fullPath = path.join(__dirname, filePath);
      
      fs.readFile(fullPath, function(err, data) {
        if (err) {
          res.writeHead(404, {'Content-Type': 'text/html'});
          res.end('<h1>404 - 页面未找到</h1>');
          return;
        }
        
        var ext = path.extname(fullPath);
        var contentType = 'text/html';
        
        switch(ext) {
          case '.css':
            contentType = 'text/css';
            break;
          case '.js':
            contentType = 'application/javascript';
            break;
          case '.json':
            contentType = 'application/json';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
        }
        
        res.writeHead(200, {'Content-Type': contentType});
        res.end(data);
      });
    } catch (error) {
      console.error('服务器错误:', error);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({success: false, error: '服务器内部错误'}));
    }
}).listen(8080, function() {
  console.log('愿望清单网站已启动，访问地址: http://localhost:8080');
  console.log('数据将保存在服务器端，所有用户共享');
});
}

// 启动应用
initApp();