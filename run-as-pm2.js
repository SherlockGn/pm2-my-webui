#!/usr/bin/env node

/**
 * PM2 WebUI - PM2 Startup Script
 *
 * This script starts the PM2 WebUI using PM2 itself for better process management.
 * It automatically configures PM2 to manage the WebUI application with proper
 * logging, monitoring, and restart policies.
 */

const pm2 = require('pm2')
const path = require('path')
const fs = require('fs')

// Configuration
const APP_NAME = 'pm2-webui'
const SCRIPT_PATH = path.join(__dirname, 'server', 'app.js')
const LOG_DIR = path.join(__dirname, 'logs', APP_NAME)
const CONFIG_PATH = path.join(__dirname, 'config.json')

// Default configuration
let config = {
    port: 3000,
    corsEnabled: true,
    auth: {
        enabled: true,
        jwtExpiration: '1h'
    }
}

// Load configuration if exists
if (fs.existsSync(CONFIG_PATH)) {
    try {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8')
        config = { ...config, ...JSON.parse(configData) }
    } catch (error) {
        console.warn('Warning: Failed to load config.json, using defaults:', error.message)
    }
}

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}

// PM2 ecosystem configuration
const pm2Config = {
    name: APP_NAME,
    script: SCRIPT_PATH,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
        NODE_ENV: 'production',
        PORT: config.port || 3000
    },
    env_development: {
        NODE_ENV: 'development',
        PORT: config.port || 3000
    },
    log_file: path.join(LOG_DIR, 'combined.log'),
    out_file: path.join(LOG_DIR, 'output.log'),
    error_file: path.join(LOG_DIR, 'error.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
}

// Helper function to promisify PM2 operations
const pm2Promise = (method, ...args) => {
    return new Promise((resolve, reject) => {
        pm2[method](...args, (err, result) => {
            if (err) reject(err)
            else resolve(result)
        })
    })
}

async function connectToPM2() {
    try {
        await pm2Promise('connect')
        console.log('✅ Connected to PM2 daemon')
    } catch (error) {
        console.error('❌ Failed to connect to PM2:', error.message)
        throw error
    }
}

async function disconnectFromPM2() {
    try {
        pm2.disconnect()
        console.log('🔌 Disconnected from PM2 daemon')
    } catch (error) {
        console.warn('⚠️ Warning: Failed to disconnect from PM2:', error.message)
    }
}

async function stopExistingProcess() {
    try {
        console.log('🔍 Checking for existing PM2 WebUI process...')
        const processes = await pm2Promise('describe', APP_NAME)

        if (processes && processes.length > 0) {
            console.log('🛑 Stopping existing PM2 WebUI process...')
            await pm2Promise('delete', APP_NAME)
            console.log('✅ Existing process stopped')
        } else {
            console.log('ℹ️  No existing process found')
        }
    } catch (error) {
        // Process doesn't exist, which is fine
        console.log('ℹ️  No existing process found')
    }
}

async function startWithPM2() {
    try {
        console.log('🚀 Starting PM2 WebUI with PM2...')

        // Start the application
        await pm2Promise('start', pm2Config)

        console.log('✅ PM2 WebUI started successfully!')
        console.log(`📊 Dashboard: http://localhost:${config.port}`)
        console.log(`🔐 Default password: admin (change after first login)`)
        console.log('')
        console.log('Useful commands:')
        console.log(`  node run-as-pm2.js logs     - View logs`)
        console.log(`  node run-as-pm2.js status   - Check status`)
        console.log(`  node run-as-pm2.js restart  - Restart WebUI`)
        console.log(`  node run-as-pm2.js stop     - Stop WebUI`)
        console.log(`  node run-as-pm2.js delete   - Remove WebUI from PM2`)
    } catch (error) {
        console.error('❌ Failed to start with PM2:', error.message)
        throw error
    }
}

async function showStatus() {
    try {
        console.log('📊 PM2 WebUI Status:')
        const processes = await pm2Promise('describe', APP_NAME)

        if (processes && processes.length > 0) {
            const process = processes[0]
            const status = process.pm2_env?.status || 'unknown'
            const pid = process.pid || 'N/A'
            const memory = process.monit?.memory ? `${Math.round(process.monit.memory / 1024 / 1024)}MB` : 'N/A'
            const cpu = process.monit?.cpu ? `${process.monit.cpu}%` : 'N/A'
            const uptime = process.pm2_env?.pm_uptime ? new Date(process.pm2_env.pm_uptime).toLocaleString() : 'N/A'
            const restarts = process.pm2_env?.restart_time || 0

            console.log(`Name: ${process.name}`)
            console.log(`Status: ${status}`)
            console.log(`PID: ${pid}`)
            console.log(`Memory: ${memory}`)
            console.log(`CPU: ${cpu}`)
            console.log(`Uptime: ${uptime}`)
            console.log(`Restarts: ${restarts}`)
            console.log(`Script: ${process.pm2_env?.pm_exec_path || 'N/A'}`)
        } else {
            console.log('ℹ️  PM2 WebUI is not running')
        }
    } catch (error) {
        console.log('ℹ️  PM2 WebUI is not running or not accessible')
    }
}

async function showLogs() {
    try {
        console.log('� PM2 WebUI Logs:')
        console.log('==================')

        // Read recent logs from log files
        const logFiles = [
            { name: 'Output', path: path.join(LOG_DIR, 'output.log') },
            { name: 'Error', path: path.join(LOG_DIR, 'error.log') },
            { name: 'Combined', path: path.join(LOG_DIR, 'combined.log') }
        ]

        for (const logFile of logFiles) {
            console.log(`\n--- ${logFile.name} Logs ---`)
            if (fs.existsSync(logFile.path)) {
                try {
                    const logContent = fs.readFileSync(logFile.path, 'utf8')
                    const lines = logContent.trim().split('\n')
                    const recentLines = lines.slice(-20) // Show last 20 lines

                    if (recentLines.length > 0 && recentLines[0]) {
                        console.log(recentLines.join('\n'))
                    } else {
                        console.log('(empty)')
                    }
                } catch (readError) {
                    console.log(`Error reading log file: ${readError.message}`)
                }
            } else {
                console.log('(log file not found)')
            }
        }

        console.log('\nNote: Use PM2 commands for real-time log streaming:')
        console.log(`  pm2 logs ${APP_NAME}`)
        console.log(`  pm2 flush ${APP_NAME}  # Clear logs`)
    } catch (error) {
        console.error('❌ Failed to show logs:', error.message)
    }
}

async function main() {
    console.log('🎯 PM2 WebUI - PM2 Startup Script')
    console.log('=====================================')

    const args = process.argv.slice(2)
    const command = args[0]

    try {
        // Connect to PM2 for all operations
        await connectToPM2()

        // Handle different commands
        switch (command) {
            case 'stop':
                console.log('🛑 Stopping PM2 WebUI...')
                try {
                    await pm2Promise('stop', APP_NAME)
                    console.log('✅ PM2 WebUI stopped')
                } catch (error) {
                    console.log('ℹ️  PM2 WebUI was not running')
                }
                break

            case 'restart':
                console.log('🔄 Restarting PM2 WebUI...')
                try {
                    await pm2Promise('restart', APP_NAME)
                    console.log('✅ PM2 WebUI restarted')
                } catch (error) {
                    console.log('⚠️  Failed to restart, trying to start fresh...')
                    await stopExistingProcess()
                    await startWithPM2()
                }
                break

            case 'delete':
            case 'remove':
                console.log('🗑️  Removing PM2 WebUI from PM2...')
                try {
                    await pm2Promise('delete', APP_NAME)
                    console.log('✅ PM2 WebUI removed from PM2')
                } catch (error) {
                    console.log('ℹ️  PM2 WebUI was not in PM2')
                }
                break

            case 'status':
                await showStatus()
                break

            case 'logs':
                await showLogs()
                break

            case 'help':
            case '--help':
            case '-h':
                console.log('Usage: node run-as-pm2.js [command]')
                console.log('')
                console.log('Commands:')
                console.log('  start (default)  - Start PM2 WebUI with PM2')
                console.log('  stop            - Stop PM2 WebUI')
                console.log('  restart         - Restart PM2 WebUI')
                console.log('  delete/remove   - Remove PM2 WebUI from PM2')
                console.log('  status          - Show PM2 WebUI status')
                console.log('  logs            - Show PM2 WebUI logs')
                console.log('  help            - Show this help message')
                break

            default:
                // Default action: start

                // Check if script exists
                if (!fs.existsSync(SCRIPT_PATH)) {
                    console.error(`❌ Main script not found: ${SCRIPT_PATH}`)
                    console.error('Please ensure you are running this script from the PM2 WebUI root directory')
                    process.exit(1)
                }

                // Stop any existing process
                await stopExistingProcess()

                // Start with PM2
                await startWithPM2()
                break
        }
    } catch (error) {
        console.error('❌ Operation failed:', error.message)
        process.exit(1)
    } finally {
        // Always disconnect from PM2
        await disconnectFromPM2()
    }
}

// Handle errors
process.on('uncaughtException', error => {
    console.error('❌ Uncaught Exception:', error.message)
    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
})

// Run the script
main().catch(error => {
    console.error('❌ Failed to execute:', error.message)
    process.exit(1)
})
