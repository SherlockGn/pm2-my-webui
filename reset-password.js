#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const readline = require('readline')

const configPath = path.join(__dirname, 'config.json')
const pwPath = path.join(__dirname, 'pw.dat')

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function promptPassword() {
    return new Promise(resolve => {
        rl.question('Enter new password: ', password => {
            if (password.trim().length === 0) {
                console.log('Password cannot be empty. Please try again.')
                promptPassword().then(resolve)
            } else {
                resolve(password.trim())
            }
        })
    })
}

function promptConfirmation() {
    return new Promise(resolve => {
        rl.question('Confirm new password: ', password => {
            resolve(password.trim())
        })
    })
}

async function resetPassword() {
    try {
        console.log('='.repeat(50))
        console.log('PM2 WebUI Password Reset Tool')
        console.log('='.repeat(50))

        // Check if config file exists
        if (!fs.existsSync(configPath)) {
            console.error('❌ Config file not found:', configPath)
            process.exit(1)
        }

        // Load current config
        const configData = fs.readFileSync(configPath, 'utf8')
        const config = JSON.parse(configData)

        console.log('📝 Current configuration loaded')

        // Check if password file exists
        if (fs.existsSync(pwPath)) {
            console.log('📝 Current password file found')
        } else {
            console.log('📝 No existing password file found')
        }
        console.log('')

        // Get new password
        const password = await promptPassword()
        const confirmPassword = await promptConfirmation()

        if (password !== confirmPassword) {
            console.log('❌ Passwords do not match. Please try again.')
            rl.close()
            process.exit(1)
        }

        // Hash the password
        console.log('🔐 Hashing password...')
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)

        // Save password hash to pw.dat
        fs.writeFileSync(pwPath, passwordHash)

        // Update config to ensure auth is enabled
        if (!config.auth) {
            config.auth = {}
        }
        config.auth.enabled = true
        config.auth.jwtExpiration = config.auth.jwtExpiration || '1h'

        // Save updated config (without password hash)
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4))

        console.log('✅ Password has been reset successfully!')
        console.log('🔄 Please restart the PM2 WebUI server for changes to take effect.')
        console.log('')
        console.log('Password saved to: pw.dat')
        console.log('New password hash:', passwordHash)
    } catch (error) {
        console.error('❌ Error resetting password:', error.message)
        process.exit(1)
    } finally {
        rl.close()
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n❌ Password reset cancelled')
    rl.close()
    process.exit(0)
})

// Run the script
resetPassword()
