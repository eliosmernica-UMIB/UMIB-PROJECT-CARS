/* 
    FILE: js/admin-dashboard.js
    DESCRIPTION: Admin Dashboard functionality
    - Dashboard statistics & Charts
    - Order management
    - Rental management
    - User management (ban/delete)
    - Inventory management (cars, rental cars, parts)
    - Inbox messaging
    - Support Tickets handling
    - Contact Messages
    - Blog Posts management
    - Testimonials management
*/

(function() {
    'use strict';

    let currentTicketFilter = 'all';
    let currentTestimonialFilter = 'all';
    let revenueChart = null;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Require admin authentication
        if (!EMAuth.requireAuth('admin')) {
            return;
        }

        // Load all dashboard data
        loadDashboardStats();
        loadCharts();
        loadOrders();
        loadRentals();
        loadCars();
        loadRentalCars();
        loadParts();
        loadUsers();
        loadInbox();
        loadTickets();
        loadMessages();
        loadBlogPosts();
        loadTestimonials();
        populateUserSelect();

        // Setup event listeners
        setupSidebarNavigation();
        setupCarForm();
        setupEditCarForm();
        setupRentalCarForm();
        setupEditRentalCarForm();
        setupPartForm();
        setupEditPartForm();
        setupBanForm();
        setupComposeMessageForm();
        setupReplyInboxForm();
        setupBlogForm();
        setupTicketResponseForm();
        setupUserSearch();

        // Update cart badge
        if (typeof emUpdateBadge === 'function') {
            emUpdateBadge();
        }
    });

    // ==================== DASHBOARD STATS ====================

    function loadDashboardStats() {
        const stats = EMAuth.getAdminStats();
        setElementText('stat-revenue', '$' + stats.revenue.toLocaleString());
        setElementText('stat-orders', stats.totalOrders);
        setElementText('stat-tickets', stats.openTickets);
        setElementText('stat-users', stats.totalUsers);
        setElementText('msg-badge', stats.unreadMessages);
        setElementText('inbox-badge', stats.unreadInbox);
        setElementText('order-revenue', '$' + stats.orderRevenue.toLocaleString());
        setElementText('rental-revenue', '$' + stats.rentalRevenue.toLocaleString());
    }

    // ==================== CHARTS ====================

    function loadCharts() {
        const chartData = EMAuth.getChartData();
        
        // Revenue Chart
        const ctx = document.getElementById('revenueChart');
        if (ctx) {
            if (revenueChart) {
                revenueChart.destroy();
            }
            
            revenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.months,
                    datasets: [{
                        label: 'Revenue ($)',
                        data: chartData.revenueData,
                        backgroundColor: 'rgba(255, 193, 7, 0.8)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
        
        // Category bars
        const catData = chartData.categoryData;
        setElementText('cat-cars', catData.cars + '%');
        setElementText('cat-rentals', catData.rentals + '%');
        setElementText('cat-parts', catData.parts + '%');
        
        const carsBar = document.getElementById('cat-cars-bar');
        const rentalsBar = document.getElementById('cat-rentals-bar');
        const partsBar = document.getElementById('cat-parts-bar');
        
        if (carsBar) carsBar.style.width = catData.cars + '%';
        if (rentalsBar) rentalsBar.style.width = catData.rentals + '%';
        if (partsBar) partsBar.style.width = catData.parts + '%';
    }

    // ==================== ORDERS ====================

    function loadOrders() {
        const orders = EMAuth.getAllOrders();
        const container = document.getElementById('orders-container');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = createEmptyState('bi-inbox', 'No orders yet.');
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        orders.forEach(order => {
            const statusClass = getStatusClass(order.status);
            const itemCount = order.items ? order.items.length : 1;
            html += `
                <tr>
                    <td><strong>${order.orderId}</strong></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <img src="${order.userPicture || 'https://via.placeholder.com/35'}" class="rounded-circle" width="35" height="35" style="object-fit: cover;">
                            <div>
                                <span class="d-block">${order.userName}</span>
                                <small class="text-muted">${order.userEmail}</small>
                            </div>
                        </div>
                    </td>
                    <td>${itemCount} item(s)</td>
                    <td>${EMAuth.formatDate(order.date)}</td>
                    <td>$${(order.total || 0).toLocaleString()}</td>
                    <td><span class="em-status-badge ${statusClass}">${order.status}</span></td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                                Update
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'pending'); return false;">Pending</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'confirmed'); return false;">Confirmed</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'processing'); return false;">Processing</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'shipped'); return false;">Shipped</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'out-for-delivery'); return false;">Out for Delivery</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'delivered'); return false;">Delivered</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'completed'); return false;">Completed</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="AdminDashboard.updateOrderStatus('${order.orderId}', 'cancelled'); return false;">Cancelled</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ==================== RENTALS ====================

    function loadRentals() {
        const rentals = EMAuth.getAllRentals();
        const container = document.getElementById('rentals-container');
        if (!container) return;

        if (rentals.length === 0) {
            container.innerHTML = createEmptyState('bi-key', 'No rentals yet.');
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Rental ID</th>
                            <th>Customer</th>
                            <th>Vehicle</th>
                            <th>Dates</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rentals.forEach(rental => {
            const statusClass = getStatusClass(rental.status);
            html += `
                <tr>
                    <td><strong>${rental.rentalId}</strong></td>
                    <td>${rental.userName}</td>
                    <td>${rental.carName || rental.car || 'N/A'}</td>
                    <td>${rental.startDate || 'N/A'} - ${rental.endDate || 'N/A'}</td>
                    <td>$${(rental.totalCost || rental.total || 0).toLocaleString()}</td>
                    <td><span class="em-status-badge ${statusClass}">${rental.status}</span></td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                                Update
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateRentalStatus('${rental.rentalId}', 'confirmed'); return false;">Confirmed</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateRentalStatus('${rental.rentalId}', 'active'); return false;">Active</a></li>
                                <li><a class="dropdown-item" href="#" onclick="AdminDashboard.updateRentalStatus('${rental.rentalId}', 'completed'); return false;">Completed</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="AdminDashboard.updateRentalStatus('${rental.rentalId}', 'cancelled'); return false;">Cancelled</a></li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ==================== CARS FOR SALE ====================

    function loadCars() {
        const cars = EMAuth.getCars();
        const container = document.getElementById('cars-container');
        if (!container) return;

        if (cars.length === 0) {
            container.innerHTML = '<div class="col-12">' + createEmptyState('bi-car-front', 'No cars in inventory. Add your first car!') + '</div>';
            return;
        }

        let html = '';
        cars.forEach(car => {
            const statusBadge = car.status === 'available' ? 'bg-success' : 
                               car.status === 'reserved' ? 'bg-warning text-dark' : 'bg-secondary';
            html += `
                <div class="col-md-4">
                    <div class="card border h-100">
                        <img src="${car.image}" class="card-img-top" style="height: 140px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <h6 class="fw-bold mb-1">${car.name}</h6>
                                    <small class="text-muted">$${(car.price || 0).toLocaleString()}</small>
                                </div>
                                <span class="badge ${statusBadge}">${car.status}</span>
                            </div>
                            <div class="d-flex gap-2 mt-3">
                                <button class="btn btn-sm btn-outline-dark flex-grow-1" onclick="AdminDashboard.editCar('${car.id}')">
                                    <i class="bi bi-pencil"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="AdminDashboard.deleteCar('${car.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function setupCarForm() {
        const form = document.getElementById('add-car-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const car = {
                name: document.getElementById('car-name').value,
                price: parseFloat(document.getElementById('car-price').value),
                image: document.getElementById('car-image').value,
                description: document.getElementById('car-description').value,
                category: document.getElementById('car-category').value,
                speed: document.getElementById('car-speed').value,
                acceleration: document.getElementById('car-acceleration').value,
                engine: document.getElementById('car-engine').value,
                status: document.getElementById('car-status').value
            };

            EMAuth.addCar(car);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCarModal'));
            if (modal) modal.hide();
            this.reset();
            loadCars();
            showToast('Car added successfully!', 'success');
        });
    }

    // ==================== RENTAL CARS ====================

    function loadRentalCars() {
        const cars = EMAuth.getRentalCars();
        const container = document.getElementById('rental-cars-container');
        if (!container) return;

        if (cars.length === 0) {
            container.innerHTML = '<div class="col-12">' + createEmptyState('bi-car-front', 'No rental cars. Add your first rental car!') + '</div>';
            return;
        }

        let html = '';
        cars.forEach(car => {
            const statusBadge = car.status === 'available' ? 'bg-success' : 
                               car.status === 'rented' ? 'bg-warning text-dark' : 'bg-secondary';
            html += `
                <div class="col-md-4">
                    <div class="card border h-100">
                        <img src="${car.image}" class="card-img-top" style="height: 140px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <h6 class="fw-bold mb-1">${car.name}</h6>
                                    <small class="text-muted">$${(car.dailyRate || 0).toLocaleString()}/day</small>
                                </div>
                                <span class="badge ${statusBadge}">${car.status}</span>
                            </div>
                            <div class="d-flex gap-2 mt-3">
                                <button class="btn btn-sm btn-outline-dark flex-grow-1" onclick="AdminDashboard.editRentalCar('${car.id}')">
                                    <i class="bi bi-pencil"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="AdminDashboard.deleteRentalCar('${car.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function setupRentalCarForm() {
        const form = document.getElementById('add-rental-car-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const car = {
                name: document.getElementById('rental-car-name').value,
                dailyRate: parseFloat(document.getElementById('rental-car-rate').value),
                image: document.getElementById('rental-car-image').value,
                description: document.getElementById('rental-car-description').value,
                category: document.getElementById('rental-car-category').value,
                seats: parseInt(document.getElementById('rental-car-seats').value) || 2,
                transmission: document.getElementById('rental-car-transmission').value,
                status: document.getElementById('rental-car-status').value
            };

            EMAuth.addRentalCar(car);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRentalCarModal'));
            if (modal) modal.hide();
            this.reset();
            loadRentalCars();
            showToast('Rental car added successfully!', 'success');
        });
    }

    // ==================== CAR PARTS ====================

    function loadParts() {
        const parts = EMAuth.getCarParts();
        const container = document.getElementById('parts-container');
        if (!container) return;

        if (parts.length === 0) {
            container.innerHTML = '<div class="col-12">' + createEmptyState('bi-gear', 'No parts in inventory. Add your first part!') + '</div>';
            return;
        }

        let html = '';
        parts.forEach(part => {
            const statusBadge = part.status === 'in-stock' ? 'bg-success' : 
                               part.status === 'low-stock' ? 'bg-warning text-dark' : 'bg-danger';
            html += `
                <div class="col-md-4">
                    <div class="card border h-100">
                        <img src="${part.image}" class="card-img-top" style="height: 140px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <h6 class="fw-bold mb-1">${part.name}</h6>
                                    <small class="text-muted">$${(part.price || 0).toLocaleString()}</small>
                                </div>
                                <span class="badge ${statusBadge}">${part.status}</span>
                            </div>
                            <small class="text-muted d-block">Qty: ${part.quantity || 0} | ${part.category}</small>
                            <div class="d-flex gap-2 mt-3">
                                <button class="btn btn-sm btn-outline-dark flex-grow-1" onclick="AdminDashboard.editPart('${part.id}')">
                                    <i class="bi bi-pencil"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="AdminDashboard.deletePart('${part.id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function setupPartForm() {
        const form = document.getElementById('add-part-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const part = {
                name: document.getElementById('part-name').value,
                price: parseFloat(document.getElementById('part-price').value),
                image: document.getElementById('part-image').value,
                description: document.getElementById('part-description').value,
                category: document.getElementById('part-category').value,
                compatibility: document.getElementById('part-compatibility').value,
                quantity: parseInt(document.getElementById('part-quantity').value) || 1,
                status: document.getElementById('part-status').value
            };

            EMAuth.addCarPart(part);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPartModal'));
            if (modal) modal.hide();
            this.reset();
            loadParts();
            showToast('Part added successfully!', 'success');
        });
    }

    // ==================== EDIT FORMS ====================

    function setupEditCarForm() {
        const form = document.getElementById('edit-car-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const carId = document.getElementById('edit-car-id').value;
            const updates = {
                name: document.getElementById('edit-car-name').value,
                price: parseFloat(document.getElementById('edit-car-price').value),
                image: document.getElementById('edit-car-image').value,
                description: document.getElementById('edit-car-description').value,
                category: document.getElementById('edit-car-category').value,
                speed: document.getElementById('edit-car-speed').value,
                acceleration: document.getElementById('edit-car-acceleration').value,
                engine: document.getElementById('edit-car-engine').value,
                status: document.getElementById('edit-car-status').value
            };

            EMAuth.updateCar(carId, updates);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCarModal'));
            if (modal) modal.hide();
            loadCars();
            showToast('Car updated successfully!', 'success');
        });
    }

    function setupEditRentalCarForm() {
        const form = document.getElementById('edit-rental-car-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const carId = document.getElementById('edit-rental-car-id').value;
            const updates = {
                name: document.getElementById('edit-rental-car-name').value,
                dailyRate: parseFloat(document.getElementById('edit-rental-car-rate').value),
                image: document.getElementById('edit-rental-car-image').value,
                description: document.getElementById('edit-rental-car-description').value,
                category: document.getElementById('edit-rental-car-category').value,
                seats: parseInt(document.getElementById('edit-rental-car-seats').value) || 2,
                transmission: document.getElementById('edit-rental-car-transmission').value,
                status: document.getElementById('edit-rental-car-status').value
            };

            EMAuth.updateRentalCar(carId, updates);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('editRentalCarModal'));
            if (modal) modal.hide();
            loadRentalCars();
            showToast('Rental car updated successfully!', 'success');
        });
    }

    function setupEditPartForm() {
        const form = document.getElementById('edit-part-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const partId = document.getElementById('edit-part-id').value;
            const status = document.getElementById('edit-part-status').value;
            let quantity = parseInt(document.getElementById('edit-part-quantity').value) || 0;
            
            // If low-stock, use the stock-left value
            if (status === 'low-stock') {
                const stockLeft = parseInt(document.getElementById('edit-part-stock-left').value);
                if (stockLeft && stockLeft > 0) {
                    quantity = stockLeft;
                }
            } else if (status === 'out-of-stock') {
                quantity = 0;
            }
            
            const updates = {
                name: document.getElementById('edit-part-name').value,
                price: parseFloat(document.getElementById('edit-part-price').value),
                image: document.getElementById('edit-part-image').value,
                description: document.getElementById('edit-part-description').value,
                category: document.getElementById('edit-part-category').value,
                compatibility: document.getElementById('edit-part-compatibility').value,
                quantity: quantity,
                status: status,
                stockLeft: status === 'low-stock' ? quantity : null
            };

            EMAuth.updateCarPart(partId, updates);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('editPartModal'));
            if (modal) modal.hide();
            loadParts();
            showToast('Part updated successfully!', 'success');
        });
    }

    // Toggle stock quantity field based on status selection
    window.toggleStockQuantity = function() {
        const status = document.getElementById('edit-part-status').value;
        const container = document.getElementById('stock-quantity-container');
        if (container) {
            container.style.display = status === 'low-stock' ? 'block' : 'none';
        }
    };

    // ==================== USER MANAGEMENT ====================

    function loadUsers(filterQuery = '') {
        let users = EMAuth.getAllUsers();
        const container = document.getElementById('users-container');
        if (!container) return;

        // Apply filter if provided
        if (filterQuery) {
            const query = filterQuery.toLowerCase();
            users = users.filter(u => 
                u.name.toLowerCase().includes(query) || 
                u.email.toLowerCase().includes(query)
            );
        }

        if (users.length === 0) {
            container.innerHTML = filterQuery 
                ? '<div class="text-center py-4 text-muted">No users found.</div>'
                : createEmptyState('bi-people', 'No registered users yet.');
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Registered</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        users.forEach(user => {
            const isBanned = user.isBanned;
            const banInfo = isBanned ? EMAuth.isUserBanned(user.googleId) : null;
            const statusBadge = isBanned 
                ? `<span class="badge bg-danger">Banned${banInfo && banInfo.remaining ? ' (' + banInfo.remaining + ')' : ''}</span>`
                : '<span class="badge bg-success">Active</span>';
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <img src="${user.picture || 'https://via.placeholder.com/35'}" class="rounded-circle" width="40" height="40" style="object-fit: cover;">
                            <strong>${user.name}</strong>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${user.phone || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>${EMAuth.formatDate(user.registeredAt)}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${isBanned 
                                ? `<button class="btn btn-outline-success" onclick="AdminDashboard.unbanUser('${user.googleId}')" title="Unban User"><i class="bi bi-unlock"></i></button>`
                                : `<button class="btn btn-outline-warning" onclick="AdminDashboard.openBanModal('${user.googleId}', '${user.name}')" title="Ban User"><i class="bi bi-slash-circle"></i></button>`
                            }
                            <button class="btn btn-outline-primary" onclick="AdminDashboard.messageUser('${user.googleId}')" title="Message User"><i class="bi bi-envelope"></i></button>
                            <button class="btn btn-outline-danger" onclick="AdminDashboard.deleteUser('${user.googleId}', '${user.name}')" title="Delete User"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function setupBanForm() {
        const form = document.getElementById('ban-user-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const userId = document.getElementById('ban-user-id').value;
            const duration = document.getElementById('ban-duration').value;
            const reason = document.getElementById('ban-reason').value;

            EMAuth.banUser(userId, duration, reason);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('banUserModal'));
            if (modal) modal.hide();
            this.reset();
            loadUsers();
            loadDashboardStats();
            showToast('User has been banned.', 'warning');
        });
    }

    function setupUserSearch() {
        const searchInput = document.getElementById('user-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', function() {
            loadUsers(this.value);
        });
    }

    // ==================== INBOX MESSAGING ====================

    function loadInbox() {
        const messages = EMAuth.getAdminInbox();
        const container = document.getElementById('inbox-container');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = createEmptyState('bi-inbox', 'No messages. Start a conversation with a user!');
            return;
        }

        let html = '<div class="list-group">';
        messages.forEach(msg => {
            const isUnread = msg.toId === 'admin' && !msg.read;
            const isFromAdmin = msg.fromId === 'admin';
            const otherParty = isFromAdmin ? msg.toName : msg.fromName;
            const direction = isFromAdmin ? 'To' : 'From';
            
            html += `
                <div class="list-group-item ${isUnread ? 'bg-light' : ''}" style="cursor: pointer;" onclick="AdminDashboard.viewInboxMessage('${msg.id}')">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <span class="badge ${isFromAdmin ? 'bg-secondary' : 'bg-primary'}">${direction}</span>
                                <h6 class="mb-0 ${isUnread ? 'fw-bold' : ''}">${otherParty}</h6>
                                ${isUnread ? '<span class="badge bg-danger">New</span>' : ''}
                            </div>
                            <p class="mb-1 fw-bold">${msg.subject}</p>
                            <p class="mb-1 text-muted small">${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}</p>
                            <small class="text-muted">${EMAuth.formatDateTime(msg.date)}</small>
                            ${msg.replies && msg.replies.length > 0 ? `<span class="badge bg-info ms-2">${msg.replies.length} replies</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function populateUserSelect() {
        const select = document.getElementById('message-recipient');
        if (!select) return;

        const users = EMAuth.getAllUsers().filter(u => !u.isBanned);
        select.innerHTML = '<option value="">Select a user...</option>';
        users.forEach(user => {
            select.innerHTML += `<option value="${user.googleId}">${user.name} (${user.email})</option>`;
        });
    }

    function setupComposeMessageForm() {
        const form = document.getElementById('compose-message-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const recipient = document.getElementById('message-recipient').value;
            const subject = document.getElementById('message-subject').value;
            const content = document.getElementById('message-content').value;

            EMAuth.sendInboxMessage('admin', recipient, subject, content);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('composeMessageModal'));
            if (modal) modal.hide();
            this.reset();
            loadInbox();
            loadDashboardStats();
            showToast('Message sent successfully!', 'success');
        });
    }

    function setupReplyInboxForm() {
        const form = document.getElementById('reply-inbox-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const messageId = document.getElementById('reply-message-id').value;
            const replyContent = document.getElementById('reply-content').value;

            EMAuth.replyToInboxMessage(messageId, replyContent, 'admin');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('replyInboxModal'));
            if (modal) modal.hide();
            this.reset();
            loadInbox();
            showToast('Reply sent successfully!', 'success');
        });
    }

    // ==================== SUPPORT TICKETS ====================

    function loadTickets() {
        let tickets = EMAuth.getAllTickets();
        const container = document.getElementById('tickets-container');
        if (!container) return;

        // Apply filter
        if (currentTicketFilter === 'open') {
            tickets = tickets.filter(t => t.status === 'open' || t.status === 'in-progress');
        } else if (currentTicketFilter === 'resolved') {
            tickets = tickets.filter(t => t.status === 'resolved');
        }

        if (tickets.length === 0) {
            container.innerHTML = createEmptyState('bi-chat-left-text', 'No support tickets.');
            return;
        }

        let html = '<div class="list-group">';
        tickets.forEach(ticket => {
            const statusBg = ticket.status === 'resolved' ? 'bg-success' : 
                            ticket.status === 'in-progress' ? 'bg-warning text-dark' : 'bg-info';
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="mb-0 fw-bold">${ticket.subject}</h6>
                                <span class="badge ${statusBg}">${ticket.status}</span>
                            </div>
                            <p class="mb-1 text-muted small">${ticket.message}</p>
                            <small class="text-muted">
                                <strong>${ticket.userName}</strong> (${ticket.userEmail}) - ${EMAuth.formatDateTime(ticket.createdAt)}
                            </small>
                        </div>
                        <div class="d-flex gap-2">
                            ${ticket.status !== 'resolved' ? `
                                <button class="btn btn-sm btn-outline-primary" onclick="AdminDashboard.openTicketResponse('${ticket.id}')">
                                    <i class="bi bi-reply"></i> Reply
                                </button>
                                <button class="btn btn-sm btn-outline-success" onclick="AdminDashboard.closeTicket('${ticket.id}')">
                                    <i class="bi bi-check"></i> Close
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${ticket.responses && ticket.responses.length > 0 ? `
                        <div class="mt-2 p-2 bg-light rounded">
                            <small class="fw-bold text-success"><i class="bi bi-reply me-1"></i>Your Response:</small>
                            <p class="mb-0 small">${ticket.responses[ticket.responses.length - 1].message}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function setupTicketResponseForm() {
        const form = document.getElementById('ticket-response-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const ticketId = document.getElementById('response-ticket-id').value;
            const response = document.getElementById('ticket-response').value;
            
            EMAuth.addTicketResponse(ticketId, response);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('ticketResponseModal'));
            if (modal) modal.hide();
            this.reset();
            loadTickets();
            showToast('Response sent successfully!', 'success');
        });
    }

    // ==================== CONTACT MESSAGES ====================

    function loadMessages() {
        const messages = EMAuth.getContactMessages();
        const container = document.getElementById('messages-container');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = createEmptyState('bi-envelope-open', 'No contact messages.');
            return;
        }

        let html = '<div class="list-group">';
        messages.forEach(msg => {
            html += `
                <div class="list-group-item ${msg.read ? '' : 'bg-light'}" onclick="AdminDashboard.markMessageRead('${msg.id}')" style="cursor: pointer;">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1 ${msg.read ? '' : 'fw-bold'}">${msg.name}</h6>
                            <small class="text-muted">${msg.email}</small>
                            <p class="mb-1 mt-2">${msg.message}</p>
                            <small class="text-muted">${EMAuth.formatDateTime(msg.date)}</small>
                        </div>
                        <div>
                            ${!msg.read ? '<span class="badge bg-primary">New</span>' : ''}
                            <button class="btn btn-sm btn-outline-danger ms-2" onclick="AdminDashboard.deleteMessage('${msg.id}', event)">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ==================== BLOG POSTS ====================

    function loadBlogPosts() {
        const posts = EMAuth.getBlogPosts();
        const container = document.getElementById('blog-container');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = createEmptyState('bi-file-earmark-text', 'No blog posts yet.');
            return;
        }

        let html = '<div class="row g-3">';
        posts.forEach(post => {
            html += `
                <div class="col-md-6">
                    <div class="card border h-100">
                        ${post.image ? `<img src="${post.image}" class="card-img-top" style="height: 120px; object-fit: cover;">` : ''}
                        <div class="card-body">
                            <span class="badge bg-warning text-dark mb-2">${post.category || 'General'}</span>
                            <h6 class="fw-bold">${post.title}</h6>
                            <p class="small text-muted mb-2">${post.excerpt || ''}</p>
                            <small class="text-muted">${EMAuth.formatDate(post.date)}</small>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-outline-danger" onclick="AdminDashboard.deleteBlogPost('${post.id}')">
                                    <i class="bi bi-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function setupBlogForm() {
        const form = document.getElementById('add-blog-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const post = {
                title: document.getElementById('blog-title').value,
                excerpt: document.getElementById('blog-excerpt').value,
                image: document.getElementById('blog-image').value,
                category: document.getElementById('blog-category').value,
                content: document.getElementById('blog-content').value,
                author: 'Admin'
            };

            EMAuth.addBlogPost(post);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBlogModal'));
            if (modal) modal.hide();
            this.reset();
            loadBlogPosts();
            showToast('Blog post published!', 'success');
        });
    }

    // ==================== TESTIMONIALS ====================

    function loadTestimonials() {
        let testimonials = EMAuth.getTestimonials(false);
        const container = document.getElementById('testimonials-container');
        if (!container) return;

        // Apply filter
        if (currentTestimonialFilter === 'pending') {
            testimonials = testimonials.filter(t => !t.approved);
        } else if (currentTestimonialFilter === 'approved') {
            testimonials = testimonials.filter(t => t.approved);
        }

        if (testimonials.length === 0) {
            container.innerHTML = createEmptyState('bi-chat-quote', 'No testimonials yet.');
            return;
        }

        let html = '<div class="list-group">';
        testimonials.forEach(review => {
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="mb-0 fw-bold">${review.name}</h6>
                                <span class="badge ${review.approved ? 'bg-success' : 'bg-warning text-dark'}">${review.approved ? 'Approved' : 'Pending'}</span>
                            </div>
                            <div class="mb-2">
                                ${Array(review.rating || 5).fill('<i class="bi bi-star-fill text-warning"></i>').join('')}
                            </div>
                            <p class="mb-1">${review.text}</p>
                            <small class="text-muted">${EMAuth.formatDate(review.date)}</small>
                        </div>
                        <div class="d-flex gap-2">
                            ${!review.approved ? `
                                <button class="btn btn-sm btn-outline-success" onclick="AdminDashboard.approveTestimonial('${review.id}')">
                                    <i class="bi bi-check"></i> Approve
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="AdminDashboard.deleteTestimonial('${review.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ==================== SIDEBAR NAVIGATION ====================

    function setupSidebarNavigation() {
        document.querySelectorAll('.em-dash-nav a').forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    document.querySelectorAll('.em-dash-nav a').forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                }
            });
        });
    }

    // ==================== HELPER FUNCTIONS ====================

    function createEmptyState(icon, message) {
        return `
            <div class="text-center py-5 text-muted">
                <i class="bi ${icon}" style="font-size: 3rem;"></i>
                <p class="mt-3 mb-0">${message}</p>
            </div>
        `;
    }

    function getStatusClass(status) {
        if (status === 'completed' || status === 'delivered') return 'success';
        if (status === 'cancelled') return 'cancelled';
        if (status === 'shipped' || status === 'out-for-delivery') return 'shipped';
        if (status === 'confirmed' || status === 'active') return 'confirmed';
        return 'pending';
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    // ==================== PUBLIC API ====================

    window.AdminDashboard = {
        // Orders
        updateOrderStatus: function(orderId, status) {
            EMAuth.updateOrderStatus(orderId, status);
            loadOrders();
            loadDashboardStats();
            loadCharts();
        },

        // Rentals
        updateRentalStatus: function(rentalId, status) {
            EMAuth.updateRentalStatus(rentalId, status);
            loadRentals();
            loadDashboardStats();
        },

        // Cars
        editCar: function(carId) {
            const cars = EMAuth.getCars();
            const car = cars.find(c => c.id === carId);
            if (!car) return;
            
            // Populate the edit form
            document.getElementById('edit-car-id').value = car.id;
            document.getElementById('edit-car-name').value = car.name || '';
            document.getElementById('edit-car-price').value = car.price || '';
            document.getElementById('edit-car-image').value = car.image || '';
            document.getElementById('edit-car-description').value = car.description || '';
            document.getElementById('edit-car-category').value = car.category || 'Supercar';
            document.getElementById('edit-car-speed').value = car.speed || '';
            document.getElementById('edit-car-acceleration').value = car.acceleration || '';
            document.getElementById('edit-car-engine').value = car.engine || '';
            document.getElementById('edit-car-status').value = car.status || 'available';
            
            new bootstrap.Modal(document.getElementById('editCarModal')).show();
        },

        deleteCar: function(carId) {
            showConfirm('Delete this car?', function() {
                EMAuth.deleteCar(carId);
                loadCars();
                showToast('Car deleted successfully.', 'success');
            }, { title: 'Delete Car', confirmText: 'Delete' });
        },

        // Rental Cars
        editRentalCar: function(carId) {
            const cars = EMAuth.getRentalCars();
            const car = cars.find(c => c.id === carId);
            if (!car) return;
            
            // Populate the edit form
            document.getElementById('edit-rental-car-id').value = car.id;
            document.getElementById('edit-rental-car-name').value = car.name || '';
            document.getElementById('edit-rental-car-rate').value = car.dailyRate || '';
            document.getElementById('edit-rental-car-image').value = car.image || '';
            document.getElementById('edit-rental-car-description').value = car.description || '';
            document.getElementById('edit-rental-car-category').value = car.category || 'Supercar';
            document.getElementById('edit-rental-car-seats').value = car.seats || 2;
            document.getElementById('edit-rental-car-transmission').value = car.transmission || 'Automatic';
            document.getElementById('edit-rental-car-status').value = car.status || 'available';
            
            new bootstrap.Modal(document.getElementById('editRentalCarModal')).show();
        },

        deleteRentalCar: function(carId) {
            showConfirm('Delete this rental car?', function() {
                EMAuth.deleteRentalCar(carId);
                loadRentalCars();
                showToast('Rental car deleted successfully.', 'success');
            }, { title: 'Delete Rental Car', confirmText: 'Delete' });
        },

        // Parts
        editPart: function(partId) {
            const parts = EMAuth.getCarParts();
            const part = parts.find(p => p.id === partId);
            if (!part) return;
            
            // Populate the edit form
            document.getElementById('edit-part-id').value = part.id;
            document.getElementById('edit-part-name').value = part.name || '';
            document.getElementById('edit-part-price').value = part.price || '';
            document.getElementById('edit-part-image').value = part.image || '';
            document.getElementById('edit-part-description').value = part.description || '';
            document.getElementById('edit-part-category').value = part.category || 'Other';
            document.getElementById('edit-part-compatibility').value = part.compatibility || '';
            document.getElementById('edit-part-quantity').value = part.quantity || 0;
            document.getElementById('edit-part-status').value = part.status || 'in-stock';
            document.getElementById('edit-part-stock-left').value = part.stockLeft || part.quantity || '';
            
            // Show/hide stock quantity field based on status
            const stockContainer = document.getElementById('stock-quantity-container');
            if (stockContainer) {
                stockContainer.style.display = part.status === 'low-stock' ? 'block' : 'none';
            }
            
            new bootstrap.Modal(document.getElementById('editPartModal')).show();
        },

        deletePart: function(partId) {
            showConfirm('Delete this part?', function() {
                EMAuth.deleteCarPart(partId);
                loadParts();
                showToast('Part deleted successfully.', 'success');
            }, { title: 'Delete Part', confirmText: 'Delete' });
        },

        // Users
        openBanModal: function(userId, userName) {
            document.getElementById('ban-user-id').value = userId;
            document.getElementById('ban-user-name').innerText = userName;
            new bootstrap.Modal(document.getElementById('banUserModal')).show();
        },

        unbanUser: function(userId) {
            showConfirm('Unban this user?', function() {
                EMAuth.unbanUser(userId);
                loadUsers();
                loadDashboardStats();
                showToast('User has been unbanned.', 'success');
            }, { title: 'Unban User', confirmText: 'Unban', icon: 'unlock-fill', iconColor: 'text-success', danger: false });
        },

        deleteUser: function(userId, userName) {
            showConfirm(`Permanently delete ${userName} and all their data? This cannot be undone!`, function() {
                EMAuth.deleteUser(userId);
                loadUsers();
                loadDashboardStats();
                loadOrders();
                loadRentals();
                loadInbox();
                loadTickets();
                showToast('User deleted successfully.', 'success');
            }, { title: 'Delete User', confirmText: 'Delete Permanently', icon: 'exclamation-triangle-fill', iconColor: 'text-danger' });
        },

        messageUser: function(userId) {
            const select = document.getElementById('message-recipient');
            if (select) {
                select.value = userId;
            }
            new bootstrap.Modal(document.getElementById('composeMessageModal')).show();
        },

        // Inbox
        viewInboxMessage: function(messageId) {
            const messages = EMAuth.getAdminInbox();
            const msg = messages.find(m => m.id === messageId);
            if (!msg) return;
            
            // Mark as read if sent to admin
            if (msg.toId === 'admin') {
                EMAuth.markInboxMessageRead(messageId);
                loadDashboardStats();
            }
            
            const isFromAdmin = msg.fromId === 'admin';
            let html = `
                <div class="mb-3">
                    <strong>From:</strong> ${msg.fromName}<br>
                    <strong>To:</strong> ${msg.toName}<br>
                    <strong>Date:</strong> ${EMAuth.formatDateTime(msg.date)}
                </div>
                <div class="mb-3">
                    <strong>Subject:</strong> ${msg.subject}
                </div>
                <div class="p-3 bg-light rounded mb-3">
                    ${msg.message}
                </div>
            `;
            
            if (msg.replies && msg.replies.length > 0) {
                html += '<h6 class="fw-bold">Replies:</h6>';
                msg.replies.forEach(reply => {
                    const isAdminReply = reply.from === 'admin';
                    html += `
                        <div class="p-3 mb-2 ${isAdminReply ? 'bg-warning bg-opacity-10 border-start border-warning border-3' : 'bg-light'}">
                            <small class="text-muted">${reply.fromName} - ${EMAuth.formatDateTime(reply.date)}</small>
                            <p class="mb-0">${reply.message}</p>
                        </div>
                    `;
                });
            }
            
            document.getElementById('view-inbox-content').innerHTML = html;
            document.getElementById('view-inbox-reply-btn').onclick = function() {
                const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewInboxModal'));
                if (viewModal) viewModal.hide();
                
                document.getElementById('reply-message-id').value = messageId;
                document.getElementById('reply-from-name').innerText = msg.fromName;
                document.getElementById('reply-original-message').innerText = msg.message;
                new bootstrap.Modal(document.getElementById('replyInboxModal')).show();
            };
            
            new bootstrap.Modal(document.getElementById('viewInboxModal')).show();
            loadInbox();
        },

        // Tickets
        openTicketResponse: function(ticketId) {
            document.getElementById('response-ticket-id').value = ticketId;
            new bootstrap.Modal(document.getElementById('ticketResponseModal')).show();
        },

        closeTicket: function(ticketId) {
            showConfirm('Close this ticket?', function() {
                EMAuth.closeTicket(ticketId);
                loadTickets();
                loadDashboardStats();
                showToast('Ticket closed successfully.', 'success');
            }, { title: 'Close Ticket', confirmText: 'Close', icon: 'check-circle-fill', iconColor: 'text-success', danger: false });
        },

        filterTickets: function(filter) {
            currentTicketFilter = filter;
            document.querySelectorAll('#tickets .btn-group .btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadTickets();
        },

        // Messages
        markMessageRead: function(messageId) {
            EMAuth.markMessageRead(messageId);
            loadMessages();
            loadDashboardStats();
        },

        markAllMessagesRead: function() {
            const messages = EMAuth.getContactMessages();
            messages.forEach(msg => EMAuth.markMessageRead(msg.id));
            loadMessages();
            loadDashboardStats();
        },

        deleteMessage: function(messageId, event) {
            event.stopPropagation();
            showConfirm('Delete this message?', function() {
                EMAuth.deleteMessage(messageId);
                loadMessages();
                loadDashboardStats();
                showToast('Message deleted successfully.', 'success');
            }, { title: 'Delete Message', confirmText: 'Delete' });
        },

        // Blog
        deleteBlogPost: function(postId) {
            showConfirm('Delete this blog post?', function() {
                EMAuth.deleteBlogPost(postId);
                loadBlogPosts();
                showToast('Blog post deleted successfully.', 'success');
            }, { title: 'Delete Blog Post', confirmText: 'Delete' });
        },

        // Testimonials
        approveTestimonial: function(reviewId) {
            EMAuth.approveTestimonial(reviewId);
            loadTestimonials();
        },

        deleteTestimonial: function(reviewId) {
            showConfirm('Delete this testimonial?', function() {
                EMAuth.deleteTestimonial(reviewId);
                loadTestimonials();
                showToast('Testimonial deleted successfully.', 'success');
            }, { title: 'Delete Testimonial', confirmText: 'Delete' });
        },

        filterTestimonials: function(filter) {
            currentTestimonialFilter = filter;
            document.querySelectorAll('#testimonials .btn-group .btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadTestimonials();
        }
    };

    // Expose filter functions globally for onclick
    window.filterTickets = window.AdminDashboard.filterTickets;
    window.filterTestimonials = window.AdminDashboard.filterTestimonials;
    window.markAllMessagesRead = window.AdminDashboard.markAllMessagesRead;

})();
