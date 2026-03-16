// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Utility references
    const supabase = window.supabaseClient;
    const body = document.body;

    // Toast and Loading (If not on app.js yet)
    const showLoading = (show) => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.toggle('d-none', !show);
    };

    const showToast = (message, type = 'default') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // Check Auth State
    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const isAuthPage = window.location.pathname.endsWith('auth.html') || window.location.pathname === '/auth.html';

            if (session) {
                if (isAuthPage) {
                    window.location.replace('index.html');
                }
            } else {
                if (!isAuthPage) {
                    window.location.replace('auth.html');
                }
            }
        } catch (err) {
            console.error("Session Check Error (LocalStorage blocked?):", err);
            if (!window.location.pathname.endsWith('auth.html')) {
                window.location.replace('auth.html'); // Ensure unauth state redirects
            }
        }
    };

    // Listen to session changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            window.location.replace('index.html');
        } else if (event === 'SIGNED_OUT') {
            window.location.replace('auth.html');
        }
    });

    checkUser();

    // If on Auth Page, attach event listeners
    if (body.classList.contains('auth-page')) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const forgotForm = document.getElementById('forgot-form');

        // Toggle Forms
        document.getElementById('show-signup-btn').addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('d-none');
            signupForm.classList.remove('d-none');
        });

        document.getElementById('show-login-btn').addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
        });

        document.getElementById('show-forgot-btn').addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('d-none');
            forgotForm.classList.remove('d-none');
        });

        document.getElementById('back-to-login-btn').addEventListener('click', (e) => {
            e.preventDefault();
            forgotForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
        });

        // Handle Log In
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            showLoading(true);
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });

                if (error) {
                    showToast(error.message, 'error');
                } else {
                    showToast('Login successful!', 'success');
                }
            } catch (err) {
                showToast("System error: " + err.message + ". Are you running on file:// or strict mode?", "error");
                console.error("Login Exception:", err);
            } finally {
                showLoading(false);
            }
        });

        // Handle Sign Up
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            showLoading(true);
            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });

                if (error) {
                    showToast(error.message, 'error');
                } else {
                    showToast('Registration successful! Please check your email.', 'success');
                    signupForm.classList.add('d-none');
                    loginForm.classList.remove('d-none');
                }
            } catch (err) {
                showToast("System error: " + err.message, "error");
                console.error("Registration Exception:", err);
            } finally {
                showLoading(false);
            }
        });

        // Handle Google OAuth
        document.getElementById('google-login-btn').addEventListener('click', async () => {
            try {
                showToast("Starting Google Login...", "default");
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + '/index.html' }
                });
                if (error) showToast("Supabase specific error: " + error.message, 'error');
            } catch (err) {
                showToast("System Error (Run Live Server!): " + err.message, "error");
                console.error("OAuth Exception:", err);
            }
        });

        // Handle Password Reset
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;

            showLoading(true);
            const { data, error } = await supabase.auth.resetPasswordForEmail(email);
            showLoading(false);

            if (error) {
                showToast(error.message, 'error');
            } else {
                showToast('Password reset link sent to your email.', 'success');
                forgotForm.classList.add('d-none');
                loginForm.classList.remove('d-none');
            }
        });
    }

    // Global Logout Listener for Index page
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showLoading(true);
            await supabase.auth.signOut();
            showLoading(false);
        });
    }
});