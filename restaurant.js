const API_BASE_URL = 'http://localhost:8080'; // API manzili, kerak bo'lsa o'zgartiring

/* ================= URL PARAMS ================= */

const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id'); // restaurantId → shopId

if (!shopId) {
    alert("Restoran aniqlanmadi!");
    window.location.href = 'index.html';
}

// shopId ni saqlab qo'yamiz (cart uchun kerak bo'ladi)
localStorage.setItem("shopId", shopId);
sessionStorage.setItem("shopId", shopId);

/* ================= ELEMENTS ================= */

const productsContainer = document.getElementById('productsContainer');
const categoryBar = document.getElementById('categoryBar');
const restaurantName = document.getElementById('restaurant-name');
const deliveryTime = document.getElementById('delivery-time');

const backBtn = document.getElementById('backToMenuBtn');
const infoBtn = document.getElementById('info-btn');
const modal = document.getElementById('infoModal');
const modalBackBtn = document.getElementById('backBtn');
const modalBody = document.getElementById('modalBody');

let shopData = null;

/* ================= BACK ================= */

backBtn.onclick = () => {
    window.location.href = 'index.html';
};

/* ================= LOAD PRODUCTS ================= */

async function fetchProducts() {

    productsContainer.innerHTML = "Yuklanmoqda...";

    const res = await fetch(`${API_BASE_URL}/user/shops/${shopId}/products`);
    const products = await res.json();

    if (products.length > 0) {
        shopData = products[0].shop;
        restaurantName.innerText = shopData.name;
        deliveryTime.innerText = shopData.estimatedDeliveryTime
            ? shopData.estimatedDeliveryTime + " min"
            : '';
    }

    // FAQAT ACTIVE MAHSULOTLARNI FILTRLASH
    const activeProducts = products.filter(p => p.isActive === true || p.is_active === true);

    const categorized = {};

    activeProducts.forEach(p => {
        const cat = p.category?.name || "Boshqa";
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(p);
    });

    renderCategories(categorized);
    renderProducts(categorized);
}

/* ================= CATEGORY BAR ================= */

function renderCategories(categorized) {

    categoryBar.innerHTML = '';

    Object.keys(categorized).forEach(cat => {

        const chip = document.createElement('div');
        chip.className = 'category-chip';
        chip.innerText = cat;

        chip.onclick = () => {
            document
                .querySelector(`[data-category="${cat}"]`)
                .scrollIntoView({ behavior: 'smooth' });
        };

        categoryBar.appendChild(chip);
    });
}

/* ================= PRODUCTS ================= */

function renderProducts(categorized) {

    productsContainer.innerHTML = '';

    Object.entries(categorized).forEach(([category, products]) => {

        const title = document.createElement('div');
        title.className = 'category-title';
        title.innerText = category;
        title.dataset.category = category;

        const grid = document.createElement('div');
        grid.className = 'category-grid';

        products.forEach(p => {

            const card = document.createElement('div');
            card.className = 'product-card';

            card.innerHTML = `
                <img src="${p.imageUrl || p.image || 'https://via.placeholder.com/150'}">
                <h4>${p.name}</h4>
                <p class="product-price">${p.price} сум</p>
                <button class="add-button">+</button>
            `;

            card.onclick = () => openProductDetail(p.id);
            grid.appendChild(card);
        });

        productsContainer.append(title, grid);
    });
}

/* ================= INFO MODAL ================= */

infoBtn.onclick = () => {
    if (!shopData) return;

    modalBody.innerHTML = `
        <h3>${shopData.name}</h3>
        <p>${shopData.description || ''}</p>
        <p><b>Manzil:</b> ${shopData.address || 'N/A'}</p>
        <p><b>Yetkazish:</b> ${shopData.estimatedDeliveryTime || 'N/A'} min</p>
    `;

    modal.classList.add('active');
};

modalBackBtn.onclick = () => modal.classList.remove('active');

/* ================= PRODUCT DETAIL ================= */

const productModal = document.getElementById('productModal');
const productCloseBtn = document.getElementById('productCloseBtn');
const decreaseBtn = document.getElementById('decreaseBtn');
const increaseBtn = document.getElementById('increaseBtn');
const quantityInput = document.getElementById('quantityInput');
const addToCartBtn = document.getElementById('addToCartBtn');

let currentProductId = null;

async function openProductDetail(productId) {

    currentProductId = productId;
    banner.style.display = 'none'; // 👈 SHU QATOR


    const res = await fetch(`${API_BASE_URL}/user/shops/${shopId}/products/${productId}`);
    const product = await res.json();

    document.getElementById('productDetailImage').src =
        product.imageUrl || product.image || 'https://via.placeholder.com/300';

    document.getElementById('productDetailName').innerText = product.name;
    document.getElementById('productDetailDesc').innerText = product.description || '';
    document.getElementById('productDetailPrice').innerText = `${product.price} сум`;
    document.getElementById('productDetailWeight').innerText = `${product.weight || 0} г`;

    quantityInput.value = 1;
    productModal.classList.add('active');
}

productCloseBtn.onclick = () => productModal.classList.remove('active');

decreaseBtn.onclick = () => {
    if (quantityInput.value > 1) quantityInput.value--;
};

increaseBtn.onclick = () => {
    quantityInput.value++;
};

/* ================= ADD TO CART ================= */

const banner = document.getElementById('cartBanner');
const goToCartBtn = document.getElementById('goToCartBtn');

// Add to cart tugmasi bosilganda
addToCartBtn.onclick = async () => {
    const phone = sessionStorage.getItem("userPhone") || localStorage.getItem("userPhone");

    if (!phone) {
        alert("Avval telefon raqamingizni kiriting!");
        window.location.href = 'index.html';
        return;
    }

    const quantity = parseInt(quantityInput.value);
    const price = parseFloat(
        document.getElementById('productDetailPrice').innerText.replace(' сум', '')
    );

    // Backendga POST qilish
    await fetch(`${API_BASE_URL}/api/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            phone: phone,
            shopId: Number(shopId),
            productId: currentProductId,
            price: price,
            quantity: quantity
        })
    });

    productModal.classList.remove('active');

    // Bannerni ko'rsatish
    banner.style.display = 'flex';
};

// Bannerdagi tugma bosilganda
goToCartBtn.onclick = () => {
    window.location.href = './cart/cart.html'; // Korzina sahifasiga o'tadi
};

function setupScrollObserver() {
    const categoryTitles = document.querySelectorAll('.category-title');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const categoryName = entry.target.dataset.category;
                
                // Active class o'zgartirish
                document.querySelectorAll('.category-chip').forEach(chip => {
                    chip.classList.remove('active');
                });
                
                const activeChip = document.querySelector(`.category-chip[data-category="${categoryName}"]`);
                if (activeChip) {
                    activeChip.classList.add('active');
                    activeChip.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }
        });
    }, {
        threshold: 0.5,
        rootMargin: '-160px 0px 0px 0px'
    });
    
    categoryTitles.forEach(title => observer.observe(title));
}




/* ================= START ================= */

fetchProducts();