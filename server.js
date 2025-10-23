const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Обработка API запросов
    if (pathname === '/api/update-data' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                // Проверяем структуру данных
                if (!data.employees || !Array.isArray(data.employees)) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Неверная структура данных' }));
                    return;
                }
                
                // Добавляем timestamp
                data.timestamp = Date.now();
                data.uploadDate = new Date().toISOString();
                
                // Сохраняем данные в файл
                fs.writeFile('./data.json', JSON.stringify(data, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('Ошибка при сохранении данных:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: 'Ошибка при сохранении данных' }));
                    } else {
                        console.log('✅ Данные успешно обновлены:', data.employees.length, 'сотрудников');
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            message: 'Данные успешно обновлены для всех пользователей',
                            count: data.employees.length,
                            timestamp: data.timestamp
                        }));
                    }
                });
                
            } catch (error) {
                console.error('Ошибка при обработке данных:', error);
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Неверный формат JSON' }));
            }
        });
        
        return;
    }

    // Обработка статических файлов
    let filePath = '.' + req.url;

    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html>
                        <head>
                            <title>404 - Страница не найдена</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                h1 { color: #e74c3c; }
                            </style>
                        </head>
                        <body>
                            <h1>404 - Страница не найдена</h1>
                            <p>Запрашиваемый файл не найден.</p>
                            <a href="/">Вернуться на главную</a>
                        </body>
                    </html>
                `);
            } else {
                res.writeHead(500);
                res.end('Ошибка сервера: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': mimeType + '; charset=utf-8' });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log('📁 Откройте браузер и перейдите по адресу выше');
    console.log('📊 Загрузите Excel файл для просмотра данных сотрудников');
    console.log('🔄 Данные автоматически обновляются для всех пользователей');
    console.log('📡 API endpoint: POST /api/update-data');
    console.log('\nДля остановки сервера нажмите Ctrl+C');
});
