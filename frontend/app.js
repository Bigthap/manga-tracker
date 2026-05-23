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
            card.className = `manga-card glass ${m.isPinned ? 'pinned-state' : ''}`;
            
            const defaultCover = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="#1e293b"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">No Cover</text></svg>');
            const coverSrc = m.coverPath ? m.coverPath : defaultCover;

            let displayChap = m.lastReadChapter;
            if(!displayChap.toLowerCase().includes('chapter') && !displayChap.includes('ตอน')) {
                displayChap = "Chapter " + displayChap;
            }

            const resumeUrl = m.lastChapterUrl || m.mainUrl || '#';
            const pinIcon = m.isPinned ? '📌' : '📍';
            const pinClass = m.isPinned ? 'pinned' : '';

            // Format time as DD/MM/YYYY
            let timeStr = "";
            if (m.lastReadAt) {
                const date = new Date(m.lastReadAt);
                if (!isNaN(date)) {
                    const d = String(date.getDate()).padStart(2, '0');
                    const mo = String(date.getMonth() + 1).padStart(2, '0');
                    const y = date.getFullYear();
                    timeStr = `${d}/${mo}/${y}`;
                }
            }

            card.innerHTML = `
                <img src="${coverSrc}" class="manga-cover" alt="Cover" loading="lazy" onerror="this.src='${defaultCover}'">
                
                <a href="${resumeUrl}" target="_blank" class="fab-resume" title="Resume Reading">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </a>
                
                <div class="card-actions">
                    <button class="action-btn pin-btn ${pinClass}" onclick="window.pinManga(${m.id}, this)" title="Pin/Unpin">${pinIcon}</button>
                    <button class="action-btn delete-btn" onclick="deleteManga(${m.id}, '${m.title.replace(/'/g, "\\'")}', this)" title="Delete">🗑️</button>
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

    window.pinManga = async (id, btnElement) => {
        const card = btnElement.closest('.manga-card');
        if (!card || card.dataset.isPinAnimating === "true") return;

        const isCurrentlyPinned = btnElement.classList.contains('pinned');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isCurrentlyPinned || prefersReducedMotion) {
            btnElement.disabled = true;
            try {
                const res = await fetch('/api/pin', { method: 'POST', body: JSON.stringify({id: id}) });
                if (!res.ok) throw new Error("Pin API failed");
                
                const isNowPinned = !isCurrentlyPinned;
                if (isNowPinned) {
                    card.classList.add('pinned-state');
                    btnElement.classList.add('pinned');
                    btnElement.textContent = '📌';
                } else {
                    card.classList.remove('pinned-state');
                    btnElement.classList.remove('pinned');
                    btnElement.textContent = '📍';
                }
                
                // Update local state
                const m = allMangas.find(x => x.id === id);
                if (m) m.isPinned = isNowPinned;
                
            } catch (e) {
                console.error(e);
                alert("Failed to update pin state");
            } finally {
                btnElement.disabled = false;
            }
            return;
        }

        // --- Grand Pin Animation ---
        card.dataset.isPinAnimating = "true";
        btnElement.disabled = true;

        const rect = card.getBoundingClientRect();
        card.style.opacity = '0'; // Hide original card temporarily

        const overlay = document.createElement('div');
        overlay.className = 'pin-overlay';
        document.body.appendChild(overlay);

        const wrapper = document.createElement('div');
        wrapper.className = 'pin-focus-wrapper';
        wrapper.style.setProperty('--start-left', `${rect.left}px`);
        wrapper.style.setProperty('--start-top', `${rect.top}px`);
        wrapper.style.setProperty('--start-width', `${rect.width}px`);
        wrapper.style.setProperty('--start-height', `${rect.height}px`);
        
        const clone = card.cloneNode(true);
        clone.style.opacity = '1';
        clone.style.position = 'relative';
        clone.style.margin = '0';
        clone.style.width = '100%';
        clone.style.height = '100%';
        clone.style.transform = 'none'; // reset any scaling
        
        // Remove interactive elements in clone
        clone.querySelectorAll('button, a').forEach(el => {
            el.onclick = null;
            el.style.pointerEvents = 'none';
        });

        wrapper.appendChild(clone);
        overlay.appendChild(wrapper);

        // Force reflow and add focus scale
        wrapper.offsetHeight;
        wrapper.classList.add('is-focused');

        const wait = (ms) => new Promise(res => setTimeout(res, ms));

        try {
            await wait(400); // Wait for scale up
            
            // Sword & Shockwave elements
            const sword = document.createElement('div');
            sword.innerHTML = '🗡️';
            sword.className = 'holy-sword';
            
            const shockwave = document.createElement('div');
            shockwave.className = 'holy-shockwave';
            
            wrapper.appendChild(sword);
            wrapper.appendChild(shockwave);
            
            wrapper.classList.add('is-striking');
            clone.classList.add('card-impact-shake', 'flash-impact');
            
            // Call API during impact
            const res = await fetch('/api/pin', {
                method: 'POST',
                body: JSON.stringify({id: id})
            });
            
            if (!res.ok) throw new Error("Pin API failed");

            // Wait for impact animations (strike is 0.4s + shockwave 0.6s)
            await wait(1000); 

            // Add chains visually to the clone first
            clone.classList.add('pinned-state');
            clone.querySelector('.pin-btn').classList.add('pinned');
            clone.querySelector('.pin-btn').textContent = '📌';
            
            await wait(400); // Let user see the chained card

            // Cleanup & Update Original
            overlay.remove();
            card.style.opacity = '1';
            card.classList.add('pinned-state');
            btnElement.classList.add('pinned');
            btnElement.textContent = '📌';
            
            // Update local state without full reload
            const m = allMangas.find(x => x.id === id);
            if (m) m.isPinned = true;
            
        } catch (e) {
            console.error(e);
            overlay.remove();
            card.style.opacity = '1';
            alert("Failed to pin manga");
        } finally {
            card.dataset.isPinAnimating = "false";
            btnElement.disabled = false;
        }
    };

    window.deleteManga = async (id, title, btnElement) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
        
        const card = btnElement.closest('.manga-card');
        if (!card || card.dataset.deleting === "true") return;
        
        card.dataset.deleting = "true";
        btnElement.disabled = true;

        // Check for reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            // Fallback quick delete
            try {
                await fetch('/api/delete', { method: 'POST', body: JSON.stringify({id: id}) });
                loadManga();
            } catch (e) {
                console.error(e);
                card.dataset.deleting = "false";
                btnElement.disabled = false;
            }
            return;
        }

        const rect = card.getBoundingClientRect();
        
        // Calculate target size (preserve aspect ratio)
        const targetWidth = Math.min(480, window.innerWidth * 0.88);
        const targetHeight = Math.min(targetWidth * (rect.height / rect.width), window.innerHeight * 0.8);
        const targetLeft = (window.innerWidth - targetWidth) / 2;
        const targetTop = (window.innerHeight - targetHeight) / 2;

        card.style.visibility = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'delete-overlay';
        document.body.appendChild(overlay);

        const wrapper = document.createElement('div');
        wrapper.className = 'delete-focus-wrapper';
        wrapper.style.setProperty('--start-left', `${rect.left}px`);
        wrapper.style.setProperty('--start-top', `${rect.top}px`);
        wrapper.style.setProperty('--start-width', `${rect.width}px`);
        wrapper.style.setProperty('--start-height', `${rect.height}px`);
        wrapper.style.setProperty('--target-left', `${targetLeft}px`);
        wrapper.style.setProperty('--target-top', `${targetTop}px`);
        wrapper.style.setProperty('--target-width', `${targetWidth}px`);
        wrapper.style.setProperty('--target-height', `${targetHeight}px`);
        
        // Create clones
        const clone1 = card.cloneNode(true);
        const clone2 = card.cloneNode(true);
        
        [clone1, clone2].forEach((c, idx) => {
            c.style.visibility = 'visible';
            c.style.position = 'absolute';
            c.style.margin = '0';
            c.style.transform = 'none';
            c.className = `manga-card glass delete-card-piece ${idx === 0 ? 'top-left' : 'bottom-right'}`;
            // Disable interactivity
            c.querySelectorAll('button, a').forEach(el => {
                el.onclick = null;
                el.style.pointerEvents = 'none';
            });
            wrapper.appendChild(c);
        });

        overlay.appendChild(wrapper);

        // Force reflow and start transition
        wrapper.offsetHeight;
        wrapper.classList.add('is-centered');

        // Helper for animation wait
        const wait = (ms) => new Promise(res => setTimeout(res, ms));

        try {
            // Wait for center animation (0.8s defined in css)
            await wait(800);

            // Draw slash
            const slash = document.createElement('div');
            slash.className = 'delete-slash';
            wrapper.appendChild(slash);
            wrapper.classList.add('is-slashing');
            
            await wait(200); // Wait for slash (0.2s)

            // Split and fall
            wrapper.classList.add('is-splitting');
            
            await wait(1500); // Wait for fall down (1.5s)

            // Actual delete
            const res = await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({id: id})
            });
            if (!res.ok) throw new Error("Delete failed");
            
            overlay.remove();
            loadManga();
            
        } catch (e) {
            console.error(e);
            overlay.remove();
            card.style.visibility = 'visible';
            card.dataset.deleting = "false";
            btnElement.disabled = false;
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
