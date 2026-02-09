const API_BASE_URL = "https://daturxonbg-production.up.railway.app"; // --- IGNORE ---
const cartContainer = document.getElementById("cartContainer");
const loadingDiv = document.getElementById("loadingCart");

let currentShopId = null;

/**
 * Telefon raqamni olish
 */
function getUserPhone() {
    let phone = sessionStorage.getItem("userPhone");
    
    if (!phone) {
        phone = localStorage.getItem("userPhone");
        if (phone) {
            sessionStorage.setItem("userPhone", phone);
        }
    }
    
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
 * Bo'sh savat ekranini ko'rsatish
 */
function showEmptyCart() {
    cartContainer.innerHTML = `
        <div class="empty-cart">
            <div class="empty-cart-icon">🛒</div>
            <h2 class="empty-cart-title">Savatingiz bo'sh</h2>
            <p class="empty-cart-text">Hozircha hech narsa qo'shilmagan. Kerakli mahsulotlarni tanlang va buyurtma bering!</p>
            <button class="back-to-shop-btn" onclick="window.location.href='/index.html'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Bosh sahifaga qaytish
            </button>
        </div>
    `;
}

/**
 * Savatni yuklash
 */
async function loadCart() {
    const phone = getUserPhone();
    
    if (!phone) {
        showEmptyCart();
        return;
    }

    loadingDiv.style.display = "block";
    cartContainer.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE_URL}/api/cart/all?phone=${encodeURIComponent(phone)}`);
        
        // Agar API xatolik qaytarsa (404, 500, va h.k.)
        if (!res.ok) {
            console.warn('Cart API xatolik:', res.status);
            loadingDiv.style.display = "none";
            showEmptyCart();
            return;
        }

        const data = await res.json();

        // Agar data bo'sh bo'lsa yoki array emas bo'lsa
        if (!data || !Array.isArray(data) || data.length === 0) {
            loadingDiv.style.display = "none";
            showEmptyCart();
            return;
        }

        // Active cart itemlarni filtrlash (quantity > 0)
        const activeItems = data.filter(item => item.quantity && item.quantity > 0);

        // Agar active itemlar bo'lmasa
        if (activeItems.length === 0) {
            loadingDiv.style.display = "none";
            showEmptyCart();
            return;
        }

        // Shoplar bo'yicha guruhlash
        const groupedCart = groupByShop(activeItems);

        // Agar guruhlanganidan keyin bo'sh bo'lsa
        if (Object.keys(groupedCart).length === 0) {
            loadingDiv.style.display = "none";
            showEmptyCart();
            return;
        }

        cartContainer.innerHTML = "";

        // Shoplarni cartId bo'yicha sort qilish
        const sortedShops = Object.entries(groupedCart)
            .sort((a, b) => {
                const firstCartId = Math.min(...a[1].map(item => item.cartId));
                const secondCartId = Math.min(...b[1].map(item => item.cartId));
                return firstCartId - secondCartId;
            });

        for (const [shopId, items] of sortedShops) {
            // Shop Header
            const shopName = items[0].product?.shop?.name || `Restoran ${shopId}`;
            const shopHeader = document.createElement("h3");
            shopHeader.className = "shop-header";
            shopHeader.textContent = shopName;
            cartContainer.appendChild(shopHeader);

            // Mahsulotlar
            items.forEach(item => {
                const div = document.createElement("div");
                div.className = "cart-item";

                const productName = item.productName || item.product?.name || item.name || 'Mahsulot';
                const productImage = item.productImage || item.product?.imageUrl || '/img/premium.jpg';
                const productPrice = item.price || item.product?.price || 0;
                const quantity = item.quantity || 1;
                const itemId = item.id;
                const cartId = item.cartId || 1;
                const productId = item.productId;

                div.innerHTML = `
                    <img src="${productImage}" alt="${productName}" class="cart-item-image" onerror="this.src='/img/premium.jpg'">
                    <div class="cart-item-info">
                        <h4>${productName}</h4>
                        <p class="cart-item-price">${productPrice.toLocaleString()} so'm</p>
                        <div class="quantity-controls">
                            <button class="minus" data-item-id="${itemId}" data-cart-id="${cartId}" data-product-id="${productId}">-</button>
                            <span class="quantity">${quantity}</span>
                            <button class="plus" data-item-id="${itemId}" data-cart-id="${cartId}" data-product-id="${productId}">+</button>
                        </div>
                    </div>
                    <button class="remove-btn" data-item-id="${itemId}" data-cart-id="${cartId}" data-product-id="${productId}" title="O'chirish">🗑️</button>
                `;

                div.querySelector(".minus").addEventListener("click", () => {
                    const newQty = quantity - 1;
                    if (newQty < 1) {
                        if (confirm("Mahsulotni savatdan o'chirmoqchimisiz?")) {
                            deleteCartItem(itemId, cartId, productId);
                        }
                    } else {
                        updateCartItem(cartId, productId, newQty, itemId);
                    }
                });

                div.querySelector(".plus").addEventListener("click", () => updateCartItem(cartId, productId, quantity + 1, itemId));
                div.querySelector(".remove-btn").addEventListener("click", () => {
                    if (confirm("Mahsulotni savatdan o'chirmoqchimisiz?")) {
                        deleteCartItem(itemId, cartId, productId);
                    }
                });

                cartContainer.appendChild(div);
            });

            // Chek
            const receiptDiv = document.createElement("div");
            receiptDiv.className = "receipt-container";

            const deliveryFeePerKm = items[0].product?.shop?.deliveryFeePerKm || 0;
            const baseDeliveryFee = items[0].product?.shop?.baseDeliveryFee || 0;

            let receiptItemsHTML = "";
            let total = 0;

            items.forEach(item => {
                const productName = item.productName || item.product?.name || 'Mahsulot';
                const productPrice = item.price || item.product?.price || 0;
                const quantity = item.quantity || 1;
                const subTotal = productPrice * quantity;
                total += subTotal;

                receiptItemsHTML += `
                    <div class="receipt-item">
                        <span>${productName} x ${quantity}</span>
                        <span>${subTotal.toLocaleString()} so'm</span>
                    </div>
                `;
            });

            // Delivery fee (faqat asosiy to'lov ko'rsatiladi, km bo'yicha emas)
            let deliveryHTML = "";
            if (baseDeliveryFee > 0 || deliveryFeePerKm > 0) {
                const deliveryText = baseDeliveryFee > 0 
                    ? `Servis hizmati` 
                    : `Yetkazib berish (1 km)`;
                const deliveryAmount = 4900;
                
                deliveryHTML = `
                    <div class="receipt-item delivery">
                        <span>${deliveryText}</span>
                        <span>${deliveryAmount.toLocaleString()} so'm</span>
                    </div>
                    <div class="delivery-note">* Aniq yetkazib berish narxi joylashuvga qarab hisoblanadi</div>
                `;
            }

            receiptDiv.innerHTML = `
                <div class="receipt">
                    <div class="receipt-title">CHEK</div>
                    <div class="receipt-separator-main"></div>

                    ${receiptItemsHTML}

                    ${deliveryHTML}

                    <div class="receipt-separator"></div>

                    <div class="receipt-total">
                        <span>TAXMINIY SUMMA:</span>
                        <span class="receipt-total-amount">
                            ${(total + (baseDeliveryFee > 0 ? baseDeliveryFee : deliveryFeePerKm)).toLocaleString()} so'm
                        </span>
                    </div>
                </div>
            `;

            cartContainer.appendChild(receiptDiv);

            // Buyurtma tugmasi
            const checkoutDiv = document.createElement("div");
            checkoutDiv.className = "checkout-container";
            checkoutDiv.innerHTML = `
                <button class="checkout-btn" onclick="checkout(${shopId})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                    Buyurtma berish
                </button>
            `;
            cartContainer.appendChild(checkoutDiv);
        }

    } catch (err) {
        console.error('Savat yuklashda xatolik:', err);
        cartContainer.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h2 class="error-title">Xatolik yuz berdi</h2>
                <p class="error-text">${err.message}</p>
                <button class="retry-btn" onclick="loadCart()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 4v6h6M23 20v-6h-6"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                    Qayta urinish
                </button>
            </div>
        `;
    } finally {
        loadingDiv.style.display = "none";
    }
}

/**
 * Checkout funksiyasi
 */
function checkout(shopId) {
    const phone = getUserPhone();
    if (!phone) {
        alert("Telefon raqam topilmadi!");
        window.location.href = '/index.html';
        return;
    }

    const urlShopId = shopId || getShopId();
    window.location.href = `./order/order.html?shopId=${urlShopId}`;
}

/**
 * Guruhlash funksiyasi
 */
function groupByShop(cartItems) {
    const grouped = {};

    if (!Array.isArray(cartItems)) return grouped;

    cartItems.forEach(item => {
        const shopId = item.product?.shop?.id || 1;

        if (!grouped[shopId]) grouped[shopId] = [];

        grouped[shopId].push(item);
    });

    return grouped;
}

/**
 * Savat itemini yangilash
 */
async function updateCartItem(cartId, productId, newQty, itemId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/cart/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cartId: cartId,
                productId: productId,
                quantity: newQty
            })
        });

        if (!res.ok) throw new Error("Savatni yangilashda xatolik");

        console.log('Cart item updated:', { cartId, productId, quantity: newQty });
        loadCart();
    } catch (err) {
        console.error(err);
        alert("Savatni yangilashda xatolik yuz berdi");
    }
}

/**
 * Savat itemini o'chirish
 */
async function deleteCartItem(itemId, cartId, productId) {
    const phone = getUserPhone();
    if (!phone) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/cart/delete/${itemId}?phone=${encodeURIComponent(phone)}`, {
            method: "DELETE"
        });

        if (!res.ok) {
            // Fallback: quantity=0 bilan update
            await updateCartItem(cartId, productId, 0, itemId);
            return;
        }

        console.log('Cart item deleted:', { itemId, cartId, productId });
        loadCart();
    } catch (err) {
        console.error(err);
        // Fallback: quantity=0 bilan update
        await updateCartItem(cartId, productId, 0, itemId);
    }
}

// Sahifa yuklanganda
document.addEventListener("DOMContentLoaded", () => {
    loadCart();
});
