const { createApp, ref, reactive, onMounted, nextTick, computed } = Vue

createApp({
    setup() {
        // Reactive state
        const processes = ref([])
        const systemInfo = reactive({
            totalProcesses: 0,
            runningProcesses: 0,
            stoppedProcesses: 0,
            erroredProcesses: 0
        })

        // Authentication state
        const authEnabled = ref(false)
        const isAuthenticated = ref(false)
        const loginData = reactive({
            password: '',
            showPassword: false,
            isLoading: false,
            error: ''
        })

        // Password change state
        const passwordChangeData = reactive({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            showCurrentPassword: false,
            showNewPassword: false,
            showConfirmPassword: false,
            isLoading: false,
            error: '',
            success: ''
        })

        const newProcess = reactive({
            type: 'script',
            script: '',
            name: '',
            directory: '',
            port: null
        })
        const toasts = ref([])
        const toastId = ref(0)
        const selectedProcess = ref(null)

        // Logs functionality
        const logProcess = ref(null)
        const logData = ref({ logs: [], totalLines: 0, from: 'tail', type: 'combined', file: '' })
        const logOptions = reactive({
            lines: 200,
            from: 'tail',
            type: 'combined'
        })
        const logsLoading = ref(false)

        // Custom modal data
        const confirmData = reactive({
            title: '',
            message: '',
            confirmText: 'OK',
            cancelText: 'Cancel',
            onConfirm: () => {},
            onCancel: () => {}
        })

        const alertData = reactive({
            title: '',
            message: '',
            okText: 'OK',
            iconClass: 'fas fa-info-circle text-info',
            onOk: () => {}
        })

        // File browser data
        const browserData = reactive({
            items: [],
            currentPath: '',
            parentPath: null,
            message: ''
        })
        const browserItems = ref([])
        const browserLoading = ref(false)
        const browserSelectionMode = ref('file') // 'file' or 'directory'
        const breadcrumbs = ref([])

        // Template refs for file inputs
        const fileUploadInput = ref(null)
        const folderUploadInput = ref(null)

        // Upload progress data
        const uploadProgress = reactive({
            isUploading: false,
            percentage: 0,
            currentFile: '',
            filesCompleted: 0,
            totalFiles: 0,
            error: null
        })

        // Create folder data
        const newFolderData = reactive({
            name: '',
            isCreating: false
        })

        // Initialize Bootstrap tooltips
        const initializeTooltips = () => {
            nextTick(() => {
                const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
                tooltipTriggerList.map(function (tooltipTriggerEl) {
                    return new bootstrap.Tooltip(tooltipTriggerEl)
                })
            })
        }

        // Custom confirm dialog
        const customConfirm = (title, message, options = {}) => {
            return new Promise(resolve => {
                Object.assign(confirmData, {
                    title: title,
                    message: message,
                    confirmText: options.confirmText || 'OK',
                    cancelText: options.cancelText || 'Cancel',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                })

                const modal = new bootstrap.Modal(document.getElementById('customConfirmModal'))
                modal.show()
            })
        }

        // Custom alert dialog
        const customAlert = (title, message, options = {}) => {
            return new Promise(resolve => {
                let iconClass = 'fas fa-info-circle text-info'

                // Set icon based on type
                switch (options.type) {
                    case 'success':
                        iconClass = 'fas fa-check-circle text-success'
                        break
                    case 'warning':
                        iconClass = 'fas fa-exclamation-triangle text-warning'
                        break
                    case 'error':
                    case 'danger':
                        iconClass = 'fas fa-times-circle text-danger'
                        break
                    default:
                        iconClass = 'fas fa-info-circle text-info'
                }

                Object.assign(alertData, {
                    title: title,
                    message: message,
                    okText: options.okText || 'OK',
                    iconClass: iconClass,
                    onOk: () => resolve(true)
                })

                const modal = new bootstrap.Modal(document.getElementById('customAlertModal'))
                modal.show()
            })
        }

        // Authentication functions
        const getAuthToken = () => {
            return localStorage.getItem('pm2-webui-token')
        }

        const setAuthToken = token => {
            if (token) {
                localStorage.setItem('pm2-webui-token', token)
            } else {
                localStorage.removeItem('pm2-webui-token')
            }
        }

        const getAuthHeaders = () => {
            const token = getAuthToken()
            return token ? { 'Authorization': `Bearer ${token}` } : {}
        }

        const checkAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth/status')
                if (response.ok) {
                    const data = await response.json()
                    authEnabled.value = data.enabled

                    if (data.enabled) {
                        // Check if we have a valid token
                        await verifyToken()
                    } else {
                        isAuthenticated.value = true
                    }
                }
            } catch (error) {
                console.error('Failed to check auth status:', error)
                showToast('danger', 'Error', 'Failed to check authentication status')
            }
        }

        const verifyToken = async () => {
            const token = getAuthToken()
            if (!token) {
                isAuthenticated.value = false
                return
            }

            try {
                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                })

                if (response.ok) {
                    const data = await response.json()
                    isAuthenticated.value = data.valid
                } else {
                    isAuthenticated.value = false
                    setAuthToken(null)
                }
            } catch (error) {
                console.error('Token verification failed:', error)
                isAuthenticated.value = false
                setAuthToken(null)
            }
        }

        const showLoginModal = () => {
            loginData.password = ''
            loginData.error = ''
            loginData.showPassword = false
            loginData.isLoading = false

            const modal = new bootstrap.Modal(document.getElementById('loginModal'))
            modal.show()
        }

        const togglePasswordVisibility = () => {
            loginData.showPassword = !loginData.showPassword
            const passwordInput = document.getElementById('password')
            passwordInput.type = loginData.showPassword ? 'text' : 'password'
        }

        const login = async () => {
            if (!loginData.password) {
                loginData.error = 'Password is required'
                return
            }

            loginData.isLoading = true
            loginData.error = ''

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: loginData.password })
                })

                const data = await response.json()

                if (response.ok && data.success) {
                    setAuthToken(data.token)
                    isAuthenticated.value = true
                    showToast('success', 'Success', 'Login successful!')

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'))
                    if (modal) modal.hide()

                    // Refresh processes
                    await refreshProcesses()
                } else {
                    loginData.error = data.error || 'Login failed'
                }
            } catch (error) {
                console.error('Login error:', error)
                loginData.error = 'Connection error. Please try again.'
            } finally {
                loginData.isLoading = false
            }
        }

        const logout = async () => {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: getAuthHeaders()
                })
            } catch (error) {
                console.error('Logout error:', error)
            }

            setAuthToken(null)
            isAuthenticated.value = false
            processes.value = []
            showToast('info', 'Logged Out', 'You have been logged out successfully')
        }

        // Password change functions
        const showChangePasswordModal = () => {
            // Reset form
            passwordChangeData.currentPassword = ''
            passwordChangeData.newPassword = ''
            passwordChangeData.confirmPassword = ''
            passwordChangeData.showCurrentPassword = false
            passwordChangeData.showNewPassword = false
            passwordChangeData.showConfirmPassword = false
            passwordChangeData.error = ''
            passwordChangeData.success = ''
            passwordChangeData.isLoading = false

            const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'))
            modal.show()
        }

        const toggleCurrentPasswordVisibility = () => {
            passwordChangeData.showCurrentPassword = !passwordChangeData.showCurrentPassword
        }

        const toggleNewPasswordVisibility = () => {
            passwordChangeData.showNewPassword = !passwordChangeData.showNewPassword
        }

        const toggleConfirmPasswordVisibility = () => {
            passwordChangeData.showConfirmPassword = !passwordChangeData.showConfirmPassword
        }

        const changePassword = async () => {
            // Reset messages
            passwordChangeData.error = ''
            passwordChangeData.success = ''

            // Validate form
            if (!passwordChangeData.currentPassword) {
                passwordChangeData.error = 'Current password is required'
                return
            }

            if (!passwordChangeData.newPassword) {
                passwordChangeData.error = 'New password is required'
                return
            }

            if (passwordChangeData.newPassword.length < 4) {
                passwordChangeData.error = 'New password must be at least 4 characters long'
                return
            }

            if (!passwordChangeData.confirmPassword) {
                passwordChangeData.error = 'Please confirm your new password'
                return
            }

            if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
                passwordChangeData.error = 'New password and confirmation do not match'
                return
            }

            passwordChangeData.isLoading = true

            try {
                const response = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        currentPassword: passwordChangeData.currentPassword,
                        newPassword: passwordChangeData.newPassword,
                        confirmPassword: passwordChangeData.confirmPassword
                    })
                })

                const data = await response.json()

                if (response.ok && data.success) {
                    passwordChangeData.success = data.message
                    showToast('success', 'Success', 'Password changed successfully!')

                    // Auto-close modal after 2 seconds and log out
                    setTimeout(() => {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'))
                        if (modal) modal.hide()

                        // Log out the user since they need to log in with new password
                        setTimeout(() => {
                            logout()
                            showToast('info', 'Please Log In', 'Please log in again with your new password')
                        }, 500)
                    }, 2000)
                } else {
                    passwordChangeData.error = data.error || 'Password change failed'
                }
            } catch (error) {
                console.error('Password change error:', error)
                passwordChangeData.error = 'Connection error. Please try again.'
            } finally {
                passwordChangeData.isLoading = false
            }
        }

        // File browser functions
        const openFileBrowser = (mode = 'file') => {
            browserSelectionMode.value = mode
            browsePath('')

            // Reset target mode for regular file browser usage
            browserData.targetMode = null

            const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'))
            modal.show()
        }

        const browsePath = async (path = '') => {
            browserLoading.value = true

            try {
                const params = new URLSearchParams({ dir: path })
                const response = await fetch(`/api/pm2/browse?${params}`, {
                    headers: getAuthHeaders()
                })

                if (response.ok) {
                    const data = await response.json()
                    Object.assign(browserData, data)
                    browserItems.value = data.items

                    // Update breadcrumbs
                    if (data.currentPath) {
                        breadcrumbs.value = data.currentPath.split('/').filter(segment => segment.length > 0)
                    } else {
                        breadcrumbs.value = []
                    }
                } else {
                    const error = await response.json()
                    showToast('danger', 'Browse Error', error.error || 'Failed to browse directory')
                    browserItems.value = []
                }
            } catch (error) {
                showToast('danger', 'Error', `Failed to browse directory: ${error.message}`)
                browserItems.value = []
            } finally {
                browserLoading.value = false
            }
        }

        const selectFile = item => {
            // Use the full path provided by the server
            if (browserSelectionMode.value === 'file') {
                newProcess.script = item.fullPath
            } else {
                // For directory mode, get the directory containing the file
                // Handle both Windows (\) and Unix (/) path separators
                const lastSlashIndex = Math.max(item.fullPath.lastIndexOf('/'), item.fullPath.lastIndexOf('\\'))
                newProcess.directory = lastSlashIndex > 0 ? item.fullPath.substring(0, lastSlashIndex) : item.fullPath
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'))
            modal.hide()

            showToast('success', 'File Selected', `Selected: ${item.name}`)
        }

        const selectCurrentDirectory = () => {
            // Use the current full path provided by the server
            const fullPath = browserData.currentFullPath || browserData.baseDirectory || ''

            // Handle different target modes
            if (browserData.targetMode === 'gitPull') {
                gitPullData.directory = fullPath

                // Close the file browser modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'))
                modal.hide()

                showToast('success', 'Directory Selected', `Selected: ${browserData.currentPath || 'apps'}`)

                // Auto-execute git pull after a short delay
                setTimeout(() => {
                    executeGitPull()
                }, 500)
            } else if (browserData.targetMode === 'npmInstall') {
                npmInstallData.directory = fullPath

                // Close the file browser modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'))
                modal.hide()

                showToast('success', 'Directory Selected', `Selected: ${browserData.currentPath || 'apps'}`)

                // Auto-execute npm install after a short delay
                setTimeout(() => {
                    executeNpmInstall()
                }, 500)
            } else {
                // Default: new process directory selection (targetMode is null/undefined)
                newProcess.directory = fullPath

                // Close the file browser modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal'))
                modal.hide()

                // Reset target mode after use
                browserData.targetMode = null

                // Reopen the new process modal after a short delay
                setTimeout(() => {
                    const newProcessModal = new bootstrap.Modal(document.getElementById('newProcessModal'))
                    newProcessModal.show()
                }, 100)

                showToast('success', 'Directory Selected', `Selected: ${browserData.currentPath || 'apps'}`)
            }

            // Always reset target mode after handling to prevent reuse
            browserData.targetMode = null
        }

        const getBreadcrumbPath = index => {
            return breadcrumbs.value.slice(0, index + 1).join('/')
        }

        const getFileIcon = extension => {
            switch (extension) {
                case '.js':
                    return 'text-warning'
                case '.html':
                case '.htm':
                    return 'text-danger'
                case '.css':
                    return 'text-info'
                case '.json':
                    return 'text-success'
                case '.md':
                    return 'text-primary'
                case '.txt':
                    return 'text-secondary'
                default:
                    return 'text-muted'
            }
        }

        const formatFileSize = bytes => {
            if (!bytes) return '0 B'
            const k = 1024
            const sizes = ['B', 'KB', 'MB', 'GB']
            const i = Math.floor(Math.log(bytes) / Math.log(k))
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
        }

        // Delete file or folder
        const deleteFileOrFolder = async item => {
            const isDirectory = item.type === 'directory'
            const typeText = isDirectory ? 'folder' : 'file'

            const confirmed = await customConfirm(
                `Delete ${typeText.charAt(0).toUpperCase() + typeText.slice(1)}`,
                `<p>Are you sure you want to delete the ${typeText} <strong>"${item.name}"</strong>?</p>
                 <div class="alert alert-warning mt-3 mb-0">
                     <strong>Warning:</strong>
                     <ul class="mb-0 mt-2">
                         <li>This will permanently delete the ${typeText}${
                    isDirectory ? ' and all its contents' : ''
                }</li>
                         <li><strong>This action cannot be undone</strong></li>
                     </ul>
                 </div>`,
                {
                    confirmText: `Delete ${typeText.charAt(0).toUpperCase() + typeText.slice(1)}`,
                    cancelText: 'Cancel'
                }
            )

            if (!confirmed) {
                return
            }

            try {
                const response = await fetch('/api/pm2/files', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        relativePath: item.path
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast(
                        'success',
                        'Deleted Successfully',
                        `${result.type === 'directory' ? 'Folder' : 'File'} "${item.name}" has been deleted`
                    )

                    // Refresh the current directory
                    browsePath(browserData.currentPath)
                } else {
                    const error = await response.json()
                    throw new Error(error.error || `Failed to delete ${typeText}`)
                }
            } catch (error) {
                showToast('danger', 'Delete Failed', `Failed to delete ${typeText}: ${error.message}`)
            }
        }

        // Delete current directory
        const deleteCurrentDirectory = async () => {
            if (!browserData.currentPath) {
                showToast('warning', 'Warning', 'Cannot delete the root apps directory')
                return
            }

            const currentDirName = browserData.currentPath.split('/').pop() || browserData.currentPath

            const confirmed = await customConfirm(
                'Delete Current Directory',
                `<p>Are you sure you want to delete the current directory <strong>"${currentDirName}"</strong>?</p>
                 <div class="alert alert-danger mt-3 mb-0">
                     <strong>Danger:</strong>
                     <ul class="mb-0 mt-2">
                         <li>This will permanently delete the entire directory and all its contents</li>
                         <li>All files, subdirectories, and data will be lost</li>
                         <li><strong>This action cannot be undone</strong></li>
                     </ul>
                 </div>`,
                {
                    confirmText: 'Delete Directory',
                    cancelText: 'Cancel'
                }
            )

            if (!confirmed) {
                return
            }

            try {
                const response = await fetch('/api/pm2/files', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        relativePath: browserData.currentPath
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast(
                        'success',
                        'Directory Deleted',
                        `Directory "${currentDirName}" has been deleted successfully`
                    )

                    // Navigate to parent directory
                    const parentPath = browserData.parentPath === '.' ? '' : browserData.parentPath
                    browsePath(parentPath)
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to delete directory')
                }
            } catch (error) {
                showToast('danger', 'Delete Failed', `Failed to delete directory: ${error.message}`)
            }
        }

        // Show create folder modal
        const showCreateFolderModal = () => {
            newFolderData.name = ''
            newFolderData.isCreating = false
            const modal = new bootstrap.Modal(document.getElementById('createFolderModal'))
            modal.show()
        }

        // Create new folder
        const createFolder = async () => {
            if (!newFolderData.name || newFolderData.isCreating) {
                return
            }

            newFolderData.isCreating = true

            try {
                const response = await fetch('/api/pm2/folders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        folderName: newFolderData.name,
                        parentPath: browserData.currentPath || ''
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast(
                        'success',
                        'Folder Created',
                        `Folder "${result.folderName}" has been created successfully`
                    )

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('createFolderModal'))
                    modal.hide()

                    // Refresh the current directory
                    browsePath(browserData.currentPath)
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to create folder')
                }
            } catch (error) {
                showToast('danger', 'Create Folder Failed', `Failed to create folder: ${error.message}`)
            } finally {
                newFolderData.isCreating = false
            }
        }

        // Trigger file upload input
        const triggerFileUpload = () => {
            if (fileUploadInput.value) {
                fileUploadInput.value.click()
            }
        }

        // Trigger folder upload input
        const triggerFolderUpload = () => {
            if (folderUploadInput.value) {
                folderUploadInput.value.click()
            }
        }

        // Handle file upload
        const handleFileUpload = async event => {
            const files = event.target.files
            if (!files || files.length === 0) {
                return
            }

            uploadProgress.isUploading = true
            uploadProgress.percentage = 0
            uploadProgress.currentFile = ''
            uploadProgress.filesCompleted = 0
            uploadProgress.totalFiles = files.length
            uploadProgress.error = null

            try {
                const formData = new FormData()

                // Add upload path
                formData.append('uploadPath', browserData.currentPath || '')

                // Add all files
                for (let i = 0; i < files.length; i++) {
                    formData.append('files', files[i])
                }

                // Create XMLHttpRequest for progress tracking
                const xhr = new XMLHttpRequest()

                // Track upload progress
                xhr.upload.addEventListener('progress', e => {
                    if (e.lengthComputable) {
                        uploadProgress.percentage = Math.round((e.loaded / e.total) * 100)
                        uploadProgress.currentFile = `Uploading ${uploadProgress.totalFiles} file(s)...`
                    }
                })

                // Handle completion
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const result = JSON.parse(xhr.responseText)
                        uploadProgress.filesCompleted = result.count
                        uploadProgress.percentage = 100
                        uploadProgress.currentFile = 'Upload complete!'

                        showToast('success', 'Upload Complete', result.message)

                        // Refresh the current directory
                        setTimeout(() => {
                            browsePath(browserData.currentPath)
                            uploadProgress.isUploading = false
                        }, 1500)
                    } else {
                        const errorData = JSON.parse(xhr.responseText)
                        throw new Error(errorData.error || 'Upload failed')
                    }
                })

                // Handle errors
                xhr.addEventListener('error', () => {
                    throw new Error('Network error during upload')
                })

                // Start upload
                xhr.open('POST', '/api/pm2/upload')

                // Add authentication header
                const authHeaders = getAuthHeaders()
                if (authHeaders.Authorization) {
                    xhr.setRequestHeader('Authorization', authHeaders.Authorization)
                }

                xhr.send(formData)
            } catch (error) {
                uploadProgress.error = error.message
                uploadProgress.isUploading = false
                showToast('danger', 'Upload Failed', `Failed to upload files: ${error.message}`)
            }

            // Clear the file input
            event.target.value = ''
        }

        // Handle folder upload
        const handleFolderUpload = async event => {
            const files = event.target.files
            if (!files || files.length === 0) {
                return
            }

            uploadProgress.isUploading = true
            uploadProgress.percentage = 0
            uploadProgress.currentFile = ''
            uploadProgress.filesCompleted = 0
            uploadProgress.totalFiles = files.length
            uploadProgress.error = null

            try {
                const formData = new FormData()
                const filePaths = []

                // Add upload path
                formData.append('uploadPath', browserData.currentPath || '')
                formData.append('preserveFolderStructure', 'true')

                // Add all files and collect their paths
                for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    formData.append('files', file)
                    // Collect the relative path for folder structure preservation
                    const relativePath = file.webkitRelativePath || file.name
                    filePaths.push(relativePath)
                    console.log(`File ${i}: ${file.name}, webkitRelativePath: ${file.webkitRelativePath}`)
                }

                console.log('All file paths:', filePaths)

                // Add the file paths as a JSON array
                formData.append('filePaths', JSON.stringify(filePaths))

                // Create XMLHttpRequest for progress tracking
                const xhr = new XMLHttpRequest()

                // Track upload progress
                xhr.upload.addEventListener('progress', e => {
                    if (e.lengthComputable) {
                        uploadProgress.percentage = Math.round((e.loaded / e.total) * 100)
                        uploadProgress.currentFile = `Uploading folder with ${uploadProgress.totalFiles} file(s)...`
                    }
                })

                // Handle completion
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const result = JSON.parse(xhr.responseText)
                        uploadProgress.filesCompleted = result.count
                        uploadProgress.percentage = 100
                        uploadProgress.currentFile = 'Folder upload complete!'

                        showToast('success', 'Folder Upload Complete', result.message)

                        // Refresh the current directory
                        setTimeout(() => {
                            browsePath(browserData.currentPath)
                            uploadProgress.isUploading = false
                        }, 1500)
                    } else {
                        const errorData = JSON.parse(xhr.responseText)
                        throw new Error(errorData.error || 'Folder upload failed')
                    }
                })

                // Handle errors
                xhr.addEventListener('error', () => {
                    throw new Error('Network error during folder upload')
                })

                // Start upload
                xhr.open('POST', '/api/pm2/upload')

                // Add authentication header
                const authHeaders = getAuthHeaders()
                if (authHeaders.Authorization) {
                    xhr.setRequestHeader('Authorization', authHeaders.Authorization)
                }

                xhr.send(formData)
            } catch (error) {
                uploadProgress.error = error.message
                uploadProgress.isUploading = false
                showToast('danger', 'Folder Upload Failed', `Failed to upload folder: ${error.message}`)
            }

            // Clear the folder input
            event.target.value = ''
        }

        // Process link generation
        const processLinks = ref(new Map()) // Cache for detected links

        // Advanced functions data
        const gitCloneData = ref({
            url: ''
        })

        const gitPullData = reactive({
            directory: ''
        })

        const npmInstallData = reactive({
            directory: ''
        })

        const gitOperationInProgress = ref(false)

        const getProcessLink = process => {
            if (!process || process.pm2_env.status !== 'online') {
                return null
            }

            const processType = getProcessType(process)
            const baseUrl = `${window.location.protocol}//${window.location.hostname}`

            if (processType === 'Static') {
                // For static servers, get port from environment
                const port = process.pm2_env.env?.STATIC_PORT
                if (port) {
                    return `${baseUrl}:${port}/index.html`
                }
            } else {
                // For script processes, check cached link or return null for now
                const cachedLink = processLinks.value.get(process.pm_id)
                if (cachedLink) {
                    return cachedLink
                }
            }

            return null
        }

        const detectPortFromLogs = async processId => {
            try {
                const params = new URLSearchParams({
                    lines: '10',
                    from: 'head',
                    type: 'combined'
                })

                const response = await fetch(`/api/pm2/processes/${processId}/logs?${params}`, {
                    headers: getAuthHeaders()
                })
                if (response.ok) {
                    const data = await response.json()
                    const logs = data.logs || []

                    // Look for 4-digit port numbers in the first 10 lines
                    for (const line of logs) {
                        // Match 4-digit numbers that are likely to be port numbers, avoiding dates
                        const portMatch =
                            line.match(/(?:port|listening|server).*?(\d{4})|:(\d{4})\b/i) ||
                            (!/\d{4}-\d{2}/.test(line) ? line.match(/\b(\d{4})\b/) : null)
                        if (portMatch) {
                            const port = parseInt(portMatch[1] || portMatch[2] || portMatch[0])
                            // Validate port range (common web server ports)
                            if (port >= 1000 && port <= 9999) {
                                const baseUrl = `${window.location.protocol}//${window.location.hostname}`
                                const link = `${baseUrl}:${port}`

                                // Cache the detected link
                                processLinks.value.set(processId, link)
                                return link
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to detect port for process ${processId}:`, error)
            }
            return null
        }

        const refreshProcessLinks = async () => {
            // Detect ports for script processes that don't have cached links
            for (const process of processes.value) {
                if (
                    getProcessType(process) === 'Script' &&
                    process.pm2_env.status === 'online' &&
                    !processLinks.value.has(process.pm_id)
                ) {
                    await detectPortFromLogs(process.pm_id)
                }
            }
        }

        // Advanced functions
        const showGitCloneModal = () => {
            gitCloneData.url = ''
            const modal = new bootstrap.Modal(document.getElementById('gitCloneModal'))
            modal.show()
        }

        const showGitPullModal = () => {
            gitPullData.directory = ''
            const modal = new bootstrap.Modal(document.getElementById('gitPullModal'))
            modal.show()
        }

        const showNpmInstallModal = () => {
            npmInstallData.directory = ''
            const modal = new bootstrap.Modal(document.getElementById('npmInstallModal'))
            modal.show()
        }

        const showFileManagerModal = () => {
            browserSelectionMode.value = 'file' // Default to file mode
            browsePath('')

            // Reset target mode for file management
            browserData.targetMode = 'fileManager'

            const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'))
            modal.show()
        }

        const openDirectoryBrowser = mode => {
            browserSelectionMode.value = 'directory'
            browsePath('')

            // Store the mode for later use
            browserData.targetMode = mode

            // Close the current modal first to avoid z-index issues
            let currentModalId = null
            if (mode === 'gitPull') {
                currentModalId = 'gitPullModal'
            } else if (mode === 'npmInstall') {
                currentModalId = 'npmInstallModal'
            }

            if (currentModalId) {
                const currentModal = bootstrap.Modal.getInstance(document.getElementById(currentModalId))
                if (currentModal) {
                    currentModal.hide()
                }
            }

            // Small delay to ensure the previous modal is fully closed
            setTimeout(() => {
                const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'))
                modal.show()
            }, 100)
        }

        const executeGitClone = async () => {
            if (!gitCloneData.value.url) {
                showToast('warning', 'Warning', 'Repository URL is required')
                return
            }

            gitOperationInProgress.value = true

            try {
                const response = await fetch('/api/pm2/git/clone', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        url: gitCloneData.value.url
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast('success', 'Success', result.message)

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('gitCloneModal'))
                    modal.hide()

                    // Show output if available
                    if (result.stdout) {
                        setTimeout(() => {
                            showToast('info', 'Git Output', result.stdout.substring(0, 100) + '...')
                        }, 1000)
                    }
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Git clone failed')
                }
            } catch (error) {
                showToast('danger', 'Error', `Git clone failed: ${error.message}`)
            } finally {
                gitOperationInProgress.value = false
            }
        }

        const executeGitPull = async () => {
            if (!gitPullData.directory) {
                showToast('warning', 'Warning', 'Directory is required')
                return
            }

            gitOperationInProgress.value = true

            try {
                // Extract relative path from full path - handle both Windows and Unix paths
                const relativePath = gitPullData.directory.replace(/^.*[\/\\]apps[\/\\]/, '')

                const response = await fetch('/api/pm2/git/pull', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        directory: relativePath
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast('success', 'Success', result.message)

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('gitPullModal'))
                    modal.hide()

                    // Show output if available
                    if (result.stdout) {
                        setTimeout(() => {
                            showToast('info', 'Git Output', result.stdout.substring(0, 100) + '...')
                        }, 1000)
                    }
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Git pull failed')
                }
            } catch (error) {
                showToast('danger', 'Error', `Git pull failed: ${error.message}`)
            } finally {
                gitOperationInProgress.value = false
            }
        }

        const executeNpmInstall = async () => {
            if (!npmInstallData.directory) {
                showToast('warning', 'Warning', 'Directory is required')
                return
            }

            gitOperationInProgress.value = true

            try {
                // Extract relative path from full path - handle both Windows and Unix paths
                const relativePath = npmInstallData.directory.replace(/^.*[\/\\]apps[\/\\]/, '')

                const response = await fetch('/api/pm2/npm/install', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        directory: relativePath
                    })
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast('success', 'Success', result.message)

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('npmInstallModal'))
                    modal.hide()

                    // Show output if available
                    if (result.stdout) {
                        setTimeout(() => {
                            showToast('info', 'NPM Output', 'Dependencies installed successfully')
                        }, 1000)
                    }
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'NPM install failed')
                }
            } catch (error) {
                showToast('danger', 'Error', `NPM install failed: ${error.message}`)
            } finally {
                gitOperationInProgress.value = false
            }
        }

        // Methods
        const fetchProcesses = async () => {
            try {
                const response = await fetch('/api/pm2/processes', {
                    headers: getAuthHeaders()
                })
                if (response.ok) {
                    processes.value = await response.json()
                    updateSystemInfo(processes.value)

                    // Refresh process links after a short delay to allow UI to update
                    setTimeout(() => {
                        refreshProcessLinks()
                    }, 500)
                } else if (response.status === 401) {
                    // Token expired or invalid
                    setAuthToken(null)
                    isAuthenticated.value = false
                    showToast('warning', 'Authentication Required', 'Please log in again')
                }
            } catch (error) {
                showToast('danger', 'Error', 'Failed to fetch processes')
            }
        }

        const fetchSystemInfo = async () => {
            try {
                const response = await fetch('/api/pm2/system', {
                    headers: getAuthHeaders()
                })
                if (response.ok) {
                    const data = await response.json()
                    Object.assign(systemInfo, data)
                } else if (response.status === 401) {
                    // Token expired or invalid
                    setAuthToken(null)
                    isAuthenticated.value = false
                }
            } catch (error) {
                console.error('Failed to fetch system info:', error)
            }
        }

        const updateSystemInfo = processesList => {
            systemInfo.totalProcesses = processesList.length
            systemInfo.runningProcesses = processesList.filter(p => p.pm2_env.status === 'online').length
            systemInfo.stoppedProcesses = processesList.filter(p => p.pm2_env.status === 'stopped').length
            systemInfo.erroredProcesses = processesList.filter(p => p.pm2_env.status === 'errored').length
        }

        const startProcess = async id => {
            try {
                const response = await fetch(`/api/pm2/processes/${id}/restart`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                })

                if (response.ok) {
                    showToast('success', 'Success', 'Process started successfully')
                    fetchProcesses()
                } else {
                    throw new Error('Failed to start process')
                }
            } catch (error) {
                showToast('danger', 'Error', 'Failed to start process')
            }
        }

        const stopProcess = async id => {
            try {
                const response = await fetch(`/api/pm2/processes/${id}/stop`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                })

                if (response.ok) {
                    showToast('success', 'Success', 'Process stopped successfully')
                    fetchProcesses()
                } else {
                    throw new Error('Failed to stop process')
                }
            } catch (error) {
                showToast('danger', 'Error', 'Failed to stop process')
            }
        }

        const restartProcess = async id => {
            try {
                const response = await fetch(`/api/pm2/processes/${id}/restart`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                })

                if (response.ok) {
                    showToast('success', 'Success', 'Process restarted successfully')
                    fetchProcesses()
                } else {
                    throw new Error('Failed to restart process')
                }
            } catch (error) {
                showToast('danger', 'Error', 'Failed to restart process')
            }
        }

        const deleteProcess = async id => {
            // Get process name for better confirmation message
            const process = processes.value.find(p => p.pm_id === id)
            const processName = process?.name || `Process ${id}`

            const confirmed = await customConfirm(
                'Delete Process',
                `<p>Are you sure you want to delete <strong>"${processName}"</strong>?</p>
                 <div class="alert alert-warning mt-3 mb-0">
                     <strong>This will:</strong>
                     <ul class="mb-0 mt-2">
                         <li>Stop and remove the process from PM2</li>
                         <li>Delete all associated log files</li>
                         <li><strong>This action cannot be undone</strong></li>
                     </ul>
                 </div>`,
                {
                    confirmText: 'Delete Process',
                    cancelText: 'Cancel'
                }
            )

            if (!confirmed) {
                return
            }

            try {
                const response = await fetch(`/api/pm2/processes/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                })

                if (response.ok) {
                    const result = await response.json()

                    // Show appropriate success message based on whether logs were deleted
                    if (result.logsDeleted) {
                        showToast(
                            'success',
                            'Process Deleted',
                            `${processName} and its logs have been deleted successfully`
                        )
                    } else {
                        showToast('success', 'Process Deleted', result.message)

                        // Show warning if logs couldn't be deleted
                        if (result.logError) {
                            setTimeout(() => {
                                showToast(
                                    'warning',
                                    'Log Cleanup Warning',
                                    'Process deleted but some log files may remain'
                                )
                            }, 1000)
                        }
                    }

                    fetchProcesses()
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to delete process')
                }
            } catch (error) {
                showToast('danger', 'Error', `Failed to delete process: ${error.message}`)
            }
        }

        const startNewProcess = async () => {
            // Validation based on process type
            if (newProcess.type === 'script' && !newProcess.script) {
                showToast('warning', 'Warning', 'Script path is required for Node.js applications')
                return
            }

            if (newProcess.type === 'static') {
                if (!newProcess.directory) {
                    showToast('warning', 'Warning', 'Directory path is required for static file servers')
                    return
                }
                if (!newProcess.port) {
                    showToast('warning', 'Warning', 'Port is required for static file servers')
                    return
                }

                // Basic path validation - support both Unix and Windows absolute paths
                const isAbsolutePath =
                    newProcess.directory.startsWith('/') ||
                    /^[a-zA-Z]:\\/.test(newProcess.directory) ||
                    newProcess.directory.startsWith('\\\\')

                if (!isAbsolutePath) {
                    showToast(
                        'warning',
                        'Warning',
                        'Please provide an absolute path for the directory (e.g., /path/to/dir or C:\\path\\to\\dir)'
                    )
                    return
                }

                // Port validation
                const port = parseInt(newProcess.port)
                if (port < 1 || port > 65535) {
                    showToast('warning', 'Warning', 'Port must be between 1 and 65535')
                    return
                }
            }

            try {
                const response = await fetch('/api/pm2/processes/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(newProcess)
                })

                if (response.ok) {
                    const result = await response.json()
                    showToast('success', 'Success', result.message)
                    resetNewProcessForm()

                    // Close modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('startProcessModal'))
                    modal.hide()

                    fetchProcesses()

                    // Show additional info for static servers
                    if (newProcess.type === 'static') {
                        setTimeout(() => {
                            showToast(
                                'info',
                                'Static Server Started',
                                `Visit your website at http://localhost:${newProcess.port}`
                            )
                        }, 1000)
                    }
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to start process')
                }
            } catch (error) {
                showToast('danger', 'Error', error.message)
            }
        }

        const onProcessTypeChange = () => {
            // Reset form fields when process type changes
            newProcess.script = ''
            newProcess.directory = ''
            newProcess.port = null
            newProcess.name = ''

            // Reinitialize tooltips after type change
            initializeTooltips()
        }

        const getNamePlaceholder = () => {
            if (newProcess.type === 'static' && newProcess.port) {
                return `static-${newProcess.port}`
            }
            return 'Optional process name'
        }

        const normalizeDirectoryPath = () => {
            if (!newProcess.directory) return

            const path = newProcess.directory.trim()

            // Check if the path looks like a file (has an extension)
            const lastSegment = path.split('/').pop()
            const hasExtension = lastSegment && lastSegment.includes('.') && !lastSegment.startsWith('.')

            if (hasExtension) {
                // Extract the directory path (remove the filename)
                const directoryPath = path.substring(0, path.lastIndexOf('/'))

                if (directoryPath) {
                    newProcess.directory = directoryPath
                    showToast('info', 'Path Adjusted', `Detected file path. Using parent directory: ${directoryPath}`)
                }
            }
        }

        const resetNewProcessForm = () => {
            Object.assign(newProcess, {
                type: 'script',
                script: '',
                name: '',
                directory: '',
                port: null
            })

            // Reinitialize tooltips after form reset
            initializeTooltips()
        }

        const showProcessDetails = process => {
            selectedProcess.value = process
            const modal = new bootstrap.Modal(document.getElementById('processDetailsModal'))
            modal.show()
        }

        const refreshProcessDetails = async () => {
            if (!selectedProcess.value) return

            try {
                const response = await fetch(`/api/pm2/processes/${selectedProcess.value.pm_id}`, {
                    headers: getAuthHeaders()
                })
                if (response.ok) {
                    const processDetails = await response.json()
                    selectedProcess.value = processDetails
                    showToast('success', 'Refreshed', 'Process details updated successfully')
                } else {
                    throw new Error('Failed to fetch process details')
                }
            } catch (error) {
                showToast('danger', 'Error', 'Failed to refresh process details')
            }
        }

        const showProcessLogs = process => {
            logProcess.value = process
            logData.value = { logs: [], totalLines: 0, from: 'tail', type: 'combined', file: '' }

            // Close process details modal and open logs modal
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('processDetailsModal'))
            if (detailsModal) {
                detailsModal.hide()
            }

            nextTick(() => {
                const logsModal = new bootstrap.Modal(document.getElementById('processLogsModal'))
                logsModal.show()

                // Load logs after modal is shown
                setTimeout(() => {
                    refreshLogs()
                }, 300)
            })
        }

        const refreshLogs = async () => {
            if (!logProcess.value) return

            logsLoading.value = true

            try {
                const params = new URLSearchParams({
                    lines: logOptions.lines.toString(),
                    from: logOptions.from,
                    type: logOptions.type
                })

                const response = await fetch(`/api/pm2/processes/${logProcess.value.pm_id}/logs?${params}`, {
                    headers: getAuthHeaders()
                })
                if (response.ok) {
                    const data = await response.json()
                    logData.value = data
                } else {
                    const error = await response.json()
                    throw new Error(error.error || 'Failed to fetch logs')
                }
            } catch (error) {
                showToast('danger', 'Error', `Failed to load logs: ${error.message}`)
                logData.value = {
                    logs: [],
                    totalLines: 0,
                    from: logOptions.from,
                    type: logOptions.type,
                    file: '',
                    message: 'Failed to load logs'
                }
            } finally {
                logsLoading.value = false
            }
        }

        const clearLogsDisplay = () => {
            logData.value = {
                logs: [],
                totalLines: 0,
                from: logOptions.from,
                type: logOptions.type,
                file: '',
                message: 'Logs cleared'
            }
        }

        const formatDate = timestamp => {
            if (!timestamp) return 'N/A'
            return new Date(timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            })
        }

        const refreshProcesses = () => {
            if (authEnabled.value && !isAuthenticated.value) {
                return // Don't fetch if auth is required but user not authenticated
            }
            fetchProcesses()
            fetchSystemInfo()
        }

        const showSystemInfo = () => {
            // Refresh system info before showing modal
            fetchSystemInfo()
            const modal = new bootstrap.Modal(document.getElementById('systemInfoModal'))
            modal.show()
        }

        const getStatusClass = status => {
            switch (status) {
                case 'online':
                    return 'bg-success'
                case 'stopped':
                    return 'bg-secondary'
                case 'errored':
                    return 'bg-danger'
                case 'stopping':
                    return 'bg-warning'
                case 'launching':
                    return 'bg-info'
                default:
                    return 'bg-secondary'
            }
        }

        const getProcessType = process => {
            // Check if it's a static file server based on script name or environment
            if (
                process.pm2_env?.pm_exec_path?.includes('static-server.js') ||
                process.pm2_env?.env?.STATIC_DIR ||
                process.pm2_env?.script === 'serve'
            ) {
                return 'Static'
            }
            return 'Script'
        }

        const getTypeClass = process => {
            const type = getProcessType(process)
            return type === 'Static' ? 'bg-info' : 'bg-primary'
        }

        const formatCpu = cpu => {
            return cpu ? cpu.toFixed(1) : '0.0'
        }

        const formatMemory = memory => {
            if (!memory) return '0 MB'
            return (memory / 1024 / 1024).toFixed(1) + ' MB'
        }

        const formatUptime = uptime => {
            if (!uptime) return '-'

            const now = Date.now()
            const uptimeMs = now - uptime
            const seconds = Math.floor(uptimeMs / 1000)
            const minutes = Math.floor(seconds / 60)
            const hours = Math.floor(minutes / 60)
            const days = Math.floor(hours / 24)

            if (days > 0) return `${days}d ${hours % 24}h`
            if (hours > 0) return `${hours}h ${minutes % 60}m`
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`
            return `${seconds}s`
        }

        const formatServerUptime = uptimeInSeconds => {
            if (!uptimeInSeconds) return '-'

            const seconds = Math.floor(uptimeInSeconds)
            const minutes = Math.floor(seconds / 60)
            const hours = Math.floor(minutes / 60)
            const days = Math.floor(hours / 24)

            if (days > 0) return `${days}d ${hours % 24}h`
            if (hours > 0) return `${hours}h ${minutes % 60}m`
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`
            return `${seconds}s`
        }

        const showToast = (type, title, message) => {
            const toast = {
                id: ++toastId.value,
                type,
                title,
                message
            }

            toasts.value.push(toast)

            // Auto remove after 5 seconds
            setTimeout(() => {
                removeToast(toast.id)
            }, 5000)
        }

        const removeToast = id => {
            const index = toasts.value.findIndex(t => t.id === id)
            if (index !== -1) {
                toasts.value.splice(index, 1)
            }
        }

        // Computed properties
        const namePlaceholder = computed(() => getNamePlaceholder())

        const isPasswordChangeFormValid = computed(() => {
            return (
                passwordChangeData.currentPassword.length > 0 &&
                passwordChangeData.newPassword.length >= 4 &&
                passwordChangeData.confirmPassword.length > 0 &&
                passwordChangeData.newPassword === passwordChangeData.confirmPassword
            )
        })

        // Lifecycle
        onMounted(async () => {
            await checkAuthStatus()
            refreshProcesses()
            initializeTooltips()
        })

        // Return reactive data and methods for template
        return {
            // Authentication state
            authEnabled,
            isAuthenticated,
            loginData,
            passwordChangeData,

            // Reactive state
            processes,
            systemInfo,
            newProcess,
            toasts,
            selectedProcess,

            // Logs functionality
            logProcess,
            logData,
            logOptions,
            logsLoading,

            // Custom modals
            confirmData,
            alertData,

            // File browser
            browserData,
            browserItems,
            browserLoading,
            browserSelectionMode,
            breadcrumbs,

            // Template refs
            fileUploadInput,
            folderUploadInput,

            // Upload and folder creation
            uploadProgress,
            newFolderData,

            // Process links
            processLinks,

            // Advanced functions data
            gitCloneData,
            gitPullData,
            npmInstallData,
            gitOperationInProgress,

            // Methods
            fetchProcesses,
            fetchSystemInfo,
            updateSystemInfo,

            // Authentication methods
            showLoginModal,
            togglePasswordVisibility,
            login,
            logout,
            showChangePasswordModal,
            toggleCurrentPasswordVisibility,
            toggleNewPasswordVisibility,
            toggleConfirmPasswordVisibility,
            changePassword,

            startProcess,
            stopProcess,
            restartProcess,
            deleteProcess,
            startNewProcess,
            onProcessTypeChange,
            getNamePlaceholder,
            normalizeDirectoryPath,
            resetNewProcessForm,
            showProcessDetails,
            refreshProcessDetails,
            showProcessLogs,
            refreshLogs,
            clearLogsDisplay,
            formatDate,
            refreshProcesses,
            showSystemInfo,
            getStatusClass,
            getProcessType,
            getTypeClass,
            formatCpu,
            formatMemory,
            formatUptime,
            formatServerUptime,
            showToast,
            removeToast,
            customConfirm,
            customAlert,
            openFileBrowser,
            browsePath,
            selectFile,
            selectCurrentDirectory,
            getBreadcrumbPath,
            getFileIcon,
            formatFileSize,
            deleteFileOrFolder,
            deleteCurrentDirectory,
            showCreateFolderModal,
            createFolder,
            triggerFileUpload,
            handleFileUpload,
            triggerFolderUpload,
            handleFolderUpload,
            getProcessLink,
            detectPortFromLogs,
            refreshProcessLinks,

            // Advanced functions methods
            showGitCloneModal,
            showGitPullModal,
            showNpmInstallModal,
            showFileManagerModal,
            openDirectoryBrowser,
            executeGitClone,
            executeGitPull,
            executeNpmInstall,

            // Computed
            namePlaceholder,
            isPasswordChangeFormValid
        }
    }
}).mount('#app')
