const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// Auto-generate private key if it doesn't exist
const generatePrivateKey = () => {
    const pkPath = path.join(__dirname, '../../pk.dat')

    if (!fs.existsSync(pkPath)) {
        console.log('🔑 Private key not found, generating new one...')
        const privateKey = crypto.randomBytes(64).toString('hex')
        fs.writeFileSync(pkPath, privateKey)
        console.log('✅ Private key generated and saved to pk.dat')
        return privateKey
    }

    return fs.readFileSync(pkPath, 'utf8').trim()
}

// Auto-generate default password hash if not configured
const ensureDefaultPassword = (configPath, config) => {
    const pwPath = path.join(__dirname, '../../pw.dat')

    if (!config.auth) {
        config.auth = {}
    }

    if (!fs.existsSync(pwPath)) {
        console.log('🔐 Setting up default password...')
        const defaultPassword = 'admin'
        const saltRounds = 10
        const passwordHash = bcrypt.hashSync(defaultPassword, saltRounds)

        // Save password hash to pw.dat
        fs.writeFileSync(pwPath, passwordHash)

        config.auth.enabled = true
        config.auth.jwtExpiration = '1h'

        // Save updated config (without password hash)
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        console.log('✅ Default password set to "admin"')
        console.log('💡 Use reset-password.js to change the password')
    } else {
        // Ensure auth is enabled if password file exists
        if (!config.auth.enabled) {
            config.auth.enabled = true
            config.auth.jwtExpiration = config.auth.jwtExpiration || '1h'
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        }
    }
}

// Load password hash from pw.dat
const getPasswordHash = () => {
    const pwPath = path.join(__dirname, '../../pw.dat')
    if (fs.existsSync(pwPath)) {
        return fs.readFileSync(pwPath, 'utf8').trim()
    }
    return null
}

// Load private key
let privateKey = ''
try {
    privateKey = generatePrivateKey()
} catch (error) {
    console.error('❌ Failed to generate/load private key:', error.message)
    process.exit(1)
}

// Load configuration
let config = {}
try {
    const configPath = path.join(__dirname, '../../config.json')
    if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8')
        config = JSON.parse(configData)

        // Ensure default password is set up
        ensureDefaultPassword(configPath, config)
    } else {
        console.log('📋 Creating default configuration...')
        config = {
            port: 3000,
            corsEnabled: false,
            corsOptions: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization']
            },
            auth: {
                enabled: true,
                jwtExpiration: '1h'
            },
            git: {
                allowedPrefixes: []
            }
        }

        // Set up default password
        ensureDefaultPassword(configPath, config)
    }
} catch (error) {
    console.warn('Failed to load/create config.json for auth middleware:', error.message)
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    // Skip auth if disabled in config
    if (!config.auth?.enabled) {
        return next()
    }

    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Access token required',
            code: 'TOKEN_REQUIRED'
        })
    }

    jwt.verify(token, privateKey, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: 'Invalid or expired token',
                code: 'TOKEN_INVALID'
            })
        }
        req.user = user
        next()
    })
}

// Generate JWT token
const generateToken = payload => {
    const expiresIn = config.auth?.jwtExpiration || '1h'
    return jwt.sign(payload, privateKey, { expiresIn })
}

// Verify token (for client-side validation)
const verifyToken = token => {
    try {
        return jwt.verify(token, privateKey)
    } catch (error) {
        return null
    }
}

module.exports = {
    authenticateToken,
    generateToken,
    verifyToken,
    getPasswordHash,
    config
}
