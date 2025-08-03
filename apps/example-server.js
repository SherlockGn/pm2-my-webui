const http = require('http')
const url = require('url')

const port = 8001

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true)
    const path = parsedUrl.pathname

    // Simple HTML page
    if (path === '/' || path === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Server</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .container { text-align: center; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px; }
        button:hover { background: #0056b3; }
        #result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Simple Node.js Server</h1>
        <p>This is a basic HTTP server running on port ${port}</p>
        <p>Process ID: ${process.pid}</p>
        <p>Server started at: ${new Date().toLocaleString()}</p>
        
        <button onclick="fetchTime()">Get Server Time</button>
        <button onclick="fetchStatus()">Get Server Status</button>
        
        <div id="result"></div>
    </div>

    <script>
        async function fetchTime() {
            try {
                const response = await fetch('/api/time');
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<h3>Server Time</h3><p>' + data.time + '</p>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<h3>Error</h3><p>' + error.message + '</p>';
            }
        }

        async function fetchStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<h3>Server Status</h3>' +
                    '<p><strong>Uptime:</strong> ' + Math.round(data.uptime) + ' seconds</p>' +
                    '<p><strong>Memory:</strong> ' + Math.round(data.memory / 1024 / 1024) + ' MB</p>' +
                    '<p><strong>PID:</strong> ' + data.pid + '</p>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<h3>Error</h3><p>' + error.message + '</p>';
            }
        }
    </script>
</body>
</html>
    `)
        return
    }

    // Simple API endpoint - time
    if (path === '/api/time') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
            JSON.stringify({
                time: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })
        )
        return
    }

    // Simple API endpoint - status
    if (path === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
            JSON.stringify({
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage().rss,
                status: 'running'
            })
        )
        return
    }

    // 404 for unknown paths
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Page not found')
})

server.listen(port, () => {
    console.log(`Simple server running on port ${port}`)
    console.log(`Process ID: ${process.pid}`)
    console.log(`Visit: http://localhost:${port}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully')
    server.close(() => {
        console.log('Server closed')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully')
    server.close(() => {
        console.log('Server closed')
        process.exit(0)
    })
})
