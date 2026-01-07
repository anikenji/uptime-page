// ===== Configuration =====
const CONFIG = {
    // GitHub repo containing Upptime data
    owner: 'anikenji',
    repo: 'uptime-page',
    // API endpoints
    apiBase: 'https://raw.githubusercontent.com/anikenji/uptime-page/master/api',
    historyBase: 'https://raw.githubusercontent.com/anikenji/uptime-page/master/history',
    // Services to monitor (should match .upptimerc.yml)
    services: [
        { name: 'Website', slug: 'website', icon: '🌐', url: 'https://anikenji.live' },
        { name: 'Streaming Service', slug: 'streaming-service', icon: '📺', url: 'https://service.anikenji.live' }
    ],
    // Number of days to show in uptime bar
    uptimeDays: 90,
    // Refresh interval (ms)
    refreshInterval: 60000
};

// ===== State =====
let chartsInstances = {};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadStatusData();
    setInterval(loadStatusData, CONFIG.refreshInterval);
});

// ===== Load Status Data =====
async function loadStatusData() {
    try {
        // Fetch summary data
        const summaryResponse = await fetch(`${CONFIG.apiBase}/summary.json`);

        if (!summaryResponse.ok) {
            // If API not available, use mock data
            renderMockData();
            return;
        }

        const summary = await summaryResponse.json();

        // Update UI
        updateOverallStatus(summary);
        renderServiceCards(summary);
        renderCharts(summary);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading status data:', error);
        renderMockData();
    }
}

// ===== Update Overall Status Banner =====
function updateOverallStatus(summary) {
    const banner = document.getElementById('status-banner');
    const allUp = summary.sites.every(site => site.status === 'up');
    const anyDown = summary.sites.some(site => site.status === 'down');

    banner.classList.remove('operational', 'degraded', 'outage');

    if (allUp) {
        banner.classList.add('operational');
        banner.querySelector('.status-text').textContent = '✅ Tất cả hệ thống hoạt động bình thường';
    } else if (anyDown) {
        banner.classList.add('outage');
        banner.querySelector('.status-text').textContent = '🔴 Một số dịch vụ đang gặp sự cố';
    } else {
        banner.classList.add('degraded');
        banner.querySelector('.status-text').textContent = '⚠️ Một số dịch vụ đang bị ảnh hưởng';
    }
}

// ===== Render Service Cards =====
function renderServiceCards(summary) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    summary.sites.forEach((site, index) => {
        const service = CONFIG.services[index] || { icon: '🔗', name: site.name };
        const isUp = site.status === 'up';
        const statusClass = isUp ? 'operational' : 'down';
        const statusText = isUp ? 'Hoạt động' : 'Gián đoạn';

        const card = document.createElement('div');
        card.className = `service-card ${statusClass}`;
        card.innerHTML = `
            <div class="service-header">
                <div class="service-name">
                    <span class="service-icon">${service.icon}</span>
                    <span>${site.name}</span>
                </div>
                <div class="service-status">
                    <span class="pulse-dot"></span>
                    ${statusText}
                </div>
            </div>
            <div class="service-stats">
                <div class="stat-item">
                    <div class="stat-value">${site.uptime || '100'}%</div>
                    <div class="stat-label">Uptime</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${site.time || 0}ms</div>
                    <div class="stat-label">Response Time</div>
                </div>
            </div>
            <div class="uptime-bar-container">
                <div class="uptime-bar-label">
                    <span>${CONFIG.uptimeDays} ngày qua</span>
                    <span>${site.uptime || '100'}% uptime</span>
                </div>
                <div class="uptime-bar" id="uptime-bar-${index}">
                    ${generateUptimeBar()}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ===== Generate Uptime Bar =====
function generateUptimeBar() {
    let bars = '';
    for (let i = 0; i < CONFIG.uptimeDays; i++) {
        // Random status for demo (in real app, fetch from history)
        const rand = Math.random();
        let statusClass = '';
        if (rand > 0.02) statusClass = ''; // operational (green by default)
        else if (rand > 0.01) statusClass = 'degraded';
        else statusClass = 'down';

        bars += `<div class="uptime-day ${statusClass}" title="Ngày ${CONFIG.uptimeDays - i} trước"></div>`;
    }
    return bars;
}

// ===== Render Charts =====
function renderCharts(summary) {
    const chartsGrid = document.getElementById('charts-grid');
    chartsGrid.innerHTML = '';

    summary.sites.forEach((site, index) => {
        const service = CONFIG.services[index] || { icon: '🔗', name: site.name };

        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        chartCard.innerHTML = `
            <div class="chart-title">
                <span>${service.icon}</span>
                ${site.name} - Response Time
            </div>
            <div class="chart-container">
                <canvas id="chart-${index}"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartCard);

        // Create chart after DOM is updated
        setTimeout(() => createResponseTimeChart(`chart-${index}`, site.name), 0);
    });
}

// ===== Create Response Time Chart =====
function createResponseTimeChart(canvasId, serviceName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart if any
    if (chartsInstances[canvasId]) {
        chartsInstances[canvasId].destroy();
    }

    // Generate sample data (in real app, fetch from history)
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
        const time = new Date(now - i * 3600000);
        labels.push(time.getHours() + ':00');
        // Random response time between 100-800ms
        data.push(Math.floor(Math.random() * 500) + 200);
    }

    const ctx = canvas.getContext('2d');
    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: data,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#00d4ff',
                pointHoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(18, 18, 26, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#8888aa',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y}ms`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#555566',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#555566',
                        callback: function (value) {
                            return value + 'ms';
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== Render Mock Data =====
function renderMockData() {
    const mockSummary = {
        sites: CONFIG.services.map(service => ({
            name: service.name,
            url: service.url,
            status: 'up',
            uptime: '100.00',
            time: Math.floor(Math.random() * 500) + 200
        }))
    };

    updateOverallStatus(mockSummary);
    renderServiceCards(mockSummary);
    renderCharts(mockSummary);
    updateLastUpdate();
}

// ===== Update Last Update Time =====
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('last-update').textContent = timeStr;
}

// ===== Subscribe Form (Demo) =====
document.addEventListener('DOMContentLoaded', () => {
    const subscribeBtn = document.querySelector('.subscribe-btn');
    const subscribeInput = document.querySelector('.subscribe-input');

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            const email = subscribeInput.value.trim();
            if (email && email.includes('@')) {
                alert('🎉 Đã đăng ký thành công!\nBạn sẽ nhận thông báo khi có sự cố.');
                subscribeInput.value = '';
            } else {
                alert('⚠️ Vui lòng nhập email hợp lệ');
            }
        });
    }
});
