const express = require('express')
const router = express.Router()
const pm2 = require('pm2')

// Helper function to promisify PM2 operations
const pm2Promise = (method, ...args) => {
    return new Promise((resolve, reject) => {
        pm2[method](...args, (err, result) => {
            if (err) reject(err)
            else resolve(result)
        })
    })
}

// Get all processes
router.get('/processes', async (req, res) => {
    try {
        await pm2Promise('connect')
        const processes = await pm2Promise('list')
        res.json(processes)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Get specific process by id or name
router.get('/processes/:id', async (req, res) => {
    try {
        await pm2Promise('connect')
        const processes = await pm2Promise('describe', req.params.id)
        if (processes.length === 0) {
            return res.status(404).json({ error: 'Process not found' })
        }
        res.json(processes[0])
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Start a process
router.post('/processes/start', async (req, res) => {
    try {
        const { script, name, env, type, port, directory } = req.body

        if (!script && type !== 'static') {
            return res.status(400).json({ error: 'Script path is required for regular processes' })
        }

        if (type === 'static' && (!directory || !port)) {
            return res.status(400).json({ error: 'Directory and port are required for static file serving' })
        }

        const path = require('path')
        const fs = require('fs')

        // Create logs directory if it doesn't exist
        const logsDir = path.join(__dirname, '../../logs')
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true })
        }

        let options
        let processName
        let processCwd

        if (type === 'static') {
            // For static file serving using custom static server
            processName = name || `static-${port}`
            processCwd = path.resolve(directory)

            // Check if the directory exists
            if (!fs.existsSync(processCwd)) {
                return res.status(404).json({ error: 'Static directory not found' })
            }

            // Create process-specific log directory
            const processLogDir = path.join(logsDir, processName)
            if (!fs.existsSync(processLogDir)) {
                fs.mkdirSync(processLogDir, { recursive: true })
            }

            options = {
                script: path.join(__dirname, '../static-server.js'),
                name: processName,
                cwd: processCwd,
                out_file: path.join(processLogDir, 'output.log'),
                error_file: path.join(processLogDir, 'error.log'),
                log_file: path.join(processLogDir, 'combined.log'),
                env: {
                    STATIC_DIR: directory,
                    STATIC_PORT: port,
                    ...env
                }
            }
        } else {
            // For regular Node.js applications
            processName = name || path.basename(script, path.extname(script))
            processCwd = path.dirname(path.resolve(script))

            // Create process-specific log directory
            const processLogDir = path.join(logsDir, processName)
            if (!fs.existsSync(processLogDir)) {
                fs.mkdirSync(processLogDir, { recursive: true })
            }

            options = {
                script,
                name: processName,
                instances: 1, // Always single instance
                cwd: processCwd,
                out_file: path.join(processLogDir, 'output.log'),
                error_file: path.join(processLogDir, 'error.log'),
                log_file: path.join(processLogDir, 'combined.log'),
                env: env || {}
            }
        }

        await pm2Promise('connect')
        await pm2Promise('start', options)
        res.json({ message: 'Process started successfully' })
    } catch (error) {
        console.error('Error starting process:', error)
        res.status(500).json({ error: error.message })
    }
})

// Stop a process
router.post('/processes/:id/stop', async (req, res) => {
    try {
        await pm2Promise('connect')
        await pm2Promise('stop', req.params.id)
        res.json({ message: 'Process stopped successfully' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Restart a process
router.post('/processes/:id/restart', async (req, res) => {
    try {
        await pm2Promise('connect')
        await pm2Promise('restart', req.params.id)
        res.json({ message: 'Process restarted successfully' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Delete a process
router.delete('/processes/:id', async (req, res) => {
    try {
        await pm2Promise('connect')

        // Get process details before deletion to get the log directory
        const processes = await pm2Promise('describe', req.params.id)
        if (processes.length === 0) {
            return res.status(404).json({ error: 'Process not found' })
        }

        const process = processes[0]
        const processName = process.name

        // Delete the process first
        await pm2Promise('delete', req.params.id)

        // Then try to delete the log directory
        const path = require('path')
        const fs = require('fs')

        try {
            const logsDir = path.join(__dirname, '../../logs')
            const processLogDir = path.join(logsDir, processName)

            if (fs.existsSync(processLogDir)) {
                // Remove all files in the process log directory
                const files = fs.readdirSync(processLogDir)
                for (const file of files) {
                    const filePath = path.join(processLogDir, file)
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath)
                    }
                }

                // Remove the directory itself
                fs.rmdirSync(processLogDir)

                res.json({
                    message: 'Process and logs deleted successfully',
                    logsDeleted: true
                })
            } else {
                res.json({
                    message: 'Process deleted successfully (no logs found)',
                    logsDeleted: false
                })
            }
        } catch (logError) {
            console.warn(`Warning: Failed to delete logs for process ${processName}:`, logError.message)
            res.json({
                message: 'Process deleted successfully, but failed to delete logs',
                logsDeleted: false,
                logError: logError.message
            })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Reload a process
router.post('/processes/:id/reload', async (req, res) => {
    try {
        await pm2Promise('connect')
        await pm2Promise('reload', req.params.id)
        res.json({ message: 'Process reloaded successfully' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Get process logs with efficient reading
router.get('/processes/:id/logs', async (req, res) => {
    try {
        const { lines = 200, from = 'tail', type = 'combined' } = req.query
        const maxLines = Math.min(parseInt(lines) || 200, 1000) // Limit max lines for performance

        await pm2Promise('connect')
        const processes = await pm2Promise('describe', req.params.id)
        if (processes.length === 0) {
            return res.status(404).json({ error: 'Process not found' })
        }

        const process = processes[0]
        const fs = require('fs')
        const path = require('path')
        const readline = require('readline')

        // Determine log file path
        let logFile
        if (type === 'error') {
            logFile = process.pm2_env.pm_err_log_path
        } else if (type === 'output') {
            logFile = process.pm2_env.pm_out_log_path
        } else {
            logFile = process.pm2_env.pm_log_path
        }

        if (!logFile || !fs.existsSync(logFile)) {
            return res.json({ logs: [], message: 'Log file not found or empty' })
        }

        // Check file size and handle empty files
        const stats = fs.statSync(logFile)
        if (stats.size === 0) {
            return res.json({ logs: [], message: 'Log file is empty' })
        }

        try {
            let logLines = []

            if (from === 'head') {
                // Read from beginning
                const fileStream = fs.createReadStream(logFile, { encoding: 'utf8' })
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                })

                let lineCount = 0
                for await (const line of rl) {
                    if (lineCount >= maxLines) break
                    logLines.push(line)
                    lineCount++
                }
                rl.close()
            } else {
                // Read from end (tail) - more complex but efficient
                const bufferSize = Math.min(64 * 1024, stats.size) // Read last 64KB or file size
                const buffer = Buffer.alloc(bufferSize)

                // Read from the end of file
                const fd = fs.openSync(logFile, 'r')
                const position = Math.max(0, stats.size - bufferSize)
                fs.readSync(fd, buffer, 0, bufferSize, position)
                fs.closeSync(fd)

                // Convert buffer to string and split into lines
                const content = buffer.toString('utf8')
                const allLines = content.split(/\r?\n/)

                // Remove empty first line if we started reading mid-line
                if (position > 0 && allLines.length > 0 && allLines[0].length > 0) {
                    allLines.shift()
                }

                // Filter out empty lines and get last N lines
                const nonEmptyLines = allLines.filter(line => line.trim().length > 0)
                logLines = nonEmptyLines.slice(-maxLines)

                // If we don't have enough lines, try reading more from the beginning
                if (logLines.length < maxLines && position > 0) {
                    const additionalBufferSize = Math.min(128 * 1024, position)
                    const additionalBuffer = Buffer.alloc(additionalBufferSize)
                    const additionalPosition = Math.max(0, position - additionalBufferSize)

                    const fd2 = fs.openSync(logFile, 'r')
                    fs.readSync(fd2, additionalBuffer, 0, additionalBufferSize, additionalPosition)
                    fs.closeSync(fd2)

                    const additionalContent = additionalBuffer.toString('utf8')
                    const additionalLines = additionalContent.split(/\r?\n/).filter(line => line.trim().length > 0)

                    // Combine and get last N lines
                    const combinedLines = [...additionalLines, ...logLines]
                    logLines = combinedLines.slice(-maxLines)
                }
            }

            res.json({
                logs: logLines,
                totalLines: logLines.length,
                from,
                type,
                file: logFile
            })
        } catch (readError) {
            console.error('Error reading log file:', readError)
            res.status(500).json({ error: `Failed to read log file: ${readError.message}` })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Flush logs
router.post('/processes/:id/flush-logs', async (req, res) => {
    try {
        await pm2Promise('connect')
        await pm2Promise('flush', req.params.id)
        res.json({ message: 'Logs flushed successfully' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Get system information
router.get('/system', async (req, res) => {
    try {
        await pm2Promise('connect')
        const processes = await pm2Promise('list')

        // Load configuration for display
        const fs = require('fs')
        let serverConfig = { port: 3000, corsEnabled: true }
        try {
            const configPath = require('path').join(__dirname, '../../config.json')
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8')
                serverConfig = JSON.parse(configData)
            }
        } catch (error) {
            console.warn('Failed to load config for system info:', error.message)
        }

        // Get Node.js and npm versions
        const { exec } = require('child_process')
        const { promisify } = require('util')
        const execAsync = promisify(exec)

        let nodeVersion = 'Unknown'
        let npmVersion = 'Unknown'

        try {
            const { stdout: nodeStdout } = await execAsync('node --version')
            nodeVersion = nodeStdout.trim().replace(/^v/, '') // Remove 'v' prefix
        } catch (error) {
            console.warn('Failed to get Node.js version:', error.message)
        }

        try {
            const { stdout: npmStdout } = await execAsync('npm --version')
            npmVersion = npmStdout.trim()
        } catch (error) {
            console.warn('Failed to get npm version:', error.message)
        }

        const systemInfo = {
            totalProcesses: processes.length,
            runningProcesses: processes.filter(p => p.pm2_env.status === 'online').length,
            stoppedProcesses: processes.filter(p => p.pm2_env.status === 'stopped').length,
            erroredProcesses: processes.filter(p => p.pm2_env.status === 'errored').length,
            memory: processes.reduce((acc, p) => acc + (p.monit?.memory || 0), 0),
            cpu: processes.reduce((acc, p) => acc + (p.monit?.cpu || 0), 0),
            nodeVersion,
            npmVersion,
            platform: process.platform.charAt(0).toUpperCase() + process.platform.slice(1), // Capitalize first letter
            arch: process.arch,
            uptime: process.uptime(), // This is already in seconds
            serverPort: process.env.PORT || serverConfig.port,
            corsEnabled: serverConfig.corsEnabled
        }

        res.json(systemInfo)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Browse apps directory
router.get('/browse', async (req, res) => {
    try {
        const path = require('path')
        const fs = require('fs')

        const { dir = '' } = req.query
        const appsDir = path.join(__dirname, '../../apps')
        const targetDir = path.join(appsDir, dir)

        // Security check: ensure we're only browsing within apps directory
        if (!targetDir.startsWith(appsDir)) {
            return res.status(403).json({ error: 'Access denied: Cannot browse outside apps directory' })
        }

        // Check if apps directory exists
        if (!fs.existsSync(appsDir)) {
            return res.json({
                items: [],
                currentPath: '',
                message: 'Apps directory does not exist'
            })
        }

        // Check if target directory exists
        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Directory not found' })
        }

        const items = []
        const files = fs.readdirSync(targetDir)

        for (const file of files) {
            const filePath = path.join(targetDir, file)
            const stats = fs.statSync(filePath)
            const relativePath = path.relative(appsDir, filePath)

            items.push({
                name: file,
                type: stats.isDirectory() ? 'directory' : 'file',
                path: relativePath,
                fullPath: filePath,
                size: stats.isFile() ? stats.size : null,
                modified: stats.mtime.toISOString(),
                extension: stats.isFile() ? path.extname(file) : null
            })
        }

        // Sort: directories first, then files
        items.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name)
            }
            return a.type === 'directory' ? -1 : 1
        })

        res.json({
            items,
            currentPath: path.relative(appsDir, targetDir),
            currentFullPath: targetDir,
            parentPath: dir ? path.dirname(dir) : null,
            baseDirectory: appsDir
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Advanced functions - Git clone
router.post('/git/clone', async (req, res) => {
    try {
        const { url } = req.body

        if (!url) {
            return res.status(400).json({ error: 'Git URL is required' })
        }

        // Validate URL format and characters to prevent command injection
        // Support HTTP/HTTPS and SSH URLs
        const urlRegex =
            /^(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+\.git|ssh:\/\/[a-zA-Z0-9\-._~@]+\/[a-zA-Z0-9\-._~/?#[\]@!$&'()*+,;=%\/]+\.git|git@[a-zA-Z0-9\-._~]+:[a-zA-Z0-9\-._~/?#[\]@!$&'()*+,;=%\/]+\.git)$/
        if (!urlRegex.test(url)) {
            return res.status(400).json({
                error: 'Invalid Git URL format. Must be HTTP/HTTPS/SSH URL ending with .git'
            })
        }

        // Additional security: check for dangerous characters that could be used for injection
        // Allow @ and : for SSH URLs, but block other dangerous characters
        const dangerousChars = /[;&|`$(){}[\]\\'"<>\n\r]/
        if (dangerousChars.test(url)) {
            return res.status(400).json({
                error: 'Git URL contains invalid characters'
            })
        }

        // Validate URL length to prevent overly long URLs
        if (url.length > 500) {
            return res.status(400).json({
                error: 'Git URL is too long (maximum 500 characters)'
            })
        }

        // Load configuration for URL validation
        const fs = require('fs')
        const path = require('path')
        let config = { git: { allowedPrefixes: [] } }

        try {
            const configPath = path.join(__dirname, '../../config.json')
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8')
                config = JSON.parse(configData)
            }
        } catch (error) {
            console.warn('Failed to load config for git validation:', error.message)
        }

        // Validate URL prefix - if allowedPrefixes is configured, enforce it
        const allowedPrefixes = config.git?.allowedPrefixes || []
        const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix))
        if (!isAllowed) {
            return res.status(403).json({
                error: `Git URL not allowed. Repository must start with one of: ${allowedPrefixes.join(', ')}`
            })
        }

        // Set clone directory to apps folder
        const appsDir = path.join(__dirname, '../../apps')
        if (!fs.existsSync(appsDir)) {
            fs.mkdirSync(appsDir, { recursive: true })
        }

        const { spawn } = require('child_process')

        // Execute git clone with proper timeout handling using spawn for better security
        let gitProcess
        const timeoutMs = 20000 // 20 seconds timeout

        try {
            const gitPromise = new Promise((resolve, reject) => {
                // Use spawn instead of exec to avoid shell interpretation
                gitProcess = spawn('git', ['clone', '--quiet', url], {
                    cwd: appsDir,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
                        GIT_ASKPASS: 'true', // Use 'true' command which always exits with 0 but provides no input
                        SSH_ASKPASS: 'true' // Disable SSH password prompts
                    }
                })

                let stdout = ''
                let stderr = ''

                gitProcess.stdout.on('data', data => {
                    stdout += data.toString()
                })

                gitProcess.stderr.on('data', data => {
                    stderr += data.toString()
                })

                gitProcess.on('close', code => {
                    if (code === 0) {
                        resolve({ stdout, stderr })
                    } else {
                        const error = new Error(`Git clone exited with code ${code}`)
                        error.code = code
                        error.stdout = stdout
                        error.stderr = stderr
                        reject(error)
                    }
                })

                gitProcess.on('error', error => {
                    error.stdout = stdout
                    error.stderr = stderr
                    reject(error)
                })
            })

            // Set up timeout to kill the process
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    if (gitProcess && !gitProcess.killed) {
                        gitProcess.kill('SIGKILL') // Force kill the git process
                        reject(new Error('Git clone operation timed out after 20 seconds'))
                    }
                }, timeoutMs)
            })

            // Race between git operation and timeout
            const { stdout, stderr } = await Promise.race([gitPromise, timeoutPromise])

            // Extract repository name from URL for response
            const repoName = url.split('/').pop().replace('.git', '')

            res.json({
                message: `Repository "${repoName}" cloned successfully`,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                directory: path.join(appsDir, repoName)
            })
        } catch (error) {
            // Ensure process is killed if still running
            if (gitProcess && !gitProcess.killed) {
                gitProcess.kill('SIGKILL')
            }

            console.error('Git clone error:', error)

            // Provide more specific error messages for common authentication issues
            let errorMessage = error.message
            if (error.code === 128) {
                if (
                    error.stderr &&
                    (error.stderr.includes('Authentication failed') ||
                        error.stderr.includes('Permission denied') ||
                        error.stderr.includes('could not read Username') ||
                        error.stderr.includes('could not read Password'))
                ) {
                    errorMessage =
                        'Authentication required but interactive prompts are disabled. Please ensure the repository is public or use SSH keys for private repositories.'
                } else if (error.stderr && error.stderr.includes('Repository not found')) {
                    errorMessage =
                        'Repository not found. Please check the URL and ensure you have access to the repository.'
                }
            }

            res.status(500).json({
                error: `Git clone failed: ${errorMessage}`,
                stderr: error.stderr || ''
            })
        }
    } catch (outerError) {
        // Handle any other errors
        console.error('Unexpected error in git clone:', outerError)
        res.status(500).json({
            error: `Git clone failed: ${outerError.message}`
        })
    }
})

// Advanced functions - Git pull
router.post('/git/pull', async (req, res) => {
    try {
        const { directory } = req.body

        if (!directory) {
            return res.status(400).json({ error: 'Directory is required' })
        }

        const path = require('path')
        const fs = require('fs')

        // Validate directory is within apps folder
        const appsDir = path.join(__dirname, '../../apps')
        const targetDir = path.resolve(appsDir, directory)

        if (!targetDir.startsWith(appsDir)) {
            return res.status(403).json({ error: 'Directory must be within apps folder' })
        }

        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Directory not found' })
        }

        // Check if it's a git repository
        const gitDir = path.join(targetDir, '.git')
        if (!fs.existsSync(gitDir)) {
            return res.status(400).json({ error: 'Directory is not a git repository' })
        }

        const { spawn } = require('child_process')

        // Execute git pull with proper timeout handling using spawn for better security
        let gitProcess
        const timeoutMs = 180000 // 3 minutes timeout

        try {
            const gitPromise = new Promise((resolve, reject) => {
                // Use spawn instead of exec to avoid shell interpretation
                gitProcess = spawn('git', ['pull', '--quiet'], {
                    cwd: targetDir,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
                        GIT_ASKPASS: 'true', // Use 'true' command which always exits with 0 but provides no input
                        SSH_ASKPASS: 'true' // Disable SSH password prompts
                    }
                })

                let stdout = ''
                let stderr = ''

                gitProcess.stdout.on('data', data => {
                    stdout += data.toString()
                })

                gitProcess.stderr.on('data', data => {
                    stderr += data.toString()
                })

                gitProcess.on('close', code => {
                    if (code === 0) {
                        resolve({ stdout, stderr })
                    } else {
                        const error = new Error(`Git pull exited with code ${code}`)
                        error.code = code
                        error.stdout = stdout
                        error.stderr = stderr
                        reject(error)
                    }
                })

                gitProcess.on('error', error => {
                    error.stdout = stdout
                    error.stderr = stderr
                    reject(error)
                })
            })

            // Set up timeout to kill the process
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    if (gitProcess && !gitProcess.killed) {
                        gitProcess.kill('SIGKILL') // Force kill the git process
                        reject(new Error('Git pull operation timed out after 3 minutes'))
                    }
                }, timeoutMs)
            })

            // Race between git operation and timeout
            const { stdout, stderr } = await Promise.race([gitPromise, timeoutPromise])

            res.json({
                message: 'Git pull completed successfully',
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                directory: targetDir
            })
        } catch (error) {
            // Ensure process is killed if still running
            if (gitProcess && !gitProcess.killed) {
                gitProcess.kill('SIGKILL')
            }

            console.error('Git pull error:', error)

            // Provide more specific error messages for common authentication issues
            let errorMessage = error.message
            if (error.code === 128) {
                if (
                    error.stderr &&
                    (error.stderr.includes('Authentication failed') ||
                        error.stderr.includes('Permission denied') ||
                        error.stderr.includes('could not read Username') ||
                        error.stderr.includes('could not read Password'))
                ) {
                    errorMessage =
                        'Authentication required but interactive prompts are disabled. Please ensure you have proper access credentials configured.'
                }
            }

            res.status(500).json({
                error: `Git pull failed: ${errorMessage}`,
                stderr: error.stderr || ''
            })
        }
    } catch (outerError) {
        // Handle any other errors
        console.error('Unexpected error in git pull:', outerError)
        res.status(500).json({
            error: `Git pull failed: ${outerError.message}`
        })
    }
})

// Advanced functions - NPM install
router.post('/npm/install', async (req, res) => {
    try {
        const { directory } = req.body

        if (!directory) {
            return res.status(400).json({ error: 'Directory is required' })
        }

        const path = require('path')
        const fs = require('fs')

        // Validate directory is within apps folder
        const appsDir = path.join(__dirname, '../../apps')
        const targetDir = path.resolve(appsDir, directory)

        if (!targetDir.startsWith(appsDir)) {
            return res.status(403).json({ error: 'Directory must be within apps folder' })
        }

        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Directory not found' })
        }

        // Check if package.json exists
        const packageJsonPath = path.join(targetDir, 'package.json')
        if (!fs.existsSync(packageJsonPath)) {
            return res.status(400).json({ error: 'package.json not found in directory' })
        }

        const { spawn } = require('child_process')

        // Execute npm install with proper timeout handling using spawn for better security
        let npmProcess
        const timeoutMs = 600000 // 10 minutes timeout

        try {
            const npmPromise = new Promise((resolve, reject) => {
                // Use spawn instead of exec to avoid shell interpretation
                npmProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], {
                    cwd: targetDir,
                    shell: false,
                    stdio: ['pipe', 'pipe', 'pipe']
                })

                let stdout = ''
                let stderr = ''

                npmProcess.stdout.on('data', data => {
                    stdout += data.toString()
                })

                npmProcess.stderr.on('data', data => {
                    stderr += data.toString()
                })

                npmProcess.on('close', code => {
                    if (code === 0) {
                        resolve({ stdout, stderr })
                    } else {
                        const error = new Error(`NPM install exited with code ${code}`)
                        error.code = code
                        error.stdout = stdout
                        error.stderr = stderr
                        reject(error)
                    }
                })

                npmProcess.on('error', error => {
                    error.stdout = stdout
                    error.stderr = stderr
                    reject(error)
                })
            })

            // Set up timeout to kill the process
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    if (npmProcess && !npmProcess.killed) {
                        npmProcess.kill('SIGKILL') // Force kill the npm process
                        reject(new Error('NPM install operation timed out after 10 minutes'))
                    }
                }, timeoutMs)
            })

            // Race between npm operation and timeout
            const { stdout, stderr } = await Promise.race([npmPromise, timeoutPromise])

            res.json({
                message: 'NPM install completed successfully',
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                directory: targetDir
            })
        } catch (error) {
            // Ensure process is killed if still running
            if (npmProcess && !npmProcess.killed) {
                npmProcess.kill('SIGKILL')
            }

            console.error('NPM install error:', error)
            res.status(500).json({
                error: `NPM install failed: ${error.message}`,
                stderr: error.stderr || ''
            })
        }
    } catch (outerError) {
        // Handle any other errors
        console.error('Unexpected error in npm install:', outerError)
        res.status(500).json({
            error: `NPM install failed: ${outerError.message}`
        })
    }
})

// Delete file or folder in apps directory
router.delete('/files', async (req, res) => {
    try {
        const path = require('path')
        const fs = require('fs')

        const { relativePath } = req.body

        if (!relativePath) {
            return res.status(400).json({ error: 'File/folder path is required' })
        }

        // Security: Validate path doesn't contain dangerous patterns
        const dangerousPatterns = ['..', '~', '$', '|', '&', ';', '`', '(', ')', '<', '>', '\n', '\r']
        const hasDangerousPattern = dangerousPatterns.some(pattern => relativePath.includes(pattern))

        if (hasDangerousPattern) {
            return res.status(400).json({ error: 'Invalid path: contains dangerous characters' })
        }

        const appsDir = path.join(__dirname, '../../apps')
        const targetPath = path.join(appsDir, relativePath)

        // Security check: ensure we're only deleting within apps directory
        if (!targetPath.startsWith(appsDir)) {
            return res.status(403).json({ error: 'Access denied: Cannot delete outside apps directory' })
        }

        // Check if target exists
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'File or folder not found' })
        }

        const stats = fs.statSync(targetPath)
        const isDirectory = stats.isDirectory()

        // Prevent deletion of the apps directory itself
        if (targetPath === appsDir) {
            return res.status(403).json({ error: 'Cannot delete the apps directory itself' })
        }

        try {
            if (isDirectory) {
                // Use rmSync with recursive option for directories (Node.js 14.14.0+)
                if (fs.rmSync) {
                    fs.rmSync(targetPath, { recursive: true, force: true })
                } else {
                    // Fallback for older Node.js versions
                    const { spawn } = require('child_process')
                    await new Promise((resolve, reject) => {
                        const rmProcess = spawn('rm', ['-rf', targetPath], {
                            stdio: 'pipe'
                        })

                        rmProcess.on('close', code => {
                            if (code === 0) {
                                resolve()
                            } else {
                                reject(new Error(`rm command failed with code ${code}`))
                            }
                        })

                        rmProcess.on('error', reject)
                    })
                }
            } else {
                // Delete file
                fs.unlinkSync(targetPath)
            }

            res.json({
                message: `${isDirectory ? 'Folder' : 'File'} deleted successfully`,
                type: isDirectory ? 'directory' : 'file',
                path: relativePath
            })
        } catch (deleteError) {
            console.error('Delete operation failed:', deleteError)
            res.status(500).json({
                error: `Failed to delete ${isDirectory ? 'folder' : 'file'}: ${deleteError.message}`
            })
        }
    } catch (error) {
        console.error('Delete endpoint error:', error)
        res.status(500).json({
            error: `Delete operation failed: ${error.message}`
        })
    }
})

// Create new folder in apps directory
router.post('/folders', async (req, res) => {
    try {
        const path = require('path')
        const fs = require('fs')

        const { folderName, parentPath = '' } = req.body

        if (!folderName) {
            return res.status(400).json({ error: 'Folder name is required' })
        }

        // Security: Validate folder name doesn't contain dangerous patterns
        const dangerousPatterns = ['..', '~', '$', '|', '&', ';', '`', '(', ')', '<', '>', '\n', '\r', '/', '\\']
        const hasDangerousPattern = dangerousPatterns.some(pattern => folderName.includes(pattern))

        if (hasDangerousPattern) {
            return res.status(400).json({ error: 'Invalid folder name: contains dangerous characters' })
        }

        // Validate parent path
        if (parentPath) {
            const pathDangerousPatterns = ['..', '~', '$', '|', '&', ';', '`', '(', ')', '<', '>', '\n', '\r']
            const hasPathDangerousPattern = pathDangerousPatterns.some(pattern => parentPath.includes(pattern))

            if (hasPathDangerousPattern) {
                return res.status(400).json({ error: 'Invalid parent path: contains dangerous characters' })
            }
        }

        const appsDir = path.join(__dirname, '../../apps')
        const targetDir = path.join(appsDir, parentPath)
        const newFolderPath = path.join(targetDir, folderName)

        // Security check: ensure we're only creating within apps directory
        if (!targetDir.startsWith(appsDir) || !newFolderPath.startsWith(appsDir)) {
            return res.status(403).json({ error: 'Access denied: Cannot create folder outside apps directory' })
        }

        // Check if parent directory exists
        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Parent directory not found' })
        }

        // Check if folder already exists
        if (fs.existsSync(newFolderPath)) {
            return res.status(409).json({ error: 'Folder already exists' })
        }

        try {
            fs.mkdirSync(newFolderPath, { recursive: true })

            res.json({
                message: 'Folder created successfully',
                folderName: folderName,
                path: path.join(parentPath, folderName)
            })
        } catch (createError) {
            console.error('Folder creation failed:', createError)
            res.status(500).json({
                error: `Failed to create folder: ${createError.message}`
            })
        }
    } catch (error) {
        console.error('Create folder endpoint error:', error)
        res.status(500).json({
            error: `Create folder operation failed: ${error.message}`
        })
    }
})

// Upload files to apps directory
router.post('/upload', async (req, res) => {
    try {
        const multer = require('multer')
        const path = require('path')
        const fs = require('fs')

        // Configure multer for temporary file uploads
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const appsDir = path.join(__dirname, '../../apps')
                const tempDir = path.join(appsDir, '.temp-upload')

                // Ensure temp directory exists
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true })
                }

                cb(null, tempDir)
            },
            filename: (req, file, cb) => {
                // Use timestamp + original name to avoid conflicts
                const timestamp = Date.now()
                const filename = `${timestamp}-${file.originalname}`
                cb(null, filename)
            }
        })

        const upload = multer({
            storage: storage,
            limits: {
                fileSize: 100 * 1024 * 1024, // 100MB limit
                files: 50 // Max 50 files at once
            },
            fileFilter: (req, file, cb) => {
                // Basic security: reject executable files
                const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll']
                const fileExt = path.extname(file.originalname).toLowerCase()

                if (dangerousExtensions.includes(fileExt)) {
                    return cb(new Error('File type not allowed for security reasons'))
                }

                cb(null, true)
            }
        }).array('files', 50)

        upload(req, res, async err => {
            if (err) {
                console.error('Upload error:', err)
                return res.status(400).json({
                    error: `Upload failed: ${err.message}`
                })
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' })
            }

            try {
                const uploadPath = req.body.uploadPath || ''
                const preserveFolderStructure = req.body.preserveFolderStructure === 'true'
                const appsDir = path.join(__dirname, '../../apps')
                const targetBaseDir = path.join(appsDir, uploadPath)
                const tempDir = path.join(appsDir, '.temp-upload')

                let rootFolderName = null
                const uploadedFiles = []

                // Parse filePaths if available and preserveFolderStructure is true
                let parsedFilePaths = []
                if (preserveFolderStructure && req.body.filePaths) {
                    try {
                        parsedFilePaths = JSON.parse(req.body.filePaths)

                        // Extract root folder name from the first file path
                        if (parsedFilePaths.length > 0) {
                            const firstPath = parsedFilePaths[0]
                            const pathParts = firstPath.split('/')
                            if (pathParts.length > 0) {
                                rootFolderName = pathParts[0]
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing filePaths:', e)
                        parsedFilePaths = []
                    }
                }

                // Process each file
                for (let i = 0; i < req.files.length; i++) {
                    const file = req.files[i]
                    const originalName = file.originalname

                    let targetDir = targetBaseDir
                    let finalFilename = originalName

                    // Handle folder structure preservation
                    if (preserveFolderStructure && parsedFilePaths.length > 0 && parsedFilePaths[i]) {
                        const relativePath = parsedFilePaths[i]

                        const fileDirPath = path.dirname(relativePath)
                        if (fileDirPath && fileDirPath !== '.') {
                            targetDir = path.join(targetBaseDir, fileDirPath)
                        }
                        finalFilename = path.basename(relativePath)
                    }

                    // Security check
                    if (!targetDir.startsWith(appsDir)) {
                        // Clean up temp file
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path)
                        }
                        continue
                    }

                    // Ensure target directory exists
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true })
                    }

                    // Move file from temp location to final location
                    const finalPath = path.join(targetDir, finalFilename)

                    try {
                        fs.renameSync(file.path, finalPath)

                        uploadedFiles.push({
                            originalName: originalName,
                            filename: finalFilename,
                            size: file.size,
                            path: path.relative(appsDir, finalPath)
                        })
                    } catch (moveError) {
                        console.error(`Failed to move file ${file.path} to ${finalPath}:`, moveError)
                        // Try to clean up temp file
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path)
                        }
                    }
                }

                // Clean up temp directory
                try {
                    if (fs.existsSync(tempDir)) {
                        const tempFiles = fs.readdirSync(tempDir)
                        for (const tempFile of tempFiles) {
                            const tempFilePath = path.join(tempDir, tempFile)
                            if (fs.statSync(tempFilePath).isFile()) {
                                fs.unlinkSync(tempFilePath)
                            }
                        }
                        fs.rmdirSync(tempDir)
                    }
                } catch (cleanupError) {
                    console.warn('Failed to clean up temp directory:', cleanupError)
                }

                // Create appropriate success message
                let message = `Successfully uploaded ${uploadedFiles.length} file(s)`
                if (rootFolderName && preserveFolderStructure) {
                    message = `Successfully uploaded folder "${rootFolderName}" with ${uploadedFiles.length} file(s)`
                }

                res.json({
                    message: message,
                    files: uploadedFiles,
                    count: uploadedFiles.length,
                    rootFolder: rootFolderName
                })
            } catch (processingError) {
                console.error('File processing error:', processingError)
                res.status(500).json({
                    error: `File processing failed: ${processingError.message}`
                })
            }
        })
    } catch (error) {
        console.error('Upload endpoint error:', error)
        res.status(500).json({
            error: `Upload operation failed: ${error.message}`
        })
    }
})

module.exports = router
