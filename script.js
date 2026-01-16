// Configuration
const API_URL = 'http://localhost:3000/api';
const REFRESH_INTERVAL = 5000; // 5 seconds
let autoRefresh = true;
let updates = [];
let currentMacro = null;
let allMacros = [];

// DOM Elements
const macroSelect = document.getElementById('macroSelect');
const updatesContainer = document.getElementById('updatesContainer');
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const autoRefreshToggle = document.getElementById('autoRefresh');
const updateCountEl = document.getElementById('updateCount');
const lastUpdateEl = document.getElementById('lastUpdate');
const toastContainer = document.getElementById('toastContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMacros();
    setupEventListeners();
    setupAutoRefresh();
});

function setupEventListeners() {
    macroSelect.addEventListener('change', (e) => {
        currentMacro = e.target.value;
        loadUpdates();
    });

    refreshBtn.addEventListener('click', () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
        loadUpdates().finally(() => {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh';
        });
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all updates?')) {
            clearUpdates();
        }
    });

    autoRefreshToggle.addEventListener('change', (e) => {
        autoRefresh = e.target.checked;
        if (autoRefresh) {
            setupAutoRefresh();
            showToast('Auto-refresh enabled', 'success');
        } else {
            showToast('Auto-refresh disabled', 'info');
        }
    });
}

function setupAutoRefresh() {
    if (autoRefresh) {
        setInterval(() => {
            if (currentMacro) {
                loadUpdates();
            }
        }, REFRESH_INTERVAL);
    }
}

async function loadMacros() {
    try {
        const response = await fetch(`${API_URL}/macros`);
        if (!response.ok) throw new Error('Failed to fetch macros');

        allMacros = await response.json();

        // Populate select dropdown
        macroSelect.innerHTML = '';
        if (allMacros.length === 0) {
            macroSelect.innerHTML = '<option value="">No macros configured</option>';
        } else {
            allMacros.forEach(macro => {
                const option = document.createElement('option');
                option.value = macro;
                option.textContent = macro;
                macroSelect.appendChild(option);
            });
            // Select first macro by default
            currentMacro = allMacros[0];
            macroSelect.value = currentMacro;
            loadUpdates();
        }
    } catch (error) {
        console.error('Error loading macros:', error);
        macroSelect.innerHTML = '<option value="">Error loading macros</option>';
    }
}

async function loadUpdates() {
    if (!currentMacro) return;

    try {
        const response = await fetch(`${API_URL}/updates/${currentMacro}`);
        if (!response.ok) throw new Error('Failed to fetch updates');

        updates = await response.json();
        renderUpdates();
        updateStatusBar();
    } catch (error) {
        console.error('Error loading updates:', error);
        showToast('Error loading updates: ' + error.message, 'error');
        if (updates.length === 0) {
            updatesContainer.innerHTML = `
                <div class="error-message">
                    <p>Cannot connect to server</p>
                    <p class="error-details">Make sure the server is running on port 3000</p>
                </div>
            `;
        }
    }
}

function renderUpdates() {
    if (updates.length === 0) {
        updatesContainer.innerHTML = `
            <div class="empty-message">
                <p>No macro updates yet</p>
                <p class="empty-details">Updates will appear here when the macro runs</p>
            </div>
        `;
        return;
    }

    updatesContainer.innerHTML = updates.map(update => createUpdateCard(update)).join('');
}

function createUpdateCard(update) {
    const date = new Date(update.timestamp);
    const timeStr = date.toLocaleTimeString();
    const dateStr = date.toLocaleDateString();

    // If the update has embeds (Discord embeds)
    if (update.embeds && update.embeds.length > 0) {
        return createEmbedCard(update, timeStr, dateStr);
    }

    // Simple text update
    return `
        <div class="update-card">
            <div class="card-header">
                <div class="card-title">
                    <span class="author-badge">${escapeHtml(update.author)}</span>
                    <span class="timestamp" title="${dateStr}">${timeStr}</span>
                </div>
            </div>
            <div class="card-content">
                <p>${escapeHtml(update.content) || 'Macro execution update'}</p>
            </div>
        </div>
    `;
}

function createEmbedCard(update, timeStr, dateStr) {
    const embed = update.embeds[0];
    const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865F2';

    let embedHtml = `
        <div class="update-card embed-card" style="border-left: 4px solid ${color}">
            <div class="card-header">
                <div class="card-title">
                    <span class="author-badge">${escapeHtml(update.author)}</span>
                    <span class="timestamp" title="${dateStr}">${timeStr}</span>
                </div>
            </div>
            <div class="card-content embed-content">
    `;

    // Embed title
    if (embed.title) {
        embedHtml += `<h3 class="embed-title">${escapeHtml(embed.title)}</h3>`;
    }

    // Embed description
    if (embed.description) {
        embedHtml += `<p class="embed-description">${escapeHtml(embed.description)}</p>`;
    }

    // Embed fields
    if (embed.fields && embed.fields.length > 0) {
        embedHtml += '<div class="embed-fields">';
        embed.fields.forEach(field => {
            embedHtml += `
                <div class="embed-field ${field.inline ? 'inline' : ''}">
                    <div class="field-name">${escapeHtml(field.name)}</div>
                    <div class="field-value">${escapeHtml(field.value)}</div>
                </div>
            `;
        });
        embedHtml += '</div>';
    }

    // Embed thumbnail
    if (embed.thumbnail) {
        embedHtml += `<img src="${embed.thumbnail.url}" alt="thumbnail" class="embed-thumbnail" loading="lazy">`;
    }

    // Embed image
    if (embed.image) {
        embedHtml += `<img src="${embed.image.url}" alt="image" class="embed-image" loading="lazy">`;
    }

    embedHtml += `
            </div>
        </div>
    `;

    return embedHtml;
}

function updateStatusBar() {
    updateCountEl.textContent = updates.length;
    if (updates.length > 0) {
        const lastUpdate = new Date(updates[0].timestamp);
        lastUpdateEl.textContent = lastUpdate.toLocaleTimeString();
    } else {
        lastUpdateEl.textContent = 'Never';
    }
}

async function clearUpdates() {
    if (!currentMacro) return;

    try {
        const response = await fetch(`${API_URL}/clear/${currentMacro}`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to clear updates');

        updates = [];
        renderUpdates();
        updateStatusBar();
        showToast('All updates cleared', 'success');
    } catch (error) {
        console.error('Error clearing updates:', error);
        showToast('Error clearing updates: ' + error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
