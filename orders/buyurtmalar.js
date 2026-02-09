const API_BASE_URL = "https://daturxonbg-production.up.railway.app"; // --- IGNORE ---
const ordersContainer = document.getElementById("ordersContainer");
const loadingOrders = document.getElementById("loadingOrders");

// Cache uchun
let shopsCache = null;
let loadingShopsPromise = null;

// Real-time tracking uchun
let statusCheckInterval = null;
let previousOrderStatuses = {}; // orderId -> status mapping
let notificationSound = null;

/**
 * Notification ovozini yaratish
 */
function initNotificationSound() {
    if (!notificationSound) {
        // Web Audio API orqali oddiy notification ovozi
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        notificationSound = () => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Yoqimli notification ovozi (2 ta beep)
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            
            // Ikkinchi beep
            setTimeout(() => {
                const oscillator2 = audioContext.createOscillator();
                const gainNode2 = audioContext.createGain();
                
                oscillator2.connect(gainNode2);
                gainNode2.connect(audioContext.destination);
                
                oscillator2.frequency.value = 1000;
                oscillator2.type = 'sine';
                
                gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator2.start(audioContext.currentTime);
                oscillator2.stop(audioContext.currentTime + 0.1);
            }, 150);
        };
    }
}

/**
 * Browser notification ko'rsatish
 */
function showBrowserNotification(orderId, oldStatus, newStatus) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Buyurtma holati o\'zgardi! 🎉', {
            body: `Buyurtma #${orderId}: ${translateStatus(oldStatus)} → ${translateStatus(newStatus)}`,
            icon: '/img/logo.png', // Logo rasmingiz bo'lsa
            badge: '/img/badge.png',
            vibrate: [200, 100, 200]
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

/**
 * Status o'zgarishini tekshirish va notification
 */
function checkStatusChange(orderId, newStatus) {
    const oldStatus = previousOrderStatuses[orderId];
    
    if (oldStatus && oldStatus !== newStatus) {
        console.log(`🔔 Status changed for order #${orderId}: ${oldStatus} → ${newStatus}`);
        
        // Ovoz chiqarish
        if (notificationSound) {
            notificationSound();
        }
        
        // Browser notification
        showBrowserNotification(orderId, oldStatus, newStatus);
        
        // Visual notification (optional - screen tepasida)
        showVisualNotification(orderId, oldStatus, newStatus);
        
        // Buyurtmalarni qayta yuklash (yangi status bilan)
        loadOrders();
    }
    
    // Yangi statusni saqlash
    previousOrderStatuses[orderId] = newStatus;
}

/**
 * Visual notification (screen tepasida)
 */
function showVisualNotification(orderId, oldStatus, newStatus) {
    // Status bo'yicha xabar va emoji
    const statusMessages = {
        'ACCEPTED': {
            title: '✅ Buyurtma qabul qilindi!',
            message: 'Hurmatli mijoz, sizning buyurtmangiz muvaffaqiyatli qabul qilindi. Restoran buyurtmangizni tayyorlashni boshladi.',
            color: '#10b981'
        },
        'PREPARING': {
            title: '👨‍🍳 Tayyorlanmoqda!',
            message: 'Buyurtmangiz tayyorlanmoqda. Oshpazlarimiz eng mazali taomlarni tayyorlashmoqda.',
            color: '#f59e0b'
        },
        'READY': {
            title: '🎉 Buyurtma tayyor!',
            message: 'Buyurtmangiz tayyor bo\'ldi va tez orada yo\'lga chiqadi. Kuryer sizning manzilingizga yo\'l olmoqda.',
            color: '#8b5cf6'
        },
        'DELIVERING': {
            title: '🚗 Yo\'lda!',
            message: 'Buyurtmangiz yo\'lga chiqdi! Kuryer sizning manzilingizga kelmoqda. Iltimos, telefon yoningizda bo\'sin.',
            color: '#3b82f6'
        },
        'DELIVERED': {
            title: '🎊 Yetkazildi!',
            message: 'Buyurtmangiz muvaffaqiyatli yetkazildi. Ishtahangiz ochsin! Bizni tanlaganingiz uchun rahmat.',
            color: '#059669'
        }
    };

    const statusInfo = statusMessages[newStatus] || {
        title: '📦 Holat yangilandi',
        message: `Buyurtma #${orderId} holati ${translateStatus(oldStatus)} dan ${translateStatus(newStatus)} ga o'zgartirildi.`,
        color: '#6366f1'
    };

    const notification = document.createElement('div');
    notification.className = 'status-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-left">
                <div class="notification-icon-circle" style="background: ${statusInfo.color};">
                    <span class="notification-emoji">${statusInfo.title.match(/[\u{1F300}-\u{1F9FF}]/u)?.[0] || '📦'}</span>
                </div>
            </div>
            <div class="notification-right">
                <div class="notification-header">
                    <div class="notification-title">${statusInfo.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}</div>
                    <div class="notification-order-id">Buyurtma #${orderId}</div>
                </div>
                <div class="notification-message">${statusInfo.message}</div>
                <div class="notification-progress">
                    <div class="notification-progress-bar" style="background: ${statusInfo.color};"></div>
                </div>
            </div>
            <button class="notification-close" onclick="this.closest('.status-notification').classList.remove('show'); setTimeout(() => this.closest('.status-notification').remove(), 300)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animation
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Progress bar animation
    const progressBar = notification.querySelector('.notification-progress-bar');
    setTimeout(() => {
        progressBar.style.width = '100%';
    }, 200);
    
    // 8 sekunddan keyin o'chirish
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 8000);
}

/**
 * Buyurtmalarni background da tekshirish (faqat active buyurtmalar)
 */
async function checkOrderStatusUpdates() {
    const phone = getUserPhone();
    if (!phone) return;
    
    try {
        const encodedPhone = encodeURIComponent(phone);
        const response = await fetch(
            `${API_BASE_URL}/api/orders/by-phone?phoneNumber=${encodedPhone}`
        );
        
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data || data.length === 0) return;
        
        // Faqat active buyurtmalarni tekshirish (DELIVERED va CANCELLED emas)
        const activeOrders = data.filter(orderData => {
            const status = orderData.order.status;
            return status !== 'DELIVERED' && status !== 'CANCELLED';
        });
        
        activeOrders.forEach(orderData => {
            const order = orderData.order;
            checkStatusChange(order.id, order.status);
        });
        
    } catch (error) {
        console.warn('Status tekshirishda xatolik:', error);
    }
}

/**
 * Real-time tracking ni boshlash
 */
function startStatusTracking() {
    // Avvalgi interval ni to'xtatish
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Notification ovozini init qilish
    initNotificationSound();
    
    // Browser notification ruxsatini so'rash
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Har 10 sekundda tekshirish (production da 15-30 sekund qilish mumkin)
    statusCheckInterval = setInterval(checkOrderStatusUpdates, 10000);
    
    console.log('✅ Status tracking started (checking every 10 seconds)');
}

/**
 * Tracking ni to'xtatish
 */
function stopStatusTracking() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        console.log('🛑 Status tracking stopped');
    }
}

/**
 * Telefon raqamni olish
 */
function getUserPhone() {
    let phone = sessionStorage.getItem("userPhone") || localStorage.getItem("userPhone");
    if (phone) sessionStorage.setItem("userPhone", phone);
    return phone;
}

/**
 * Barcha do'konlarni yuklash va cache'da saqlash
 */
async function loadShops() {
    // Agar allaqachon yuklanyotgan bo'lsa, o'sha promise'ni qaytaramiz
    if (loadingShopsPromise) {
        return loadingShopsPromise;
    }

    // Agar cache'da bo'lsa, cache'dan qaytaramiz
    if (shopsCache) {
        return shopsCache;
    }

    // Yangi yuklash
    loadingShopsPromise = fetch(`${API_BASE_URL}/user/shops`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Do\'konlarni yuklashda xatolik');
            }
            return response.json();
        })
        .then(shops => {
            shopsCache = shops;
            loadingShopsPromise = null;
            return shops;
        })
        .catch(error => {
            console.error('Do\'konlarni yuklashda xatolik:', error);
            loadingShopsPromise = null;
            return [];
        });

    return loadingShopsPromise;
}

/**
 * Shop ID bo'yicha shop ma'lumotini olish
 */
async function getShopById(shopId) {
    const shops = await loadShops();
    return shops.find(shop => shop.id === shopId);
}

/**
 * Product ma'lumotini olish
 */
async function getProductInfo(shopId, productId) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/user/shops/${shopId}/products/${productId}`
        );
        
        if (!response.ok) {
            throw new Error('Mahsulot topilmadi');
        }
        
        return await response.json();
    } catch (error) {
        console.warn(`Mahsulot ${productId} topilmadi:`, error);
        return null;
    }
}

/**
 * Bo'sh buyurtmalar ekranini ko'rsatish
 */
function showEmptyOrders() {
    ordersContainer.innerHTML = `
        <div class="empty-orders">
            <div class="empty-orders-icon">📦</div>
            <h2 class="empty-orders-title">Buyurtmalaringiz yo'q</h2>
            <p class="empty-orders-text">Hozircha hech qanday buyurtma bermagansiz. Sevimli taomlaringizni buyurtma qiling!</p>
            <a href="../index.html" class="go-shopping-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                Buyurtma berish
            </a>
        </div>
    `;
}

/**
 * Xato ekranini ko'rsatish
 */
function showError(message) {
    ordersContainer.innerHTML = `
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h2 class="error-title">Xatolik yuz berdi</h2>
            <p class="error-text">${message}</p>
            <button class="retry-btn" onclick="loadOrders()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Qayta urinish
            </button>
        </div>
    `;
}

/**
 * Status nomini o'zbekchaga tarjima qilish
 */
function translateStatus(status) {
    const statusMap = {
        'PENDING': 'Kutilmoqda',
        'ACCEPTED': 'Qabul qilindi',
        'PREPARING': 'Tayyorlanmoqda',
        'READY': 'Tayyor',
        'DELIVERING': 'Yetkazilmoqda',
        'DELIVERED': 'Yetkazildi',
        'CANCELLED': 'Bekor qilindi'
    };
    return statusMap[status] || status;
}

/**
 * Status CSS class ni olish
 */
function getStatusClass(status) {
    return 'status-' + status.toLowerCase();
}

/**
 * Sanani formatlash
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
        return 'Bugun';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Kecha';
    } else {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
}

/**
 * Vaqtni formatlash (HH:MM)
 */
function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Buyurtmalarni sanaga qarab guruhlash
 */
function groupOrdersByDate(orders) {
    const grouped = {};

    orders.forEach(orderData => {
        const order = orderData.order;
        const dateKey = order.createdAt.split('T')[0]; // YYYY-MM-DD
        
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        
        grouped[dateKey].push(orderData);
    });

    return grouped;
}

/**
 * Buyurtma kartasini render qilish
 */
function renderOrderCard(orderData) {
    const order = orderData.order;
    const items = orderData.items || [];

    const card = document.createElement('div');
    card.className = 'order-card';
    card.onclick = () => showOrderDetail(orderData);

    // Shop rasmi va nomi
    const shopImage = order.shopImage || '';
    const shopName = order.shopName || 'Restoran';

    // Mahsulotlar ro'yxati
    let itemsHTML = '';
    if (items.length > 0) {
        itemsHTML = `
            <div class="order-items">
                <div class="order-items-title">Mahsulotlar:</div>
                <div class="item-list">
                    ${items.slice(0, 3).map(item => `
                        <div class="item-row">
                            <span class="item-name">${item.productName || 'Mahsulot'}</span>
                            <span class="item-quantity">${item.quantity} ta</span>
                        </div>
                    `).join('')}
                    ${items.length > 3 ? `<div class="item-row" style="color: var(--gray); font-style: italic;">va yana ${items.length - 3} ta...</div>` : ''}
                </div>
            </div>
        `;
    }

    const deliveryFee = order.deliveryFee || 0;
    const deliveryText = deliveryFee > 0 
        ? `🚚 Yetkazish: ${deliveryFee.toLocaleString()} so'm` 
        : '🚚 Bepul yetkazish';

    const totalPrice = order.totalAmount || order.totalPrice || 0;

    card.innerHTML = `
        <div class="order-header">
            <div class="order-id">Buyurtma #${order.id}</div>
            <div class="order-status ${getStatusClass(order.status)}">
                ${translateStatus(order.status)}
            </div>
        </div>

        <div class="order-info">
            <div class="shop-info-row">
                ${shopImage ? `
                    <img src="${shopImage}" alt="${shopName}" class="shop-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="shop-logo-fallback" style="display: none;">🏪</div>
                ` : `
                    <div class="shop-logo-fallback">🏪</div>
                `}
                <div>
                    <div class="shop-name">${shopName}</div>
                    <div class="shop-subtitle">${items.length} ta mahsulot</div>
                </div>
            </div>
            
            <div class="order-details">
                <div class="detail-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span>${order.deliveryAddress || 'Manzil ko\'rsatilmagan'}</span>
                </div>

                <div class="detail-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>${formatDate(order.createdAt)} • ${formatTime(order.createdAt)}</span>
                </div>

                <div class="detail-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="5" width="20" height="14" rx="2"/>
                        <line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                    <span>${order.paymentMethod === 'CASH' ? 'Naqd pul' : 'Karta orqali'}</span>
                </div>

                <div class="detail-row" style="color: var(--purple); font-weight: 600;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                        <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h9zm0 0h5.5a1 1 0 001-.8l1.5-6a1 1 0 00-1-1.2H13"/>
                    </svg>
                    <span>${deliveryText}</span>
                </div>
            </div>
        </div>

        ${itemsHTML}

        <div class="order-footer">
            <div class="order-time">${formatTime(order.createdAt)}</div>
            <div class="order-total">${totalPrice.toLocaleString()} so'm</div>
        </div>
    `;

    return card;
}

/**
 * Buyurtma detallari modalini ko'rsatish
 */
function showOrderDetail(orderData) {
    const order = orderData.order;
    const items = orderData.items || [];

    const modal = document.createElement('div');
    modal.className = 'order-modal active';
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };

    const shopImage = order.shopImage || '';
    const shopName = order.shopName || 'Restoran';

    let itemsHTML = '';
    if (items.length > 0) {
        itemsHTML = items.map(item => {
            const productImage = item.productImage || '';
            const productName = item.productName || 'Mahsulot';
            const price = item.price || 0;
            const quantity = item.quantity || 1;
            const total = price * quantity;

            return `
            <div class="modal-item-row">
                ${productImage ? `
                    <img src="${productImage}" alt="${productName}" class="modal-product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="modal-product-fallback" style="display: none; width: 50px; height: 50px; border-radius: 8px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); align-items: center; justify-content: center; font-size: 24px;">🍔</div>
                ` : `
                    <div class="modal-product-fallback" style="width: 50px; height: 50px; border-radius: 8px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; align-items: center; justify-content: center; font-size: 24px;">🍔</div>
                `}
                <div class="modal-item-info">
                    <div class="modal-item-name">${productName}</div>
                    <div class="modal-item-details">
                        <span>${quantity} ta × ${price.toLocaleString()} so'm</span>
                    </div>
                </div>
                <div class="modal-item-total">${total.toLocaleString()} so'm</div>
            </div>
            `;
        }).join('');
    }

    const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const deliveryFee = order.deliveryFee || 0;
    const total = order.totalAmount || order.totalPrice || (subtotal + deliveryFee);

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Buyurtma #${order.id}</h2>
                <button class="close-modal" onclick="this.closest('.order-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div style="background: var(--gray-bg); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14px; color: var(--gray);">Status:</span>
                        <div class="order-status ${getStatusClass(order.status)}">
                            ${translateStatus(order.status)}
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Restoran</h3>
                    <div style="background: var(--gray-bg); padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                        ${shopImage ? `
                            <img src="${shopImage}" alt="${shopName}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="width: 60px; height: 60px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: none; align-items: center; justify-content: center; font-size: 28px;">🏪</div>
                        ` : `
                            <div style="width: 60px; height: 60px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 28px;">🏪</div>
                        `}
                        <div>
                            <p style="font-weight: 600; margin-bottom: 4px;">${shopName}</p>
                            <p style="color: var(--gray); font-size: 14px;">${items.length} ta mahsulot</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Yetkazish ma'lumotlari</h3>
                    <div style="background: var(--gray-bg); padding: 12px; border-radius: 8px;">
                        <p style="color: var(--gray); font-size: 14px; margin-bottom: 4px;">📍 ${order.deliveryAddress || 'Manzil ko\'rsatilmagan'}</p>
                        <p style="color: var(--gray); font-size: 14px;">📞 ${order.phoneNumber || 'Telefon ko\'rsatilmagan'}</p>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Mahsulotlar</h3>
                    <div class="modal-items-container">
                        ${itemsHTML || '<p style="text-align: center; padding: 20px; color: var(--gray);">Mahsulotlar topilmadi</p>'}
                    </div>
                </div>

                <div style="background: var(--gray-bg); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: var(--gray);">Mahsulotlar:</span>
                        <span style="font-weight: 600;">${subtotal.toLocaleString()} so'm</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: var(--gray);">Yetkazib berish:</span>
                        <span style="font-weight: 600; color: ${deliveryFee > 0 ? 'var(--black)' : 'var(--green)'};">
                            ${deliveryFee > 0 ? deliveryFee.toLocaleString() + ' so\'m' : 'Bepul'}
                        </span>
                    </div>
                    <div style="height: 1px; background: var(--gray-light); margin: 8px 0;"></div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 600;">Jami:</span>
                        <span style="font-size: 20px; font-weight: 700; color: var(--purple);">${total.toLocaleString()} so'm</span>
                    </div>
                </div>

                <div style="background: var(--purple); color: white; padding: 16px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 16px; font-weight: 600;">To'lov usuli:</span>
                        <span style="font-size: 16px; font-weight: 600;">${order.paymentMethod === 'CASH' ? '💵 Naqd pul' : '💳 Karta orqali'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; opacity: 0.9; font-size: 14px;">
                        <span>📅 ${formatDate(order.createdAt)}</span>
                        <span>🕐 ${formatTime(order.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Buyurtma ma'lumotlarini to'ldirish
 */
async function enrichOrderData(orderData) {
    const order = orderData.order;
    const items = orderData.items || [];

    try {
        if (order.deliveryFee === undefined || order.deliveryFee === null) {
            order.deliveryFee = 0;
        }
        
        const shopId = order.shopId || order.shop_id || order.shop?.id;
        
        if (shopId) {
            const shop = await getShopById(shopId);
            if (shop) {
                order.shopName = shop.name;
                order.shopImage = shop.image;
                order.shopId = shopId;
            }
        }

        const enrichedItems = await Promise.all(
            items.map(async (item) => {
                if (item.product) {
                    item.productName = item.product.name || item.productName || 'Mahsulot';
                    item.productImage = item.product.imageUrl || item.product.image || item.productImage;
                    if (!item.price && item.product.price) {
                        item.price = item.product.price;
                    }
                    return item;
                }
                
                const productId = item.productId || item.product_id || item.id;
                
                if ((!item.productName || !item.productImage) && productId && shopId) {
                    try {
                        const product = await getProductInfo(shopId, productId);
                        if (product) {
                            item.productName = product.name || item.productName || 'Mahsulot';
                            item.productImage = product.imageUrl || item.productImage;
                            if (!item.price && product.price) {
                                item.price = product.price;
                            }
                        }
                    } catch (error) {
                        item.productName = item.productName || 'Mahsulot';
                    }
                } else {
                    item.productName = item.productName || 'Mahsulot';
                }
                
                return item;
            })
        );
        
        return {
            order: order,
            items: enrichedItems
        };
    } catch (error) {
        console.error('Buyurtma ma\'lumotlarini enrichment qilishda xatolik:', error);
        return orderData;
    }
}

/**
 * Buyurtmalarni yuklash
 */
async function loadOrders() {
    const phone = getUserPhone();

    if (!phone) {
        showEmptyOrders();
        return;
    }

    loadingOrders.classList.add('active');
    ordersContainer.innerHTML = '';

    try {
        await loadShops();

        const encodedPhone = encodeURIComponent(phone);
        const response = await fetch(
            `${API_BASE_URL}/api/orders/by-phone?phoneNumber=${encodedPhone}`
        );

        if (!response.ok) {
            if (response.status === 404 || response.status === 400) {
                loadingOrders.classList.remove('active');
                showEmptyOrders();
                return;
            }
            throw new Error(`Buyurtmalarni yuklashda xatolik: ${response.status}`);
        }

        const data = await response.json();

        if (!data || (Array.isArray(data) && data.length === 0)) {
            loadingOrders.classList.remove('active');
            showEmptyOrders();
            return;
        }

        const enrichedOrders = await Promise.all(
            data.map(orderData => enrichOrderData(orderData))
        );

        // Previous statuses ni yangilash (tracking uchun)
        enrichedOrders.forEach(orderData => {
            const orderId = orderData.order.id;
            const status = orderData.order.status;
            if (!previousOrderStatuses[orderId]) {
                previousOrderStatuses[orderId] = status;
            }
        });

        loadingOrders.classList.remove('active');

        const groupedOrders = groupOrdersByDate(enrichedOrders);
        const sortedDates = Object.keys(groupedOrders).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(dateKey => {
            const orders = groupedOrders[dateKey];
            orders.sort((a, b) => new Date(b.order.createdAt) - new Date(a.order.createdAt));

            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';

            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.textContent = formatDate(orders[0].order.createdAt);
            dateGroup.appendChild(dateHeader);

            orders.forEach(orderData => {
                const card = renderOrderCard(orderData);
                dateGroup.appendChild(card);
            });

            ordersContainer.appendChild(dateGroup);
        });

    } catch (error) {
        console.error('Buyurtmalarni yuklashda xatolik:', error);
        loadingOrders.classList.remove('active');
        
        if (error.message.includes('Failed to fetch')) {
            showError('Internetga ulanishda muammo. Iltimos, internet ulanishingizni tekshiring.');
        } else {
            showError(error.message || 'Noma\'lum xatolik yuz berdi');
        }
    }
}

// Sahifa yuklanganda va sahifa ko'rinib turganda
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    startStatusTracking();
});

// Sahifa yopilganda tracking to'xtatish
window.addEventListener('beforeunload', () => {
    stopStatusTracking();
});

// Sahifa visibility o'zgarganda (background/foreground)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Sahifa background ga ketdi - tracking ni to'xtatmaymiz, davom ettiraveramiz
        console.log('📱 Page hidden, tracking continues');
    } else {
        // Sahifa foreground ga qaytdi - yangi ma'lumotlarni yuklash
        console.log('📱 Page visible, reloading orders');
        loadOrders();
    }
});
