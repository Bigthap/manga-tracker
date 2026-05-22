let debounceTimers = {};

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    triggerScan(details.tabId, details.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        triggerScan(tabId, tab.url);
    }
});

function triggerScan(tabId, url) {
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;
    
    const key = `${tabId}-${url}`;
    if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
    
    debounceTimers[key] = setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "SCAN_PAGE" }).catch(() => {});
    }, 1000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_TRACK_DATA") {
        handleTrackData(request.data);
    }
});

async function handleTrackData(data) {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        console.warn("Manga Tracker: API Key not set. Open extension popup to configure.");
        return;
    }

    if (data.coverUrl && !data.coverBase64) {
        try {
            const urlObj = new URL(data.coverUrl);
            const hostname = urlObj.hostname;
            if (!hostname.match(/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/)) {
                const imgRes = await fetch(data.coverUrl, { signal: AbortSignal.timeout(10000) });
                if (imgRes.ok) {
                    const blob = await imgRes.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    data.coverBase64 = base64;
                }
            }
        } catch(e) {
            console.log("Failed to fetch cover in background", e);
        }
    }

    try {
        const response = await fetch('http://localhost:8264/api/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            console.error("Manga Tracker: Server responded with", response.status);
            queueData(data);
        } else {
            console.log("Manga Tracker: Successfully tracked", data.title);
            flushQueue();
        }
    } catch (err) {
        console.error("Manga Tracker: Fetch failed, server offline", err);
        queueData(data);
    }
}

async function queueData(data) {
    const { offlineQueue = [] } = await chrome.storage.local.get('offlineQueue');
    if (offlineQueue.length > 50) offlineQueue.shift();
    // remove duplicates of same chapter
    const filtered = offlineQueue.filter(q => !(q.source === data.source && q.slug === data.slug && q.chapterNumber === data.chapterNumber));
    filtered.push(data);
    await chrome.storage.local.set({ offlineQueue: filtered });
}

async function flushQueue() {
    const { offlineQueue = [] } = await chrome.storage.local.get('offlineQueue');
    if (offlineQueue.length === 0) return;
    
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) return;

    let remainingQueue = [];
    for (const data of offlineQueue) {
        try {
            const res = await fetch('http://localhost:8264/api/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                remainingQueue.push(data);
            }
        } catch(e) {
            remainingQueue.push(data);
        }
    }
    await chrome.storage.local.set({ offlineQueue: remainingQueue });
}
