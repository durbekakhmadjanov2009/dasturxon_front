// API base URL
const API_BASE_URL = 'https://dasturxon-bgbot-production.up.railway.app';

// FAQAT BRAUZERDA FAOL BO’LSIN
if (typeof document !== 'undefined') {

    // Modal elementlar
    const phoneModal = document.getElementById('phoneModal');
    const phoneInput = document.getElementById('phoneInput');
    const continueBtn = document.getElementById('continueBtn');
    const newPhoneForm = document.getElementById('newPhoneForm');
    const existingPhoneForm = document.getElementById('existingPhoneForm');
    const changePhoneForm = document.getElementById('changePhoneForm');
    const savedPhone = document.getElementById('savedPhone');
    const oldPhoneDisplay = document.getElementById('oldPhoneDisplay');
    const confirmBtn = document.getElementById('confirmBtn');
    const changeBtn = document.getElementById('changeBtn');
    const submitChangeBtn = document.getElementById('submitChangeBtn');
    const backToExistingBtn = document.getElementById('backToExistingBtn');
    const changePhoneInput = document.getElementById('changePhoneInput');

    let currentPhoneNumber = null;

    // TELEGRAM CHAT ID olish (Telegram Web App API)
const chatId = window.Telegram.WebApp.initDataUnsafe?.user?.id || null;

    // FORMAT PHONE INPUT
    function formatPhoneInput(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.length > 9) value = value.substring(0, 9);
        input.value = value;
        return value;
    }

    phoneInput?.addEventListener('input', e => continueBtn.disabled = formatPhoneInput(e.target).length !== 9);
    changePhoneInput?.addEventListener('input', e => submitChangeBtn.disabled = formatPhoneInput(e.target).length !== 9);

    // CHECK SAVED PHONE
    async function checkSavedPhone() {
        if (sessionStorage.getItem('phoneModalShown') === 'true') {
            fetchRestaurants();
            return;
        }

        const savedPhoneNumber = localStorage.getItem('userPhone');
        if (savedPhoneNumber) {
            currentPhoneNumber = savedPhoneNumber;
            try {
                const res = await fetch(`${API_BASE_URL}/api/contacts/check?phone=${encodeURIComponent(savedPhoneNumber)}`);
                if (!res.ok) return showNewPhoneForm();
                const data = await res.json();
                if (!data.isNewContact) {
                    showExistingPhoneForm();
                    await updateLastLogin(savedPhoneNumber);
                    return;
                }
            } catch { /* backend yo‘q */ }
        }
        showNewPhoneForm();
    }

    function showNewPhoneForm() {
        newPhoneForm.style.display = 'block';
        existingPhoneForm.style.display = 'none';
        changePhoneForm.style.display = 'none';
        phoneInput.value = '';
        continueBtn.disabled = true;
        phoneModal.classList.add('active');
    }

    function showExistingPhoneForm() {
        newPhoneForm.style.display = 'none';
        existingPhoneForm.style.display = 'block';
        changePhoneForm.style.display = 'none';
        savedPhone.textContent = currentPhoneNumber;
        phoneModal.classList.add('active');
    }

    function showChangePhoneForm() {
        newPhoneForm.style.display = 'none';
        existingPhoneForm.style.display = 'none';
        changePhoneForm.style.display = 'block';
        oldPhoneDisplay.textContent = currentPhoneNumber;
        changePhoneInput.value = '';
        submitChangeBtn.disabled = true;
    }

    // SAVE PHONE + CHAT ID
   async function savePhoneNumber(phone) {
    const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
    });

    const data = await res.json();
    // serverdan chatId qaytariladi
    const chatId = data.chatId;
}

    // UPDATE LAST LOGIN
    async function updateLastLogin(phone) {
        try {
            await fetch(`${API_BASE_URL}/api/contacts/login?phone=${encodeURIComponent(phone)}`, { method: 'POST' });
        } catch {}
    }

    // BUTTONS
    continueBtn?.addEventListener('click', async () => {
        if (phoneInput.value.length === 9) await savePhoneNumber('+998' + phoneInput.value);
    });

    confirmBtn?.addEventListener('click', async () => {
        sessionStorage.setItem('userPhone', currentPhoneNumber);
        sessionStorage.setItem('phoneModalShown', 'true');
        await updateLastLogin(currentPhoneNumber);
        phoneModal.classList.remove('active');
        fetchRestaurants();
    });

    changeBtn?.addEventListener('click', showChangePhoneForm);
    backToExistingBtn?.addEventListener('click', showExistingPhoneForm);

    submitChangeBtn?.addEventListener('click', async () => {
        if (changePhoneInput.value.length !== 9) return;
        const newPhone = '+998' + changePhoneInput.value;
        const oldPhone = currentPhoneNumber;
        const phoneHistory = JSON.parse(localStorage.getItem('phoneHistory') || '[]');
        phoneHistory.push({ oldPhone, changedAt: new Date().toISOString() });
        localStorage.setItem('phoneHistory', JSON.stringify(phoneHistory));
        await savePhoneNumber(newPhone);
    });

    // FETCH RESTAURANTS
    async function fetchRestaurants() {
        const loadingDiv = document.getElementById('loading');
        const container = document.getElementById('restaurantCards');
        if (!loadingDiv || !container) return;
        loadingDiv.style.display = 'block';
        container.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE_URL}/user/shops`);
            if (!res.ok) throw new Error(res.status);
            const shops = await res.json();
            loadingDiv.style.display = 'none';
            if (!shops.length) return container.innerHTML = '<p style="text-align:center;padding:20px;">Hozircha restoranlar yo\'q</p>';

            shops.forEach(shop => {
                const card = document.createElement('div');
                card.className = 'restaurant-card';
                card.innerHTML = `
                    <img src="${shop.image || 'img/Glamour.png'}" alt="${shop.name}" class="restaurant-image" onerror="this.src='img/Glamour.png';">
                    <div class="restaurant-info">
                        <h3>${shop.name || 'No name'}</h3>
                        <p class="restaurant-tags">${shop.description || 'Milliy taomlar, fastfood'}</p>
                        <div class="restaurant-footer">
                            <div class="delivery-info">
                                <img src="./img/clock.jpg" alt="Time">
                                <span>${shop.estimatedDeliveryTime || '25-35'} min</span>
                            </div>
                            <div class="restaurant-rating">⭐ ${shop.rating || '4.9'}</div>
                        </div>
                        ${shop.hasPromo ? '<p class="promo-text">10% chegirma</p>' : ''}
                    </div>
                `;
                card.addEventListener('click', () => window.location.href = `restaurant.html?id=${shop.id}`);
                container.appendChild(card);
            });
        } catch (err) {
            loadingDiv.style.display = 'none';
            container.innerHTML = `<p style="text-align:center;color:red;">Xatolik yuz berdi: ${err.message}</p>`;
        }
    }

    // SEARCH
    document.querySelector('.search-bar input')?.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.restaurant-card').forEach(card => {
            const name = card.querySelector('h3').textContent.toLowerCase();
            const tags = card.querySelector('.restaurant-tags')?.textContent.toLowerCase() || '';
            card.style.display = name.includes(term) || tags.includes(term) ? 'block' : 'none';
        });
    });

    // LOGOUT
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.clear();
        localStorage.removeItem('userPhone');
        window.location.href = 'index.html';
    });

    // INITIALIZE
    document.addEventListener('DOMContentLoaded', checkSavedPhone);
}
