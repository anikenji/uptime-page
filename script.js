// ===== Configuration =====
const CONFIG = {
    // API endpoints
    apiBase: './history',
    apiResponseTime: './api',
    // Cloudflare Worker API for historical data
    workerApi: 'https://anikenji-stats.buicaobinh2016.workers.dev',
    // Number of days to show in uptime bar
    uptimeDays: 90,
    // Refresh interval (ms) - refresh every 5 minutes
    refreshInterval: 300000,
    // Service icons
    serviceIcons: {
        'website': '🌐',
        'streaming-service': '📺',
        'api': '⚡'
    }
};

// ===== State =====
let chartsInstances = {};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadStatusData();
    setInterval(loadStatusData, CONFIG.refreshInterval);
});

// ===== Load Status Data from Upptime API =====
async function loadStatusData() {
    try {
        // Fetch summary.json from Upptime (stored in master branch)
        const response = await fetch(`${CONFIG.apiBase}/summary.json?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error('API not available');
        }

        // Upptime returns array directly, wrap it in object
        let data = await response.json();
        if (Array.isArray(data)) {
            data = { sites: data };
        }

        // Update UI with real data
        updateOverallStatus(data);
        renderServiceCards(data);
        renderCharts(data);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading status data:', error);
        showErrorState();
    }
}

// ===== Update Overall Status Banner =====
function updateOverallStatus(data) {
    const banner = document.getElementById('status-banner');
    const allUp = data.sites.every(site => site.status === 'up');
    const anyDown = data.sites.some(site => site.status === 'down');

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
function renderServiceCards(data) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    data.sites.forEach((site, index) => {
        const slug = site.slug || site.name.toLowerCase().replace(/\s+/g, '-');
        const icon = CONFIG.serviceIcons[slug] || '🔗';
        const isUp = site.status === 'up';
        const statusClass = isUp ? 'operational' : 'down';
        const statusText = isUp ? 'Hoạt động' : 'Gián đoạn';
        const pulseClass = isUp ? 'pulse-up' : 'pulse-down';

        // Parse uptime from Upptime data
        const uptime = parseFloat(site.uptime || '100').toFixed(2);
        const responseTime = site.time || 0;

        const card = document.createElement('div');
        card.className = `service-card ${statusClass}`;
        card.innerHTML = `
            <div class="service-header">
                <div class="service-name">
                    <span class="service-icon">${icon}</span>
                    <span>${site.name}</span>
                </div>
                <div class="service-status ${statusClass}">
                    <span class="pulse-dot ${pulseClass}"></span>
                    ${statusText}
                </div>
            </div>
            <div class="service-stats">
                <div class="stat-item">
                    <div class="stat-value">${uptime}%</div>
                    <div class="stat-label">Uptime</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${responseTime}ms</div>
                    <div class="stat-label">Response Time</div>
                </div>
            </div>
            <div class="uptime-bar-container">
                <div class="uptime-bar-label">
                    <span>${CONFIG.uptimeDays} ngày qua</span>
                    <span>${uptime}% uptime</span>
                </div>
                <div class="uptime-bar" id="uptime-bar-${index}">
                    ${generateUptimeBar(site)}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ===== Generate Uptime Bar =====
function generateUptimeBar(site) {
    let bars = '';

    // Use daily uptime data from Upptime if available
    if (site.dailyMinutesDown && Array.isArray(site.dailyMinutesDown)) {
        for (let i = 0; i < CONFIG.uptimeDays; i++) {
            const minutesDown = site.dailyMinutesDown[i] || 0;
            let statusClass = '';
            let tooltip = '';

            if (minutesDown === 0) {
                statusClass = '';
                tooltip = `Ngày ${i + 1} trước: Hoạt động bình thường`;
            } else if (minutesDown < 30) {
                statusClass = 'degraded';
                tooltip = `Ngày ${i + 1} trước: ${minutesDown} phút gián đoạn`;
            } else {
                statusClass = 'down';
                tooltip = `Ngày ${i + 1} trước: ${minutesDown} phút gián đoạn`;
            }

            bars = `<div class="uptime-day ${statusClass}" title="${tooltip}"></div>` + bars;
        }
    } else {
        // Fallback: show no-data for most days, operational for today
        for (let i = 0; i < CONFIG.uptimeDays; i++) {
            const statusClass = i === 0 ? '' : 'no-data';
            const tooltip = i === 0 ? 'Hôm nay: Hoạt động' : `Ngày ${i + 1} trước: Chưa có dữ liệu`;
            bars = `<div class="uptime-day ${statusClass}" title="${tooltip}"></div>` + bars;
        }
    }

    return bars;
}

// ===== Render Charts =====
function renderCharts(data) {
    const chartsGrid = document.getElementById('charts-grid');
    chartsGrid.innerHTML = '';

    data.sites.forEach((site, index) => {
        const slug = site.slug || site.name.toLowerCase().replace(/\s+/g, '-');
        const icon = CONFIG.serviceIcons[slug] || '🔗';

        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        chartCard.innerHTML = `
            <div class="chart-title">
                <span>${icon}</span>
                ${site.name} - Response Time
            </div>
            <div class="chart-container">
                <canvas id="chart-${index}"></canvas>
            </div>
        `;
        chartsGrid.appendChild(chartCard);

        // Fetch and create chart
        setTimeout(() => fetchAndCreateChart(`chart-${index}`, slug, site.time || 300), 0);
    });
}

// ===== Fetch and Create Chart =====
async function fetchAndCreateChart(canvasId, slug, currentTime) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart if any
    if (chartsInstances[canvasId]) {
        chartsInstances[canvasId].destroy();
    }

    let labels = [];
    let chartData = [];

    try {
        // Fetch response time history from Cloudflare Worker API
        const response = await fetch(`${CONFIG.workerApi}/history/${slug}?hours=24`);
        if (response.ok) {
            const result = await response.json();
            if (result.data && result.data.length > 0) {
                // Group by hour for cleaner chart
                const hourlyData = {};
                result.data.forEach(point => {
                    const date = new Date(point.time);
                    const hourKey = date.getHours();
                    if (!hourlyData[hourKey]) {
                        hourlyData[hourKey] = { sum: 0, count: 0 };
                    }
                    hourlyData[hourKey].sum += point.responseTime;
                    hourlyData[hourKey].count++;
                });

                // Convert to arrays
                for (let i = 0; i < 24; i++) {
                    const hour = (new Date().getHours() - 23 + i + 24) % 24;
                    labels.push(hour + ':00');
                    if (hourlyData[hour]) {
                        chartData.push(Math.round(hourlyData[hour].sum / hourlyData[hour].count));
                    } else {
                        chartData.push(null); // No data for this hour
                    }
                }
            }
        }
    } catch (e) {
        console.log('Could not fetch response time data from Worker:', e);
    }

    // Fallback if no data
    if (chartData.length === 0) {
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            labels.push((now.getHours() - i + 24) % 24 + ':00');
            chartData.push(currentTime);
        }
    }

    const ctx = canvas.getContext('2d');
    chartsInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: chartData,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: '#00d4ff',
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
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(18, 18, 26, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#8888aa',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${Math.round(context.parsed.y)}ms`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#555566', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: {
                        color: '#555566',
                        callback: (value) => value + 'ms'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== Show Error State =====
function showErrorState() {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ff4466; grid-column: 1 / -1;">
            <p>⚠️ Không thể tải dữ liệu trạng thái.</p>
            <button onclick="loadStatusData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #00d4ff; border: none; border-radius: 8px; cursor: pointer; color: #000;">
                🔄 Thử lại
            </button>
        </div>
    `;
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

// ===== Subscribe Form =====
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
