# PM2 WebUI

A modern web interface for PM2 process manager built with Express.js backend and Vue 3 frontend.

## ⚠️ AI-Generated Project Notice

**This project was primarily generated using AI assistance (GitHub Copilot) and may contain errors, security vulnerabilities, or suboptimal implementations.**

### Why AI Was Used

- **Rapid Prototyping**: AI enabled quick development of a comprehensive PM2 management interface with multiple features
- **Complex Integration**: Seamlessly integrated multiple technologies (PM2, JWT authentication, file management, Git operations) that would take weeks to implement manually
- **Security Implementation**: AI helped implement proper authentication patterns, bcrypt hashing, and security middleware that require specialized knowledge
- **Full-Stack Development**: Generated both backend APIs and frontend Vue.js components with consistent patterns
- **Documentation**: Automatically generated comprehensive API documentation and usage guides

### Potential Limitations

- **Security**: While security patterns are implemented, the code should be thoroughly reviewed before production use
- **Error Handling**: Some edge cases might not be properly handled
- **Performance**: The implementation prioritizes functionality over optimization
- **Best Practices**: Some patterns might not follow the latest industry standards
- **Testing**: Comprehensive test coverage is not included

### Recommendations

- **Code Review**: Thoroughly review all code before deploying to production
- **Security Audit**: Conduct a security audit, especially for authentication and file operations
- **Testing**: Add comprehensive unit and integration tests
- **Monitoring**: Implement proper logging and monitoring in production
- **Updates**: Regularly update dependencies and review security advisories

**Use at your own risk and always review the code before production deployment.**

## Features

- 📊 Process monitoring and management
- 🚀 Start, stop, restart, and delete processes
- 📈 System overview with process statistics
- 💾 Memory and CPU usage monitoring
- 📱 Responsive design
- 🎨 Modern UI with Bootstrap 5
- 🔐 **JWT-based authentication system**
- 🛡️ **Password protection with bcrypt hashing**
- 🔄 Password change functionality
- 📁 File management with upload/download
- 🌐 Git repository management (clone/pull)
- 📦 NPM package installation

## Tech Stack

- **Backend**: Node.js, Express.js, PM2
- **Frontend**: Vue 3 (Composition API via CDN), Bootstrap 5
- **No Database**: All data fetched directly from PM2

## Prerequisites

- Node.js (v14 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pm2-my-webui
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:

**Option A: Direct Start**
```bash
npm start
```

**Option B: Development Mode (with auto-restart)**
```bash
npm run dev
```

**Option C: Production with PM2 (Recommended)**
```bash
# Start with PM2 management
npm run pm2:start
# or
node run-as-pm2.js

# Other PM2 commands
npm run pm2:status   # Check status
npm run pm2:logs     # View logs
npm run pm2:restart  # Restart
npm run pm2:stop     # Stop
npm run pm2:delete   # Remove from PM2
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## PM2 Management Script

The included `run-as-pm2.js` script allows you to manage the PM2 WebUI using PM2 itself, providing better process monitoring, automatic restarts, and log management.

### Features

- **Programmatic PM2 API**: Uses the local PM2 module instead of global commands
- **Automatic Process Management**: Handles existing processes gracefully
- **Comprehensive Logging**: Dedicated log files with rotation
- **Memory Management**: Automatic restart on high memory usage (500MB limit)
- **Error Recovery**: Automatic restart on crashes with backoff strategy

### Usage

```bash
# Start PM2 WebUI with PM2
node run-as-pm2.js
# or
npm run pm2:start

# Check status
node run-as-pm2.js status
npm run pm2:status

# View logs
node run-as-pm2.js logs
npm run pm2:logs

# Restart
node run-as-pm2.js restart
npm run pm2:restart

# Stop
node run-as-pm2.js stop
npm run pm2:stop

# Remove from PM2
node run-as-pm2.js delete
npm run pm2:delete

# Help
node run-as-pm2.js help
```

### PM2 Configuration

The script automatically configures PM2 with:

- **Process Name**: `pm2-webui`
- **Instances**: 1 (fork mode)
- **Memory Limit**: 500MB (auto-restart)
- **Auto-restart**: Enabled with 10 max restarts
- **Logs**: Dedicated log directory (`logs/pm2-webui/`)
- **Environment**: Production settings

## Authentication

The application includes a comprehensive JWT-based authentication system for enhanced security.

### First Run Setup

When you start the application for the first time:

1. **Automatic Key Generation**: The system automatically generates a private key (`pk.dat`) for JWT token signing
2. **Default Password**: A default password is created and stored in `pw.dat` (bcrypt hashed)
3. **Login Required**: You'll be prompted to log in before accessing any features

### Default Credentials

- **Username**: Not required (password-only authentication)
- **Default Password**: `admin` (you should change this immediately after first login)

### Security Features

- **JWT Tokens**: 1-hour expiration for enhanced security
- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **Auto-logout**: Automatic logout when tokens expire
- **Protected APIs**: All management endpoints require valid authentication
- **Secure File Operations**: File upload/download with authentication

### Password Management

#### Changing Password (Web Interface)
1. Log in to the web interface
2. Click your profile/settings (top-right corner)
3. Select "Change Password"
4. Enter current password and new password
5. Confirm the change

#### Reset Password (Command Line)
If you forget your password, use the CLI reset tool:

```bash
node reset-password.js
```

This will prompt you to enter a new password and update the `pw.dat` file.

### Authentication Configuration

Add authentication settings to your `config.json`:

```json
{
  "auth": {
    "enabled": true,
    "jwtExpiration": "1h"
  }
}
```

#### Authentication Parameters

- **`enabled`** (boolean): Enable/disable authentication (default: true)
- **`jwtExpiration`** (string): Token expiration time (default: "1h")

### Disabling Authentication

To disable authentication (not recommended for production):

```json
{
  "auth": {
    "enabled": false
  }
}
```

### Security Files

The application creates two security files:

- **`pk.dat`**: Contains the private key for JWT token signing
- **`pw.dat`**: Contains the bcrypt-hashed password

⚠️ **Important**: Keep these files secure and do not share them. Add them to your `.gitignore` file.

## Configuration

The application can be configured using a `config.json` file in the root directory. If no configuration file is present, default settings will be used.

### Configuration Options

Create a `config.json` file with the following structure:

```json
{
  "port": 3000,
  "corsEnabled": true,
  "corsOptions": {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allowedHeaders": ["Content-Type", "Authorization"]
  },
  "auth": {
    "enabled": true,
    "jwtExpiration": "1h"
  },
  "git": {
    "allowedPrefixes": [
      "https://github.com/",
      "https://gitlab.com/"
    ]
  }
}
```

#### Configuration Parameters

- **`port`** (number): Server port (default: 3000)
- **`corsEnabled`** (boolean): Enable/disable CORS (default: true)
- **`corsOptions`** (object): CORS configuration options
  - **`origin`**: Allowed origins (* for all, or specific URLs)
  - **`methods`**: Allowed HTTP methods
  - **`allowedHeaders`**: Allowed request headers
- **`auth`** (object): Authentication configuration
  - **`enabled`**: Enable/disable authentication (default: true)
  - **`jwtExpiration`**: JWT token expiration time (default: "1h")
- **`git`** (object): Git repository configuration
  - **`allowedPrefixes`**: Array of allowed Git URL prefixes for security

#### Example Configurations

**Development (Open CORS)**:
```json
{
  "port": 3000,
  "corsEnabled": true,
  "corsOptions": {
    "origin": "*"
  }
}
```

**Production (Restricted CORS)**:
```json
{
  "port": 8080,
  "corsEnabled": true,
  "corsOptions": {
    "origin": "https://yourdomain.com",
    "methods": ["GET", "POST", "PUT", "DELETE"],
    "allowedHeaders": ["Content-Type", "Authorization"]
  }
}
```

**Local Only (CORS Disabled)**:
```json
{
  "port": 3000,
  "corsEnabled": false
}
```

> **Note**: You can also use the `PORT` environment variable to override the port setting.

## Project Structure

```
pm2-my-webui/
├── server/
│   ├── app.js              # Main server file
│   ├── static-server.js    # Static file server
│   ├── middleware/
│   │   └── auth.js         # Authentication middleware
│   └── routes/
│       ├── pm2.js          # PM2 API routes
│       └── auth.js         # Authentication routes
├── public/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── style.css       # Custom styles
│   └── js/
│       └── app.js          # Vue.js application
├── apps/                   # User applications directory
├── logs/                   # Application logs
├── config.json             # Configuration file
├── pk.dat                  # JWT private key (auto-generated)
├── pw.dat                  # Password hash (auto-generated)
├── reset-password.js       # Password reset utility
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `GET /api/auth/status` - Get authentication status
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/auth/change-password` - Change user password

### Processes
- `GET /api/pm2/processes` - Get all processes
- `GET /api/pm2/processes/:id` - Get specific process
- `POST /api/pm2/processes/start` - Start new process
- `POST /api/pm2/processes/:id/stop` - Stop process
- `POST /api/pm2/processes/:id/restart` - Restart process
- `POST /api/pm2/processes/:id/reload` - Reload process
- `DELETE /api/pm2/processes/:id` - Delete process
- `GET /api/pm2/processes/:id/logs` - Get process logs
- `POST /api/pm2/processes/:id/flush-logs` - Flush process logs

### File Management
- `GET /api/pm2/browse` - Browse apps directory
- `POST /api/pm2/upload` - Upload files
- `DELETE /api/pm2/files` - Delete files/folders
- `POST /api/pm2/folders` - Create new folder

### Git Operations
- `POST /api/pm2/git/clone` - Clone Git repository
- `POST /api/pm2/git/pull` - Pull Git updates

### NPM Operations
- `POST /api/pm2/npm/install` - Install NPM packages

### System
- `GET /api/pm2/system` - Get system information

## Usage

### Getting Started

1. **First Login**: When you first access the application, you'll see a login screen
   - Use the default password: `admin`
   - **Important**: Change this password immediately after login

2. **Dashboard**: After login, you'll see the main dashboard with all PM2 processes

### Core Features

1. **View Processes**: The main dashboard shows all PM2 processes with their status, CPU, memory usage, and uptime.

2. **Start New Process**: Click the "Start New Process" button to launch a new application.
   - **Regular Apps**: Specify script path and configuration
   - **Static Sites**: Choose directory and port for static file serving

3. **Manage Processes**: Use the action buttons to:
   - Start/Stop processes
   - Restart processes
   - Delete processes (with logs)
   - View detailed process information
   - Access process logs

4. **File Management**: 
   - Browse the `/apps` directory
   - Upload files and folders (drag & drop supported)
   - Create new folders
   - Delete files and directories
   - Download files

5. **Git Integration**:
   - Clone repositories directly into the `/apps` directory
   - Pull updates from existing repositories
   - Security: Only allowed Git URL prefixes can be cloned

6. **NPM Management**:
   - Install dependencies for Node.js projects
   - Automatic detection of `package.json` files

7. **System Monitoring**: View system information including:
   - Total processes and their states
   - Memory and CPU usage
   - Node.js and npm versions
   - Server configuration

8. **Security Management**:
   - Change your password through the web interface
   - Automatic logout when tokens expire
   - All operations require valid authentication

### Manual Refresh

Use the refresh button to get the latest process information when needed.

## Development

The application uses Vue 3 Composition API loaded via CDN for simplicity. No build process is required for the frontend.

### Adding New Features

1. **Backend**: Add new routes in `server/routes/pm2.js` or `server/routes/auth.js`
2. **Frontend**: Modify `public/js/app.js` and `public/index.html`
3. **Styling**: Update `public/css/style.css`
4. **Authentication**: Use the provided middleware in `server/middleware/auth.js`

### Security Considerations

- Always use authentication in production environments
- Keep `pk.dat` and `pw.dat` files secure
- Regularly update passwords
- Configure Git URL restrictions for security
- Review file upload restrictions as needed

## Troubleshooting

### Authentication Issues

**Problem**: "Invalid or expired token" errors
- **Solution**: Your session has expired. Log out and log back in.

**Problem**: Forgot password
- **Solution**: Use the password reset utility: `node reset-password.js`

**Problem**: Authentication not working after restart
- **Solution**: Check that `pk.dat` and `pw.dat` files exist and have proper permissions.

### File Operations

**Problem**: Cannot upload files
- **Solution**: Ensure you're logged in and have proper authentication tokens.

**Problem**: File upload fails with large files
- **Solution**: Check the 100MB file size limit. Split large files if necessary.

### Git Operations

**Problem**: Git clone fails with authentication errors
- **Solution**: Ensure the repository is public or configure SSH keys for private repos.

**Problem**: Git URL not allowed
- **Solution**: Check the `git.allowedPrefixes` configuration in `config.json`.

### Process Management

**Problem**: Cannot start processes
- **Solution**: Verify script paths and ensure PM2 is properly installed.

**Problem**: Logs not showing
- **Solution**: Check that the logs directory exists and has write permissions.

## Contributing

This project welcomes contributions, especially to improve upon the AI-generated codebase.

### Priority Areas for Improvement

1. **Security Enhancements**
   - Security audit and vulnerability fixes
   - Enhanced input validation and sanitization
   - Rate limiting and additional security headers

2. **Code Quality**
   - Add comprehensive unit and integration tests
   - Improve error handling and edge cases
   - Code optimization and performance improvements
   - TypeScript migration for better type safety

3. **Features**
   - Enhanced process monitoring and alerting
   - Configuration file editor
   - Process templates and presets
   - Real-time log streaming
   - Multi-user support

4. **Documentation**
   - API documentation improvements
   - Deployment guides
   - Troubleshooting expansion

### How to Contribute

1. Fork the repository
2. Create a feature branch
3. **Important**: Review and test your changes thoroughly
4. Add tests for new functionality
5. Update documentation as needed
6. Commit your changes
7. Push to the branch
8. Create a Pull Request

### Code Review Focus

When reviewing AI-generated code, pay special attention to:
- Security implementations
- Error handling patterns
- Input validation
- Authentication and authorization
- File system operations
- Process execution security

## License

MIT License
