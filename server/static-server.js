const express = require('express')
const path = require('path')

const app = express()
const staticDir = process.env.STATIC_DIR || '.'
const port = process.env.STATIC_PORT || 8080

// Validate that the directory exists
const fs = require('fs')
if (!fs.existsSync(staticDir)) {
    console.error(`Error: Directory '${staticDir}' does not exist`)
    process.exit(1)
}

if (!fs.statSync(staticDir).isDirectory()) {
    console.error(`Error: '${staticDir}' is not a directory`)
    process.exit(1)
}

// Serve static files
app.use(express.static(staticDir))

// SPA support - serve index.html for all routes that don't match files
app.get('*', (req, res) => {
    const indexPath = path.join(staticDir, 'index.html')
    if (fs.existsSync(indexPath)) {
        res.sendFile(path.resolve(indexPath))
    } else {
        res.status(404).send('404 - Page Not Found')
    }
})

app.listen(port, () => {
    console.log(`Static file server running on port ${port}`)
    console.log(`Serving files from: ${path.resolve(staticDir)}`)
    console.log(`Process ID: ${process.pid}`)
    console.log(`Visit: http://localhost:${port}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down static server gracefully')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down static server gracefully')
    process.exit(0)
})
