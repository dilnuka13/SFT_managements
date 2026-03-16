// js/app.js

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = window.supabaseClient;
    if (!document.body.classList.contains('auth-page')) {

        // Ensure user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // handled by auth.js

        const user = session.user;

        // --- Device Tracking ---
        const registerDevice = async () => {
            let deviceId = localStorage.getItem('sft_device_id');
            if (!deviceId) {
                deviceId = crypto.randomUUID();
                localStorage.setItem('sft_device_id', deviceId);
            }

            const userAgent = navigator.userAgent;
            const deviceName = userAgent.includes('Windows') ? 'Windows PC' :
                userAgent.includes('Mac') ? 'Mac OS' :
                    userAgent.includes('Android') ? 'Android Device' :
                        userAgent.includes('iPhone') ? 'iPhone' : 'Unknown Device';

            const browserName = userAgent.includes('Chrome') ? 'Chrome' :
                userAgent.includes('Firefox') ? 'Firefox' :
                    userAgent.includes('Safari') ? 'Safari' : 'Browser';

            let ip = 'Unknown';
            let location = 'Unknown';

            // Try multiple IP geolocation services for reliability
            const fetchGeoData = async () => {
                try {
                    // Try ip-api.com first (often more reliable)
                    const res = await fetch('http://ip-api.com/json/');
                    const data = await res.json();
                    if (data.status === 'success') {
                        return { ip: data.query, city: data.city, country: data.country };
                    }
                } catch (e) {
                    console.log("ip-api failed, trying ipapi.co");
                }
                
                try {
                    const res = await fetch('https://ipapi.co/json/');
                    const data = await res.json();
                    return { ip: data.ip, city: data.city, country: data.country_name };
                } catch (e) {
                    console.error("All IP services failed");
                }
                return null;
            };

            const geo = await fetchGeoData();
            if (geo) {
                ip = geo.ip || 'Unknown';
                location = geo.city ? `${geo.city}, ${geo.country}` : 'Unknown';
            }

            await supabase
                .from('user_devices')
                .upsert({
                    user_id: user.id,
                    device_id: deviceId,
                    device_name: deviceName,
                    browser_name: browserName,
                    ip_address: ip,
                    location: location,
                    last_login: new Date()
                }, { onConflict: 'user_id, device_id' });
        };

        await registerDevice();

        // --- Navigation Logic ---
        const navLinks = document.querySelectorAll('.nav-links a, .nav-item, .launch-card');
        const sections = document.querySelectorAll('.content-section');
        const headerTitle = document.querySelector('.header-title');

        // --- Switch Section Logic ---
        const switchSection = (targetId) => {
            // Update nav active state (Sidebar & Bottom Nav)
            document.querySelectorAll('.nav-links a, .nav-item').forEach(l => {
                if (l.getAttribute('data-target') === targetId) {
                    l.classList.add('active');
                } else {
                    l.classList.remove('active');
                }
            });

            // Update section active state
            sections.forEach(sec => {
                sec.classList.add('d-none');
                sec.classList.remove('active');
            });

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('d-none');
                setTimeout(() => targetSection.classList.add('active'), 10);
            }

            // Update header title and icon
            const headerIcon = document.getElementById('current-header-icon');
            if (targetId === 'launchpad-section') {
                headerTitle.textContent = 'Malaka Sir\'s SFT';
                if (headerIcon) headerIcon.textContent = 'home';
            } else {
                // Find matching link in sidebar or bottom nav to get icon and title
                const link = document.querySelector(`.nav-links a[data-target="${targetId}"], .nav-item[data-target="${targetId}"]`);
                if (link) {
                    const titleSpan = link.querySelector('span');
                    const iconI = link.querySelector('i');
                    if (titleSpan) headerTitle.textContent = titleSpan.textContent;
                    if (headerIcon && iconI) {
                        headerIcon.textContent = iconI.textContent;
                    }
                }
            }

            // Trigger events for specific sections
            if (targetId === 'dashboard-section' && window.loadDashboardData) {
                window.loadDashboardData();
            } else if (targetId === 'past-entries-section' && window.loadPastEntries) {
                window.loadPastEntries();
            }

            // Update URL Hash
            if (window.location.hash !== `#${targetId}`) {
                window.history.pushState(null, null, `#${targetId}`);
            }
        };

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                if (targetId) {
                    switchSection(targetId);
                    // Close sidebar on mobile
                    if (window.innerWidth <= 900) {
                        document.getElementById('sidebar').classList.remove('open');
                    }
                }
            });
        });

        // Initialize from Hash
        const handleHash = () => {
            const hash = window.location.hash.substring(1);
            if (hash && document.getElementById(hash)) {
                switchSection(hash);
            } else {
                switchSection('launchpad-section');
            }
        };

        // Listen for back/forward buttons
        window.addEventListener('popstate', handleHash);
        handleHash(); // Initial load

        // --- Mobile Menu Toggle ---
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // --- Profile Logic ---
        const loadProfile = async () => {
            // Fetch profile data
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            const avatarPreview = document.getElementById('profile-avatar-preview');
            const sidebarAvatar = document.getElementById('sidebar-avatar');
            const avatarUrlInput = document.getElementById('profile-avatar-url');
            
            // Set dynamic fallback based on email/user
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random`;

            if (data) {
                document.getElementById('profile-display-name').value = data.display_name || '';
                
                const finalAvatar = data.avatar_url || fallbackAvatar;
                
                if (data.avatar_url) {
                    avatarUrlInput.value = data.avatar_url;
                }
                
                if (avatarPreview) avatarPreview.src = finalAvatar;
                if (sidebarAvatar) sidebarAvatar.src = finalAvatar;
            } else {
                // No profile data yet, set default fallback
                if (avatarPreview) avatarPreview.src = fallbackAvatar;
                if (sidebarAvatar) sidebarAvatar.src = fallbackAvatar;
            }

            // Populate email from auth session and show Google branding if applicable
            const emailInput = document.getElementById('profile-email');
            const googleLogo = document.getElementById('google-logo-box');
            const verifiedBtn = document.getElementById('google-verified-btn');

            if (emailInput && user.email) {
                emailInput.value = user.email;
                
                const isGoogle = (user.app_metadata && user.app_metadata.provider === 'google') || 
                                 (user.email.endsWith('@gmail.com'));
                
                if (isGoogle) {
                    if (googleLogo) googleLogo.classList.remove('d-none');
                    emailInput.style.paddingLeft = '48px';
                } else {
                    if (googleLogo) googleLogo.classList.add('d-none');
                    emailInput.style.paddingLeft = '16px';
                }
                emailInput.style.paddingRight = '16px'; // Reset paddingRight since icon is removed
            }

            // Render Device List
            const sessionTableBody = document.querySelector('#session-table tbody');
            if (sessionTableBody) {
                sessionTableBody.innerHTML = '';

                const currentDeviceId = localStorage.getItem('sft_device_id');

                // Fetch all devices from DB
                const { data: devices } = await supabase
                    .from('user_devices')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('last_login', { ascending: false });

                if (devices) {
                    let sessIndex = 1;
                    devices.forEach(dev => {
                        const isCurrent = dev.device_id === currentDeviceId;
                        const loginTime = new Date(dev.last_login).toLocaleString('en-US', {
                            dateStyle: 'medium', timeStyle: 'short'
                        });

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${sessIndex++}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i class="material-symbols-rounded" style="color:var(--md-sys-color-primary); font-size:20px; font-variation-settings: 'FILL' 1;">
                                        ${(dev.device_name && (dev.device_name.includes('PC') || dev.device_name.includes('Mac'))) ? 'computer' : 'smartphone'}
                                    </i>
                                    <div>
                                        <strong>${dev.device_name || 'Device'}</strong> (${dev.browser_name || 'Browser'})
                                        ${isCurrent ? `<div style="font-size:11px; color:var(--md-sys-color-on-secondary-container); border:1px solid var(--md-sys-color-secondary-container); padding:2px 6px; border-radius:12px; display:inline-block; margin-left:8px; background:var(--md-sys-color-secondary-container);">Active Now</div>` : ''}
                                        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                                            <i class="material-symbols-rounded" style="font-size:14px; vertical-align:middle;">location_on</i> ${dev.location || 'Unknown Location'}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td style="color:var(--text-secondary); font-family:monospace;">${dev.ip_address || 'Unknown IP'}</td>
                            <td>${loginTime}</td>
                        `;
                        sessionTableBody.appendChild(tr);
                    });
                }
            }
        };

        loadProfile();

        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayName = document.getElementById('profile-display-name').value;
            const avatarUrl = document.getElementById('profile-avatar-url').value;

            window.showLoading(true);
            const { error } = await supabase
                .from('profiles')
                .update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date() })
                .eq('id', user.id);
            window.showLoading(false);

            if (error) {
                window.showToast('Failed to update profile: ' + error.message, 'error');
            } else {
                window.showToast('Profile updated successfully!', 'success');
                if (avatarUrl) {
                    const avatarPreview = document.getElementById('profile-avatar-preview');
                    const sidebarAvatar = document.getElementById('sidebar-avatar');
                    if (avatarPreview) avatarPreview.src = avatarUrl;
                    if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
                }
            }
        });

        // --- Advanced Avatar Management ---
        const editAvatarBtn = document.getElementById('edit-avatar-btn');
        const avatarOptionsMenu = document.getElementById('avatar-options-menu');
        const externalUrlContainer = document.getElementById('external-url-container');
        const avatarHint = document.getElementById('avatar-hint');

        if (editAvatarBtn && avatarOptionsMenu) {
            editAvatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isMenuHidden = avatarOptionsMenu.classList.contains('d-none');
                
                if (isMenuHidden) {
                    avatarOptionsMenu.classList.remove('d-none');
                    externalUrlContainer.classList.remove('d-none');
                    editAvatarBtn.innerHTML = '<i class="material-symbols-rounded" style="font-size: 18px;">close</i> Close';
                    if (avatarHint) avatarHint.textContent = 'Use the options below to change your profile picture.';
                } else {
                    avatarOptionsMenu.classList.add('d-none');
                    externalUrlContainer.classList.add('d-none');
                    editAvatarBtn.innerHTML = '<i class="material-symbols-rounded" style="font-size: 18px;">edit</i> Edit';
                    if (avatarHint) avatarHint.textContent = 'Click Edit to change your profile picture.';
                }
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!avatarOptionsMenu.contains(e.target) && e.target !== editAvatarBtn) {
                    avatarOptionsMenu.classList.add('d-none');
                    externalUrlContainer.classList.add('d-none');
                    editAvatarBtn.innerHTML = '<i class="material-symbols-rounded" style="font-size: 18px;">edit</i> Edit';
                    if (avatarHint) avatarHint.textContent = 'Click Edit to change your profile picture.';
                }
            });
        }

        const avatarFileInput = document.getElementById('avatar-file-input');
        const avatarUploadTrigger = document.getElementById('avatar-upload-trigger');
        const avatarCameraTrigger = document.getElementById('avatar-camera-trigger');
        const avatarDeleteBtn = document.getElementById('avatar-delete-btn');
        const cameraModal = document.getElementById('camera-modal');
        const cameraVideo = document.getElementById('camera-video');
        const cameraCanvas = document.getElementById('camera-canvas');
        const cameraCaptureBtn = document.getElementById('camera-capture-btn');
        const cameraCancelBtn = document.getElementById('camera-cancel-btn');
        const avatarDriveTrigger = document.getElementById('avatar-drive-trigger');
        const avatarPhotosTrigger = document.getElementById('avatar-photos-trigger');

        // File Upload
        avatarUploadTrigger.addEventListener('click', () => avatarFileInput.click());

        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await uploadAvatar(file);
        });

        // Cloud Storage Placeholders
        avatarDriveTrigger.addEventListener('click', () => {
            window.showToast('Google Drive integration coming soon (requires API keys).', 'info');
        });

        avatarPhotosTrigger.addEventListener('click', () => {
            window.showToast('Google Photos integration coming soon (requires API keys).', 'info');
        });

        const uploadAvatar = async (file) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            window.showLoading(true);
            try {
                // 1. Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // 2. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                // 3. Update Profile
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: publicUrl, updated_at: new Date() })
                    .eq('id', user.id);

                if (updateError) throw updateError;

                // 4. Update UI
                const avatarPreview = document.getElementById('profile-avatar-preview');
                const sidebarAvatar = document.getElementById('sidebar-avatar');
                const avatarUrlInput = document.getElementById('profile-avatar-url');

                if (avatarPreview) avatarPreview.src = publicUrl;
                if (sidebarAvatar) sidebarAvatar.src = publicUrl;
                if (avatarUrlInput) avatarUrlInput.value = publicUrl;
                
                window.showToast('Avatar updated successfully!', 'success');
            } catch (err) {
                console.error('Avatar upload error:', err);
                window.showToast('Failed to upload avatar: ' + err.message, 'error');
            } finally {
                window.showLoading(false);
            }
        };

        // Camera Capturing
        let stream = null;

        avatarCameraTrigger.addEventListener('click', async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                cameraVideo.srcObject = stream;
                cameraModal.classList.remove('d-none');
            } catch (err) {
                console.error('Camera access denied:', err);
                window.showToast('Camera access denied or not available.', 'error');
            }
        });

        cameraCancelBtn.addEventListener('click', () => {
            stopCamera();
            cameraModal.classList.add('d-none');
        });

        const stopCamera = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        };

        cameraCaptureBtn.addEventListener('click', async () => {
            const context = cameraCanvas.getContext('2d');
            cameraCanvas.width = cameraVideo.videoWidth;
            cameraCanvas.height = cameraVideo.videoHeight;
            context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

            cameraCanvas.toBlob(async (blob) => {
                const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                await uploadAvatar(file);
                stopCamera();
                cameraModal.classList.add('d-none');
            }, 'image/jpeg');
        });

        // Delete Avatar
        avatarDeleteBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to remove your avatar?')) return;

            window.showLoading(true);
            try {
                // Update profile to null or default
                const { error } = await supabase
                    .from('profiles')
                    .update({ avatar_url: null, updated_at: new Date() })
                    .eq('id', user.id);

                if (error) throw error;

                const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random`;
                const avatarPreview = document.getElementById('profile-avatar-preview');
                const sidebarAvatar = document.getElementById('sidebar-avatar');
                const avatarUrlInput = document.getElementById('profile-avatar-url');

                if (avatarPreview) avatarPreview.src = fallbackAvatar;
                if (sidebarAvatar) sidebarAvatar.src = fallbackAvatar;
                if (avatarUrlInput) avatarUrlInput.value = '';
                
                window.showToast('Avatar removed.', 'success');
            } catch (err) {
                window.showToast('Failed to remove avatar: ' + err.message, 'error');
            } finally {
                window.showLoading(false);
            }
        });

        document.getElementById('global-logout-btn').addEventListener('click', async () => {
            window.showLoading(true);
            await supabase.auth.signOut();
            window.showLoading(false);
        });

        // --- PWA Setup ---
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            // e.preventDefault();

            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            console.log("PWA install prompt available.");
        });
    }
});

// Global Helpers
window.showLoading = (show) => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('d-none', !show);
};

window.showToast = (message, type = 'default') => {
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

// Formatting helpers
window.formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

window.formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};