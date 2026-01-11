/* 
    FILE: js/auth.js
    DESCRIPTION: Authentication & Data Management System for EM Luxury Cars
    - Google OAuth for Users
    - Admin Login with hardcoded credentials
    - localStorage-based session management
    - User management (ban/delete)
    - Dynamic inventory management
    - Inbox messaging system
    - Order/Rental management
*/

const EMAuth = {
    // Configuration
    GOOGLE_CLIENT_ID: '772994303555-uavag5lq8o00cb77ncfuikjep6aq783o.apps.googleusercontent.com',
    ADMIN_CREDENTIALS: { email: 'admin', password: 'admin' },

    // LocalStorage Keys
    KEYS: {
        CURRENT_USER: 'emCurrentUser',
        USERS: 'emUsers',
        USER_ORDERS: 'emUserOrders',
        USER_WISHLIST: 'emUserWishlist',
        USER_RENTALS: 'emUserRentals',
        SUPPORT_TICKETS: 'emSupportTickets',
        NOTIFICATIONS: 'emNotifications',
        CONTACT_MESSAGES: 'emContactMessages',
        BLOG_POSTS: 'emBlogPosts',
        TESTIMONIALS: 'emTestimonials',
        // New keys for dynamic inventory
        CARS: 'emCars',
        RENTAL_CARS: 'emRentalCars',
        CAR_PARTS: 'emCarParts',
        // New key for inbox messaging
        INBOX_MESSAGES: 'emInboxMessages'
    },

    // ==================== INITIALIZATION ====================

    // Initialize Google Sign-In
    initGoogleSignIn: function(buttonElementId) {
        if (typeof google === 'undefined') {
            console.error('Google Identity Services not loaded');
            return;
        }

        google.accounts.id.initialize({
            client_id: this.GOOGLE_CLIENT_ID,
            callback: this.handleGoogleCredential.bind(this),
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Render the button
        const buttonElement = document.getElementById(buttonElementId);
        if (buttonElement) {
            google.accounts.id.renderButton(buttonElement, {
                theme: 'outline',
                size: 'large',
                width: 300,
                text: 'signin_with',
                shape: 'pill'
            });
        }
    },

    // Handle Google credential response
    handleGoogleCredential: function(response) {
        try {
            // Decode the JWT token
            const payload = this.decodeJwtPayload(response.credential);
            
            if (payload) {
                const userData = {
                    googleId: payload.sub,
                    name: payload.name,
                    email: payload.email,
                    picture: payload.picture
                };

                // Check if user is banned
                const banStatus = this.isUserBanned(userData.googleId);
                if (banStatus.banned) {
                    showNotificationModal(banStatus.message, 'error', 'Access Denied');
                    return;
                }

                // Check if this is a new user BEFORE registering
                const existingUser = this.getUserByGoogleId(userData.googleId);
                const isNewUser = !existingUser;

                // Register or update user
                this.registerOrUpdateUser(userData);

                // Create session with isNewUser flag
                this.createUserSession(userData, isNewUser);

                // Add welcome notification for new users
                if (isNewUser) {
                    this.addNotification(userData.googleId, {
                        type: 'welcome',
                        title: 'Welcome to EM Luxury Cars!',
                        message: 'Your account has been created successfully.',
                        read: false
                    });
                }

                // Redirect to user dashboard
                window.location.href = 'user-dashboard.html';
            }
        } catch (error) {
            console.error('Error processing Google sign-in:', error);
            showNotificationModal('Login failed. Please try again.', 'error');
        }
    },

    // Decode JWT payload (Google ID token)
    decodeJwtPayload: function(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding JWT:', error);
            return null;
        }
    },

    // ==================== USER MANAGEMENT ====================

    // Register new user or update existing
    registerOrUpdateUser: function(userData) {
        let users = this.getFromStorage(this.KEYS.USERS) || [];
        const existingIndex = users.findIndex(u => u.googleId === userData.googleId);

        if (existingIndex > -1) {
            // Update existing user
            users[existingIndex] = {
                ...users[existingIndex],
                name: userData.name,
                email: userData.email,
                picture: userData.picture,
                lastLogin: new Date().toISOString(),
                hasLoggedInBefore: true
            };
        } else {
            // Register new user
            users.push({
                googleId: userData.googleId,
                name: userData.name,
                email: userData.email,
                picture: userData.picture,
                phone: '',
                address: '',
                registeredAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                hasLoggedInBefore: true,
                // Ban-related fields
                isBanned: false,
                bannedUntil: null,
                bannedReason: null,
                bannedAt: null
            });
        }

        this.saveToStorage(this.KEYS.USERS, users);
    },

    // Get user by Google ID
    getUserByGoogleId: function(googleId) {
        const users = this.getFromStorage(this.KEYS.USERS) || [];
        return users.find(u => u.googleId === googleId);
    },

    // Update user profile
    updateUserProfile: function(googleId, updates) {
        let users = this.getFromStorage(this.KEYS.USERS) || [];
        const index = users.findIndex(u => u.googleId === googleId);
        
        if (index > -1) {
            users[index] = { ...users[index], ...updates, lastUpdated: new Date().toISOString() };
            this.saveToStorage(this.KEYS.USERS, users);
            return true;
        }
        return false;
    },

    // Ban user
    banUser: function(googleId, duration, reason) {
        let users = this.getFromStorage(this.KEYS.USERS) || [];
        const index = users.findIndex(u => u.googleId === googleId);
        
        if (index > -1) {
            let bannedUntil = null;
            if (duration !== 'permanent') {
                const now = new Date();
                const hours = parseInt(duration);
                bannedUntil = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
            }
            
            users[index].isBanned = true;
            users[index].bannedUntil = bannedUntil;
            users[index].bannedReason = reason || 'Violation of terms of service';
            users[index].bannedAt = new Date().toISOString();
            
            this.saveToStorage(this.KEYS.USERS, users);
            
            // Send notification to user
            this.addNotification(googleId, {
                type: 'account',
                title: 'Account Suspended',
                message: `Your account has been suspended. Reason: ${reason || 'Violation of terms of service'}`,
                read: false
            });
            
            return true;
        }
        return false;
    },

    // Unban user
    unbanUser: function(googleId) {
        let users = this.getFromStorage(this.KEYS.USERS) || [];
        const index = users.findIndex(u => u.googleId === googleId);
        
        if (index > -1) {
            users[index].isBanned = false;
            users[index].bannedUntil = null;
            users[index].bannedReason = null;
            users[index].bannedAt = null;
            
            this.saveToStorage(this.KEYS.USERS, users);
            
            // Send notification to user
            this.addNotification(googleId, {
                type: 'account',
                title: 'Account Restored',
                message: 'Your account has been restored. You can now access all features.',
                read: false
            });
            
            return true;
        }
        return false;
    },

    // Check if user is banned
    isUserBanned: function(googleId) {
        const user = this.getUserByGoogleId(googleId);
        if (!user) return { banned: false };
        
        if (!user.isBanned) return { banned: false };
        
        // Check if ban has expired (for timed bans)
        if (user.bannedUntil) {
            const bannedUntil = new Date(user.bannedUntil);
            const now = new Date();
            
            if (now >= bannedUntil) {
                // Ban expired, auto-unban
                this.unbanUser(googleId);
                return { banned: false };
            }
            
            // Calculate remaining time
            const remaining = bannedUntil - now;
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            
            return {
                banned: true,
                permanent: false,
                remaining: `${hours}h ${minutes}m`,
                reason: user.bannedReason,
                message: `Your account is suspended for ${hours}h ${minutes}m. Reason: ${user.bannedReason}`
            };
        }
        
        // Permanent ban
        return {
            banned: true,
            permanent: true,
            reason: user.bannedReason,
            message: `Your account is permanently suspended. Reason: ${user.bannedReason}`
        };
    },

    // Delete user and all their data
    deleteUser: function(googleId) {
        // Remove from users list
        let users = this.getFromStorage(this.KEYS.USERS) || [];
        users = users.filter(u => u.googleId !== googleId);
        this.saveToStorage(this.KEYS.USERS, users);
        
        // Remove user orders
        let orders = this.getFromStorage(this.KEYS.USER_ORDERS) || {};
        delete orders[googleId];
        this.saveToStorage(this.KEYS.USER_ORDERS, orders);
        
        // Remove user wishlist
        let wishlists = this.getFromStorage(this.KEYS.USER_WISHLIST) || {};
        delete wishlists[googleId];
        this.saveToStorage(this.KEYS.USER_WISHLIST, wishlists);
        
        // Remove user rentals
        let rentals = this.getFromStorage(this.KEYS.USER_RENTALS) || {};
        delete rentals[googleId];
        this.saveToStorage(this.KEYS.USER_RENTALS, rentals);
        
        // Remove user notifications
        let notifications = this.getFromStorage(this.KEYS.NOTIFICATIONS) || {};
        delete notifications[googleId];
        this.saveToStorage(this.KEYS.NOTIFICATIONS, notifications);
        
        // Remove user tickets
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        tickets = tickets.filter(t => t.userId !== googleId);
        this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);
        
        // Remove user inbox messages
        let messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        messages = messages.filter(m => m.fromId !== googleId && m.toId !== googleId);
        this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
        
        return true;
    },

    // Get all registered users (admin)
    getAllUsers: function() {
        const users = this.getFromStorage(this.KEYS.USERS) || [];
        // Check and update ban status for each user
        return users.map(user => {
            if (user.isBanned && user.bannedUntil) {
                const bannedUntil = new Date(user.bannedUntil);
                if (new Date() >= bannedUntil) {
                    // Ban expired
                    this.unbanUser(user.googleId);
                    user.isBanned = false;
                }
            }
            return user;
        });
    },

    // ==================== SESSION MANAGEMENT ====================

    // Create user session
    createUserSession: function(userData, isNewUser = false) {
        const session = {
            isLoggedIn: true,
            userType: 'user',
            googleId: userData.googleId,
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            loginTime: new Date().toISOString(),
            isNewUser: isNewUser
        };
        this.saveToStorage(this.KEYS.CURRENT_USER, session);
    },

    // Create admin session
    createAdminSession: function() {
        const session = {
            isLoggedIn: true,
            userType: 'admin',
            name: 'Administrator',
            email: 'admin@emcars.com',
            picture: null,
            loginTime: new Date().toISOString()
        };
        this.saveToStorage(this.KEYS.CURRENT_USER, session);
    },

    // Get current user session
    getCurrentUser: function() {
        return this.getFromStorage(this.KEYS.CURRENT_USER);
    },

    // Check if logged in
    isLoggedIn: function() {
        const user = this.getCurrentUser();
        return user && user.isLoggedIn === true;
    },

    // Check if current user is admin
    isAdmin: function() {
        const user = this.getCurrentUser();
        return user && user.isLoggedIn && user.userType === 'admin';
    },

    // Check if current user is regular user
    isUser: function() {
        const user = this.getCurrentUser();
        return user && user.isLoggedIn && user.userType === 'user';
    },

    // Logout
    logout: function() {
        localStorage.removeItem(this.KEYS.CURRENT_USER);
        
        // Revoke Google token if applicable
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        
        window.location.href = 'login.html';
    },

    // ==================== ADMIN AUTHENTICATION ====================

    // Admin login
    adminLogin: function(email, password) {
        if (email === this.ADMIN_CREDENTIALS.email && password === this.ADMIN_CREDENTIALS.password) {
            this.createAdminSession();
            return { success: true };
        }
        return { success: false, message: 'Invalid admin credentials' };
    },

    // ==================== PAGE PROTECTION ====================

    // Require authentication (call on protected pages)
    requireAuth: function(requiredRole = 'any') {
        const user = this.getCurrentUser();

        if (!user || !user.isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }

        // Check if user is banned
        if (user.userType === 'user') {
            const banStatus = this.isUserBanned(user.googleId);
            if (banStatus.banned) {
                showNotificationModal(banStatus.message, 'error', 'Access Denied');
                this.logout();
                return false;
            }
        }

        if (requiredRole === 'admin' && user.userType !== 'admin') {
            window.location.href = 'login.html?error=unauthorized';
            return false;
        }

        if (requiredRole === 'user' && user.userType !== 'user') {
            window.location.href = 'login.html?error=unauthorized';
            return false;
        }

        return true;
    },

    // ==================== ORDERS MANAGEMENT ====================

    // Get user orders
    getUserOrders: function(googleId) {
        const allOrders = this.getFromStorage(this.KEYS.USER_ORDERS) || {};
        return allOrders[googleId] || [];
    },

    // Add order
    addOrder: function(googleId, order) {
        let allOrders = this.getFromStorage(this.KEYS.USER_ORDERS) || {};
        if (!allOrders[googleId]) {
            allOrders[googleId] = [];
        }
        
        const newOrder = {
            orderId: 'EM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...order,
            date: new Date().toISOString(),
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                date: new Date().toISOString(),
                note: 'Order placed'
            }]
        };
        
        allOrders[googleId].unshift(newOrder);
        this.saveToStorage(this.KEYS.USER_ORDERS, allOrders);

        // Add notification
        this.addNotification(googleId, {
            type: 'order',
            title: 'Order Placed!',
            message: `Your order #${newOrder.orderId} has been placed successfully.`,
            read: false
        });

        return newOrder;
    },

    // Get all orders (for admin)
    getAllOrders: function() {
        const allOrders = this.getFromStorage(this.KEYS.USER_ORDERS) || {};
        const users = this.getFromStorage(this.KEYS.USERS) || [];
        let orders = [];

        for (const googleId in allOrders) {
            const user = users.find(u => u.googleId === googleId);
            allOrders[googleId].forEach(order => {
                orders.push({
                    ...order,
                    googleId: googleId,
                    userName: user ? user.name : 'Deleted User',
                    userEmail: user ? user.email : 'N/A',
                    userPicture: user ? user.picture : null
                });
            });
        }

        return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // Update order status
    updateOrderStatus: function(orderId, status, note = '') {
        let allOrders = this.getFromStorage(this.KEYS.USER_ORDERS) || {};
        
        for (const googleId in allOrders) {
            const orderIndex = allOrders[googleId].findIndex(o => o.orderId === orderId);
            if (orderIndex > -1) {
                allOrders[googleId][orderIndex].status = status;
                
                // Add to status history
                if (!allOrders[googleId][orderIndex].statusHistory) {
                    allOrders[googleId][orderIndex].statusHistory = [];
                }
                allOrders[googleId][orderIndex].statusHistory.push({
                    status: status,
                    date: new Date().toISOString(),
                    note: note || `Status updated to ${status}`
                });
                
                this.saveToStorage(this.KEYS.USER_ORDERS, allOrders);

                // Notify user
                const statusMessages = {
                    'pending': 'is pending confirmation',
                    'confirmed': 'has been confirmed',
                    'processing': 'is being processed',
                    'shipped': 'has been shipped',
                    'out-for-delivery': 'is out for delivery',
                    'delivered': 'has been delivered',
                    'completed': 'has been completed',
                    'cancelled': 'has been cancelled'
                };
                
                this.addNotification(googleId, {
                    type: 'order_update',
                    title: 'Order Update',
                    message: `Your order #${orderId} ${statusMessages[status] || 'status changed to: ' + status}`,
                    read: false
                });
                return true;
            }
        }
        return false;
    },

    // ==================== WISHLIST MANAGEMENT ====================

    // Get user wishlist
    getUserWishlist: function(googleId) {
        const allWishlists = this.getFromStorage(this.KEYS.USER_WISHLIST) || {};
        return allWishlists[googleId] || [];
    },

    // Add to wishlist
    addToWishlist: function(googleId, item) {
        let allWishlists = this.getFromStorage(this.KEYS.USER_WISHLIST) || {};
        if (!allWishlists[googleId]) {
            allWishlists[googleId] = [];
        }

        // Check if already exists
        const exists = allWishlists[googleId].find(w => w.id === item.id);
        if (!exists) {
            allWishlists[googleId].push({
                ...item,
                addedAt: new Date().toISOString()
            });
            this.saveToStorage(this.KEYS.USER_WISHLIST, allWishlists);
        }
    },

    // Remove from wishlist
    removeFromWishlist: function(googleId, itemId) {
        let allWishlists = this.getFromStorage(this.KEYS.USER_WISHLIST) || {};
        if (allWishlists[googleId]) {
            allWishlists[googleId] = allWishlists[googleId].filter(w => w.id !== itemId);
            this.saveToStorage(this.KEYS.USER_WISHLIST, allWishlists);
        }
    },

    // ==================== RENTALS MANAGEMENT ====================

    // Get user rentals
    getUserRentals: function(googleId) {
        const allRentals = this.getFromStorage(this.KEYS.USER_RENTALS) || {};
        return allRentals[googleId] || [];
    },

    // Add rental
    addRental: function(googleId, rental) {
        let allRentals = this.getFromStorage(this.KEYS.USER_RENTALS) || {};
        if (!allRentals[googleId]) {
            allRentals[googleId] = [];
        }

        const newRental = {
            rentalId: 'RNT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...rental,
            bookedAt: new Date().toISOString(),
            status: 'confirmed'
        };

        allRentals[googleId].unshift(newRental);
        this.saveToStorage(this.KEYS.USER_RENTALS, allRentals);

        // Add notification
        this.addNotification(googleId, {
            type: 'rental',
            title: 'Rental Confirmed!',
            message: `Your rental #${newRental.rentalId} has been confirmed.`,
            read: false
        });

        return newRental;
    },

    // Get all rentals (for admin)
    getAllRentals: function() {
        const allRentals = this.getFromStorage(this.KEYS.USER_RENTALS) || {};
        const users = this.getFromStorage(this.KEYS.USERS) || [];
        let rentals = [];

        for (const googleId in allRentals) {
            const user = users.find(u => u.googleId === googleId);
            allRentals[googleId].forEach(rental => {
                rentals.push({
                    ...rental,
                    googleId: googleId,
                    userName: user ? user.name : 'Deleted User',
                    userEmail: user ? user.email : 'N/A'
                });
            });
        }

        return rentals.sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
    },

    // Update rental status
    updateRentalStatus: function(rentalId, status) {
        let allRentals = this.getFromStorage(this.KEYS.USER_RENTALS) || {};
        
        for (const googleId in allRentals) {
            const rentalIndex = allRentals[googleId].findIndex(r => r.rentalId === rentalId);
            if (rentalIndex > -1) {
                allRentals[googleId][rentalIndex].status = status;
                this.saveToStorage(this.KEYS.USER_RENTALS, allRentals);

                this.addNotification(googleId, {
                    type: 'rental_update',
                    title: 'Rental Update',
                    message: `Your rental #${rentalId} status: ${status}`,
                    read: false
                });
                return true;
            }
        }
        return false;
    },

    // ==================== SUPPORT TICKETS ====================

    // Get user tickets
    getUserTickets: function(googleId) {
        const allTickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        return allTickets.filter(t => t.userId === googleId);
    },

    // Get all tickets (for admin)
    getAllTickets: function() {
        return this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
    },

    // Create ticket
    createTicket: function(googleId, ticket) {
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        const user = this.getUserByGoogleId(googleId);

        const newTicket = {
            id: 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            userId: googleId,
            userName: user ? user.name : 'Unknown',
            userEmail: user ? user.email : 'Unknown',
            subject: ticket.subject,
            message: ticket.message,
            status: 'open',
            createdAt: new Date().toISOString(),
            responses: []
        };

        tickets.unshift(newTicket);
        this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);
        return newTicket;
    },

    // Add response to ticket (admin)
    addTicketResponse: function(ticketId, response) {
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        const index = tickets.findIndex(t => t.id === ticketId);

        if (index > -1) {
            tickets[index].responses.push({
                message: response,
                from: 'admin',
                date: new Date().toISOString()
            });
            tickets[index].status = 'in-progress';
            this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);

            // Notify user
            this.addNotification(tickets[index].userId, {
                type: 'ticket_update',
                title: 'Ticket Response',
                message: `Admin responded to your ticket #${ticketId}`,
                read: false
            });
            return true;
        }
        return false;
    },

    // Close ticket
    closeTicket: function(ticketId) {
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        const index = tickets.findIndex(t => t.id === ticketId);

        if (index > -1) {
            tickets[index].status = 'resolved';
            this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);
            return true;
        }
        return false;
    },

    // Delete ticket
    deleteTicket: function(ticketId, userId) {
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        const index = tickets.findIndex(t => t.id === ticketId && t.userId === userId);
        
        if (index > -1) {
            tickets.splice(index, 1);
            this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);
            return true;
        }
        return false;
    },

    // Update ticket (user can edit subject and message if status is still 'open')
    updateTicket: function(ticketId, userId, updates) {
        let tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        const index = tickets.findIndex(t => t.id === ticketId && t.userId === userId);
        
        if (index > -1) {
            // Only allow editing if ticket is still open
            if (tickets[index].status !== 'open') {
                return false;
            }
            
            if (updates.subject) tickets[index].subject = updates.subject;
            if (updates.message) tickets[index].message = updates.message;
            tickets[index].updatedAt = new Date().toISOString();
            
            this.saveToStorage(this.KEYS.SUPPORT_TICKETS, tickets);
            return true;
        }
        return false;
    },

    // Get single ticket by ID
    getTicketById: function(ticketId) {
        const tickets = this.getFromStorage(this.KEYS.SUPPORT_TICKETS) || [];
        return tickets.find(t => t.id === ticketId);
    },

    // ==================== NOTIFICATIONS ====================

    // Get user notifications
    getNotifications: function(googleId) {
        const allNotifications = this.getFromStorage(this.KEYS.NOTIFICATIONS) || {};
        return allNotifications[googleId] || [];
    },

    // Add notification
    addNotification: function(googleId, notification) {
        let allNotifications = this.getFromStorage(this.KEYS.NOTIFICATIONS) || {};
        if (!allNotifications[googleId]) {
            allNotifications[googleId] = [];
        }

        allNotifications[googleId].unshift({
            id: 'NTF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...notification,
            date: new Date().toISOString()
        });

        // Keep only last 50 notifications
        allNotifications[googleId] = allNotifications[googleId].slice(0, 50);
        this.saveToStorage(this.KEYS.NOTIFICATIONS, allNotifications);
    },

    // Mark notification as read
    markNotificationRead: function(googleId, notificationId) {
        let allNotifications = this.getFromStorage(this.KEYS.NOTIFICATIONS) || {};
        if (allNotifications[googleId]) {
            const index = allNotifications[googleId].findIndex(n => n.id === notificationId);
            if (index > -1) {
                allNotifications[googleId][index].read = true;
                this.saveToStorage(this.KEYS.NOTIFICATIONS, allNotifications);
            }
        }
    },

    // Mark all notifications as read
    markAllNotificationsRead: function(googleId) {
        let allNotifications = this.getFromStorage(this.KEYS.NOTIFICATIONS) || {};
        if (allNotifications[googleId]) {
            allNotifications[googleId].forEach(n => n.read = true);
            this.saveToStorage(this.KEYS.NOTIFICATIONS, allNotifications);
        }
    },

    // Get unread notification count
    getUnreadNotificationCount: function(googleId) {
        const notifications = this.getNotifications(googleId);
        return notifications.filter(n => !n.read).length;
    },

    // ==================== CONTACT MESSAGES ====================

    // Save contact message
    saveContactMessage: function(message) {
        let messages = this.getFromStorage(this.KEYS.CONTACT_MESSAGES) || [];
        messages.unshift({
            id: 'MSG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...message,
            date: new Date().toISOString(),
            read: false
        });
        this.saveToStorage(this.KEYS.CONTACT_MESSAGES, messages);
    },

    // Get all contact messages (admin)
    getContactMessages: function() {
        return this.getFromStorage(this.KEYS.CONTACT_MESSAGES) || [];
    },

    // Mark message as read
    markMessageRead: function(messageId) {
        let messages = this.getFromStorage(this.KEYS.CONTACT_MESSAGES) || [];
        const index = messages.findIndex(m => m.id === messageId);
        if (index > -1) {
            messages[index].read = true;
            this.saveToStorage(this.KEYS.CONTACT_MESSAGES, messages);
        }
    },

    // Delete message
    deleteMessage: function(messageId) {
        let messages = this.getFromStorage(this.KEYS.CONTACT_MESSAGES) || [];
        messages = messages.filter(m => m.id !== messageId);
        this.saveToStorage(this.KEYS.CONTACT_MESSAGES, messages);
    },

    // ==================== INBOX MESSAGING SYSTEM ====================

    // Send inbox message (works both ways: user to admin, admin to user)
    sendInboxMessage: function(fromId, toId, subject, message) {
        let messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        
        const fromUser = fromId === 'admin' ? { name: 'Admin', email: 'admin@emcars.com' } : this.getUserByGoogleId(fromId);
        const toUser = toId === 'admin' ? { name: 'Admin', email: 'admin@emcars.com' } : this.getUserByGoogleId(toId);
        
        const newMessage = {
            id: 'INBOX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            fromId: fromId,
            toId: toId,
            fromName: fromUser ? fromUser.name : 'Unknown',
            toName: toUser ? toUser.name : 'Unknown',
            subject: subject,
            message: message,
            date: new Date().toISOString(),
            read: false,
            replies: []
        };
        
        messages.unshift(newMessage);
        this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
        
        // Add notification for recipient
        if (toId !== 'admin') {
            this.addNotification(toId, {
                type: 'inbox',
                title: 'New Message from Admin',
                message: subject,
                read: false
            });
        }
        
        return newMessage;
    },

    // Get inbox messages for a user
    getUserInboxMessages: function(userId) {
        const messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        return messages.filter(m => m.toId === userId || m.fromId === userId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // Get admin inbox (all messages sent to admin)
    getAdminInbox: function() {
        const messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        return messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // Mark inbox message as read
    markInboxMessageRead: function(messageId) {
        let messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        const index = messages.findIndex(m => m.id === messageId);
        if (index > -1) {
            messages[index].read = true;
            this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
        }
    },

    // Reply to inbox message
    replyToInboxMessage: function(messageId, replyText, fromId) {
        let messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        const index = messages.findIndex(m => m.id === messageId);
        
        if (index > -1) {
            const fromUser = fromId === 'admin' ? { name: 'Admin' } : this.getUserByGoogleId(fromId);
            
            messages[index].replies.push({
                message: replyText,
                from: fromId,
                fromName: fromUser ? fromUser.name : 'Unknown',
                date: new Date().toISOString()
            });
            
            this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
            
            // Notify the other party
            const originalMessage = messages[index];
            const recipientId = originalMessage.fromId === fromId ? originalMessage.toId : originalMessage.fromId;
            
            if (recipientId !== 'admin') {
                this.addNotification(recipientId, {
                    type: 'inbox',
                    title: 'New Reply',
                    message: `Reply to: ${originalMessage.subject}`,
                    read: false
                });
            }
            
            return true;
        }
        return false;
    },

    // Get unread inbox count
    getUnreadInboxCount: function(userId) {
        const messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        return messages.filter(m => m.toId === userId && !m.read).length;
    },

    // Like/Unlike inbox message
    toggleMessageLike: function(messageId, userId) {
        let messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        const index = messages.findIndex(m => m.id === messageId);
        if (index > -1) {
            // Initialize likes array if not exists
            if (!messages[index].likes) {
                messages[index].likes = [];
            }
            
            const likeIndex = messages[index].likes.indexOf(userId);
            if (likeIndex > -1) {
                // Unlike
                messages[index].likes.splice(likeIndex, 1);
                this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
                return false; // unliked
            } else {
                // Like
                messages[index].likes.push(userId);
                this.saveToStorage(this.KEYS.INBOX_MESSAGES, messages);
                return true; // liked
            }
        }
        return null;
    },

    // Check if user liked a message
    hasUserLikedMessage: function(messageId, userId) {
        const messages = this.getFromStorage(this.KEYS.INBOX_MESSAGES) || [];
        const msg = messages.find(m => m.id === messageId);
        return msg && msg.likes && msg.likes.includes(userId);
    },

    // ==================== BLOG POSTS ====================

    // Get all blog posts
    getBlogPosts: function() {
        return this.getFromStorage(this.KEYS.BLOG_POSTS) || [];
    },

    // Add blog post (admin)
    addBlogPost: function(post) {
        let posts = this.getFromStorage(this.KEYS.BLOG_POSTS) || [];
        posts.unshift({
            id: 'POST-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...post,
            date: new Date().toISOString()
        });
        this.saveToStorage(this.KEYS.BLOG_POSTS, posts);
    },

    // Update blog post
    updateBlogPost: function(postId, updates) {
        let posts = this.getFromStorage(this.KEYS.BLOG_POSTS) || [];
        const index = posts.findIndex(p => p.id === postId);
        if (index > -1) {
            posts[index] = { ...posts[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveToStorage(this.KEYS.BLOG_POSTS, posts);
            return true;
        }
        return false;
    },

    // Delete blog post
    deleteBlogPost: function(postId) {
        let posts = this.getFromStorage(this.KEYS.BLOG_POSTS) || [];
        posts = posts.filter(p => p.id !== postId);
        this.saveToStorage(this.KEYS.BLOG_POSTS, posts);
    },

    // ==================== TESTIMONIALS ====================

    // Get all testimonials
    getTestimonials: function(approvedOnly = true) {
        const testimonials = this.getFromStorage(this.KEYS.TESTIMONIALS) || [];
        return approvedOnly ? testimonials.filter(t => t.approved) : testimonials;
    },

    // Add testimonial
    addTestimonial: function(testimonial) {
        let testimonials = this.getFromStorage(this.KEYS.TESTIMONIALS) || [];
        testimonials.unshift({
            id: 'REV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...testimonial,
            date: new Date().toISOString(),
            approved: false
        });
        this.saveToStorage(this.KEYS.TESTIMONIALS, testimonials);
    },

    // Approve testimonial
    approveTestimonial: function(testimonialId) {
        let testimonials = this.getFromStorage(this.KEYS.TESTIMONIALS) || [];
        const index = testimonials.findIndex(t => t.id === testimonialId);
        if (index > -1) {
            testimonials[index].approved = true;
            this.saveToStorage(this.KEYS.TESTIMONIALS, testimonials);
            return true;
        }
        return false;
    },

    // Delete testimonial
    deleteTestimonial: function(testimonialId) {
        let testimonials = this.getFromStorage(this.KEYS.TESTIMONIALS) || [];
        testimonials = testimonials.filter(t => t.id !== testimonialId);
        this.saveToStorage(this.KEYS.TESTIMONIALS, testimonials);
    },

    // ==================== DYNAMIC INVENTORY: CARS FOR SALE ====================

    // Get all cars for sale
    getCars: function() {
        return this.getFromStorage(this.KEYS.CARS) || [];
    },

    // Add car
    addCar: function(car) {
        let cars = this.getFromStorage(this.KEYS.CARS) || [];
        const newCar = {
            id: 'CAR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...car,
            createdAt: new Date().toISOString(),
            status: car.status || 'available'
        };
        cars.unshift(newCar);
        this.saveToStorage(this.KEYS.CARS, cars);
        return newCar;
    },

    // Update car
    updateCar: function(carId, updates) {
        let cars = this.getFromStorage(this.KEYS.CARS) || [];
        const index = cars.findIndex(c => c.id === carId);
        if (index > -1) {
            cars[index] = { ...cars[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveToStorage(this.KEYS.CARS, cars);
            return true;
        }
        return false;
    },

    // Delete car
    deleteCar: function(carId) {
        let cars = this.getFromStorage(this.KEYS.CARS) || [];
        cars = cars.filter(c => c.id !== carId);
        this.saveToStorage(this.KEYS.CARS, cars);
    },

    // ==================== DYNAMIC INVENTORY: RENTAL CARS ====================

    // Get all rental cars
    getRentalCars: function() {
        return this.getFromStorage(this.KEYS.RENTAL_CARS) || [];
    },

    // Add rental car
    addRentalCar: function(car) {
        let cars = this.getFromStorage(this.KEYS.RENTAL_CARS) || [];
        const newCar = {
            id: 'RENT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...car,
            createdAt: new Date().toISOString(),
            status: car.status || 'available'
        };
        cars.unshift(newCar);
        this.saveToStorage(this.KEYS.RENTAL_CARS, cars);
        return newCar;
    },

    // Update rental car
    updateRentalCar: function(carId, updates) {
        let cars = this.getFromStorage(this.KEYS.RENTAL_CARS) || [];
        const index = cars.findIndex(c => c.id === carId);
        if (index > -1) {
            cars[index] = { ...cars[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveToStorage(this.KEYS.RENTAL_CARS, cars);
            return true;
        }
        return false;
    },

    // Delete rental car
    deleteRentalCar: function(carId) {
        let cars = this.getFromStorage(this.KEYS.RENTAL_CARS) || [];
        cars = cars.filter(c => c.id !== carId);
        this.saveToStorage(this.KEYS.RENTAL_CARS, cars);
    },

    // ==================== DYNAMIC INVENTORY: CAR PARTS ====================

    // Get all car parts
    getCarParts: function() {
        return this.getFromStorage(this.KEYS.CAR_PARTS) || [];
    },

    // Add car part
    addCarPart: function(part) {
        let parts = this.getFromStorage(this.KEYS.CAR_PARTS) || [];
        const newPart = {
            id: 'PART-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...part,
            createdAt: new Date().toISOString(),
            status: part.status || 'in-stock'
        };
        parts.unshift(newPart);
        this.saveToStorage(this.KEYS.CAR_PARTS, parts);
        return newPart;
    },

    // Update car part
    updateCarPart: function(partId, updates) {
        let parts = this.getFromStorage(this.KEYS.CAR_PARTS) || [];
        const index = parts.findIndex(p => p.id === partId);
        if (index > -1) {
            parts[index] = { ...parts[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveToStorage(this.KEYS.CAR_PARTS, parts);
            return true;
        }
        return false;
    },

    // Delete car part
    deleteCarPart: function(partId) {
        let parts = this.getFromStorage(this.KEYS.CAR_PARTS) || [];
        parts = parts.filter(p => p.id !== partId);
        this.saveToStorage(this.KEYS.CAR_PARTS, parts);
    },

    // ==================== UTILITY FUNCTIONS ====================

    // Get from localStorage
    getFromStorage: function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    },

    // Save to localStorage
    saveToStorage: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },

    // Get dashboard stats (admin)
    getAdminStats: function() {
        const users = this.getAllUsers();
        const orders = this.getAllOrders();
        const tickets = this.getAllTickets();
        const messages = this.getContactMessages();
        const rentals = this.getAllRentals();
        const inboxMessages = this.getAdminInbox();

        // Calculate revenue
        const orderRevenue = orders.reduce((sum, o) => {
            if (o.status !== 'cancelled') return sum + (o.total || 0);
            return sum;
        }, 0);
        
        const rentalRevenue = rentals.reduce((sum, r) => {
            return sum + (r.totalCost || r.total || 0);
        }, 0);

        return {
            totalUsers: users.filter(u => !u.isBanned).length,
            bannedUsers: users.filter(u => u.isBanned).length,
            totalOrders: orders.length,
            pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
            totalRentals: rentals.length,
            activeRentals: rentals.filter(r => r.status === 'confirmed' || r.status === 'active').length,
            openTickets: tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length,
            unreadMessages: messages.filter(m => !m.read).length,
            unreadInbox: inboxMessages.filter(m => m.toId === 'admin' && !m.read).length,
            revenue: orderRevenue + rentalRevenue,
            orderRevenue: orderRevenue,
            rentalRevenue: rentalRevenue
        };
    },

    // Get chart data for admin dashboard
    getChartData: function() {
        const orders = this.getAllOrders();
        const rentals = this.getAllRentals();
        const users = this.getAllUsers();
        
        // Get last 6 months data
        const months = [];
        const revenueData = [];
        const ordersData = [];
        const usersData = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            months.push(monthYear);
            
            // Calculate monthly revenue
            const monthlyOrderRevenue = orders
                .filter(o => {
                    const orderDate = new Date(o.date);
                    return orderDate >= monthStart && orderDate <= monthEnd && o.status !== 'cancelled';
                })
                .reduce((sum, o) => sum + (o.total || 0), 0);
            
            const monthlyRentalRevenue = rentals
                .filter(r => {
                    const rentalDate = new Date(r.bookedAt);
                    return rentalDate >= monthStart && rentalDate <= monthEnd;
                })
                .reduce((sum, r) => sum + (r.totalCost || r.total || 0), 0);
            
            revenueData.push(monthlyOrderRevenue + monthlyRentalRevenue);
            
            // Count monthly orders
            const monthlyOrders = orders.filter(o => {
                const orderDate = new Date(o.date);
                return orderDate >= monthStart && orderDate <= monthEnd;
            }).length;
            ordersData.push(monthlyOrders);
            
            // Count monthly user registrations
            const monthlyUsers = users.filter(u => {
                const regDate = new Date(u.registeredAt);
                return regDate >= monthStart && regDate <= monthEnd;
            }).length;
            usersData.push(monthlyUsers);
        }
        
        // Category breakdown
        let carSales = 0;
        let partSales = 0;
        let rentalSales = 0;
        
        orders.forEach(order => {
            if (order.status === 'cancelled') return;
            if (order.items) {
                order.items.forEach(item => {
                    if (item.type === 'Sale' || item.type === 'car') {
                        carSales += item.price * (item.quantity || 1);
                    } else if (item.type === 'Part' || item.type === 'part') {
                        partSales += item.price * (item.quantity || 1);
                    } else if (item.type === 'Rental' || item.type === 'rental') {
                        rentalSales += item.price * (item.quantity || 1);
                    }
                });
            }
        });
        
        rentals.forEach(rental => {
            rentalSales += rental.totalCost || rental.total || 0;
        });
        
        const totalSales = carSales + partSales + rentalSales;
        
        return {
            months,
            revenueData,
            ordersData,
            usersData,
            categoryData: {
                cars: totalSales > 0 ? Math.round((carSales / totalSales) * 100) : 0,
                parts: totalSales > 0 ? Math.round((partSales / totalSales) * 100) : 0,
                rentals: totalSales > 0 ? Math.round((rentalSales / totalSales) * 100) : 0
            }
        };
    },

    // Format date
    formatDate: function(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Format date with time
    formatDateTime: function(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Clear all data (for testing)
    clearAllData: function() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        localStorage.removeItem('emCart');
        console.log('All EM Luxury Cars data cleared!');
    },

    // Initialize default inventory - NO LONGER ADDS MOCK DATA
    // All inventory data must be added through the admin panel
    initializeDefaultInventory: function() {
        // This function is intentionally empty
        // All cars, rental cars, and parts must be added manually through the admin panel
        // No mock/default data is loaded automatically
        console.log('Inventory system ready - add items through admin panel');
    }
};

// ==================== NAVBAR DYNAMIC RENDERING ====================

function renderAuthNavbar() {
    const user = EMAuth.getCurrentUser();
    const navAuthContainer = document.getElementById('em-nav-auth');
    
    if (!navAuthContainer) return;

    if (!user || !user.isLoggedIn) {
        // Not logged in
        navAuthContainer.innerHTML = `
            <li class="nav-item">
                <a href="login.html" class="btn em-btn-primary">Login</a>
            </li>
        `;
    } else if (user.userType === 'admin') {
        // Admin logged in
        navAuthContainer.innerHTML = `
            <li class="nav-item">
                <a class="nav-link em-nav-link" href="admin.html">
                    <i class="bi bi-shield-lock-fill me-1"></i>Admin Panel
                </a>
            </li>
            <li class="nav-item ms-lg-2">
                <button class="btn btn-outline-dark rounded-pill" onclick="EMAuth.logout()">
                    <i class="bi bi-box-arrow-right me-1"></i>Logout
                </button>
            </li>
        `;
    } else {
        // User logged in
        const unreadCount = EMAuth.getUnreadNotificationCount(user.googleId);
        const inboxCount = EMAuth.getUnreadInboxCount(user.googleId);
        const totalUnread = unreadCount + inboxCount;
        
        navAuthContainer.innerHTML = `
            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" data-bs-toggle="dropdown">
                    <img src="${user.picture}" class="rounded-circle" width="32" height="32" alt="${user.name}" style="object-fit: cover;">
                    <span class="d-none d-lg-inline">${user.name.split(' ')[0]}</span>
                    ${totalUnread > 0 ? `<span class="badge bg-danger rounded-pill">${totalUnread}</span>` : ''}
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="user-dashboard.html"><i class="bi bi-speedometer2 me-2"></i>My Dashboard</a></li>
                    <li><a class="dropdown-item" href="user-dashboard.html#orders"><i class="bi bi-bag me-2"></i>My Orders</a></li>
                    <li><a class="dropdown-item" href="user-dashboard.html#wishlist"><i class="bi bi-heart me-2"></i>Wishlist</a></li>
                    <li><a class="dropdown-item" href="user-dashboard.html#bookings"><i class="bi bi-calendar-check me-2"></i>Booking History</a></li>
                    <li><a class="dropdown-item" href="user-dashboard.html#inbox"><i class="bi bi-envelope me-2"></i>Inbox ${totalUnread > 0 ? `<span class="badge bg-danger">${totalUnread}</span>` : ''}</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" onclick="EMAuth.logout(); return false;"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
                </ul>
            </li>
        `;
    }
}

// Initialize navbar on page load
document.addEventListener('DOMContentLoaded', function() {
    renderAuthNavbar();
    // Initialize default inventory if needed
    EMAuth.initializeDefaultInventory();
    // Initialize toast container
    initToastContainer();
});

// ==================== GLOBAL TOAST NOTIFICATION SYSTEM ====================

// Initialize toast container
function initToastContainer() {
    if (document.getElementById('em-toast-container')) return;
    
    const container = document.createElement('div');
    container.id = 'em-toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    
    // Also add global notification modal if not exists
    if (!document.getElementById('emNotificationModal')) {
        const modalHtml = `
            <div class="modal fade" id="emNotificationModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header" id="emNotificationHeader">
                            <h5 class="modal-title" id="emNotificationTitle">Notification</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center py-4">
                            <div id="emNotificationIcon" class="mb-3"></div>
                            <p id="emNotificationMessage" class="mb-0"></p>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <button type="button" class="btn btn-dark rounded-pill px-4" data-bs-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('em-toast-container');
    if (!container) {
        initToastContainer();
    }
    
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };
    
    const bgColors = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-primary'
    };
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgColors[type]} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${icons[type]}"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    document.getElementById('em-toast-container').insertAdjacentHTML('beforeend', toastHtml);
    
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// Show modal notification (for important messages)
function showNotificationModal(message, type = 'success', title = null) {
    const modal = document.getElementById('emNotificationModal');
    if (!modal) {
        initToastContainer();
    }
    
    const icons = {
        success: '<i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>',
        error: '<i class="bi bi-x-circle-fill text-danger" style="font-size: 3rem;"></i>',
        warning: '<i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 3rem;"></i>',
        info: '<i class="bi bi-info-circle-fill text-primary" style="font-size: 3rem;"></i>'
    };
    
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Information'
    };
    
    document.getElementById('emNotificationIcon').innerHTML = icons[type];
    document.getElementById('emNotificationTitle').innerText = title || titles[type];
    document.getElementById('emNotificationMessage').innerText = message;
    
    new bootstrap.Modal(document.getElementById('emNotificationModal')).show();
}

// Global function to replace alerts
window.showToast = showToast;
window.showNotificationModal = showNotificationModal;

// Login as demo user (for testing without Google OAuth)
EMAuth.loginAsDemo = function() {
    // Create demo user if not exists
    const demoUser = {
        googleId: 'demo-user-123',
        name: 'Demo User',
        email: 'demo@example.com',
        picture: 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff&size=128'
    };
    
    // Check if banned
    const banStatus = this.isUserBanned(demoUser.googleId);
    if (banStatus.banned) {
        showNotificationModal(banStatus.message, 'error', 'Access Denied');
        return;
    }
    
    this.registerOrUpdateUser(demoUser);
    this.createUserSession(demoUser);
    console.log('Logged in as demo user');
    window.location.href = 'user-dashboard.html';
};
