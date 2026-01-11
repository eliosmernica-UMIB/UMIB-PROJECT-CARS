/* 
    FILE: js/user-dashboard.js
    DESCRIPTION: User Dashboard functionality
    - Profile display
    - Orders, Rentals, Wishlist management
    - Inbox messaging with Admin
    - Support Tickets
    - Notifications
    - Account Settings
*/

(function() {
    'use strict';

    let currentUser = null;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Require user authentication
        if (!EMAuth.requireAuth('user')) {
            return;
        }

        // Get current user
        currentUser = EMAuth.getCurrentUser();
        
        // Initialize all sections
        updateUserProfile();
        updateStats();
        loadOrders();
        loadRentals();
        loadWishlist();
        loadMessages();
        loadNotifications();
        loadBookingHistory();
        loadTickets();
        loadSettings();

        // Setup event listeners
        setupSidebarNavigation();
        setupSettingsForm();
        setupTicketForm();

        // Update cart badge
        if (typeof emUpdateBadge === 'function') {
            emUpdateBadge();
        }

        // Check for hash navigation
        handleHashNavigation();
    });

    // Handle hash navigation (e.g., #inbox from navbar)
    function handleHashNavigation() {
        const hash = window.location.hash;
        if (hash) {
            const target = document.querySelector(hash);
            if (target) {
                setTimeout(() => {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    document.querySelectorAll('.em-dash-nav a').forEach(l => l.classList.remove('active'));
                    const navLink = document.querySelector(`.em-dash-nav a[href="${hash}"]`);
                    if (navLink) navLink.classList.add('active');
                }, 300);
            }
        }
    }

    // Update user profile display
    function updateUserProfile() {
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-name');
        const email = document.getElementById('user-email');
        const welcomeText = document.getElementById('welcome-text');

        if (avatar) avatar.src = currentUser.picture || 'https://via.placeholder.com/80';
        if (name) name.innerText = currentUser.name;
        if (email) email.innerText = currentUser.email;
        if (welcomeText) {
            const firstName = currentUser.name.split(' ')[0];
            if (currentUser.isNewUser) {
                welcomeText.innerText = 'Welcome, ' + firstName + '!';
            } else {
                welcomeText.innerText = 'Welcome back, ' + firstName + '!';
            }
        }
    }

    // Update statistics
    function updateStats() {
        const orders = EMAuth.getUserOrders(currentUser.googleId);
        const wishlist = EMAuth.getUserWishlist(currentUser.googleId);
        const rentals = EMAuth.getUserRentals(currentUser.googleId);
        const tickets = EMAuth.getUserTickets(currentUser.googleId);
        const notifications = EMAuth.getNotifications(currentUser.googleId);
        const inboxMessages = EMAuth.getUserInboxMessages(currentUser.googleId);
        const unreadNotifs = notifications.filter(n => !n.read).length;
        // Only count messages FROM admin (user can only receive)
        const unreadInbox = inboxMessages.filter(m => m.fromId === 'admin' && !m.read).length;

        setElementText('stat-orders', orders.length);
        setElementText('stat-wishlist', wishlist.length);
        setElementText('stat-rentals', rentals.length);
        setElementText('stat-tickets', tickets.filter(t => t.status !== 'resolved').length);
        
        // Combined inbox badge (messages + notifications) in sidebar
        const totalUnread = unreadNotifs + unreadInbox;
        setElementText('inbox-badge', totalUnread);
        
        // Hide badge if zero
        const inboxBadge = document.getElementById('inbox-badge');
        if (inboxBadge) {
            inboxBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
        }
        
        // Update individual tab badges
        const msgBadge = document.getElementById('messages-badge');
        if (msgBadge) {
            msgBadge.innerText = unreadInbox;
            msgBadge.style.display = unreadInbox > 0 ? 'inline-block' : 'none';
        }
        
        const notifBadge = document.getElementById('notifications-badge');
        if (notifBadge) {
            notifBadge.innerText = unreadNotifs;
            notifBadge.style.display = unreadNotifs > 0 ? 'inline-block' : 'none';
        }
    }

    // Load Orders with enhanced status display
    function loadOrders() {
        const orders = EMAuth.getUserOrders(currentUser.googleId);
        const container = document.getElementById('orders-container');
        if (!container) return;

        if (orders.length === 0) {
            container.innerHTML = createEmptyState('bi-bag-x', 'No orders yet. Start shopping!');
            return;
        }

        let html = '<div class="list-group">';

        orders.forEach(order => {
            const statusClass = getStatusClass(order.status);
            const statusSteps = getOrderStatusSteps(order.status);
            const itemCount = order.items ? order.items.length : 1;
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold mb-1">${order.orderId}</h6>
                            <small class="text-muted">${itemCount} item(s) - ${EMAuth.formatDate(order.date)}</small>
                        </div>
                        <div class="text-end">
                            <span class="em-status-badge ${statusClass}">${order.status}</span>
                            <div class="fw-bold mt-1">$${(order.total || 0).toLocaleString()}</div>
                        </div>
                    </div>
                    <!-- Order Progress Bar -->
                    <div class="order-progress mt-3">
                        <div class="d-flex justify-content-between small text-muted mb-2">
                            ${statusSteps}
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${order.status === 'cancelled' ? 'bg-danger' : 'bg-success'}" 
                                 style="width: ${getStatusProgress(order.status)}%"></div>
                        </div>
                    </div>
                    ${order.items ? `
                        <div class="mt-3">
                            <small class="text-muted">Items:</small>
                            <ul class="list-unstyled mb-0 mt-1">
                                ${order.items.map(item => `
                                    <li class="small"><i class="bi bi-dot"></i> ${item.name} ${item.quantity > 1 ? `(x${item.quantity})` : ''}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Get order status steps for progress display
    function getOrderStatusSteps(status) {
        const steps = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
        const currentIndex = {
            'pending': 0,
            'confirmed': 1,
            'processing': 2,
            'shipped': 3,
            'out-for-delivery': 4,
            'delivered': 5,
            'completed': 5,
            'cancelled': -1
        }[status] || 0;

        if (status === 'cancelled') {
            return '<span class="text-danger"><i class="bi bi-x-circle"></i> Order Cancelled</span>';
        }

        return steps.map((step, i) => {
            const isActive = i <= currentIndex;
            return `<span class="${isActive ? 'text-success' : ''}">${isActive ? '<i class="bi bi-check-circle-fill"></i> ' : ''}${step}</span>`;
        }).join('');
    }

    // Get status progress percentage
    function getStatusProgress(status) {
        const progress = {
            'pending': 10,
            'confirmed': 25,
            'processing': 50,
            'shipped': 75,
            'out-for-delivery': 90,
            'delivered': 100,
            'completed': 100,
            'cancelled': 100
        };
        return progress[status] || 10;
    }

    // Load Rentals
    function loadRentals() {
        const rentals = EMAuth.getUserRentals(currentUser.googleId);
        const container = document.getElementById('rentals-container');
        if (!container) return;

        if (rentals.length === 0) {
            container.innerHTML = createEmptyState('bi-car-front', 'No rentals yet. Book your dream car!');
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Rental ID</th>
                            <th>Vehicle</th>
                            <th>Dates</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        rentals.forEach(rental => {
            const statusClass = getStatusClass(rental.status);
            html += `
                <tr>
                    <td><strong>${rental.rentalId}</strong></td>
                    <td>${rental.carName || rental.car || 'Luxury Vehicle'}</td>
                    <td>${rental.startDate || 'N/A'} - ${rental.endDate || 'N/A'}</td>
                    <td>$${(rental.totalCost || rental.total || 0).toLocaleString()}</td>
                    <td><span class="em-status-badge ${statusClass}">${rental.status}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // Load Wishlist
    function loadWishlist() {
        const wishlist = EMAuth.getUserWishlist(currentUser.googleId);
        const container = document.getElementById('wishlist-container');
        if (!container) return;

        if (wishlist.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <i class="bi bi-heart" style="font-size: 3rem;"></i>
                    <p class="mt-3 mb-0">Your wishlist is empty. Save cars you love!</p>
                </div>
            `;
            return;
        }

        let html = '';
        wishlist.forEach(item => {
            html += `
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm h-100">
                        <img src="${item.image || 'https://via.placeholder.com/400x200'}" class="card-img-top" style="height: 150px; object-fit: cover;" onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'">
                        <div class="card-body">
                            <h6 class="fw-bold mb-1">${item.name}</h6>
                            <p class="text-muted small mb-2">$${(item.price || 0).toLocaleString()}</p>
                            <div class="d-flex gap-2">
                                <a href="inventory.html" class="btn btn-sm btn-outline-dark flex-grow-1">View</a>
                                <button class="btn btn-sm btn-outline-danger" onclick="UserDashboard.removeFromWishlist('${item.id}')">
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

    // Load Messages (separate tab)
    function loadMessages() {
        const messages = EMAuth.getUserInboxMessages(currentUser.googleId);
        const container = document.getElementById('messages-container');
        const badge = document.getElementById('messages-badge');
        if (!container) return;

        // Only show messages FROM admin (user can only receive, not send)
        const receivedMessages = messages.filter(m => m.fromId === 'admin');
        const unreadCount = receivedMessages.filter(m => !m.read).length;
        
        // Update badge
        if (badge) {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (receivedMessages.length === 0) {
            container.innerHTML = createEmptyState('bi-chat-left', 'No messages yet.');
            return;
        }

        let html = '<div class="list-group">';
        receivedMessages.forEach(msg => {
            const isUnread = !msg.read;
            const isLiked = EMAuth.hasUserLikedMessage(msg.id, currentUser.googleId);
            
            html += `
                <div class="list-group-item ${isUnread ? 'bg-light' : ''}" style="cursor: pointer;" onclick="UserDashboard.viewMessage('${msg.id}')">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <span class="badge bg-primary">From Admin</span>
                                <h6 class="mb-0 ${isUnread ? 'fw-bold' : ''}">${msg.subject}</h6>
                                ${isUnread ? '<span class="badge bg-danger">New</span>' : ''}
                                ${isLiked ? '<i class="bi bi-heart-fill text-danger"></i>' : ''}
                            </div>
                            <p class="mb-1 text-muted small">${msg.message.substring(0, 80)}${msg.message.length > 80 ? '...' : ''}</p>
                            <small class="text-muted">${EMAuth.formatDateTime(msg.date)}</small>
                        </div>
                        <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'}" onclick="event.stopPropagation(); UserDashboard.toggleLike('${msg.id}')">
                            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // Load Notifications (separate tab)
    function loadNotifications() {
        const notifications = EMAuth.getNotifications(currentUser.googleId);
        const container = document.getElementById('notifications-container');
        const badge = document.getElementById('notifications-badge');
        if (!container) return;

        const unreadCount = notifications.filter(n => !n.read).length;
        
        // Update badge
        if (badge) {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        if (notifications.length === 0) {
            container.innerHTML = createEmptyState('bi-bell-slash', 'No notifications yet.');
            return;
        }

        let html = '<div class="list-group">';
        notifications.forEach(notif => {
            const iconClass = getNotificationIcon(notif.type);
            const isUnread = !notif.read;
            
            html += `
                <div class="list-group-item ${isUnread ? 'bg-light' : ''}" style="cursor: pointer;" onclick="UserDashboard.markNotificationRead('${notif.id}')">
                    <div class="d-flex align-items-start gap-3">
                        <div class="em-notif-icon">
                            <i class="bi ${iconClass}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <h6 class="mb-0 ${isUnread ? 'fw-bold' : ''}">${notif.title}</h6>
                                ${isUnread ? '<span class="badge bg-danger">New</span>' : ''}
                            </div>
                            <p class="mb-1 small text-muted">${notif.message}</p>
                            <small class="text-muted">${EMAuth.formatDateTime(notif.date)}</small>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // Load Inbox - calls both messages and notifications (kept for compatibility)
    function loadInbox() {
        loadMessages();
        loadNotifications();
    }

    // Load Booking History (combined orders + rentals)
    function loadBookingHistory() {
        const orders = EMAuth.getUserOrders(currentUser.googleId);
        const rentals = EMAuth.getUserRentals(currentUser.googleId);
        const container = document.getElementById('bookings-container');
        if (!container) return;

        const allBookings = [
            ...orders.map(o => ({ ...o, type: 'Purchase', date: o.date })),
            ...rentals.map(r => ({ ...r, type: 'Rental', date: r.bookedAt, orderId: r.rentalId, total: r.totalCost || r.total }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allBookings.length === 0) {
            container.innerHTML = createEmptyState('bi-calendar-x', 'No booking history available.');
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Booking ID</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        allBookings.forEach(booking => {
            const statusClass = getStatusClass(booking.status);
            const typeBadge = booking.type === 'Purchase' ? 'bg-dark' : 'bg-warning text-dark';
            html += `
                <tr>
                    <td><strong>${booking.orderId}</strong></td>
                    <td><span class="badge ${typeBadge}">${booking.type}</span></td>
                    <td>${EMAuth.formatDate(booking.date)}</td>
                    <td>$${(booking.total || 0).toLocaleString()}</td>
                    <td><span class="em-status-badge ${statusClass}">${booking.status}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // Load Support Tickets
    function loadTickets() {
        const tickets = EMAuth.getUserTickets(currentUser.googleId);
        const container = document.getElementById('tickets-container');
        if (!container) return;

        if (tickets.length === 0) {
            container.innerHTML = createEmptyState('bi-chat-left-text', 'No support tickets. Need help? Create a ticket!');
            return;
        }

        let html = '<div class="list-group">';
        tickets.forEach(ticket => {
            const statusBg = ticket.status === 'resolved' ? 'bg-success' : 
                            ticket.status === 'in-progress' ? 'bg-warning text-dark' : 'bg-info';
            const canEdit = ticket.status === 'open';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1 fw-bold">${ticket.subject}</h6>
                            <p class="mb-1 text-muted small">${ticket.message.substring(0, 100)}${ticket.message.length > 100 ? '...' : ''}</p>
                            <small class="text-muted">${EMAuth.formatDateTime(ticket.createdAt)}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge ${statusBg}">${ticket.status}</span>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    ${canEdit ? `<li><a class="dropdown-item" href="#" onclick="UserDashboard.editTicket('${ticket.id}'); return false;"><i class="bi bi-pencil me-2"></i>Edit</a></li>` : ''}
                                    <li><a class="dropdown-item text-danger" href="#" onclick="UserDashboard.deleteTicket('${ticket.id}'); return false;"><i class="bi bi-trash me-2"></i>Delete</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    ${ticket.responses && ticket.responses.length > 0 ? `
                        <div class="mt-2 p-2 bg-light rounded">
                            <small class="fw-bold text-success"><i class="bi bi-reply me-1"></i>Admin Response:</small>
                            <p class="mb-0 small">${ticket.responses[ticket.responses.length - 1].message}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // Load Settings
    function loadSettings() {
        const user = EMAuth.getUserByGoogleId(currentUser.googleId);
        if (user) {
            setInputValue('setting-name', user.name);
            setInputValue('setting-email', user.email);
            setInputValue('setting-phone', user.phone || '');
            setInputValue('setting-address', user.address || '');
        }
    }

    // Setup Settings Form
    function setupSettingsForm() {
        const form = document.getElementById('settings-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const updates = {
                phone: document.getElementById('setting-phone').value,
                address: document.getElementById('setting-address').value
            };

            if (EMAuth.updateUserProfile(currentUser.googleId, updates)) {
                showToast('Settings saved successfully!', 'success');
            } else {
                showToast('Failed to save settings. Please try again.', 'error');
            }
        });
    }

    // Setup Ticket Form
    function setupTicketForm() {
        const form = document.getElementById('new-ticket-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const ticket = {
                subject: document.getElementById('ticket-subject').value,
                message: document.getElementById('ticket-message').value
            };

            EMAuth.createTicket(currentUser.googleId, ticket);
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('newTicketModal'));
            if (modal) modal.hide();
            this.reset();
            
            loadTickets();
            updateStats();
            
            showToast('Support ticket created successfully!', 'success');
        });
    }

    // Setup Sidebar Navigation
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

    // Helper: Create empty state HTML
    function createEmptyState(icon, message) {
        return `
            <div class="text-center py-5 text-muted">
                <i class="bi ${icon}" style="font-size: 3rem;"></i>
                <p class="mt-3 mb-0">${message}</p>
            </div>
        `;
    }

    // Helper: Get status class
    function getStatusClass(status) {
        if (status === 'completed' || status === 'delivered') return 'success';
        if (status === 'cancelled') return 'cancelled';
        if (status === 'shipped' || status === 'out-for-delivery') return 'shipped';
        if (status === 'confirmed' || status === 'active') return 'confirmed';
        return 'pending';
    }

    // Helper: Get notification icon
    function getNotificationIcon(type) {
        const icons = {
            'order': 'bi-bag-check',
            'order_update': 'bi-truck',
            'rental': 'bi-key',
            'rental_update': 'bi-key-fill',
            'ticket_update': 'bi-headset',
            'inbox': 'bi-envelope',
            'account': 'bi-person-exclamation',
            'welcome': 'bi-stars'
        };
        return icons[type] || 'bi-bell';
    }

    // Helper: Set element text
    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    // Helper: Set input value
    function setInputValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    // Expose public methods
    window.UserDashboard = {
        removeFromWishlist: function(itemId) {
            EMAuth.removeFromWishlist(currentUser.googleId, itemId);
            loadWishlist();
            updateStats();
        },

        markNotificationRead: function(notifId) {
            EMAuth.markNotificationRead(currentUser.googleId, notifId);
            loadNotifications();
            updateStats();
            if (typeof renderAuthNavbar === 'function') {
                renderAuthNavbar();
            }
        },

        markAllNotificationsRead: function() {
            EMAuth.markAllNotificationsRead(currentUser.googleId);
            loadNotifications();
            updateStats();
            if (typeof renderAuthNavbar === 'function') {
                renderAuthNavbar();
            }
        },

        markAllRead: function() {
            // Mark all notifications as read
            EMAuth.markAllNotificationsRead(currentUser.googleId);
            
            // Mark all inbox messages as read
            const messages = EMAuth.getUserInboxMessages(currentUser.googleId);
            messages.forEach(msg => {
                if (msg.toId === currentUser.googleId && !msg.read) {
                    EMAuth.markInboxMessageRead(msg.id);
                }
            });
            
            loadMessages();
            loadNotifications();
            updateStats();
            if (typeof renderAuthNavbar === 'function') {
                renderAuthNavbar();
            }
        },

        viewMessage: function(messageId) {
            const messages = EMAuth.getUserInboxMessages(currentUser.googleId);
            const msg = messages.find(m => m.id === messageId);
            if (!msg) return;
            
            // Mark as read
            if (!msg.read) {
                EMAuth.markInboxMessageRead(messageId);
                updateStats();
            }
            
            const isLiked = EMAuth.hasUserLikedMessage(messageId, currentUser.googleId);
            
            let html = `
                <div class="mb-3">
                    <strong>From:</strong> Admin<br>
                    <strong>Date:</strong> ${EMAuth.formatDateTime(msg.date)}
                </div>
                <div class="mb-3">
                    <strong>Subject:</strong> ${msg.subject}
                </div>
                <div class="p-3 bg-light rounded mb-3">
                    ${msg.message}
                </div>
            `;
            
            document.getElementById('view-msg-content').innerHTML = html;
            
            const likeBtn = document.getElementById('view-msg-like-btn');
            likeBtn.innerHTML = isLiked ? '<i class="bi bi-heart-fill me-1"></i>Liked' : '<i class="bi bi-heart me-1"></i>Like';
            likeBtn.className = isLiked ? 'btn btn-danger' : 'btn btn-outline-danger';
            likeBtn.onclick = function() {
                UserDashboard.toggleLike(messageId);
                const modal = bootstrap.Modal.getInstance(document.getElementById('viewMessageModal'));
                if (modal) modal.hide();
            };
            
            new bootstrap.Modal(document.getElementById('viewMessageModal')).show();
            loadMessages();
        },

        toggleLike: function(messageId) {
            const liked = EMAuth.toggleMessageLike(messageId, currentUser.googleId);
            if (liked === true) {
                showToast('Message liked!', 'success');
            } else if (liked === false) {
                showToast('Like removed', 'info');
            }
            loadMessages();
        },

        // Edit ticket - open modal with ticket data
        editTicket: function(ticketId) {
            const ticket = EMAuth.getTicketById(ticketId);
            if (!ticket) {
                showToast('Ticket not found', 'error');
                return;
            }
            
            if (ticket.status !== 'open') {
                showToast('Cannot edit ticket - already in progress or resolved', 'warning');
                return;
            }
            
            document.getElementById('edit-ticket-id').value = ticketId;
            document.getElementById('edit-ticket-subject').value = ticket.subject;
            document.getElementById('edit-ticket-message').value = ticket.message;
            
            new bootstrap.Modal(document.getElementById('editTicketModal')).show();
        },

        // Save edited ticket
        saveTicketEdit: function() {
            const ticketId = document.getElementById('edit-ticket-id').value;
            const subject = document.getElementById('edit-ticket-subject').value;
            const message = document.getElementById('edit-ticket-message').value;
            
            if (!subject || !message) {
                showToast('Please fill in all fields', 'warning');
                return;
            }
            
            const result = EMAuth.updateTicket(ticketId, currentUser.googleId, { subject, message });
            
            if (result) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editTicketModal'));
                if (modal) modal.hide();
                loadTickets();
                showToast('Ticket updated successfully!', 'success');
            } else {
                showToast('Failed to update ticket', 'error');
            }
        },

        // Delete ticket
        deleteTicket: function(ticketId) {
            if (!confirm('Are you sure you want to delete this ticket?')) {
                return;
            }
            
            const result = EMAuth.deleteTicket(ticketId, currentUser.googleId);
            
            if (result) {
                loadTickets();
                updateStats();
                showToast('Ticket deleted successfully!', 'success');
            } else {
                showToast('Failed to delete ticket', 'error');
            }
        }
    };

    // Expose markAllNotificationsRead globally for onclick
    window.markAllNotificationsRead = window.UserDashboard.markAllNotificationsRead;

})();
