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
                document.getElementById('settingsCustomDomains').value = appConfig.custom_domains.join(', ');
            }
        } catch(e) {
            console.error("Failed to load config", e);
        }
    }

    let allMangas = [];

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const domainsRaw = document.getElementById('settingsCustomDomains').value;
        const domainsArray = domainsRaw.split(',').map(s => {
            let domain = s.trim().toLowerCase();
            if (domain) {
                try {
                    // This automatically converts Thai/IDN domains to Punycode (xn--...)
                    domain = new URL('http://' + domain).hostname;
                } catch(e) {}
            }
            return domain;
        }).filter(s => s);
        
        appConfig.custom_domains = domainsArray;

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
                    domains: domainsArray
                }, "*");
            } else {
                alert("Failed to save settings");
            }
        } catch(e) {
            console.error("Save config error", e);
            alert("Error saving settings");
        }
    });

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
                    <div class="manga-source">${m.source}</div>
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

    loadManga();
});
