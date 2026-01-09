/* 
    STUDENT INITIALS: EM
    FILE: js/main.js
    DESCRIPTION: Handles Shopping Cart, Rental Calculation, and Checkout
*/

// --- 1. SHOPPING CART LOGIC ---

// Get cart from LocalStorage or create empty array
let emCart = JSON.parse(localStorage.getItem('emCart')) || [];

// Function to update the badge number in Navbar
function emUpdateBadge() {
    const badge = document.getElementById('em-cart-count');
    if (badge) {
        badge.innerText = emCart.reduce((total, item) => total + item.quantity, 0);
    }
}

// Function to Add Item to Cart
function emAddToCart(id, name, price, image, type) {
    // Check if item exists
    let existingItem = emCart.find(item => item.id === id && item.type === type);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        emCart.push({
            id: id,
            name: name,
            price: price,
            image: image,
            type: type,
            quantity: 1,
            rentDays: 0 // Default for non-rentals
        });
    }

    // Save to LocalStorage
    localStorage.setItem('emCart', JSON.stringify(emCart));
    
    // Update UI
    emUpdateBadge();
    
    // Show Success Toast
    if (typeof showToast === 'function') {
        showToast(`${name} added to your cart!`, 'success');
    }
}

// --- 2. RENTAL CALCULATOR (Real-time) ---
// This runs only if we are on the Rent page
function emInitRentalCalc() {
    const startInput = document.getElementById('em-start-date');
    const endInput = document.getElementById('em-end-date');
    const display = document.getElementById('em-price-display');
    const dailyRate = 1200; // Example base rate

    if (startInput && endInput && display) {
        const calculate = () => {
            const start = new Date(startInput.value);
            const end = new Date(endInput.value);
            
            if (start && end && end > start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                const total = diffDays * dailyRate;
                
                display.innerHTML = `Total for ${diffDays} days: <span class="text-dark fw-bold">$${total.toLocaleString()}</span>`;
                
                // Update the "Rent Now" button to include these dates
                const rentBtn = document.getElementById('em-rent-btn');
                rentBtn.onclick = function() {
                    emAddToCart('r1', 'Rental Service', total, 'https://via.placeholder.com/400x200?text=Rental+Car', 'Rental');
                };
            } else {
                display.innerText = "Please select valid dates.";
            }
        };

        startInput.addEventListener('change', calculate);
        endInput.addEventListener('change', calculate);
    }
}

// --- 3. CHECKOUT PAGE LOGIC ---
function emRenderCheckout() {
    const tableBody = document.getElementById('em-checkout-body');
    const totalDisplay = document.getElementById('em-final-total');

    if (tableBody) {
        tableBody.innerHTML = '';
        let grandTotal = 0;

        emCart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            grandTotal += itemTotal;

            const row = `
                <tr>
                    <td><img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"></td>
                    <td>
                        <strong>${item.name}</strong><br>
                        <small class="text-muted">${item.type}</small>
                    </td>
                    <td>$${item.price.toLocaleString()}</td>
                    <td>${item.quantity}</td>
                    <td>$${itemTotal.toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="emRemoveItem(${index})">&times;</button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        if (totalDisplay) {
            totalDisplay.innerText = '$' + grandTotal.toLocaleString();
        }
    }
}

function emRemoveItem(index) {
    emCart.splice(index, 1);
    localStorage.setItem('emCart', JSON.stringify(emCart));
    emRenderCheckout();
    emUpdateBadge();
}

function emCheckoutSuccess() {
    if (emCart.length === 0) {
        if (typeof showNotificationModal === 'function') {
            showNotificationModal("Your cart is empty!", 'warning');
        }
        return;
    }

    // Check if user is logged in and save order
    if (typeof EMAuth !== 'undefined') {
        const user = EMAuth.getCurrentUser();
        if (user && user.isLoggedIn && user.userType === 'user') {
            // Calculate total
            const total = emCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Create order
            EMAuth.addOrder(user.googleId, {
                items: emCart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    type: item.type
                })),
                total: total
            });
        }
    }

    // Logic for success popup
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    document.getElementById('em-success-date').innerText = new Date().toLocaleDateString();
    modal.show();
    
    // Clear cart
    emCart = [];
    localStorage.setItem('emCart', JSON.stringify(emCart));
    emRenderCheckout();
    emUpdateBadge();
}

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    emUpdateBadge();
    emInitRentalCalc();
    emRenderCheckout();
});