/**
 * Telefon raqam boshqaruvi uchun backend API
 * Foydalanuvchi telefon raqamini saqlash, tekshirish va last login ni yangilash
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// ============================================
// IN-MEMORY DATABASE (Haqiqiy database o'rniga)
// Haqiqiy loyihada MongoDB yoki boshqa DB ishlatiladi
// ============================================

const contacts = new Map(); // phoneNumber -> contact data

/**
 * Contact interface:
 * {
 *   phoneNumber: "+998901234567",
 *   firstName: null,
 *   lastName: null,
 *   createdAt: "2024-02-03T10:30:00Z",
 *   lastLogin: "2024-02-03T10:30:00Z"
 * }
 */

const carts = new Map(); // "phone_shopId" -> cart object
let cartItemId = 1; // Auto-increment cart item ID

/**
 * Cart interface:
 * {
 *   phone: "+998901234567",
 *   shopId: 1,
 *   items: [
 *     {
 *       id: 1,
 *       cartId: 1,
 *       productId: 101,
 *       quantity: 2,
 *       price: 35000
 *     }
 *   ]
 * }
 */

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/contacts/check
 * Telefon raqamini tekshirish (yangi kontakt yoki mavjud)
 */
app.get('/api/contacts/check', (req, res) => {
    const phone = req.query.phone;
    
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    const isNewContact = !contacts.has(phone);
    
    console.log(`[CHECK] Phone: ${phone}, isNew: ${isNewContact}`);
    
    res.json({
        isNewContact: isNewContact,
        phoneNumber: phone
    });
});

/**
 * POST /api/contacts
 * Yangi kontakt yaratish yoki mavjudni yangilash
 */
app.post('/api/contacts', (req, res) => {
    const { phoneNumber, firstName, lastName } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    const now = new Date().toISOString();
    const isNew = !contacts.has(phoneNumber);
    
    // Kontaktni saqlash yoki yangilash
    const contact = {
        phoneNumber: phoneNumber,
        firstName: firstName || null,
        lastName: lastName || null,
        createdAt: isNew ? now : (contacts.get(phoneNumber)?.createdAt || now),
        lastLogin: now
    };
    
    contacts.set(phoneNumber, contact);
    
    console.log(`[SAVE] Contact saved:`, contact);
    
    res.status(200).json({
        success: true,
        isNew: isNew,
        contact: contact
    });
});

/**
 * POST /api/contacts/login
 * Last login ni yangilash
 */
app.post('/api/contacts/login', (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    const contact = contacts.get(phoneNumber);
    
    if (!contact) {
        return res.status(404).json({ 
            error: 'Contact not found',
            phoneNumber: phoneNumber
        });
    }
    
    const now = new Date().toISOString();
    contact.lastLogin = now;
    
    console.log(`[LOGIN] Last login updated for ${phoneNumber}: ${now}`);
    
    res.json({
        success: true,
        contact: contact
    });
});

/**
 * GET /api/contacts/:phone
 * Kontakt haqida ma'lumot olish
 */
app.get('/api/contacts/:phone', (req, res) => {
    const phone = req.params.phone;
    const contact = contacts.get(phone);
    
    if (!contact) {
        return res.status(404).json({ 
            error: 'Contact not found',
            phoneNumber: phone
        });
    }
    
    console.log(`[GET] Contact retrieved:`, contact);
    
    res.json(contact);
});

/**
 * GET /api/contacts
 * Barcha kontaktlarni olish (admin uchun)
 */
app.get('/api/contacts', (req, res) => {
    const allContacts = Array.from(contacts.values());
    
    console.log(`[GET_ALL] Total contacts: ${allContacts.length}`);
    
    res.json({
        total: allContacts.length,
        contacts: allContacts
    });
});

/**
 * PUT /api/contacts/:phone
 * Kontaktni yangilash
 */
app.put('/api/contacts/:phone', (req, res) => {
    const phone = req.params.phone;
    const { firstName, lastName } = req.body;
    
    const contact = contacts.get(phone);
    
    if (!contact) {
        return res.status(404).json({ 
            error: 'Contact not found',
            phoneNumber: phone
        });
    }
    
    if (firstName) contact.firstName = firstName;
    if (lastName) contact.lastName = lastName;
    
    console.log(`[UPDATE] Contact updated:`, contact);
    
    res.json({
        success: true,
        contact: contact
    });
});

/**
 * DELETE /api/contacts/:phone
 * Kontaktni o'chirish
 */
app.delete('/api/contacts/:phone', (req, res) => {
    const phone = req.params.phone;
    
    if (!contacts.has(phone)) {
        return res.status(404).json({ 
            error: 'Contact not found',
            phoneNumber: phone
        });
    }
    
    contacts.delete(phone);
    
    console.log(`[DELETE] Contact deleted: ${phone}`);
    
    res.json({
        success: true,
        message: 'Contact deleted',
        phoneNumber: phone
    });
});

/**
 * ============================================
 * CART ENDPOINTS
 * ============================================
 */

/**
 * GET /api/cart
 * Savatni olish (phone va shopId orqali)
 */
app.get('/api/cart', (req, res) => {
    const phone = req.query.phone;
    const shopId = req.query.shopId;
    
    if (!phone || !shopId) {
        return res.status(400).json({ error: 'Phone and shopId required' });
    }
    
    const cartKey = `${phone}_${shopId}`;
    const cart = carts.get(cartKey);
    
    console.log(`[GET_CART] Phone: ${phone}, ShopId: ${shopId}, Items: ${cart ? cart.items.length : 0}`);
    
    if (!cart || cart.items.length === 0) {
        return res.json([]);
    }
    
    res.json(cart.items);
});

/**
 * POST /api/cart/add
 * Savatga mahsulot qo'shish
 */
app.post('/api/cart/add', (req, res) => {
    const { phone, shopId, productId, price, quantity } = req.body;
    
    if (!phone || !shopId || !productId || price === undefined || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const cartKey = `${phone}_${shopId}`;
    
    // Cart yaratish yoki mavjudni olish
    let cart = carts.get(cartKey);
    if (!cart) {
        cart = {
            phone: phone,
            shopId: shopId,
            items: [],
            createdAt: new Date().toISOString()
        };
    }
    
    // Mahsulot allaqachon savatda bor-yo'qligini tekshirish
    const existingItem = cart.items.find(item => item.productId === productId);
    
    if (existingItem) {
        // Miqdorni yangilash
        existingItem.quantity += quantity;
    } else {
        // Yangi mahsulot qo'shish
        cart.items.push({
            id: cartItemId++,
            cartId: 1, // Static cart ID
            productId: productId,
            quantity: quantity,
            price: price
        });
    }
    
    carts.set(cartKey, cart);
    
    console.log(`[ADD_TO_CART] Phone: ${phone}, ShopId: ${shopId}, ProductId: ${productId}, Qty: ${quantity}`);
    
    res.json({
        success: true,
        item: cart.items.find(item => item.productId === productId),
        cart: cart
    });
});

/**
 * POST /api/cart/update
 * Savatdagi mahsulot miqdorini yangilash
 * Request: { cartId: 1, productId: 101, quantity: 5 }
 */
app.post('/api/cart/update', (req, res) => {
    const { cartId, productId, quantity } = req.body;
    
    if (cartId === undefined || !productId || quantity === undefined) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['cartId', 'productId', 'quantity']
        });
    }
    
    // Barcha cartlardan productId ni topish
    let foundCart = null;
    let foundKey = null;
    let foundItem = null;
    
    for (const [key, cart] of carts) {
        const item = cart.items.find(i => i.productId === productId);
        if (item) {
            foundCart = cart;
            foundKey = key;
            foundItem = item;
            break;
        }
    }
    
    if (!foundCart || !foundItem) {
        return res.status(404).json({ 
            error: 'Product not found in cart',
            productId: productId
        });
    }
    
    // Miqdori 0 bo'lsa o'chirish
    if (quantity <= 0) {
        foundCart.items = foundCart.items.filter(i => i.productId !== productId);
        console.log(`[UPDATE_CART] ProductId: ${productId}, Deleted (qty was ${quantity})`);
        
        res.json({
            success: true,
            message: 'Item removed from cart',
            productId: productId
        });
    } else {
        foundItem.quantity = quantity;
        carts.set(foundKey, foundCart);
        
        console.log(`[UPDATE_CART] CartId: ${cartId}, ProductId: ${productId}, NewQty: ${quantity}`);
        
        res.json({
            success: true,
            message: 'Cart updated',
            item: foundItem,
            cart: foundCart
        });
    }
});

/**
 * DELETE /api/cart/delete/:itemId
 * Savatdan mahsulot o'chirish
 */
app.delete('/api/cart/delete/:itemId', (req, res) => {
    const itemId = parseInt(req.params.itemId);
    const phone = req.query.phone;
    
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    let deleted = false;
    
    for (const [key, cart] of carts) {
        const initialLength = cart.items.length;
        cart.items = cart.items.filter(item => item.id !== itemId);
        
        if (cart.items.length < initialLength) {
            carts.set(key, cart);
            deleted = true;
            break;
        }
    }
    
    if (!deleted) {
        return res.status(404).json({ error: 'Item not found' });
    }
    
    console.log(`[DELETE_ITEM] ItemId: ${itemId}`);
    
    res.json({
        success: true,
        message: 'Item deleted from cart'
    });
});

/**
 * DELETE /api/cart/clear
 * Butun savatni o'chirish
 */
app.delete('/api/cart/clear', (req, res) => {
    const phone = req.query.phone;
    const shopId = req.query.shopId;
    
    if (!phone || !shopId) {
        return res.status(400).json({ error: 'Phone and shopId required' });
    }
    
    const cartKey = `${phone}_${shopId}`;
    
    if (carts.has(cartKey)) {
        carts.delete(cartKey);
    }
    
    console.log(`[CLEAR_CART] Phone: ${phone}, ShopId: ${shopId}`);
    
    res.json({
        success: true,
        message: 'Cart cleared'
    });
});

/**
 * GET /api/cart/all
 * Barcha cartlarni olish (admin uchun)
 */
app.get('/api/cart/all', (req, res) => {
    const allCarts = Array.from(carts.values());
    
    console.log(`[GET_ALL_CARTS] Total carts: ${allCarts.length}`);
    
    res.json({
        total: allCarts.length,
        carts: allCarts
    });
});

/**
 * ============================================
 * PRODUCT ENDPOINTS
 * ============================================
 */

/**
 * Mock Products Data
 */
const products = {
    1: {
        101: {
            id: 101,
            name: 'Margarita Pizza',
            description: 'Klassik italyan pitstsasi pomidor, mozarella va bazilikon bilan',
            price: 35000,
            weight: 350,
            quantity: 100,
            imageUrl: '/img/pizza1.jpg',
            prepareTime: 15,
            shop: {
                id: 1,
                name: 'Пиццерия "Доменико"',
                address: 'Toshkent shahar, Oloy ko\'chasi',
                description: 'Italyan pitstsasi, pasta',
                estimatedDeliveryTime: '25-35',
                image: '/img/premium.jpg'
            },
            category: {
                id: 1,
                name: 'Pizza'
            }
        },
        102: {
            id: 102,
            name: 'Pepperoni Pizza',
            description: 'Pepperoni va mozarella bilan mazalli pitsa',
            price: 45000,
            weight: 400,
            quantity: 80,
            imageUrl: '/img/pizza2.jpg',
            prepareTime: 18,
            shop: {
                id: 1,
                name: 'Пиццерия "Доменико"',
                address: 'Toshkent shahar, Oloy ko\'chasi',
                description: 'Italyan pitstsasi, pasta',
                estimatedDeliveryTime: '25-35',
                image: '/img/premium.jpg'
            },
            category: {
                id: 1,
                name: 'Pizza'
            }
        },
        103: {
            id: 103,
            name: 'Spaghetti Carbonara',
            description: 'Klassik italyan pasta spagettini bilan',
            price: 32000,
            weight: 300,
            quantity: 60,
            imageUrl: '/img/pasta1.jpg',
            prepareTime: 20,
            shop: {
                id: 1,
                name: 'Пиццерия "Доменико"',
                address: 'Toshkent shahar, Oloy ko\'chasi',
                description: 'Italyan pitstsasi, pasta',
                estimatedDeliveryTime: '25-35',
                image: '/img/premium.jpg'
            },
            category: {
                id: 2,
                name: 'Pasta'
            }
        }
    },
    2: {
        201: {
            id: 201,
            name: 'Cheeseburger',
            description: 'Klassik burger pishloq va marinada bilan',
            price: 25000,
            weight: 250,
            quantity: 120,
            imageUrl: '/img/burger1.jpg',
            prepareTime: 10,
            shop: {
                id: 2,
                name: 'Бургер King',
                address: 'Toshkent shahar, Amir Temur ko\'chasi',
                description: 'Fastfood, burgerlar',
                estimatedDeliveryTime: '20-30',
                image: '/img/premium.jpg'
            },
            category: {
                id: 3,
                name: 'Burgers'
            }
        },
        202: {
            id: 202,
            name: 'Chicken Nuggets',
            description: 'Mazali tavuk nuggetlari',
            price: 18000,
            weight: 200,
            quantity: 150,
            imageUrl: '/img/nuggets1.jpg',
            prepareTime: 8,
            shop: {
                id: 2,
                name: 'Бургер King',
                address: 'Toshkent shahar, Amir Temur ko\'chasi',
                description: 'Fastfood, burgerlar',
                estimatedDeliveryTime: '20-30',
                image: '/img/premium.jpg'
            },
            category: {
                id: 4,
                name: 'Sides'
            }
        }
    }
};

/**
 * GET /user/shops/:shopId/products/:productId
 * Mahsulot haqida to'liq ma'lumot olish
 */
app.get('/user/shops/:shopId/products/:productId', (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const productId = parseInt(req.params.productId);
    
    if (!shopId || !productId) {
        return res.status(400).json({ error: 'ShopId and ProductId required' });
    }
    
    const shopProducts = products[shopId];
    if (!shopProducts) {
        return res.status(404).json({ 
            error: 'Shop not found',
            shopId: shopId
        });
    }
    
    const product = shopProducts[productId];
    if (!product) {
        return res.status(404).json({ 
            error: 'Product not found',
            shopId: shopId,
            productId: productId
        });
    }
    
    console.log(`[GET_PRODUCT] ShopId: ${shopId}, ProductId: ${productId}`);
    
    res.json(product);
});

/**
 * GET /user/shops/:shopId/products
 * Magazinning barcha mahsulotlari
 */
app.get('/user/shops/:shopId/products', (req, res) => {
    const shopId = parseInt(req.params.shopId);
    
    if (!shopId) {
        return res.status(400).json({ error: 'ShopId required' });
    }
    
    const shopProducts = products[shopId];
    if (!shopProducts) {
        return res.status(404).json({ 
            error: 'Shop not found',
            shopId: shopId
        });
    }
    
    const productList = Object.values(shopProducts);
    
    console.log(`[GET_SHOP_PRODUCTS] ShopId: ${shopId}, Total: ${productList.length}`);
    
    res.json(productList);
});

/**
 * Mock data: /api/user/shops
 * Restoranlarga ma'lumotni qaytarish
 */
app.get('/api/user/shops', (req, res) => {
    const shops = [
        {
            id: 1,
            name: 'Пиццерия "Доменико"',
            description: 'Italyan pitstsasi, pasta',
            image: '/img/premium.jpg',
            rating: 4.9,
            estimatedDeliveryTime: '25-35',
            hasPromo: true
        },
        {
            id: 2,
            name: 'Бургер King',
            description: 'Fastfood, burgerlar',
            image: '/img/premium.jpg',
            rating: 4.7,
            estimatedDeliveryTime: '20-30',
            hasPromo: false
        },
        {
            id: 3,
            name: 'Milliy Ovqat',
            description: 'Milliy taomlar, shurvalar',
            image: '/img/premium.jpg',
            rating: 4.8,
            estimatedDeliveryTime: '30-45',
            hasPromo: true
        }
    ];
    
    res.json(shops);
});

// Root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Serverni ishga tushurish
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║  API Server ishga tushdi!                             ║
    ║  URL: http://localhost:${PORT}                        ║
    ║  CORS: Enabled                                        ║
    ║  Database: In-Memory (JSON)                           ║
    ╚═══════════════════════════════════════════════════════╝
    
    API Endpoints:
    ✓ GET  /api/contacts/check?phone=+998901234567
    ✓ GET  /api/contacts/:phone
    ✓ GET  /api/contacts
    ✓ POST /api/contacts
    ✓ POST /api/contacts/login
    ✓ PUT  /api/contacts/:phone
    ✓ DELETE /api/contacts/:phone
    
    Cart Endpoints:
    ✓ GET  /api/cart?phone=+998901234567&shopId=1
    ✓ POST /api/cart/add
    ✓ POST /api/cart/update
    ✓ DELETE /api/cart/delete/:itemId?phone=+998901234567
    ✓ DELETE /api/cart/clear?phone=+998901234567&shopId=1
    ✓ GET  /api/cart/all
    
    Product Endpoints:
    ✓ GET  /user/shops/:shopId/products/:productId
    ✓ GET  /user/shops/:shopId/products
    
    Shop Endpoints:
    ✓ GET  /api/user/shops
    
    Test: 
    curl http://localhost:${PORT}/user/shops/1/products/101
    curl http://localhost:${PORT}/user/shops/1/products
    curl http://localhost:${PORT}/api/user/shops
    `);
});
