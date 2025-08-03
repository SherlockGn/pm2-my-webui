const express = require('express')
const cors = require('cors')
const path = require('path')
const pm2 = require('pm2')
const fs = require('fs')

// Load configuration
let config = {
    port: 3000,
    corsEnabled: true,
    corsOptions: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    },
    auth: {
        enabled: false
    }
}

try {
    const configPath = path.join(__dirname, '../config.json')
    if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8')
        config = { ...config, ...JSON.parse(configData) }
        console.log('Configuration loaded from config.json')
    } else {
        console.log('No config.json found, using default configuration')
    }
} catch (error) {
    console.warn('Failed to load config.json, using default configuration:', error.message)
}

const app = express()

const PORT = process.env.PORT || config.port

// Middleware
if (config.corsEnabled) {
    app.use(cors(config.corsOptions))
    console.log('CORS enabled with options:', config.corsOptions)
} else {
    console.log('CORS disabled')
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files
app.use(express.static(path.join(__dirname, '../public')))

// Authentication middleware (this will auto-initialize on first load)
const { authenticateToken } = require('./middleware/auth')

// API Routes
const authRoutes = require('./routes/auth')
app.use('/api/auth', authRoutes)

const pm2Routes = require('./routes/pm2')
app.use('/api/pm2', authenticateToken, pm2Routes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Something went wrong!' })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' })
})

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(50))
    console.log('PM2 WebUI Server Started')
    console.log('='.repeat(50))
    console.log(`🚀 Server running on port: ${PORT}`)
    console.log(`🌐 URL: http://localhost:${PORT}`)
    console.log(`⚙️  CORS: ${config.corsEnabled ? 'Enabled' : 'Disabled'}`)
    console.log(`🔐 Authentication: ${config.auth?.enabled ? 'Enabled' : 'Disabled'}`)
    if (config.auth?.enabled) {
        console.log(`   Default password: admin (use reset-password.js to change)`)
        console.log(`   JWT Expiration: ${config.auth.jwtExpiration || '1h'}`)
        console.log(`   Password file: pw.dat`)
    }
    if (config.corsEnabled) {
        console.log(`   Origin: ${config.corsOptions.origin}`)
    }
    console.log('='.repeat(50))
})

// Graceful shutdown
process.on('SIGINT', () => {
    pm2.disconnect()
    console.log('Server closed')
    process.exit(0)
})
