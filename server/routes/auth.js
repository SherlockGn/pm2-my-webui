const express = require('express')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const { generateToken, verifyToken, getPasswordHash, config } = require('../middleware/auth')

const router = express.Router()

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password is required'
            })
        }

        // Check if auth is enabled
        if (!config.auth?.enabled) {
            return res.status(200).json({
                success: true,
                message: 'Authentication is disabled',
                token: null
            })
        }

        // Get stored password hash
        const storedHash = getPasswordHash()
        if (!storedHash) {
            return res.status(500).json({
                success: false,
                error: 'Password hash not configured'
            })
        }

        // Verify password
        const isValid = await bcrypt.compare(password, storedHash)
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password'
            })
        }

        // Generate JWT token
        const token = generateToken({
            authenticated: true,
            loginTime: new Date().toISOString()
        })

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            expiresIn: config.auth?.jwtExpiration || '24h'
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// Verify token endpoint
router.post('/verify', (req, res) => {
    try {
        const { token } = req.body

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            })
        }

        // Check if auth is enabled
        if (!config.auth?.enabled) {
            return res.json({
                success: true,
                valid: true,
                message: 'Authentication is disabled'
            })
        }

        const decoded = verifyToken(token)
        if (decoded) {
            res.json({
                success: true,
                valid: true,
                data: decoded
            })
        } else {
            res.status(401).json({
                success: false,
                valid: false,
                error: 'Invalid or expired token'
            })
        }
    } catch (error) {
        console.error('Token verification error:', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// Get auth status endpoint
router.get('/status', (req, res) => {
    res.json({
        enabled: config.auth?.enabled || false,
        jwtExpiration: config.auth?.jwtExpiration || '24h'
    })
})

// Change password endpoint (requires authentication)
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password, new password, and confirmation are required'
            })
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'New password and confirmation do not match'
            })
        }

        if (newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 4 characters long'
            })
        }

        // Check if auth is enabled
        if (!config.auth?.enabled) {
            return res.status(400).json({
                success: false,
                error: 'Authentication is disabled'
            })
        }

        // Verify the current user is authenticated
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication token required'
            })
        }

        const decoded = verifyToken(token)
        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            })
        }

        // Verify current password
        const storedHash = getPasswordHash()
        if (!storedHash) {
            return res.status(500).json({
                success: false,
                error: 'Current password hash not found'
            })
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, storedHash)
        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            })
        }

        // Hash the new password
        const saltRounds = 10
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

        // Update the password file
        const pwPath = path.join(__dirname, '../../pw.dat')
        fs.writeFileSync(pwPath, newPasswordHash)

        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again with your new password.'
        })
    } catch (error) {
        console.error('Password change error:', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// Logout endpoint (client-side should remove token)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful'
    })
})

module.exports = router
