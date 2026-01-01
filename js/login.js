/* 
    FILE: js/login.js
    DESCRIPTION: Login page functionality
    - Google Sign-In initialization
    - Admin login form handling
    - Session checks and redirects
*/

(function() {
    'use strict';

    // Check if already logged in on page load
    document.addEventListener('DOMContentLoaded', function() {
        const user = EMAuth.getCurrentUser();
        if (user && user.isLoggedIn) {
            // Redirect based on user type
            if (user.userType === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'user-dashboard.html';
            }
            return;
        }

        // Check for error parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('error') === 'unauthorized') {
            showAdminError('You do not have permission to access that page.');
            const adminTab = document.getElementById('admin-tab');
            if (adminTab) adminTab.click();
        }

        // Initialize Google Sign-In with retry logic
        initGoogleSignIn();

        // Setup admin login form
        setupAdminLoginForm();
    });

    // Initialize Google Sign-In
    function initGoogleSignIn() {
        const maxRetries = 5;
        let retryCount = 0;

        function tryInit() {
            if (typeof google !== 'undefined' && typeof EMAuth !== 'undefined') {
                EMAuth.initGoogleSignIn('google-signin-btn');
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryInit, 500);
            } else {
                console.log('Google Identity Services not available. Using fallback.');
                showGoogleFallback();
            }
        }

        setTimeout(tryInit, 300);
    }

    // Show fallback for Google Sign-In
    function showGoogleFallback() {
        const container = document.getElementById('google-signin-btn');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle me-2"></i>
                    Google Sign-In is temporarily unavailable.<br>
                    <small class="text-muted">Please try again later or contact support.</small>
                </div>
            `;
        }
    }

    // Setup admin login form
    function setupAdminLoginForm() {
        const form = document.getElementById('admin-login-form');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;

            // Clear previous errors
            hideAdminError();

            // Validate
            if (!email || !password) {
                showAdminError('Please fill in all fields.');
                return;
            }

            // Attempt login
            const result = EMAuth.adminLogin(email, password);

            if (result.success) {
                window.location.href = 'admin.html';
            } else {
                showAdminError(result.message);
            }
        });
    }

    // Show admin error message
    function showAdminError(message) {
        const errorDiv = document.getElementById('admin-error');
        const errorText = document.getElementById('admin-error-text');
        if (errorDiv && errorText) {
            errorDiv.classList.remove('d-none');
            errorText.innerText = message;
        }
    }

    // Hide admin error message
    function hideAdminError() {
        const errorDiv = document.getElementById('admin-error');
        if (errorDiv) {
            errorDiv.classList.add('d-none');
        }
    }

    // Toggle password visibility
    window.togglePassword = function() {
        const passwordInput = document.getElementById('admin-password');
        const toggleIcon = document.getElementById('toggle-icon');
        
        if (passwordInput && toggleIcon) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('bi-eye');
                toggleIcon.classList.add('bi-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('bi-eye-slash');
                toggleIcon.classList.add('bi-eye');
            }
        }
    };

})();
