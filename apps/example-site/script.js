// JavaScript for the PM2 WebUI Test Static Site

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    updateTime()
    updateLoadTime()
    updateVisitCount()
    updateLastUpdate()

    // Update time every second
    setInterval(updateTime, 1000)
})

function updateTime() {
    const now = new Date()
    const timeString = now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
    document.getElementById('current-time').textContent = timeString
}

function updateLoadTime() {
    const loadTime = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    })
    document.getElementById('load-time').textContent = loadTime
}

function updateVisitCount() {
    // Simulate visit count using localStorage
    let visits = localStorage.getItem('pm2-test-visits') || 0
    visits = parseInt(visits) + 1
    localStorage.setItem('pm2-test-visits', visits)
    document.getElementById('visit-count').textContent = visits
}

function updateLastUpdate() {
    const lastUpdate = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    document.getElementById('last-update').textContent = lastUpdate
}

function showProcessInfo() {
    const info = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`,
        currentURL: window.location.href,
        referrer: document.referrer || 'Direct access',
        timestamp: new Date().toISOString()
    }

    alert(
        `Browser Information:\n\n${Object.entries(info)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')}`
    )
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault()
        const target = document.querySelector(this.getAttribute('href'))
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            })
        }
    })
})

// Add some interactive effects
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)'
    })

    card.addEventListener('mouseleave', function () {
        this.style.boxShadow = ''
    })
})

// Console log for debugging
console.log('PM2 WebUI Test Static Site loaded successfully!')
console.log('This site is being served by PM2 static file server')
console.log('Server process can be managed through PM2 WebUI')

// Performance timing (if available)
if (window.performance && window.performance.timing) {
    window.addEventListener('load', function () {
        setTimeout(() => {
            const timing = window.performance.timing
            const loadTime = timing.loadEventEnd - timing.navigationStart
            console.log(`Page load time: ${loadTime}ms`)
        }, 0)
    })
}
