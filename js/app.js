let allCards = [];

// ==================== SEO HELPERS ====================

function setSEO({ title, description, url, image }) {
    if (title) {
        document.title = title + ' - PokeBase';
        const ogTitle = document.getElementById('og-title');
        const twTitle = document.getElementById('tw-title');
        if (ogTitle) ogTitle.content = title + ' - PokeBase';
        if (twTitle) twTitle.content = title + ' - PokeBase';
    }
    if (description) {
        const metaDesc = document.getElementById('meta-description');
        const ogDesc = document.getElementById('og-description');
        const twDesc = document.getElementById('tw-description');
        if (metaDesc) metaDesc.content = description;
        if (ogDesc) ogDesc.content = description;
        if (twDesc) twDesc.content = description;
    }
    if (url) {
        const canonical = document.getElementById('canonical-url');
        const ogUrl = document.getElementById('og-url');
        if (canonical) canonical.href = url;
        if (ogUrl) ogUrl.content = url;
    }
    if (image) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        const twImage = document.querySelector('meta[name="twitter:image"]');
        if (ogImage) ogImage.content = image;
        if (twImage) twImage.content = image;
    }
}

function setStructuredData(data) {
    const el = document.getElementById('structured-data');
    if (el) el.textContent = JSON.stringify(data);
}

// ==================== CARD RENDERING ====================

function previewImage() {
    const url = document.getElementById('image_url').value;
    const preview = document.getElementById('image-preview');
    if (url) {
        preview.src = url;
        preview.style.display = 'block';
        preview.onerror = () => preview.style.display = 'none';
    } else {
        preview.style.display = 'none';
    }
}

function renderCard(card, showActions = true) {
    const holoClass = card.is_holo ? 'holo-card' : card.is_foil ? 'foil-card' : '';
    const rarityClass = card.rarity ? 'rarity-' + card.rarity.toLowerCase().replace(' ', '-') : '';

    return `
        <div class="pokemon-card ${holoClass}" data-id="${card.id}">
                ${card.image_url
                    ? `<img class="card-image" src="${card.image_url}" alt="${card.name} Pokemon card ${card.set_name ? 'from ' + card.set_name : ''} ${card.rarity ? '(' + card.rarity + ')' : ''}" loading="lazy" onerror="this.outerHTML='<div class=card-placeholder>?</div>'">`
                    : '<div class="card-placeholder">?</div>'
            }
            <div class="card-info">
                <div class="card-name">${card.name}</div>
                <div class="card-dex">#${String(card.pokedex_number).padStart(3, '0')}${card.collector_number ? ' · ' + card.collector_number : ''}${card.set_name ? ' - ' + card.set_name : ''}</div>
                <div class="card-meta">
                    ${card.rarity ? `<span class="badge ${rarityClass}">${card.rarity}</span>` : ''}
                    ${card.condition ? `<span class="badge">${card.condition}</span>` : ''}
                    ${card.is_holo ? '<span class="badge holo">Holo</span>' : ''}
                    ${card.is_foil ? '<span class="badge foil">Foil</span>' : ''}
                    ${card.grade ? `<span class="badge">${card.grade}</span>` : ''}
                    ${card.year ? `<span class="badge">${card.year}</span>` : ''}
                </div>
                <div class="card-value">$${(card.market_value * card.quantity).toFixed(2)}</div>
                <div class="card-qty">${card.quantity > 1 ? 'Qty: ' + card.quantity : ''}</div>
                ${card.notes ? `<div class="card-qty" style="margin-top:6px;font-style:italic;">${card.notes}</div>` : ''}
            </div>
            ${showActions ? `
                <div class="card-actions">
                    <a href="/edit.html?id=${card.id}" class="btn btn-secondary btn-small">Edit</a>
                    <button class="btn btn-danger btn-small" onclick="deleteCard(${card.id})">Delete</button>
                </div>
            ` : ''}
        </div>
    `;
}

function renderCards(cards) {
    const grid = document.getElementById('card-grid') || document.getElementById('share-card-grid');
    const empty = document.getElementById('empty-state');
    if (!grid) return;

    if (cards.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = cards.map(c => renderCard(c)).join('');
}

// ==================== DASHBOARD ====================

function filterCards() {
    const search = document.getElementById('search').value.toLowerCase();
    const holoFilter = document.getElementById('filter-holo').value;
    const rarityFilter = document.getElementById('filter-rarity').value;

    let filtered = allCards.filter(c => {
        const matchSearch = !search ||
            c.name.toLowerCase().includes(search) ||
            String(c.pokedex_number).includes(search) ||
            (c.collector_number && c.collector_number.includes(search));
        const matchHolo = !holoFilter ||
            (holoFilter === 'holo' && c.is_holo) ||
            (holoFilter === 'foil' && c.is_foil) ||
            (holoFilter === 'normal' && !c.is_holo && !c.is_foil);
        const matchRarity = !rarityFilter || c.rarity === rarityFilter;
        return matchSearch && matchHolo && matchRarity;
    });

    renderCards(filtered);
}

async function loadDashboard() {
    try {
        const res = await apiFetch('/cards');
        if (!res) return;
        allCards = await res.json();
        allCards.sort((a, b) => a.pokedex_number - b.pokedex_number);
        renderCards(allCards);

        const statsRes = await apiFetch('/cards/stats');
        if (statsRes) {
            const stats = await statsRes.json();
            document.getElementById('stat-total').textContent = stats.total_cards;
            document.getElementById('stat-unique').textContent = stats.unique_pokemon;
            document.getElementById('stat-value').textContent = '$' + stats.total_value.toFixed(2);
            document.getElementById('stat-holo').textContent = stats.holo_count + stats.foil_count;
        }

        const meRes = await apiFetch('/me');
        if (meRes) {
            const me = await meRes.json();
            document.getElementById('greeting').textContent = me.username + "'s Collection";
            document.getElementById('subtitle').textContent = allCards.length + ' unique cards in your collection';

            const toggle = document.getElementById('public-toggle');
            if (toggle) {
                toggle.checked = me.is_public;
                toggle.addEventListener('change', togglePublic);
            }
            const adminLink = document.getElementById('admin-link');
            if (adminLink && me.is_admin) {
                adminLink.style.display = 'inline';
            }
        }
    } catch (e) {
        console.error('Failed to load dashboard:', e);
    }
}

async function togglePublic() {
    try {
        const res = await apiFetch('/users/public', { method: 'PUT' });
        if (res && res.ok) {
            const data = await res.json();
            showToast(data.is_public ? 'Collection is now public' : 'Collection is now private');
        }
    } catch (e) {
        showToast('Failed to update visibility');
    }
}

// ==================== CARD CRUD ====================

async function addCard() {
    const dexVal = document.getElementById('pokedex_number').value.trim();
    const card = {
        pokedex_number: dexVal ? parseInt(dexVal) : 0,
        name: document.getElementById('name').value.trim(),
        collector_number: document.getElementById('collector_number')?.value.trim() || '',
        image_url: document.getElementById('image_url').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        rarity: document.getElementById('rarity').value,
        set_name: document.getElementById('set_name').value.trim(),
        condition: document.getElementById('condition').value,
        year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
        market_value: parseFloat(document.getElementById('market_value').value) || 0,
        notes: document.getElementById('notes').value.trim(),
        date_acquired: document.getElementById('date_acquired').value,
        grade: document.getElementById('grade').value.trim(),
        is_foil: document.getElementById('is_foil').checked,
        is_holo: document.getElementById('is_holo').checked,
    };

    if (!card.name) {
        return showToast('Pokemon name is required');
    }

    try {
        const res = await apiFetch('/cards', { method: 'POST', body: card });
        if (res && res.ok) {
            showToast('Card added!');
            setTimeout(() => window.location.href = '/dashboard.html', 500);
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to add card');
        }
    } catch (e) {
        showToast('Network error');
    }
}

async function loadCardForEdit() {
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('id');
    if (!cardId) return window.location.href = '/dashboard.html';

    try {
        const res = await apiFetch('/cards');
        if (!res) return;
        const cards = await res.json();
        const card = cards.find(c => c.id == cardId);
        if (!card) return window.location.href = '/dashboard.html';

        document.getElementById('card-id').value = card.id;
        document.getElementById('pokedex_number').value = card.pokedex_number;
        document.getElementById('name').value = card.name;
        document.getElementById('collector_number').value = card.collector_number || '';
        document.getElementById('image_url').value = card.image_url || '';
        document.getElementById('set_name').value = card.set_name || '';
        document.getElementById('rarity').value = card.rarity || '';
        document.getElementById('condition').value = card.condition || '';
        document.getElementById('grade').value = card.grade || '';
        document.getElementById('year').value = card.year || '';
        document.getElementById('quantity').value = card.quantity;
        document.getElementById('market_value').value = card.market_value || '';
        document.getElementById('is_holo').checked = card.is_holo;
        document.getElementById('is_foil').checked = card.is_foil;
        document.getElementById('date_acquired').value = card.date_acquired || '';
        document.getElementById('notes').value = card.notes || '';

        if (card.image_url) previewImage();
    } catch (e) {
        console.error('Failed to load card:', e);
    }
}

async function updateCard() {
    const cardId = document.getElementById('card-id').value;
    const dexVal = document.getElementById('pokedex_number').value.trim();
    const card = {
        pokedex_number: dexVal ? parseInt(dexVal) : 0,
        name: document.getElementById('name').value.trim(),
        collector_number: document.getElementById('collector_number')?.value.trim() || '',
        image_url: document.getElementById('image_url').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        rarity: document.getElementById('rarity').value,
        set_name: document.getElementById('set_name').value.trim(),
        condition: document.getElementById('condition').value,
        year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
        market_value: parseFloat(document.getElementById('market_value').value) || 0,
        notes: document.getElementById('notes').value.trim(),
        date_acquired: document.getElementById('date_acquired').value,
        grade: document.getElementById('grade').value.trim(),
        is_foil: document.getElementById('is_foil').checked,
        is_holo: document.getElementById('is_holo').checked,
    };

    if (!card.name) {
        return showToast('Pokemon name is required');
    }

    try {
        const res = await apiFetch('/cards/' + cardId, { method: 'PUT', body: card });
        if (res && res.ok) {
            showToast('Card updated!');
            setTimeout(() => window.location.href = '/dashboard.html', 500);
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to update card');
        }
    } catch (e) {
        showToast('Network error');
    }
}

async function deleteCard(cardId) {
    if (!confirm('Delete this card?')) return;

    try {
        const res = await apiFetch('/cards/' + cardId, { method: 'DELETE' });
        if (res && res.ok) {
            showToast('Card deleted');
            document.querySelector(`.pokemon-card[data-id="${cardId}"]`)?.remove();
        }
    } catch (e) {
        showToast('Failed to delete card');
    }
}

// ==================== SHARING ====================

async function shareCollection() {
    try {
        const meRes = await apiFetch('/me');
        if (!meRes) return;
        const me = await meRes.json();

        const res = await apiFetch('/share/link/' + me.username);
        if (!res) return;
        const data = await res.json();

        const fullUrl = window.location.origin + data.share_link;
        await navigator.clipboard.writeText(fullUrl);
        showToast('Share link copied to clipboard!');
    } catch (e) {
        showToast('Failed to generate share link');
    }
}

async function loadSharedCollection() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('data');

    if (encoded) {
        try {
            const decoded = JSON.parse(atob(encoded));
            document.getElementById('share-username').textContent = decoded.username + "'s Collection";
            document.getElementById('share-subtitle').textContent = 'Shared collection - ' + decoded.total_cards + ' cards';

            setSEO({
                title: decoded.username + "'s Shared Pokemon Collection",
                description: `Check out ${decoded.username}'s shared Pokemon card collection. ${decoded.total_cards} cards worth $${decoded.total_value.toFixed(2)}.`,
                url: window.location.href,
            });
            document.getElementById('share-total').textContent = decoded.total_cards;
            document.getElementById('share-value').textContent = '$' + decoded.total_value.toFixed(2);

            const uniquePokedex = new Set(decoded.cards.map(c => c.pokedex_number));
            document.getElementById('share-unique').textContent = uniquePokedex.size;

            const grid = document.getElementById('share-card-grid');
            const empty = document.getElementById('empty-state');
            if (decoded.cards.length === 0) {
                if (empty) empty.style.display = 'block';
            } else {
                if (empty) empty.style.display = 'none';
                grid.innerHTML = decoded.cards.map(c => renderCard(c, false)).join('');
            }
        } catch (e) {
            console.error('Failed to parse share data:', e);
        }
        return;
    }

    const username = window.location.pathname.split('/').pop();
    if (!username) return;

    try {
        const res = await fetch(API + '/share/' + username);
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('share-username').textContent = data.username + "'s Collection";
        document.getElementById('share-subtitle').textContent = data.total_cards + ' cards';

        setSEO({
            title: data.username + "'s Shared Pokemon Collection",
            description: `Check out ${data.username}'s shared Pokemon card collection. ${data.total_cards} cards worth $${data.total_value.toFixed(2)}.`,
            url: window.location.href,
        });
        document.getElementById('share-total').textContent = data.total_cards;
        document.getElementById('share-value').textContent = '$' + data.total_value.toFixed(2);

        const uniquePokedex = new Set(data.cards.map(c => c.pokedex_number));
        document.getElementById('share-unique').textContent = uniquePokedex.size;

        const grid = document.getElementById('share-card-grid');
        const empty = document.getElementById('empty-state');
        if (data.cards.length === 0) {
            if (empty) empty.style.display = 'block';
        } else {
            if (empty) empty.style.display = 'none';
            grid.innerHTML = data.cards.map(c => renderCard(c, false)).join('');
        }
    } catch (e) {
        console.error('Failed to load shared collection:', e);
    }
}

// ==================== HOME FEED ====================

let currentFeedPage = 1;
let currentFeedSearch = '';
let currentFeedTrending = false;

async function loadHomeFeed(page = 1, search = '', trending = false) {
    currentFeedPage = page;
    currentFeedSearch = search;
    currentFeedTrending = trending;

    const grid = document.getElementById('home-grid');
    const empty = document.getElementById('empty-state');
    const pagination = document.getElementById('pagination');
    if (!grid) return;

    grid.innerHTML = '<div class="loading-text">Loading collections...</div>';

    try {
        let url = `/collections/public?page=${page}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (trending) url += '&trending=1';

        const res = await fetch(API + url);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();

        if (data.collections.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            if (pagination) pagination.innerHTML = '';
            return;
        }

        if (empty) empty.style.display = 'none';

        grid.innerHTML = data.collections.map(c => `
            <div class="collection-card" onclick="window.location.href='/profile.html?user=${c.username}'">
                <div class="collection-card-header">
                    <div class="collection-avatar">${c.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="collection-username">${c.username}</div>
                        <div class="collection-meta">${c.card_count} cards · ${c.unique_pokemon} unique</div>
                    </div>
                </div>
                <div class="collection-card-stats">
                    <span class="collection-stat"><strong>$${c.total_value.toFixed(2)}</strong> value</span>
                    <span class="collection-stat">⭐ ${c.average_stars}</span>
                    <span class="collection-stat">❤️ ${c.like_count}</span>
                    ${c.holo_count > 0 ? `<span class="collection-stat holo-stat">✦ ${c.holo_count} holo</span>` : ''}
                </div>
                <div class="collection-card-cards">
                    ${c.top_cards.map(tc => `
                        <div class="mini-card">
                            ${tc.image_url
                                ? `<img src="${tc.image_url}" alt="${tc.name} Pokemon card" loading="lazy" onerror="this.outerHTML='<div class=mini-card-placeholder>?</div>'">`
                                : '<div class="mini-card-placeholder">?</div>'
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        if (pagination) {
            let paginationHtml = '';
            for (let i = 1; i <= data.pages; i++) {
                paginationHtml += `<button class="btn btn-small ${i === data.page ? 'btn-primary' : 'btn-secondary'}" onclick="loadHomeFeed(${i}, '${currentFeedSearch}', ${currentFeedTrending})">${i}</button>`;
            }
            pagination.innerHTML = paginationHtml;
        }
    } catch (e) {
        grid.innerHTML = '<div class="loading-text">Failed to load collections</div>';
        console.error(e);
    }
}

function searchHomeFeed() {
    const search = document.getElementById('home-search').value.trim();
    loadHomeFeed(1, search, currentFeedTrending);
}

function toggleTrending() {
    currentFeedTrending = !currentFeedTrending;
    const btn = document.getElementById('trending-btn');
    if (btn) btn.classList.toggle('active', currentFeedTrending);
    loadHomeFeed(1, currentFeedSearch, currentFeedTrending);
}

// ==================== PROFILE PAGE ====================

async function loadProfile() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('user');
    if (!username) {
        window.location.href = '/';
        return;
    }

    try {
        const res = await fetch(API + '/share/' + username);
        if (!res.ok) {
            document.getElementById('profile-content').innerHTML = '<div class="empty-state"><h2>User not found</h2></div>';
            return;
        }
        const data = await res.json();

        document.getElementById('profile-username').textContent = data.username;
        document.title = data.username + "'s Collection - PokeBase";

        setSEO({
            title: data.username + "'s Pokemon Card Collection",
            description: `View ${data.username}'s Pokemon card collection on PokeBase. ${data.total_cards} cards worth $${data.total_value.toFixed(2)} with ${stats ? stats.unique_pokemon : '?'} unique Pokemon.`,
            url: window.location.href,
        });

        setStructuredData({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": data.username + "'s Pokemon Card Collection",
            "description": `View ${data.username}'s Pokemon card collection. ${data.total_cards} cards worth $${data.total_value.toFixed(2)}.`,
            "url": window.location.href,
            "isPartOf": {
                "@type": "WebSite",
                "name": "PokeBase",
                "url": "https://pokebase.online"
            },
            "author": {
                "@type": "Person",
                "name": data.username
            }
        });

        const statsRes = await fetch(API + '/collections/public?search=' + encodeURIComponent(username));
        let stats = null;
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            stats = statsData.collections.find(c => c.username === username);
        }

        if (stats) {
            document.getElementById('profile-total').textContent = data.total_cards;
            document.getElementById('profile-value').textContent = '$' + data.total_value.toFixed(2);
            document.getElementById('profile-unique').textContent = stats.unique_pokemon;
            document.getElementById('profile-stars').textContent = stats.average_stars;
            document.getElementById('profile-likes').textContent = stats.like_count;
        }

        const grid = document.getElementById('profile-card-grid');
        const empty = document.getElementById('profile-empty');
        if (data.cards.length === 0) {
            if (empty) empty.style.display = 'block';
        } else {
            if (empty) empty.style.display = 'none';
            grid.innerHTML = data.cards.map(c => renderCard(c, false)).join('');
        }

        if (getToken()) {
            const meRes = await apiFetch('/me');
            if (meRes && meRes.ok) {
                const me = await meRes.json();
                if (me.username !== username) {
                    document.getElementById('profile-actions').style.display = 'flex';
                    document.getElementById('chat-btn').onclick = () => window.location.href = `/chat.html?user=${username}`;
                    document.getElementById('report-btn').onclick = () => openReportModal(username);
                }
            }
            loadRatingInfo(username);
        }
    } catch (e) {
        console.error('Failed to load profile:', e);
    }
}

async function loadRatingInfo(targetUsername) {
    loadProfileRating(targetUsername);
}

async function rateCollection(targetUsername, stars) {
    if (!getToken()) {
        showToast('Please log in to rate');
        return;
    }
    try {
        const res = await apiFetch(`/collections/${targetUsername}/rate`, {
            method: 'POST',
            body: { stars }
        });
        if (res && res.ok) {
            showToast('Rated ' + stars + ' stars!');
            loadProfileRating(targetUsername);
        }
    } catch (e) {
        showToast('Failed to rate');
    }
}

async function removeRating(targetUsername) {
    try {
        const res = await apiFetch(`/collections/${targetUsername}/rate`, { method: 'DELETE' });
        if (res && res.ok) {
            showToast('Rating removed');
            loadProfileRating(targetUsername);
        }
    } catch (e) {
        showToast('Failed to remove rating');
    }
}

async function toggleLikeProfile(targetUsername) {
    if (!getToken()) {
        showToast('Please log in to like');
        return;
    }
    try {
        const res = await apiFetch(`/collections/${targetUsername}/like`, { method: 'POST' });
        if (res && res.ok) {
            const data = await res.json();
            const likeBtn = document.getElementById('like-btn');
            if (likeBtn) {
                likeBtn.classList.toggle('liked', data.liked);
                likeBtn.innerHTML = data.liked ? '❤️ ' + data.like_count : '🤍 ' + data.like_count;
            }
        }
    } catch (e) {
        showToast('Failed to toggle like');
    }
}

let profileTargetUsername = null;

async function loadProfileRating(targetUsername) {
    profileTargetUsername = targetUsername;
    try {
        const res = await apiFetch(`/collections/${targetUsername}/rating`);
        if (!res || !res.ok) return;
        const data = await res.json();

        const starsContainer = document.getElementById('rating-stars');
        if (starsContainer) {
            starsContainer.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const star = document.createElement('span');
                star.className = 'rating-star' + (i <= data.my_stars ? ' active' : '');
                star.textContent = '★';
                star.onclick = () => rateCollection(targetUsername, i);
                starsContainer.appendChild(star);
            }
        }

        const avgEl = document.getElementById('rating-average');
        if (avgEl) avgEl.textContent = data.average_stars + ' (' + data.total_ratings + ' ratings)';

        const likeBtn = document.getElementById('like-btn');
        if (likeBtn) {
            likeBtn.classList.toggle('liked', data.liked);
            likeBtn.innerHTML = data.liked ? '❤️ ' + data.like_count : '🤍 ' + data.like_count;
            likeBtn.onclick = () => toggleLikeProfile(targetUsername);
        }
    } catch (e) {
        console.error('Failed to load rating:', e);
    }
}

function openReportModal(username) {
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-username').textContent = username;
    document.getElementById('report-target').value = username;
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    document.getElementById('report-reason').value = '';
    document.getElementById('report-detail').value = '';
}

async function submitReport() {
    const username = document.getElementById('report-target').value;
    const reason = document.getElementById('report-reason').value;
    const detail = document.getElementById('report-detail').value;

    if (!reason) {
        showToast('Please select a reason');
        return;
    }

    const fullReason = detail ? `${reason}: ${detail}` : reason;

    try {
        const res = await apiFetch(`/collections/${username}/report`, {
            method: 'POST',
            body: { reason: fullReason }
        });

        if (res && res.ok) {
            showToast('Report submitted. Thank you.');
            closeReportModal();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to submit report');
        }
    } catch (e) {
        showToast('Failed to submit report');
    }
}

function renderReportModal() {
    if (document.getElementById('report-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'report-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Report <span id="report-username"></span>'s Collection</h2>
            <input type="hidden" id="report-target">
            <div class="form-group">
                <label>Reason</label>
                <select id="report-reason">
                    <option value="">Select a reason...</option>
                    <option value="Inappropriate content">Inappropriate content</option>
                    <option value="Spam or fake collection">Spam or fake collection</option>
                    <option value="Offensive username">Offensive username</option>
                    <option value="Stolen images">Stolen images</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Additional details (optional)</label>
                <textarea id="report-detail" placeholder="Any additional details..." rows="3"></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="submitReport()">Submit Report</button>
                <button class="btn btn-secondary" onclick="closeReportModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeReportModal();
    });
}

// ==================== CHAT ====================

let chatTargetUserId = null;
let chatPollInterval = null;
let lastMessageCount = 0;

async function loadConversations() {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    try {
        const res = await apiFetch('/chat/conversations');
        if (!res || !res.ok) return;
        const conversations = await res.json();

        if (conversations.length === 0) {
            list.innerHTML = '<div class="empty-chat-list">No conversations yet</div>';
            return;
        }

        list.innerHTML = conversations.map(c => `
            <div class="conversation-item ${chatTargetUserId == c.user_id ? 'active' : ''}" onclick="openChat(${c.user_id}, '${c.username}')">
                <div class="conv-avatar">${c.username.charAt(0).toUpperCase()}</div>
                <div class="conv-info">
                    <div class="conv-name">${c.username}</div>
                    <div class="conv-preview">${c.last_message ? c.last_message.substring(0, 30) + (c.last_message.length > 30 ? '...' : '') : 'No messages yet'}</div>
                </div>
                ${c.unread_count > 0 ? `<span class="conv-unread">${c.unread_count}</span>` : ''}
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load conversations:', e);
    }
}

async function openChat(userId, username) {
    chatTargetUserId = userId;

    document.getElementById('chat-with-name').textContent = username;
    document.getElementById('chat-messages').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-placeholder').style.display = 'none';

    const list = document.getElementById('conversation-list');
    if (list) {
        list.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    }

    await loadMessages(userId);
    markAsRead(userId);
    loadConversations();

    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(() => {
        if (chatTargetUserId) {
            loadMessages(chatTargetUserId);
            loadConversations();
        }
    }, 3000);
}

async function loadMessages(userId) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    try {
        const res = await apiFetch(`/chat/${userId}`);
        if (!res || !res.ok) return;
        const messages = await res.json();

        if (messages.length === lastMessageCount) return;
        lastMessageCount = messages.length;

        const meRes = await apiFetch('/me');
        const me = meRes && meRes.ok ? await meRes.json() : null;

        container.innerHTML = messages.map(m => `
            <div class="chat-msg ${m.sender_id === me?.id ? 'sent' : 'received'}">
                <div class="msg-bubble">${m.message}</div>
                <div class="msg-time">${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    } catch (e) {
        console.error('Failed to load messages:', e);
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !chatTargetUserId) return;

    input.value = '';

    try {
        const res = await apiFetch(`/chat/${chatTargetUserId}`, {
            method: 'POST',
            body: { message: msg }
        });
        if (res && res.ok) {
            loadMessages(chatTargetUserId);
            loadConversations();
        }
    } catch (e) {
        showToast('Failed to send message');
    }
}

async function markAsRead(userId) {
    try {
        await apiFetch(`/chat/${userId}/read`, { method: 'PUT' });
        updateUnreadBadge();
    } catch (e) {}
}

function initChat() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('user');
    if (username) {
        apiFetch('/share/' + username).then(res => {
            if (res && res.ok) res.json().then(data => {
                if (data.cards.length > 0 || data.username) {
                    apiFetch('/chat/conversations').then(convRes => {
                        if (convRes && convRes.ok) convRes.json().then(convs => {
                            const conv = convs.find(c => c.username === username);
                            if (conv) {
                                openChat(conv.user_id, conv.username);
                            }
                        });
                    });
                }
            });
        });
    }
}

// ==================== ADMIN ====================

let adminTab = 'users';

async function loadAdminPanel() {
    loadAdminStats();
    loadAdminUsers();
}

async function loadAdminStats() {
    try {
        const res = await apiFetch('/admin/stats');
        if (!res || !res.ok) return;
        const stats = await res.json();

        document.getElementById('admin-total-users').textContent = stats.total_users;
        document.getElementById('admin-total-cards').textContent = stats.total_cards;
        document.getElementById('admin-public').textContent = stats.public_users;
        document.getElementById('admin-banned').textContent = stats.banned_users;
        document.getElementById('admin-reports').textContent = stats.pending_reports;
        document.getElementById('admin-feedback-count').textContent = stats.total_feedback;
        document.getElementById('admin-messages').textContent = stats.total_messages;
    } catch (e) {
        console.error('Failed to load admin stats:', e);
    }
}

function switchAdminTab(tab) {
    adminTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    document.querySelectorAll('.admin-panel-section').forEach(s => s.style.display = 'none');
    document.getElementById(`admin-${tab}`).style.display = 'block';

    if (tab === 'users') loadAdminUsers();
    else if (tab === 'reports') loadAdminReports();
    else if (tab === 'feedback') loadAdminFeedback();
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    try {
        const res = await apiFetch('/admin/users');
        if (!res || !res.ok) return;
        const users = await res.json();

        container.innerHTML = users.map(u => `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <strong>${u.username}</strong>
                    <span class="text-dim">${u.email}</span>
                    <span class="text-dim">${u.card_count} cards · Joined ${new Date(u.created_at).toLocaleDateString()}</span>
                </div>
                <div class="admin-user-badges">
                    ${u.is_admin ? '<span class="badge holo">Admin</span>' : ''}
                    ${u.is_public ? '<span class="badge foil">Public</span>' : ''}
                    ${u.is_banned ? '<span class="badge" style="background:rgba(255,0,110,0.3);color:#ff006e;border-color:rgba(255,0,110,0.5);">Banned</span>' : ''}
                </div>
                <div class="admin-user-actions">
                    ${!u.is_admin ? `
                        <button class="btn btn-small ${u.is_banned ? 'btn-primary' : 'btn-danger'}" onclick="adminToggleBan(${u.id})">${u.is_banned ? 'Unban' : 'Ban'}</button>
                        <button class="btn btn-small btn-danger" onclick="adminDeleteUser(${u.id}, '${u.username}')">Delete</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

async function adminToggleBan(userId) {
    try {
        const res = await apiFetch(`/admin/users/${userId}/ban`, { method: 'PUT' });
        if (res && res.ok) {
            showToast('User banned/unbanned');
            loadAdminUsers();
            loadAdminStats();
        }
    } catch (e) {
        showToast('Failed to toggle ban');
    }
}

async function adminDeleteUser(userId, username) {
    if (!confirm(`Delete user "${username}" and all their data?`)) return;
    try {
        const res = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
        if (res && res.ok) {
            showToast('User deleted');
            loadAdminUsers();
            loadAdminStats();
        }
    } catch (e) {
        showToast('Failed to delete user');
    }
}

async function loadAdminReports() {
    const container = document.getElementById('admin-reports-list');
    if (!container) return;

    try {
        const res = await apiFetch('/admin/reports');
        if (!res || !res.ok) return;
        const reports = await res.json();

        if (reports.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No reports</p></div>';
            return;
        }

        container.innerHTML = reports.map(r => `
            <div class="admin-report-row">
                <div class="admin-report-info">
                    <strong>${r.reporter_username}</strong> reported <strong>${r.target_username}</strong>
                    <span class="text-dim">${new Date(r.created_at).toLocaleDateString()}</span>
                    <p>${r.reason}</p>
                </div>
                <div class="admin-report-status">
                    <span class="badge ${r.status === 'pending' ? 'rarity-rare' : r.status === 'reviewed' ? 'rarity-uncommon' : 'rarity-common'}">${r.status}</span>
                </div>
                <div class="admin-report-actions">
                    ${r.status === 'pending' ? `
                        <button class="btn btn-small btn-primary" onclick="updateReportStatus(${r.id}, 'reviewed')">Review</button>
                        <button class="btn btn-small btn-secondary" onclick="updateReportStatus(${r.id}, 'dismissed')">Dismiss</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load reports:', e);
    }
}

async function updateReportStatus(reportId, status) {
    try {
        const res = await apiFetch(`/admin/reports/${reportId}`, {
            method: 'PUT',
            body: { status }
        });
        if (res && res.ok) {
            showToast('Report updated');
            loadAdminReports();
            loadAdminStats();
        }
    } catch (e) {
        showToast('Failed to update report');
    }
}

async function loadAdminFeedback() {
    const container = document.getElementById('admin-feedback-list');
    if (!container) return;

    try {
        const res = await apiFetch('/admin/feedback');
        if (!res || !res.ok) return;
        const items = await res.json();

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No feedback</p></div>';
            return;
        }

        container.innerHTML = items.map(f => `
            <div class="admin-feedback-row">
                <div class="admin-feedback-header">
                    <strong>${f.username}</strong>
                    <span class="text-dim">${new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                <p>${f.message}</p>
                <button class="btn btn-small btn-danger" onclick="deleteFeedback(${f.id})">Delete</button>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load feedback:', e);
    }
}

async function deleteFeedback(feedbackId) {
    try {
        const res = await apiFetch(`/admin/feedback/${feedbackId}`, { method: 'DELETE' });
        if (res && res.ok) {
            showToast('Feedback deleted');
            loadAdminFeedback();
            loadAdminStats();
        }
    } catch (e) {
        showToast('Failed to delete feedback');
    }
}
