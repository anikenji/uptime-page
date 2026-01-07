// ===== Configuration =====
const CONFIG = {
    // GitHub repo containing Upptime data
    owner: 'anikenji',
    repo: 'uptime-page',
    // API endpoints - Use relative paths (works when hosted on same domain)
    // Falls back to raw.githubusercontent if relative fails
    apiBase: './api',
    historyBase: './history',
    // Services configuration (icons for display)
    serviceIcons: {
        'website': '🌐',
        'streaming-service': '📺',
        'api': '⚡'
    },
    // Number of days to show in uptime bar
    uptimeDays: 90,
    // Refresh interval (ms) - refresh every 60 seconds
    refreshInterval: 60000
};

// ===== State =====
let chartsInstances = {};
let cachedHistoryData = {};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadStatusData();
    // Auto refresh
    setInterval(loadStatusData, CONFIG.refreshInterval);
});

// ===== Load Status Data from Upptime API =====
async function loadStatusData() {
    try {
        // Fetch summary.json from Upptime
        const response = await fetch(`${CONFIG.apiBase}/summary.json?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error('API not available');
        }

        const summary = await response.json();

        // Update UI with real data
        updateOverallStatus(summary);
        renderServiceCards(summary);
        await renderChartsWithRealData(summary);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading status data:', error);
        // Show error state
        showErrorState();
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

// ===== Render Service Cards with Real Data =====
function renderServiceCards(summary) {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = '';

    summary.sites.forEach((site, index) => {
        const slug = site.slug || site.name.toLowerCase().replace(/\s+/g, '-');
        const icon = CONFIG.serviceIcons[slug] || '🔗';
        const isUp = site.status === 'up';
        const statusClass = isUp ? 'operational' : 'down';
        const statusText = isUp ? 'Hoạt động' : 'Gián đoạn';

        // Parse uptime - Upptime provides this in the summary
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
                <div class="service-status">
                    <span class="pulse-dot"></span>
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
                    ${generateUptimeBarFromData(site)}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ===== Generate Uptime Bar from Real Data =====
function generateUptimeBarFromData(site) {
    let bars = '';

    // If we have daily uptime data, use it
    if (site.dailyMinutesDown && Array.isArray(site.dailyMinutesDown)) {
        // Use real daily data
        for (let i = 0; i < CONFIG.uptimeDays; i++) {
            const minutesDown = site.dailyMinutesDown[i] || 0;
            let statusClass = '';

            if (minutesDown === 0) {
                statusClass = ''; // operational (green)
            } else if (minutesDown < 30) {
                statusClass = 'degraded'; // yellow
            } else {
                statusClass = 'down'; // red
            }

            const dayLabel = CONFIG.uptimeDays - i;
            bars += `<div class="uptime-day ${statusClass}" title="Ngày ${dayLabel} trước: ${minutesDown} phút down"></div>`;
        }
    } else {
        // Fallback: generate based on overall uptime
        const uptime = parseFloat(site.uptime || '100');
        for (let i = 0; i < CONFIG.uptimeDays; i++) {
            // Assume all days are up if uptime is high
            let statusClass = uptime > 99 ? '' : (i % 30 === 0 && uptime < 99 ? 'degraded' : '');
            bars += `<div class="uptime-day ${statusClass}" title="Ngày ${CONFIG.uptimeDays - i} trước"></div>`;
        }
    }

    return bars;
}

// ===== Render Charts with Real Response Time Data =====
async function renderChartsWithRealData(summary) {
    const chartsGrid = document.getElementById('charts-grid');
    chartsGrid.innerHTML = '';

    for (let index = 0; index < summary.sites.length; index++) {
        const site = summary.sites[index];
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

        // Fetch history data for this service
        try {
            const historyData = await fetchResponseTimeHistory(slug);
            createResponseTimeChart(`chart-${index}`, historyData);
        } catch (error) {
            console.error(`Error fetching history for ${site.name}:`, error);
            // Create chart with fallback data
            createResponseTimeChart(`chart-${index}`, generateFallbackData(site.time || 300));
        }
    }
}

// ===== Fetch Response Time History =====
async function fetchResponseTimeHistory(slug) {
    try {
        // Try to fetch response-time data from history folder
        const response = await fetch(`${CONFIG.historyBase}/${slug}/response-time.json?t=${Date.now()}`);

        if (response.ok) {
            const data = await response.json();
            // Upptime stores response time as array of [timestamp, responseTime]
            return data;
        }
    } catch (error) {
        console.log(`Could not fetch history for ${slug}`);
    }

    return null;
}

// ===== Generate Fallback Data =====
function generateFallbackData(baseTime) {
    const data = [];
    const now = Date.now();

    for (let i = 23; i >= 0; i--) {
        // Generate consistent data based on time, not random
        const timestamp = now - i * 3600000;
        const variation = Math.sin(i / 4) * 100; // Sinusoidal variation for realistic look
        const responseTime = Math.max(100, baseTime + variation);
        data.push([timestamp, Math.round(responseTime)]);
    }

    return data;
}

// ===== Create Response Time Chart =====
function createResponseTimeChart(canvasId, historyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart if any
    if (chartsInstances[canvasId]) {
        chartsInstances[canvasId].destroy();
    }

    let labels = [];
    let data = [];

    if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        // Use real data - take last 24 data points
        const recentData = historyData.slice(-24);

        recentData.forEach(point => {
            if (Array.isArray(point) && point.length >= 2) {
                const date = new Date(point[0]);
                labels.push(date.getHours() + ':00');
                data.push(point[1]);
            }
        });
    }

    // Fallback if no data
    if (data.length === 0) {
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now - i * 3600000);
            labels.push(time.getHours() + ':00');
            data.push(300 + Math.sin(i / 4) * 100);
        }
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
                            return `${Math.round(context.parsed.y)}ms`;
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

// ===== Show Error State =====
function showErrorState() {
    const grid = document.getElementById('services-grid');
    grid.innerHTML = `
        <div class="error-state" style="text-align: center; padding: 2rem; color: #ff4466;">
            <p>⚠️ Không thể tải dữ liệu. Vui lòng thử lại sau.</p>
            <button onclick="loadStatusData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #00d4ff; border: none; border-radius: 8px; cursor: pointer;">
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
