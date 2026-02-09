const API_BASE_URL = "https://daturxonbg-production.up.railway.app"; // --- IGNORE ---
const orderContainer = document.getElementById("orderContainer");
const loadingOrder = document.getElementById("loadingOrder");

let currentShopId = null;
let cartItems = [];
let totalAmount = 0;
let deliveryFee = 0; // 🔥 Yetkazib berish narxi
let currentLocation = null;

/**
 * Telefon raqamni olish
 */
function getUserPhone() {
    let phone = sessionStorage.getItem("userPhone") || localStorage.getItem("userPhone");
    if (phone) sessionStorage.setItem("userPhone", phone);
    return phone;
}

/**
 * Shop ID ni olish
 */
function getShopId() {
    const params = new URLSearchParams(window.location.search);
    let shopId = params.get('shopId');
    
    if (shopId) {
        currentShopId = parseInt(shopId);
        localStorage.setItem('currentShopId', shopId);
        return parseInt(shopId);
    }
    
    shopId = localStorage.getItem('currentShopId');
    if (shopId) {
        currentShopId = parseInt(shopId);
        return parseInt(shopId);
    }
    
    currentShopId = 1;
    return 1;
}

/**
 * Savatni yuklash
 */
async function loadOrderPage() {
    const phone = getUserPhone();
    const shopId = getShopId();

    if (!phone) {
        showError("Telefon raqam topilmadi", "Iltimos, avval telefon raqamingizni kiriting!", "/index.html");
        return;
    }

    loadingOrder.classList.add('active');
    orderContainer.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE_URL}/api/cart?phone=${encodeURIComponent(phone)}&shopId=${shopId}`);
        
        if (res.status === 500 || !res.ok) {
            throw new Error("Savat bo'sh yoki xatolik yuz berdi");
        }

        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            showError("Savat bo'sh", "Iltimos, birinchi mahsulot qo'shing!", "/index.html");
            return;
        }

        cartItems = data;
        
        totalAmount = data.reduce((sum, item) => {
            const price = item.price || 0;
            const quantity = item.quantity || 1;
            return sum + (price * quantity);
        }, 0);

        loadingOrder.classList.remove('active');
        renderOrderPage(data, phone);

        // shop ma'lumotini bir marta olamiz (1-productdan)
        const shop = data[0]?.product?.shop;

        if (!shop || !shop.latitude || !shop.longitude) {
            console.warn("Restaurant location mavjud emas");
            return;
        }

        // global qilib qo'yamiz
        window.restaurantLocation = {
            lat: shop.latitude,
            lng: shop.longitude,
            feePerKm: shop.deliveryFeePerKm || 0,
            baseFee: shop.baseDeliveryFee || 0
        };

    } catch (err) {
        loadingOrder.classList.remove('active');
        showError("Xatolik", err.message);
        console.error(err);
    }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Buyurtma sahifasini render qilish
 */
function renderOrderPage(items, phone) {
    let html = '';

    // Savat mahsulotlari
    html += '<div class="cart-section">';
    html += '<h3 class="section-title">Sizning buyurtmangiz</h3>';
    
    items.forEach(item => {
        const name = item.productName || item.product?.name || item.name || 'Mahsulot';
        const image = item.productImage || item.product?.imageUrl || item.image || '/img/premium.jpg';
        const price = item.price || 0;
        const quantity = item.quantity || 1;
        const total = price * quantity;

        html += `
            <div class="cart-item">
                <img src="${image}" alt="${name}" class="cart-item-image" onerror="this.src='/img/premium.jpg'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${name}</div>
                    <div class="cart-item-quantity">${quantity} ta × ${price.toLocaleString()} so'm</div>
                </div>
                <div class="cart-item-price">${total.toLocaleString()} so'm</div>
            </div>
        `;
    });
    html += '</div>';

    // Buyurtma formasi
    html += `
        <form class="order-form" id="orderForm">
            <!-- Telefon -->
            <div class="form-group">
                <label class="form-label">📱 Telefon raqamingiz</label>
                <div class="phone-input-group">
                    <span class="country-code">+998</span>
                    <input type="tel" 
                           class="form-input" 
                           id="phoneInput" 
                           value="${phone.replace('+998', '')}" 
                           maxlength="9" 
                           placeholder="XX XXX XX XX">
                </div>
            </div>

            <!-- Manzil (faqat avtomatik aniqlash) -->
            <div class="form-group">
                <label class="form-label">📍 Yetkazish manzili</label>
                <button type="button" class="location-detect-btn" id="getLocationBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3" stroke-width="2"/>
                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Joylashuvni aniqlash
                </button>
                <input type="text" 
                       class="form-input" 
                       id="detectedAddress" 
                       placeholder="Joylashuv aniqlanmagan" 
                       readonly 
                       style="display:none; margin-top:8px;">
                <input type="hidden" id="latitude">
                <input type="hidden" id="longitude">
            </div>

            <!-- To'lov turi -->
            <div class="form-group">
                <label class="form-label">💳 To'lov turi</label>
                <div class="payment-options-inline">
                    <label class="payment-option selected">
                        <input type="radio" name="payment" value="CASH" checked>
                        <div class="payment-icon">💵</div>
                        <div class="payment-label">Naqd pul</div>
                    </label>
                    <label class="payment-option payment-disabled">
                        <input type="radio" name="payment" value="CARD" disabled>
                        <div class="payment-icon">💳</div>
                        <div class="payment-label">Karta orqali</div>
                        <div class="disabled-overlay">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </div>
                    </label>
                </div>
                <p class="payment-notice">Karta orqali to'lov hozircha mavjud emas</p>
            </div>
        </form>
    `;

    // Jami summa (eng oxirida)
    html += `
        <div class="total-section" id="totalSection" style="display:none;">
            <div class="summary-row">
                <span>Mahsulotlar:</span>
                <strong id="productTotal">${totalAmount.toLocaleString()} so'm</strong>
            </div>
            <div id="deliveryInfo"></div>
            <div class="total-divider"></div>
            <div class="total-row">
                <span class="total-label">Jami to'lov:</span>
                <span class="total-amount" id="grandTotal">${totalAmount.toLocaleString()} so'm</span>
            </div>
        </div>
    `;

    // Submit tugma (formadan tashqarida)
    html += `
        <button type="button" class="submit-btn" id="submitOrderBtn">
            Buyurtma berish
        </button>
    `;

    // Tasdiqlash modal oynasi
    html += `
        <div class="confirm-modal" id="confirmModal">
            <div class="confirm-modal-content">
                <div class="confirm-modal-icon">❓</div>
                <h3 class="confirm-modal-title">Buyurtmani tasdiqlash</h3>
                <p class="confirm-modal-text">Rostdan ham buyurtma bermoqchimisiz?</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-btn confirm-btn-yes" id="confirmYes">Ha</button>
                    <button class="confirm-btn confirm-btn-no" id="confirmNo">Yo'q</button>
                </div>
            </div>
        </div>
    `;

    orderContainer.innerHTML = html;
    setupEventListeners();
}

/**
 * Event listeners
 */
function setupEventListeners() {
    const form = document.getElementById('orderForm');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const paymentOptions = document.querySelectorAll('.payment-option');

    // Helper funksiyalar
    function addDeliveryRow(km, price) {
        const deliveryInfo = document.getElementById('deliveryInfo');
        deliveryInfo.innerHTML = `
            <div class="summary-row">
                <span>🚚 Yetkazib berish (${km} km):</span>
                <strong>${price.toLocaleString()} so'm</strong>
            </div>
        `;
    }

    function updateTotalUI(newTotal) {
        const totalSection = document.getElementById('totalSection');
        const grandTotal = document.getElementById('grandTotal');
        const submitBtn = document.getElementById('submitOrderBtn');

        // Total section ni ko'rsatish
        totalSection.style.display = 'block';
        
        grandTotal.textContent = `${newTotal.toLocaleString()} so'm`;
        submitBtn.textContent = `Buyurtma berish (${newTotal.toLocaleString()} so'm)`;
    }

    // Joylashuvni aniqlash (faqat bitta tugma)
    getLocationBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const btn = getLocationBtn;
        const detectedInput = document.getElementById('detectedAddress');
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        
        btn.disabled = true;
        btn.textContent = 'Aniqlanmoqda...';

        if (!navigator.geolocation) {
            alert('Brauzeringiz joylashuvni aniqlay olmaydi!');
            btn.disabled = false;
            btn.textContent = 'Joylashuvni aniqlash';
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                currentLocation = { lat, lng };

                // manzilni aniqlash
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
                    );
                    const data = await res.json();
                    detectedInput.value = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                } catch (err) {
                    console.error('Manzil aniqlanmadi:', err);
                    detectedInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }
                
                detectedInput.style.display = 'block';
                latInput.value = lat;
                lngInput.value = lng;

                // 🔥 DELIVERY HISOBLASH
                const shop = window.restaurantLocation;
                if (!shop || !shop.lat || !shop.lng) {
                    console.warn("Restaurant location yo'q");
                    btn.innerHTML = "Joylashuv aniqlandi ✓";
                    btn.disabled = false;
                    updateTotalUI(totalAmount);
                    return;
                }

                const distanceKm = calculateDistanceKm(
                    lat,
                    lng,
                    shop.lat,
                    shop.lng
                );

                const roundedKm = Math.ceil(distanceKm);
                deliveryFee = shop.baseFee + (roundedKm * shop.feePerKm); // 🔥 Global ga saqlaymiz

                // UI yangilash
                addDeliveryRow(roundedKm, deliveryFee);
                const newTotal = totalAmount + deliveryFee;
                updateTotalUI(newTotal);

                btn.innerHTML = "Joylashuv aniqlandi ✓";
                btn.disabled = false;
            },
            (error) => {
                console.error(error);
                alert('Joylashuvni aniqlab bo\'lmadi. Iltimos, brauzer sozlamalarida joylashuv ruxsatini yoqing.');
                btn.disabled = false;
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3" stroke-width="2"/>
                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Joylashuvni aniqlash
                `;
            }
        );
    });

    // To'lov usulini tanlash (faqat Naqd ishlaydi)
    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (option.classList.contains('payment-disabled')) {
                return; // disabled bo'lsa, hech narsa qilma
            }
            paymentOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            option.querySelector('input').checked = true;
        });
    });

    // Buyurtma berish tugmasi - faqat modal ni ochadi
    const submitBtn = document.getElementById('submitOrderBtn');
    submitBtn?.addEventListener('click', () => {
        showConfirmModal();
    });

    // Modal tugmalari
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    confirmYes?.addEventListener('click', async () => {
        hideConfirmModal();
        await submitOrder();
    });

    confirmNo?.addEventListener('click', () => {
        hideConfirmModal();
    });
}

/**
 * Tasdiqlash modal oynasini ko'rsatish
 */
function showConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // scroll ni to'xtatish
    }
}

/**
 * Tasdiqlash modal oynasini yashirish
 */
function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // scroll ni qayta yoqish
    }
}

/**
 * Buyurtmani yuborish
 */
async function submitOrder() {
    const phoneInput = document.getElementById('phoneInput').value.trim();
    const phone = phoneInput ? '+998' + phoneInput : getUserPhone();
    const shopId = getShopId();
    const latVal = document.getElementById('latitude').value;
    const lngVal = document.getElementById('longitude').value;
    const detectedInput = document.getElementById('detectedAddress');
    
    // Telefon raqam tekshiruvi
    if (!phoneInput || phoneInput.length !== 9) {
        alert('Iltimos, to\'g\'ri telefon raqam kiriting! (9 ta raqam)');
        return;
    }
    
    // Joylashuvni aniqlash tekshiriladi (majburiy)
    if (!latVal || !lngVal) {
        alert('Iltimos, avval "Joylashuvni aniqlash" tugmasini bosing!');
        return;
    }

    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    const address = (detectedInput && detectedInput.value.trim()) ? detectedInput.value.trim() : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const payment = document.querySelector('input[name="payment"]:checked').value;

    const submitBtn = document.getElementById('submitOrderBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Yuborilmoqda...';

    try {
        const orderData = {
            phoneNumber: phone,
            shopId: shopId,
            deliveryAddress: address,
            deliveryLatitude: lat,
            deliveryLongitude: lng,
            deliveryFee: deliveryFee, // 🔥 Yetkazib berish narxini yuboramiz
            paymentMethod: payment
        };

        console.log('Buyurtma:', orderData);

        const res = await fetch(`${API_BASE_URL}/api/orders/place`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Backend javobi:', errorText);
            throw new Error(`Server xatosi (${res.status})`);
        }

        const result = await res.json();
        console.log('Buyurtma yaratildi:', result);

        // Savatni tozalash
        await clearCart();

        // Muvaffaqiyatli xabar
        showSuccess(result);

    } catch (err) {
        console.error('Xatolik:', err);
        alert(`Buyurtma yuborishda xatolik: ${err.message}`);
        submitBtn.disabled = false;
        const finalTotal = totalAmount + deliveryFee;
        submitBtn.textContent = `Buyurtma berish (${finalTotal.toLocaleString()} so'm)`;
    }
}

/**
 * Savatni tozalash (soft-delete, backendda status = COMPLETED)
 */
async function clearCart() {
    // Hech narsa qilmaymiz, backend buyurtma berilganda savatni avtomatik COMPLETED qiladi
    console.log("Savat backendda COMPLETED holatga o'zgartirildi");
}

/**
 * Muvaffaqiyatli xabar
 */
function showSuccess(order) {
    orderContainer.innerHTML = `
        <div class="success-container">
            <div class="success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M5 13l4 4L19 7" stroke-linecap="round"/>
                </svg>
            </div>
            <h2 class="success-title">Buyurtma qabul qilindi!</h2>
            <p class="success-text">Tez orada operator siz bilan bog'lanadi</p>
            <div class="success-order-id">Buyurtma #${order.id || 'N/A'}</div>
            <div class="success-buttons">
                <button onclick="window.location.href='/orders/buyurtmalar.html'" class="success-btn success-btn-primary">
                    Buyurtmalarimni ko'rish
                </button>
                <button onclick="window.location.href='/index.html'" class="success-btn success-btn-secondary">
                    Bosh sahifaga qaytish
                </button>
            </div>
        </div>
    `;
}

/**
 * Xato xabarini ko'rsatish
 */
function showError(title, message, redirectUrl = null) {
    loadingOrder.classList.remove('active');
    orderContainer.innerHTML = `
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h2 class="error-title">${title}</h2>
            <p class="error-text">${message}</p>
            <button onclick="window.location.href='${redirectUrl || '/index.html'}'" class="error-btn">
                ${redirectUrl ? 'Orqaga qaytish' : 'Bosh sahifaga'}
            </button>
        </div>
    `;
}

/**
 * Sahifa yuklanganda
 */
document.addEventListener('DOMContentLoaded', () => {
    loadOrderPage();
});
