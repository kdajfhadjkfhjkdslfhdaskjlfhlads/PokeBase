const API = '';

function getToken() {
    return localStorage.getItem('pokebase_token');
}

function setToken(token) {
    localStorage.setItem('pokebase_token', token);
}

function clearToken() {
    localStorage.removeItem('pokebase_token');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showError(msg) {
    const el = document.getElementById('error-msg');
    if (el) {
        el.textContent = msg;
        el.classList.add('show');
    }
}

function hideError() {
    const el = document.getElementById('error-msg');
    if (el) el.classList.remove('show');
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    if (token) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = 'Bearer ' + token;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.body = JSON.stringify(options.body);
        options.headers = options.headers || {};
        options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API + url, options);
    if (res.status === 401) {
        clearToken();
        window.location.href = '/login.html';
        return;
    }
    return res;
}

async function signup() {
    hideError();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !email || !password) {
        return showError('All fields are required');
    }
    if (password.length < 6) {
        return showError('Password must be at least 6 characters');
    }

    try {
        const res = await fetch(API + '/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) return showError(data.detail || 'Signup failed');
        setToken(data.access_token);
        window.location.href = '/dashboard.html';
    } catch (e) {
        showError('Network error. Is the server running?');
    }
}

async function login() {
    hideError();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        return showError('Username and password are required');
    }

    try {
        const res = await fetch(API + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) return showError(data.detail || 'Login failed');
        setToken(data.access_token);
        window.location.href = '/dashboard.html';
    } catch (e) {
        showError('Network error. Is the server running?');
    }
}

function logout() {
    clearToken();
    window.location.href = '/';
}

function openFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'flex';
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').style.display = 'none';
    document.getElementById('feedback-text').value = '';
}

async function submitFeedback() {
    const text = document.getElementById('feedback-text').value.trim();
    if (!text) return showToast('Please enter your feedback');

    try {
        const res = await apiFetch('/feedback', { method: 'POST', body: { message: text } });
        if (res && res.ok) {
            showToast('Feedback submitted! Thank you.');
            closeFeedbackModal();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to submit feedback');
        }
    } catch (e) {
        showToast('Network error');
    }
}

async function getUnreadCount() {
    if (!getToken()) return 0;
    try {
        const res = await apiFetch('/chat/unread/count');
        if (res && res.ok) {
            const data = await res.json();
            return data.unread_count;
        }
    } catch (e) {}
    return 0;
}

function updateNav() {
    const nav = document.getElementById('nav-links');
    if (!nav) return;
    const token = getToken();
    if (token) {
        nav.innerHTML = `
            <a href="/">Home</a>
            <a href="/dashboard.html">My Collection</a>
            <a href="/chat.html">Chat <span id="unread-badge" class="unread-badge" style="display:none;">0</span></a>
            <button onclick="openFeedbackModal()">Feedback</button>
            <button onclick="logout()">Logout</button>
        `;
        updateUnreadBadge();
    } else {
        nav.innerHTML = `
            <a href="/">Home</a>
            <a href="/login.html">Log In</a>
            <a href="/signup.html">Sign Up</a>
        `;
    }
}

async function updateUnreadBadge() {
    const count = await getUnreadCount();
    const badge = document.getElementById('unread-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
}

function renderFeedbackModal() {
    if (document.getElementById('feedback-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'feedback-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Send Feedback</h2>
            <p class="modal-subtitle">Tell us what you think or report a bug</p>
            <textarea id="feedback-text" placeholder="Your feedback..." rows="5"></textarea>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="submitFeedback()">Submit</button>
                <button class="btn btn-secondary" onclick="closeFeedbackModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFeedbackModal();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderFeedbackModal();
});
