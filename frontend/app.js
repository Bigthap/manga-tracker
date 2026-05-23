document.addEventListener('DOMContentLoaded', async () => {
    loadConfig();
    
    // Navigation
    const navLibrary = document.getElementById('nav-library');
    const navSettings = document.getElementById('nav-settings');
    const mobNavLibrary = document.getElementById('mob-nav-library');
    const mobNavSettings = document.getElementById('mob-nav-settings');
    
    const viewLibrary = document.getElementById('library-view');
    const viewSettings = document.getElementById('settings-view');
    const pageTitle = document.getElementById('page-title');

    function switchTab(tab) {
        if (tab === 'library') {
            navLibrary.classList.add('active');
            navSettings.classList.remove('active');
            mobNavLibrary.classList.add('active');
            mobNavSettings.classList.remove('active');
            viewLibrary.classList.add('active');
            viewSettings.classList.remove('active');
            pageTitle.textContent = 'Library';
            document.querySelector('.search-container').style.display = 'block';
            loadManga();
        } else {
            navSettings.classList.add('active');
            navLibrary.classList.remove('active');
            mobNavSettings.classList.add('active');
            mobNavLibrary.classList.remove('active');
            viewSettings.classList.add('active');
            viewLibrary.classList.remove('active');
            pageTitle.textContent = 'Settings';
            document.querySelector('.search-container').style.display = 'none';
        }
    }

    navLibrary.addEventListener('click', (e) => { e.preventDefault(); switchTab('library'); });
    mobNavLibrary.addEventListener('click', (e) => { e.preventDefault(); switchTab('library'); });
    
    navSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab('settings'); });
    mobNavSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab('settings'); });



    let deleteTarget = null;
    let appConfig = null; // Store loaded config

    async function loadLibrary() {
        try {
            const res = await fetch('/api/manga');
            const data = await res.json();
            renderGrid(data || []);
        } catch(e) {
            console.error("Failed to load manga", e);
        }
    }

    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            appConfig = await res.json();
            document.getElementById('api-key-instruction').innerText = appConfig.api_key;
            
            if (appConfig.custom_domains) {
                customDomains = appConfig.custom_domains;
                renderTags();
            }
        } catch(e) {
            console.error("Failed to load config", e);
        }
    }

    let allMangas = [];

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        appConfig.custom_domains = customDomains;

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + appConfig.api_key
                },
                body: JSON.stringify(appConfig)
            });

            if (res.ok) {
                const saveStatus = document.getElementById('saveStatus');
                saveStatus.style.opacity = '1';
                setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
                
                // Notify extension to update its storage instantly
                window.postMessage({
                    action: "UPDATE_CUSTOM_DOMAINS",
                    domains: customDomains
                }, "*");
            } else {
                alert("Failed to save settings");
            }
        } catch(e) {
            console.error("Save config error", e);
            alert("Error saving settings");
        }
    });

    // --- Domain Tag Input Logic ---
    let customDomains = [];
    const domainTagsContainer = document.getElementById('domain-tags');
    const domainInput = document.getElementById('domain-input');

    function renderTags() {
        domainTagsContainer.innerHTML = '';
        customDomains.forEach((domain, index) => {
            const tag = document.createElement('div');
            tag.style.cssText = 'background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.5); padding: 4px 10px; border-radius: 16px; display: flex; align-items: center; gap: 6px; font-size: 0.9em;';
            
            const text = document.createElement('span');
            text.textContent = domain;
            
            const removeBtn = document.createElement('span');
            removeBtn.textContent = '×';
            removeBtn.style.cssText = 'cursor: pointer; font-weight: bold; color: #ef4444; margin-left: 4px;';
            removeBtn.onclick = () => {
                customDomains.splice(index, 1);
                renderTags();
            };

            tag.appendChild(text);
            tag.appendChild(removeBtn);
            domainTagsContainer.appendChild(tag);
        });
    }

    function addDomain(inputVal) {
        let val = inputVal.trim().toLowerCase();
        if (!val) return;
        
        try {
            // If the user pastes a full URL (e.g. https://kurotoon.com/read/...)
            // new URL() will extract just the hostname.
            // If they just type "kurotoon.com", we prepend http:// so new URL can parse it
            const urlObj = val.startsWith('http') ? new URL(val) : new URL('http://' + val);
            let hostname = urlObj.hostname;
            
            if (hostname && !customDomains.includes(hostname)) {
                customDomains.push(hostname);
                renderTags();
            }
        } catch(e) {
            console.error("Invalid URL/Domain", e);
        }
    }

    domainInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDomain(domainInput.value);
            domainInput.value = '';
        }
    });

    domainInput.addEventListener('paste', (e) => {
        // Optional: wait for paste to complete, then process it automatically
        setTimeout(() => {
            if (domainInput.value.includes('http') || domainInput.value.includes('/')) {
                addDomain(domainInput.value);
                domainInput.value = '';
            }
        }, 50);
    });
    // ------------------------------

    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!query) {
            renderManga(allMangas);
            return;
        }
        const filtered = allMangas.filter(m => m.title.toLowerCase().includes(query) || m.source.toLowerCase().includes(query));
        renderManga(filtered);
    });

    // Load Manga
    async function loadManga() {
        renderSkeletons();
        try {
            const res = await fetch('/api/manga');
            if (res.ok) {
                allMangas = await res.json();
                const query = document.getElementById('search-input').value.toLowerCase();
                if (query) {
                    const filtered = allMangas.filter(m => m.title.toLowerCase().includes(query) || m.source.toLowerCase().includes(query));
                    renderManga(filtered);
                } else {
                    renderManga(allMangas);
                }
            }
        } catch (e) {
            console.error("Failed to load manga", e);
        }
    }

    function renderSkeletons() {
        const grid = document.getElementById('manga-grid');
        grid.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            grid.innerHTML += `<div class="skeleton-card"></div>`;
        }
    }

    function renderManga(mangas) {
        const grid = document.getElementById('manga-grid');
        grid.innerHTML = '';
        
        document.getElementById('stat-total').textContent = mangas.length;

        mangas.forEach((m, index) => {
            const card = document.createElement('div');
            card.className = 'manga-card glass';
            
            const defaultCover = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">No Cover</text></svg>');
            const coverSrc = m.coverPath ? m.coverPath : defaultCover;

            let displayChap = m.lastReadChapter;
            if(!displayChap.toLowerCase().includes('chapter') && !displayChap.includes('ตอน')) {
                displayChap = "Chapter " + displayChap;
            }

            const resumeUrl = m.lastChapterUrl || m.mainUrl || '#';
            const pinIcon = m.isPinned ? '📌' : '📍';
            const pinClass = m.isPinned ? 'pinned' : '';

            // Format time ago
            let timeStr = "";
            if (m.lastReadAt) {
                const date = new Date(m.lastReadAt.replace(' ', 'T') + 'Z');
                if (!isNaN(date)) {
                    const seconds = Math.floor((new Date() - date) / 1000);
                    let interval = seconds / 31536000;
                    if (interval > 1) timeStr = Math.floor(interval) + " years ago";
                    else {
                        interval = seconds / 2592000;
                        if (interval > 1) timeStr = Math.floor(interval) + " months ago";
                        else {
                            interval = seconds / 86400;
                            if (interval > 1) timeStr = Math.floor(interval) + " days ago";
                            else {
                                interval = seconds / 3600;
                                if (interval > 1) timeStr = Math.floor(interval) + " hrs ago";
                                else {
                                    interval = seconds / 60;
                                    if (interval > 1) timeStr = Math.floor(interval) + " mins ago";
                                    else timeStr = "Just now";
                                }
                            }
                        }
                    }
                }
            }

            card.innerHTML = `
                <img src="${coverSrc}" class="manga-cover" alt="Cover" loading="lazy" onerror="this.src='${defaultCover}'">
                
                <a href="${resumeUrl}" target="_blank" class="fab-resume" title="Resume Reading">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </a>
                
                <div class="card-actions">
                    <button class="action-btn ${pinClass}" onclick="pinManga(${m.id})" title="Pin/Unpin">${pinIcon}</button>
                    <button class="action-btn delete-btn" onclick="deleteManga(${m.id}, '${m.title.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
                </div>

                <div class="card-overlay">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="manga-source">${m.source}</div>
                        ${timeStr ? `<div style="font-size: 0.7em; opacity: 0.7; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 10px;">🕒 ${timeStr}</div>` : ''}
                    </div>
                    <div class="manga-title" title="${m.title}">${m.title}</div>
                    <div class="manga-chapter">${displayChap}</div>
                </div>
            `;
            grid.appendChild(card);
            
            // Trigger animation
            setTimeout(() => card.classList.add('active'), index * 50);
        });
    }

    window.pinManga = async (id) => {
        try {
            await fetch('/api/pin', {
                method: 'POST',
                body: JSON.stringify({id: id})
            });
            loadManga();
        } catch (e) {
            console.error(e);
        }
    };

    window.deleteManga = async (id, title) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
        try {
            await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({id: id})
            });
            loadManga();
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-refresh when switching back to this tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && document.getElementById('library-view').classList.contains('active')) {
            loadManga();
        }
    });

    loadManga();
});
