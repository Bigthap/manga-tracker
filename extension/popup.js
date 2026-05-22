document.addEventListener('DOMContentLoaded', async () => {
    const input = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    const data = await chrome.storage.local.get('apiKey');
    if (data.apiKey) {
        input.value = data.apiKey;
    }

    saveBtn.addEventListener('click', async () => {
        const val = input.value.trim();
        if (val) {
            await chrome.storage.local.set({ apiKey: val });
            status.textContent = "API Key saved!";
            setTimeout(() => { status.textContent = ""; }, 2000);
        }
    });
});
