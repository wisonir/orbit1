let state = {
    user: null,
    currentPage: 'dashboard',
    config: {
      student_name: 'Ajay',
      assistant_name: 'Orbit AI',
      assistant_status: 'Online',
      assistant_subtext: 'Aktif • Multi-Sesi Siap',
      reminder_time: '19.00',
      reminder_desc: 'Contoh jadwal pengingat WIB',
      has_api_key: false,
      user_api_key: '',
      gemini_model: 'gemini-2.5-flash'
    },
    schedules: [],
    sessions: [],
    activeSessionId: null,
    chats: [],
    serverDate: 'Jumat, 23 Oktober 2026',
    activeAttachmentBase64: null,
    cameraStream: null,
    selectedTagFilter: 'ALL',
    chatSearchQuery: '',
    completedScheduleIds: JSON.parse(localStorage.getItem('orbit_completed_scheds_' + new Date().toDateString()) || '[]'),
    onlyShowPinned: false,
    pinnedMessageIds: JSON.parse(localStorage.getItem('orbit_pinned_msgs') || '[]'),
    activeSpeechIndex: null,
    speechRate: 1.0,
    isSpeechPaused: false,
    isZenMode: false
  };

  let dialogResolveCallback = null;

  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initClipboardPasteHandler();
    initDragAndDropHandler();
    loadGalleryCountBadge();
    lucide.createIcons();
    checkSession();
    fetchRegistrationStatus();
  });

  // ==================== 1. MODAL DIALOG ENGINE ====================
  function showAppAlert(title, message, type) {
    const alertType = type || 'success';
    return new Promise((resolve) => {
      dialogResolveCallback = resolve;
      setupDialogUI(title, message, alertType, false);
    });
  }

  function showAppConfirm(title, message, type) {
    const confirmType = type || 'warning';
    return new Promise((resolve) => {
      dialogResolveCallback = resolve;
      setupDialogUI(title, message, confirmType, true);
    });
  }

  function setupDialogUI(title, message, type, isConfirm) {
    const modal = document.getElementById('app-dialog-modal');
    const card = document.getElementById('app-dialog-card');
    const iconBox = document.getElementById('dialog-icon-container');
    const iconEl = document.getElementById('dialog-icon');
    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const btnCancel = document.getElementById('dialog-btn-cancel');
    const btnConfirm = document.getElementById('dialog-btn-confirm');

    if (!modal || !card) return;

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerHTML = message;

    if (type === 'success') {
      if (iconBox) iconBox.className = 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white bg-emerald-500 shadow-emerald-500/30 shadow-md';
      if (iconEl) iconEl.setAttribute('data-lucide', 'check-circle-2');
      if (btnConfirm) {
        btnConfirm.className = 'flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition';
        btnConfirm.innerText = 'Bagus!';
      }
    } else if (type === 'error') {
      if (iconBox) iconBox.className = 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white bg-rose-500 shadow-rose-500/30 shadow-md';
      if (iconEl) iconEl.setAttribute('data-lucide', 'alert-triangle');
      if (btnConfirm) {
        btnConfirm.className = 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition';
        btnConfirm.innerText = 'Tutup';
      }
    } else if (type === 'warning') {
      if (iconBox) iconBox.className = 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white bg-amber-500 shadow-amber-500/30 shadow-md';
      if (iconEl) iconEl.setAttribute('data-lucide', 'alert-circle');
      if (btnConfirm) {
        btnConfirm.className = 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition';
        btnConfirm.innerText = 'Ya, Hapus';
      }
    } else {
      if (iconBox) iconBox.className = 'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white bg-blue-600 shadow-blue-500/30 shadow-md';
      if (iconEl) iconEl.setAttribute('data-lucide', 'info');
      if (btnConfirm) {
        btnConfirm.className = 'flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition';
        btnConfirm.innerText = 'Mengerti';
      }
    }

    if (btnCancel) {
      if (isConfirm) {
        btnCancel.classList.remove('hidden');
      } else {
        btnCancel.classList.add('hidden');
      }
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
      card.classList.remove('scale-95');
      card.classList.add('scale-100');
    }, 10);

    lucide.createIcons();
  }

  function closeAppDialog(result) {
    const modal = document.getElementById('app-dialog-modal');
    const card = document.getElementById('app-dialog-card');
    if (card) {
      card.classList.remove('scale-100');
      card.classList.add('scale-95');
    }
    setTimeout(() => {
      if (modal) modal.classList.add('hidden');
      if (dialogResolveCallback) {
        dialogResolveCallback(result);
        dialogResolveCallback = null;
      }
    }, 150);
  }

  // ==================== 2. SPA ROUTER ====================
  function navigateToPage(pageId) {
    if (state.isZenMode && pageId !== 'chat') {
      toggleZenMode();
    }
    // Guard: Hanya Super Admin yang berhak membuka menu panel administrasi
    if ((pageId === 'users' || pageId === 'logs' || pageId === 'apikeys' || pageId === 'analytics' || pageId === 'announcement' || pageId === 'moderation') && (!state.user || state.user.role !== 'superadmin')) {
      showAppAlert('Akses Terbatas', 'Hanya Super Administrator yang berhak membuka menu ini.', 'error');
      navigateToPage('dashboard');
      return;
    }

    state.currentPage = pageId;

    // Tutup menu sidebar mobile secara otomatis setelah navigasi
    const mobSidebar = document.getElementById('sidebar');
    const mobOverlay = document.getElementById('mobile-overlay');
    if (mobSidebar && !mobSidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
      mobSidebar.classList.add('-translate-x-full');
      if (mobOverlay) mobOverlay.classList.add('hidden');
    }

    // Update active state Mobile Bottom Navigation Bar
    document.querySelectorAll('.mob-bottom-btn').forEach(btn => {
      btn.className = 'mob-bottom-btn flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 font-medium text-[10px] transition active:scale-95 cursor-pointer';
    });
    const mobActive = document.getElementById('mob-nav-' + pageId);
    if (mobActive) {
      mobActive.className = 'mob-bottom-btn flex flex-col items-center justify-center py-1 px-3 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-[10px] transition active:scale-95 cursor-pointer';
    }

    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.remove('hidden');

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.className = 'nav-tab-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-xs transition';
    });
    const activeBtn = document.getElementById('nav-btn-' + pageId);
    if (activeBtn) {
      activeBtn.className = 'nav-tab-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-semibold text-xs transition border border-transparent dark:border-blue-800/40';
    }

    const breadcrumb = document.getElementById('current-page-breadcrumb');
    if (breadcrumb) {
      if (pageId === 'dashboard') breadcrumb.innerText = 'Ringkasan';
      if (pageId === 'chat') breadcrumb.innerText = 'Chat dengan AI';
      if (pageId === 'schedule') breadcrumb.innerText = 'Jadwal Sekolah';
      if (pageId === 'users') {
        breadcrumb.innerText = 'Kelola Pengguna';
        loadUsersManagement();
      }
      if (pageId === 'logs') {
        breadcrumb.innerText = 'Log Aktivitas Sistem';
        loadSystemLogs();
      }
      if (pageId === 'apikeys') {
        breadcrumb.innerText = 'Database API Key';
        if (typeof activeApiKeyTab !== 'undefined' && activeApiKeyTab === 'user') {
          loadApiKeysManagement();
        } else {
          loadCentralizedApiKeys();
        }
      }
      if (pageId === 'changelog') {
        breadcrumb.innerText = 'Changelog Sistem';
        loadChangelogData();
      }
      if (pageId === 'analytics') {
        breadcrumb.innerText = 'Cost & Token Usage Analytics';
        loadTokenAnalyticsData();
      }
      if (pageId === 'announcement') {
        breadcrumb.innerText = 'Pengumuman Global';
        loadAnnouncementPageData();
      }
      if (pageId === 'moderation') {
        breadcrumb.innerText = 'Audit & Moderasi Percakapan';
        initModerationPage();
      }
    }

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
      sidebar.classList.add('-translate-x-full');
      if (overlay) overlay.classList.add('hidden');
    }

    renderUI();
    lucide.createIcons();
  }

  function loadAnnouncementPageData() {
    if (!state.user || state.user.role !== 'superadmin') return;

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            const toggle = document.getElementById('toggle-announcement-switch');
            const inputMsg = document.getElementById('input-announcement-text');
            const selectType = document.getElementById('select-announcement-type');
            const inputExpiry = document.getElementById('input-announcement-expiry');
            const checkPerm = document.getElementById('check-announcement-permanent');

            if (toggle) {
              toggle.checked = Boolean(res.enabled);
              updateAnnouncementStatusLabel(Boolean(res.enabled));
            }
            if (inputMsg && res.message) inputMsg.value = res.message;
            if (selectType && res.type) selectType.value = res.type;

            if (inputExpiry && checkPerm) {
              if (res.expiresAt) {
                inputExpiry.value = res.expiresAt;
                checkPerm.checked = false;
                toggleAnnouncementExpiryInput(false);
              } else {
                inputExpiry.value = '';
                checkPerm.checked = true;
                toggleAnnouncementExpiryInput(true);
              }
            }
          }
        })
        .getGlobalAnnouncement();
    }
  }

  function toggleZenMode() {
    state.isZenMode = !state.isZenMode;
    const bodyEl = document.body;
    const btnEl = document.getElementById('btn-zen-mode');
    const iconEl = document.getElementById('zen-mode-icon');
    const labelEl = document.getElementById('zen-mode-label');

    if (state.isZenMode) {
      bodyEl.classList.add('zen-active');
      if (btnEl) {
        btnEl.className = 'p-2 rounded-xl bg-indigo-600 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5';
      }
      if (iconEl) iconEl.setAttribute('data-lucide', 'minimize-2');
      if (labelEl) labelEl.innerText = 'Keluar Zen';
      showAppAlert('Mode Zen Aktif', 'Fokus belajar diaktifkan. Navigasi dan panel samping disembunyikan. Tekan <b>Esc</b> atau tombol untuk keluar.', 'info');
    } else {
      bodyEl.classList.remove('zen-active');
      if (btnEl) {
        btnEl.className = 'p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5';
      }
      if (iconEl) iconEl.setAttribute('data-lucide', 'maximize-2');
      if (labelEl) labelEl.innerText = 'Zen';
    }

    lucide.createIcons();
  }

  // Listener tombol Escape untuk keluar otomatis dari Mode Zen
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isZenMode) {
      toggleZenMode();
    }
  });

  // ==================== 3. AUTH & SESSION ====================
  function checkSession() {
    const savedUser = localStorage.getItem('orbit_user');
    const cachedData = localStorage.getItem('orbit_workspace_cache');
    
    if (savedUser) {
      try {
        state.user = JSON.parse(savedUser);
      } catch (e) {
        state.user = { username: 'ajay', name: 'Ajay', role: 'student' };
      }

      // Ambil data cache jika ada agar tidak perlu menunggu loading saat refresh
      let hasValidCache = false;
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          state.config = parsed.config || state.config;
          state.schedules = parsed.schedules || [];
          state.sessions = parsed.sessions || [];
          state.activeSessionId = parsed.activeSessionId || null;
          state.chats = parsed.chats || [];
          state.serverDate = parsed.serverDate || state.serverDate;
          hasValidCache = true;
        } catch (e) {
          console.warn('Gagal parse cache lokal');
        }
      }

      showWorkspace(hasValidCache);
    } else {
      showLogin();
    }
  }

  function switchAuthView(mode) {
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox) alertBox.classList.add('hidden');

    if (mode === 'register') {
      if (loginForm) loginForm.classList.add('hidden');
      if (registerForm) registerForm.classList.remove('hidden');
      if (title) title.innerText = 'Daftar Akun Baru';
      if (subtitle) subtitle.innerText = 'Buat akun belajar Orbit Assistant';
    } else {
      if (registerForm) registerForm.classList.add('hidden');
      if (loginForm) loginForm.classList.remove('hidden');
      if (title) title.innerText = 'Orbit Assistant';
      if (subtitle) subtitle.innerText = 'Masuk ke ruang belajar terisolasimu';
    }
    lucide.createIcons();
  }

  function showAuthAlert(message, type) {
    const alertBox = document.getElementById('auth-alert');
    const alertMsg = document.getElementById('auth-alert-msg');
    const alertIcon = document.getElementById('auth-alert-icon');
    if (!alertBox || !alertMsg) return;

    alertMsg.innerText = message;
    if (type === 'success') {
      alertBox.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2';
      if (alertIcon) alertIcon.setAttribute('data-lucide', 'check-circle-2');
    } else {
      alertBox.className = 'p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-2';
      if (alertIcon) alertIcon.setAttribute('data-lucide', 'alert-circle');
    }
    alertBox.classList.remove('hidden');
    lucide.createIcons();
  }

  function showLogin() {
    const loginCont = document.getElementById('login-container');
    const appWs = document.getElementById('app-workspace');
    const loader = document.getElementById('workspace-loading-screen');
    if (loader) {
      loader.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 200);
    }
    if (loginCont) loginCont.classList.remove('hidden');
    if (appWs) appWs.classList.add('hidden');
    switchAuthView('login');
    fetchRegistrationStatus(); // Wajib sinkronisasi ulang status pendaftaran saat layar login dibuka
  }

  function showWorkspace(hasCache) {
    const loginCont = document.getElementById('login-container');
    const appWs = document.getElementById('app-workspace');
    const loader = document.getElementById('workspace-loading-screen');

    if (loginCont) loginCont.classList.add('hidden');
    if (appWs) appWs.classList.remove('hidden');

    const displayUser = document.getElementById('auth-display-user');
    const footerUsername = document.getElementById('user-footer-username');
    if (displayUser) displayUser.innerText = '@' + (state.user ? state.user.username : 'user');
    if (footerUsername) footerUsername.innerText = '@' + (state.user ? state.user.username : 'user');

    // Tampilkan tombol Kelola Pengguna HANYA jika role adalah superadmin
    const navUsersBtn = document.getElementById('nav-btn-users');
    if (navUsersBtn) {
      if (state.user && state.user.role === 'superadmin') {
        navUsersBtn.classList.remove('hidden');
      } else {
        navUsersBtn.classList.add('hidden');
      }
    }

    navigateToPage('dashboard');

    if (hasCache) {
      // Data sudah ada di cache: render instan dan hilangkan layar loading secepat kilat!
      renderUI();
      hideWorkspaceLoading();
      // Sinkronisasi data terbaru di latar belakang (tanpa memblokir layar)
      refreshData(true);
    } else {
      if (loader) {
        loader.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      }
      refreshData(false);
    }

    // Prefetch data Administrator di latar belakang untuk Superadmin agar saat diklik langsung instan
    if (state.user && state.user.role === 'superadmin') {
      setTimeout(prefetchAdminData, 1200);
    }
  }

  function prefetchAdminData() {
    if (!state.user || state.user.role !== 'superadmin' || typeof google === 'undefined' || !google.script || !google.script.run) return;

    if (!allUsersData) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            allUsersData = res.users || [];
          }
        })
        .getAllUsersWithConfigs(state.user.username);
    }

    if (!allPoolKeysData || allPoolKeysData.length === 0) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            allPoolKeysData = res.data || [];
          }
        })
        .getCentralizedApiKeys(state.user.username);
    }

    if (!allSystemLogsData || allSystemLogsData.length === 0) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            allSystemLogsData = res.logs || [];
          }
        })
        .getAllSystemActivityLogs(state.user.username);
    }
  }

  function hideWorkspaceLoading() {
    const loader = document.getElementById('workspace-loading-screen');
    if (loader) {
      loader.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 300);
    }
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const btn = document.getElementById('login-submit-btn');

    btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Membuka...';

    const alertBox = document.getElementById('auth-alert');
    if (alertBox) alertBox.classList.add('hidden');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span>Buka Workspace Saya</span>';
          lucide.createIcons();
          if (res && res.status === 'success') {
            state.user = res.user;
            localStorage.setItem('orbit_user', JSON.stringify(res.user));
            showWorkspace(false);
          } else {
            showAuthAlert((res && res.message) ? res.message : 'Username atau kata sandi tidak valid.', 'error');
          }
        })
        .withFailureHandler((err) => {
          btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span>Buka Workspace Saya</span>';
          lucide.createIcons();
          showAuthAlert('Koneksi error: ' + err.message, 'error');
        })
        .authenticateUser(user, pass);
    }
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    const fullName = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const btn = document.getElementById('register-submit-btn');

    btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Mendaftarkan...';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          btn.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i><span>Daftar Akun Baru</span>';
          lucide.createIcons();
          if (res && res.status === 'success') {
            // Berhasil: Kosongkan form dan arahkan kembali ke tampilan login dengan notifikasi
            document.getElementById('form-register').reset();
            switchAuthView('login');
            showAuthAlert(res.message, 'success');
          } else {
            showAuthAlert((res && res.message) ? res.message : 'Pendaftaran gagal.', 'error');
          }
        })
        .withFailureHandler((err) => {
          btn.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i><span>Daftar Akun Baru</span>';
          lucide.createIcons();
          showAuthAlert('Koneksi error: ' + err.message, 'error');
        })
        .registerUser(fullName, username, password);
    }
  }

  function handleLogout() {
    localStorage.removeItem('orbit_user');
    localStorage.removeItem('orbit_workspace_cache');
    state.user = null;
    state.chats = [];
    state.sessions = [];

    // Sembunyikan kembali seluruh blok Administrator & Pengumuman
    const adminSection = document.getElementById('admin-menu-section');
    const navAnnouncementBtn = document.getElementById('nav-btn-announcement');
    if (adminSection) adminSection.classList.add('hidden');
    if (navAnnouncementBtn) navAnnouncementBtn.classList.add('hidden');

    showLogin();
  }

  // ==================== 4. DATA SYNC ====================
  function refreshData() {
    if (!state.user) return;
    setSyncStatus(true);

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success' && res.data) {
            if (res.data.user) {
              state.user = Object.assign({}, state.user, res.data.user);
              localStorage.setItem('orbit_user', JSON.stringify(state.user));
            }
            state.config = res.data.config || state.config;
            state.schedules = res.data.schedules || [];
            state.sessions = res.data.sessions || [];
            state.activeSessionId = res.data.activeSessionId || (state.sessions[0] ? state.sessions[0].sessionId : null);
            state.chats = res.data.chats || [];
            state.serverDate = res.data.serverDate || 'Jumat, 23 Oktober 2026';
            
            // Render Banner Pengumuman Global
            if (res.data.announcement) {
              renderAnnouncementBanner(res.data.announcement);
            }

            // Tampilkan popup jika akun siswa menerima peringatan dari Superadmin
            if (res.data.accountWarning && res.data.user && res.data.user.role !== 'superadmin') {
              triggerStudentWarningPopup(res.data.accountWarning);
            }

            localStorage.setItem('orbit_workspace_cache', JSON.stringify(res.data));
            renderUI();
          } else {
            useFallbackData();
          }
          setSyncStatus(false);
          hideWorkspaceLoading(); // <-- Tambahkan ini
        })
        .withFailureHandler((err) => {
          console.error('Gagal load backend:', err);
          useFallbackData();
          setSyncStatus(false);
          hideWorkspaceLoading(); // <-- Tambahkan ini
        })
        .getUserWorkspaceData(state.user.username);
    } else {
      useFallbackData();
      setSyncStatus(false);
    }
  }

  function useFallbackData() {
    state.serverDate = 'Jumat, 23 Oktober 2026';
    if (!state.sessions || state.sessions.length === 0) {
      state.sessions = [
        { sessionId: 'sess_aj_1', title: 'Latihan Soal Pecahan', tag: 'Pecahan', createdAt: '23 Okt 2026, 12:56' },
        { sessionId: 'sess_aj_2', title: 'Ringkasan Fotosintesis', tag: 'Fotosintesis', createdAt: '23 Okt 2026, 13:00' }
      ];
      state.activeSessionId = 'sess_aj_1';
    }
    if (!state.schedules || state.schedules.length === 0) {
      state.schedules = [
        { id: '1', time: '07.00', title: 'Persiapan Masuk Sekolah', desc: 'Siapkan seragam dan buku', tag: 'Pagi' },
        { id: '2', time: '12.00', title: 'Istirahat & Makan Siang', desc: 'Waktu istirahat sekolah', tag: 'Siang' },
        { id: '3', time: '16.00', title: 'Mengerjakan PR Matematika', desc: 'Belajar pecahan dengan Orbit AI', tag: 'Belajar' },
        { id: '4', time: '19.00', title: 'Review Materi Pelajaran', desc: 'Siapkan pelajaran besok', tag: 'Pengingat' }
      ];
    }
    if (!state.chats || state.chats.length === 0) {
      state.chats = [
        { role: 'assistant', message: 'Halo! Aku Orbit AI siap menemanimu belajar di sesi ini. Ada yang bisa kubantu?', timestamp: '12:56' }
      ];
    }
    renderUI();
  }

  // ==================== 5. UI RENDER ENGINE ====================
  function renderUI() {
    const displayName = state.config.student_name || (state.user ? state.user.name : 'Ajay');

    const heroName = document.getElementById('hero-student-name');
    const footerName = document.getElementById('user-footer-name');
    const avatarInit = document.getElementById('avatar-initial');
    const headerDate = document.getElementById('header-date');
    const reminderTime = document.getElementById('card-reminder-time');
    const reminderDesc = document.getElementById('card-reminder-desc');

    if (heroName) heroName.innerText = displayName;
    if (footerName) footerName.innerText = displayName;
    if (avatarInit) avatarInit.innerText = displayName.charAt(0).toUpperCase();

    const avatarImg = document.getElementById('avatar-image');
    if (avatarImg && state.user && state.user.avatarUrl) {
      avatarImg.src = state.user.avatarUrl;
      avatarImg.classList.remove('hidden');
      if (avatarInit) avatarInit.classList.add('hidden');
    } else if (avatarImg && avatarInit) {
      avatarImg.classList.add('hidden');
      avatarInit.classList.remove('hidden');
    }
    if (headerDate) headerDate.innerText = state.serverDate || 'Jumat, 23 Oktober 2026';
    if (reminderTime) reminderTime.innerText = state.config.reminder_time || '19.00';
    if (reminderDesc) reminderDesc.innerText = state.config.reminder_desc || 'Pengingat harian';

    document.querySelectorAll('.assistant-name-label').forEach(el => {
      el.innerText = state.config.assistant_name || 'Orbit AI';
    });

    const apiStatusCard = document.getElementById('card-api-status');
    if (apiStatusCard) {
      if (state.config.has_api_key) {
        apiStatusCard.innerText = 'Tersambung';
        apiStatusCard.className = 'text-lg sm:text-xl font-bold text-emerald-600';
      } else {
        apiStatusCard.innerText = 'Belum Diatur';
        apiStatusCard.className = 'text-lg sm:text-xl font-bold text-amber-500';
      }
    }

    const schedCountCard = document.getElementById('card-sched-count');
    const counterBadge = document.getElementById('schedule-counter-badge');
    if (schedCountCard) schedCountCard.innerText = state.schedules.length + ' Kegiatan';
    if (counterBadge) counterBadge.innerText = state.schedules.length + ' Agenda';

    // Enforcement hak akses: Tampilkan seluruh blok Panel Administrator & tombol pengumuman hanya untuk superadmin
    const isSuperAdmin = state.user && String(state.user.role).toLowerCase() === 'superadmin';
    const adminSection = document.getElementById('admin-menu-section');
    const navAnnouncementBtn = document.getElementById('nav-btn-announcement');

    if (adminSection) {
      adminSection.classList.toggle('hidden', !isSuperAdmin);
    }
    if (navAnnouncementBtn) {
      navAnnouncementBtn.classList.toggle('hidden', !isSuperAdmin);
    }

    renderSessionTabs();
    renderSessionTagFilters(); // <-- Tambahkan baris ini
    renderSessionCards();
    renderChatMessages();
    renderScheduleLists();
    renderQuotaIndicator();
    lucide.createIcons();
  }

  function renderQuotaIndicator() {
    const badgeFull = document.getElementById('chat-quota-badge-full');
    const badgeDash = document.getElementById('chat-quota-badge-dashboard');
    if (!badgeFull && !badgeDash) return;

    if (!state.user) return;

    const isSuper = state.user.role === 'superadmin';
    const limit = state.user.dailyPromptLimit !== undefined ? state.user.dailyPromptLimit : 50;
    const used = state.user.promptsToday || 0;

    let textHtml = '';
    const isQuotaExhausted = !isSuper && limit > 0 && (limit - used <= 0);

    if (isSuper || limit <= 0) {
      textHtml = '<span class="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">∞ Unlimited (Bebas)</span>';
    } else {
      const remaining = Math.max(0, limit - used);
      const colorClass = isQuotaExhausted 
        ? 'text-rose-600 font-extrabold animate-pulse' 
        : (remaining <= 5 ? 'text-amber-500 font-extrabold' : 'text-blue-600 dark:text-blue-400 font-bold');

      textHtml = `<span class="${colorClass}">${isQuotaExhausted ? '⚠️ Kuota Habis (0/' + limit + ')' : remaining + ' / ' + limit + ' Tanya Tersisa'}</span>`;
    }

    if (badgeFull) badgeFull.innerHTML = textHtml;
    if (badgeDash) badgeDash.innerHTML = textHtml;

    // Kunci atau Buka Form Input Chat Berdasarkan Status Kuota
    toggleChatInputLock(isQuotaExhausted);
    lucide.createIcons();
  }

  function toggleChatInputLock(isLocked) {
    const targets = [
      {
        input: document.getElementById('chat-input-full'),
        btnSend: document.getElementById('btn-send-full'),
        btnAttach: document.getElementById('btn-attach-full'),
        btnCamera: document.getElementById('btn-camera-full'),
        btnMic: document.getElementById('mic-btn-full'),
        placeholderDefault: 'Ketik atau gunakan mic untuk bicara...'
      },
      {
        input: document.getElementById('chat-input-dashboard'),
        btnSend: document.getElementById('btn-send-dashboard'),
        btnAttach: document.getElementById('btn-attach-dashboard'),
        btnCamera: document.getElementById('btn-camera-dashboard'),
        btnMic: document.getElementById('mic-btn-dashboard'),
        placeholderDefault: 'Tanyakan soal langsung di sini...'
      }
    ];

    targets.forEach(t => {
      if (t.input) {
        t.input.disabled = isLocked;
        if (isLocked) {
          t.input.value = '';
          t.input.placeholder = '⛔ Kuota harian Anda telah habis. Hubungi Super Admin atau coba lagi besok.';
          t.input.classList.add('bg-slate-200/60', 'cursor-not-allowed', 'text-slate-400');
        } else {
          t.input.placeholder = t.placeholderDefault;
          t.input.classList.remove('bg-slate-200/60', 'cursor-not-allowed', 'text-slate-400');
        }
      }

      [t.btnSend, t.btnAttach, t.btnCamera, t.btnMic].forEach(btn => {
        if (btn) {
          btn.disabled = isLocked;
          if (isLocked) {
            btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
          } else {
            btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
          }
        }
      });
    });
  }

  function getTagColorClass(tag) {
    const t = (tag || '').toLowerCase();
    if (t.includes('pecahan') || t.includes('matematika')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (t.includes('fotosintesis') || t.includes('ipa') || t.includes('biologi')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (t.includes('ujian') || t.includes('pr')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }

  function getDirectImageUrl(rawUrl) {
    if (!rawUrl) return '';
    const url = String(rawUrl).trim();
    if (url.startsWith('data:image')) {
      return url;
    }
    // Jika file adalah PDF, langsung kembalikan URL aslinya tanpa diubah ke lh3
    if (url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf')) {
      return url;
    }
    let fileId = '';
    const matchPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const matchParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchPath && matchPath[1]) {
      fileId = matchPath[1];
    } else if (matchParam && matchParam[1]) {
      fileId = matchParam[1];
    }
    if (fileId) {
      return 'https://lh3.googleusercontent.com/d/' + fileId;
    }
    return url;
  }

  // ==================== MATH & LATEX (KATEX) ENGINE ====================
  function formatMathAndMarkdown(text) {
    if (!text) return '';

    // Amankan token matematika agar sintaks LaTeX (seperti _, ^, \\, *) tidak di-parse secara keliru oleh Markdown
    const mathTokens = [];

    // 1. Tangkap blok display math ($$ ... $$, \[ ... \], \begin{...} ... \end{...})
    let protectedText = text.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\2\})/g, (match) => {
      const placeholder = '%%ORBIT_MATH_BLOCK_' + mathTokens.length + '%%';
      mathTokens.push({ placeholder: placeholder, math: match });
      return placeholder;
    });

    // 2. Tangkap inline math ($ ... $, \( ... \))
    protectedText = protectedText.replace(/(\$(?!\s)([^\$\n]+?)(?<!\s)\$|\\\([\s\S]*?\\\))/g, (match) => {
      const placeholder = '%%ORBIT_MATH_INLINE_' + mathTokens.length + '%%';
      mathTokens.push({ placeholder: placeholder, math: match });
      return placeholder;
    });

    // 3. Parse Markdown menggunakan Marked
    let html = typeof marked !== 'undefined' ? marked.parse(protectedText) : protectedText;

    // 4. Kembalikan token rumus matematika asli yang bersih dan utuh
    for (let i = 0; i < mathTokens.length; i++) {
      html = html.replace(mathTokens[i].placeholder, mathTokens[i].math);
    }

    return html;
  }

  function renderMathInElementSafely(element) {
    if (!element) return;
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\begin{equation}', right: '\\end{equation}', display: true },
            { left: '\\begin{align}', right: '\\end{align}', display: true },
            { left: '\\begin{alignat}', right: '\\end{alignat}', display: true },
            { left: '\\begin{gather}', right: '\\end{gather}', display: true },
            { left: '\\begin{CD}', right: '\\end{CD}', display: true },
            { left: '\\begin{matrix}', right: '\\end{matrix}', display: true },
            { left: '\\begin{pmatrix}', right: '\\end{pmatrix}', display: true },
            { left: '\\begin{bmatrix}', right: '\\end{bmatrix}', display: true },
            { left: '\\begin{cases}', right: '\\end{cases}', display: true }
          ],
          throwOnError: false,
          errorColor: '#f43f5e'
        });
      } catch (err) {
        console.warn('Gagal render KaTeX:', err);
      }
    } else {
      setTimeout(() => {
        if (typeof renderMathInElement === 'function') {
          renderMathInElementSafely(element);
        }
      }, 500);
    }
  }

  function scrollTagFilterBar(direction) {
    const bar = document.getElementById('session-tags-filter-bar');
    if (!bar) return;
    const scrollDistance = 150;
    if (direction === 'left') {
      bar.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
    } else {
      bar.scrollBy({ left: scrollDistance, behavior: 'smooth' });
    }
  }

  function scrollSessionTabs(direction) {
    const tabsBar = document.getElementById('session-tabs-bar');
    if (!tabsBar) return;
    const scrollAmount = 260;
    if (direction === 'left') {
      tabsBar.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      tabsBar.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  function renderSessionTagFilters() {
    const container = document.getElementById('session-tags-filter-bar');
    if (!container) return;

    // 1. Ekstrak seluruh tag unik dari sesi pengguna yang ada
    const uniqueTags = new Set();
    (state.sessions || []).forEach(s => {
      const cleanTag = (s.tag || 'Umum').trim();
      if (cleanTag) uniqueTags.add(cleanTag);
    });

    // Urutkan tag dan letakkan 'Umum' di awal jika ada
    const tagList = Array.from(uniqueTags).sort();

    // 2. Buat tombol Semua (ALL) dan tombol untuk masing-masing tag yang ditemukan
    let html = `
      <button 
        onclick="filterSessionsByTag('ALL')" 
        class="session-tag-filter whitespace-nowrap px-2.5 py-1 rounded-lg text-xs transition ${
          state.selectedTagFilter === 'ALL' 
            ? 'bg-blue-600 text-white font-bold shadow-xs' 
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium'
        }" 
        data-tag="ALL"
      >
        Semua
      </button>
    `;

    tagList.forEach(t => {
      const isSelected = state.selectedTagFilter.toLowerCase() === t.toLowerCase();
      
      // Ikon visual sesuai kategori nama tag
      let iconPrefix = '';
      const low = t.toLowerCase();
      if (low.includes('pecahan') || low.includes('matematika')) iconPrefix = '📐 ';
      else if (low.includes('fotosintesis') || low.includes('ipa') || low.includes('biologi')) iconPrefix = '🌱 ';

      html += `
        <button 
          onclick="filterSessionsByTag('${t}')" 
          class="session-tag-filter whitespace-nowrap px-2.5 py-1 rounded-lg text-xs transition ${
            isSelected 
              ? 'bg-blue-600 text-white font-bold shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium'
          }" 
          data-tag="${t}"
        >
          ${iconPrefix}${t}
        </button>
      `;
    });

    container.innerHTML = html;
    lucide.createIcons(); // Pastikan baris ini ada
  }

  // ==================== 6. CHAT & SESSION RENDER ====================
  function renderSessionTabs() {
    const tabsBar = document.getElementById('session-tabs-bar');
    if (!tabsBar) return;

    if (!state.sessions || state.sessions.length === 0) {
      tabsBar.innerHTML = '<span class="text-xs text-slate-400 py-1.5 px-2 animate-pulse flex items-center gap-1.5">' +
        '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>' +
        '<span>Memuat sesi belajar...</span>' +
      '</span>';
      return;
    }

    let tabsHtml = state.sessions.map(s => {
      const isActive = s.sessionId === state.activeSessionId;
      const tagLabel = s.tag || 'Umum';
      const tagBadgeStyle = getTagColorClass(tagLabel);
      
      const activeClass = isActive 
        ? 'bg-white dark:bg-[#1E293B] border-blue-500 dark:border-blue-500 shadow-xs ring-1 ring-blue-500/20 text-blue-900 dark:text-blue-300' 
        : 'bg-slate-100/90 dark:bg-[#0B1329] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E293B] hover:border-slate-300 dark:hover:border-slate-700';
      const iconOpacity = isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

      return '<div onclick="switchChatSession(\'' + s.sessionId + '\')" class="session-tab-item group shrink-0 flex flex-col justify-between px-3 py-1.5 rounded-xl border cursor-pointer transition select-none min-w-[130px] max-w-[200px] ' + activeClass + '">' +
        '<div class="flex items-center justify-between gap-2 w-full">' +
          '<span class="text-xs font-bold truncate leading-tight flex-1 ' + (isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200') + '">' + s.title + '</span>' +
          '<div class="flex items-center gap-0.5 ' + iconOpacity + ' transition shrink-0">' +
            '<button onclick="event.stopPropagation(); openEditSessionModal(\'' + s.sessionId + '\')" title="Edit Sesi" class="p-0.5 hover:text-blue-600 text-slate-400">' +
              '<i data-lucide="edit-3" class="w-3 h-3"></i>' +
            '</button>' +
            '<button onclick="event.stopPropagation(); deleteSessionItem(\'' + s.sessionId + '\')" title="Hapus Sesi" class="p-0.5 hover:text-rose-600 text-slate-400">' +
              '<i data-lucide="trash-2" class="w-3 h-3"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="mt-1 flex items-center">' +
          '<span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ' + tagBadgeStyle + '">' + tagLabel + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    tabsHtml += '<button onclick="openCreateSessionModal()" title="Tambah Sesi Baru" class="shrink-0 h-10 px-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition flex items-center justify-center cursor-pointer">' +
      '<i data-lucide="plus" class="w-4 h-4"></i>' +
    '</button>';

    tabsBar.innerHTML = tabsHtml;
    lucide.createIcons();
  }

  function renderSessionCards() {
    const container = document.getElementById('full-session-cards-container');
    if (!container) return;

    let filtered = state.sessions || [];
    if (state.selectedTagFilter !== 'ALL') {
      filtered = filtered.filter(s => (s.tag || 'Umum').toLowerCase() === state.selectedTagFilter.toLowerCase());
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Tidak ada sesi dengan tag ini.</div>';
      return;
    }

    container.innerHTML = filtered.map(s => {
      const isActive = s.sessionId === state.activeSessionId;
      const tagStyle = getTagColorClass(s.tag);
      const cardBg = isActive 
        ? 'bg-blue-50/80 dark:bg-blue-950/70 border-blue-400 dark:border-blue-500 shadow-xs ring-1 ring-blue-500/20' 
        : 'bg-white dark:bg-[#111C44] border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#16224D]';
      const timeStr = s.createdAt ? (s.createdAt.includes(',') ? s.createdAt.split(',')[1] : s.createdAt) : '';

      return '<div onclick="switchChatSession(\'' + s.sessionId + '\')" class="p-3 rounded-2xl border transition cursor-pointer group flex items-start justify-between gap-2 ' + cardBg + '">' +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center gap-1.5 mb-1">' +
            '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ' + tagStyle + '">' + (s.tag || 'Umum') + '</span>' +
            '<span class="text-[10px] text-slate-400">' + timeStr + '</span>' +
          '</div>' +
          '<h4 class="text-xs font-bold text-slate-800 truncate leading-snug">' + s.title + '</h4>' +
        '</div>' +
        '<div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">' +
          '<button onclick="event.stopPropagation(); openEditSessionModal(\'' + s.sessionId + '\')" title="Edit Sesi" class="p-1 hover:text-blue-600 text-slate-400">' +
            '<i data-lucide="edit-3" class="w-3.5 h-3.5"></i>' +
          '</button>' +
          '<button onclick="event.stopPropagation(); deleteSessionItem(\'' + s.sessionId + '\')" title="Hapus Sesi" class="p-1 hover:text-rose-600 text-slate-400">' +
            '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    const currentSession = (state.sessions || []).find(s => s.sessionId === state.activeSessionId);
    const headerTitle = document.getElementById('active-session-title-header');
    const headerBadge = document.getElementById('active-session-badge-header');
    const indicator = document.getElementById('active-session-tag-indicator');

    if (currentSession) {
      if (headerTitle) headerTitle.innerText = currentSession.title;
      if (headerBadge) {
        headerBadge.innerText = 'Tag: ' + (currentSession.tag || 'Umum');
        headerBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md border ' + getTagColorClass(currentSession.tag);
      }
      if (indicator) indicator.innerText = 'Tag: ' + (currentSession.tag || 'Umum');
    }

    lucide.createIcons();
  }

  function renderChatSkeleton() {
    const skeletonHtml = `
      <div class="space-y-4 animate-pulse p-1">
        
        <div class="flex gap-3 justify-start items-start">
          <div class="w-8 h-8 rounded-xl bg-slate-200 shrink-0"></div>
          <div class="space-y-2 max-w-[70%] w-full">
            <div class="h-4 bg-slate-200 rounded-lg w-3/4"></div>
            <div class="h-4 bg-slate-200 rounded-lg w-1/2"></div>
          </div>
        </div>

        
        <div class="flex gap-3 justify-end items-start">
          <div class="space-y-2 max-w-[60%] w-full flex flex-col items-end">
            <div class="h-4 bg-blue-100 rounded-lg w-2/3"></div>
            <div class="h-3 bg-blue-100 rounded-lg w-1/3"></div>
          </div>
          <div class="w-8 h-8 rounded-xl bg-blue-100 shrink-0"></div>
        </div>

        
        <div class="flex gap-3 justify-start items-start">
          <div class="w-8 h-8 rounded-xl bg-slate-200 shrink-0"></div>
          <div class="space-y-2 max-w-[80%] w-full">
            <div class="h-4 bg-slate-200 rounded-lg w-5/6"></div>
            <div class="h-4 bg-slate-200 rounded-lg w-2/3"></div>
            <div class="h-4 bg-slate-200 rounded-lg w-1/3"></div>
          </div>
        </div>
      </div>
    `;

    const dashBox = document.getElementById('chat-messages-dashboard');
    const fullBox = document.getElementById('chat-messages-full');
    if (dashBox) dashBox.innerHTML = skeletonHtml;
    if (fullBox) fullBox.innerHTML = skeletonHtml;
  }

  function toggleMobileChatSidebar(isOpen) {
    const sidebar = document.getElementById('chat-sessions-sidebar-col');
    const backdrop = document.getElementById('chat-sidebar-backdrop');
    if (!sidebar) return;

    const shouldOpen = typeof isOpen === 'boolean' ? isOpen : sidebar.classList.contains('-translate-x-full');

    if (shouldOpen) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      if (backdrop) backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      if (backdrop) backdrop.classList.add('hidden');
    }
  }

  function switchChatSession(sessionId) {
    if (!sessionId) return;
    state.activeSessionId = sessionId;
    // Otomatis tutup drawer sesi di mobile agar ruang chat langsung tampil penuh
    toggleMobileChatSidebar(false);
    renderSessionTabs();
    renderSessionCards();
    setSyncStatus(true);

    // Langsung render loading skeleton di area chat selama proses fetch
    renderChatSkeleton();

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((chats) => {
          state.chats = chats || [];
          // Hapus skeleton dan ganti dengan pesan riwayat chat yang selesai dimuat
          renderChatMessages();
          setSyncStatus(false);
        })
        .withFailureHandler((err) => {
          console.error('Gagal muat pesan sesi:', err);
          const dashBox = document.getElementById('chat-messages-dashboard');
          const fullBox = document.getElementById('chat-messages-full');
          const errMsg = '<div class="py-6 text-center text-xs text-rose-500 font-semibold">Gagal memuat pesan sesi ini.</div>';
          if (dashBox) dashBox.innerHTML = errMsg;
          if (fullBox) fullBox.innerHTML = errMsg;
          setSyncStatus(false);
        })
        .getSessionMessages(state.user.username, sessionId);
    } else {
      setTimeout(() => {
        renderChatMessages();
        setSyncStatus(false);
      }, 300);
    }
  }

  function renderChatMessages() {
    let sourceChats = state.chats || [];

    // Filter Search Query jika ada input pencarian
    if (state.chatSearchQuery) {
      const q = state.chatSearchQuery.toLowerCase();
      sourceChats = sourceChats.filter(c => (c.message || '').toLowerCase().includes(q));
    }

    // Filter Hanya Pesan Di-Pin / Dibookmark
    if (state.onlyShowPinned) {
      sourceChats = sourceChats.filter(c => state.pinnedMessageIds.includes(c.id || c.timestamp));
    }

    if (sourceChats.length === 0) {
      const emptyMsg = `
        <div class="py-12 text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <i data-lucide="search-x" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-bold text-slate-600">Tidak ada pesan ditemukan</p>
          <p class="text-[11px] text-slate-400">${state.onlyShowPinned ? 'Belum ada pesan yang Anda bookmark di sesi ini.' : 'Coba kata kunci pencarian yang lain.'}</p>
        </div>
      `;
      const dashBox = document.getElementById('chat-messages-dashboard');
      const fullBox = document.getElementById('chat-messages-full');
      if (dashBox) dashBox.innerHTML = emptyMsg;
      if (fullBox) fullBox.innerHTML = emptyMsg;
      lucide.createIcons();
      return;
    }

    const chatHtml = sourceChats.map((chat, idx) => {
      const isUser = chat.role === 'user';
      const formattedText = formatMathAndMarkdown(chat.message || '');
      const cleanImageUrl = getDirectImageUrl(chat.image);
      const msgIdentifier = String(chat.id || chat.timestamp || idx);
      const isPinned = state.pinnedMessageIds.includes(msgIdentifier);

      let imageBlock = '';
      if (cleanImageUrl) {
        const isPdf = cleanImageUrl.startsWith('data:application/pdf') || 
                      cleanImageUrl.toLowerCase().includes('.pdf') || 
                      (chat.fileName && chat.fileName.toLowerCase().endsWith('.pdf')) ||
                      (chat.message && chat.message.toLowerCase().includes('pdf'));

        if (isPdf) {
          const isBase64 = cleanImageUrl.startsWith('data:application/pdf');
          let fileId = '';
          const matchId = String(cleanImageUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (matchId && matchId[1]) fileId = matchId[1];

          const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : cleanImageUrl;
          const viewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : cleanImageUrl;

          const titleText = chat.fileName || 'Dokumen PDF';
          const subText = isBase64 ? 'Dokumen terlampir (diproses AI)' : 'Klik untuk membaca dokumen';

          const clickAttr = !isBase64 && fileId 
            ? `onclick="event.preventDefault(); openPdfViewerModal('${previewUrl}', '${viewUrl}', '${titleText.replace(/'/g, "\\'")}')"` 
            : '';

          imageBlock = `
            <div class="mb-2.5">
              <a href="javascript:void(0)" ${clickAttr} class="flex items-center gap-2.5 p-2.5 rounded-xl ${isUser ? 'bg-blue-700/80 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'} border border-white/10 transition block select-none cursor-pointer">
                <div class="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  <i data-lucide="file-text" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-bold truncate">${titleText}</p>
                  <p class="text-[10px] opacity-75">${subText}</p>
                </div>
              </a>
            </div>
          `;
        } else {
          imageBlock = '<div class="mb-2 rounded-xl overflow-hidden border border-white/20 bg-black/10">' +
            '<a href="' + cleanImageUrl + '" target="_blank">' +
              '<img src="' + cleanImageUrl + '" class="max-h-52 w-auto rounded-lg object-cover hover:opacity-90 transition" alt="Lampiran Soal" loading="lazy">' +
            '</a>' +
          '</div>';
        }
      }

      // Bar Aksi Khusus Jawaban Asisten (Listen, Copy, Export to Docs, Pin)
      let assistantActionsBar = '';
      if (!isUser) {
        const isSpeakingThis = state.activeSpeechIndex === idx;
        assistantActionsBar = `
          <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              
              <div class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                
                <button 
                  type="button"
                  onclick="handleTogglePlayPauseSpeech(${idx})" 
                  title="${isSpeakingThis ? (state.isSpeechPaused ? 'Lanjutkan Putar' : 'Jeda Suara (Pause)') : 'Dengarkan Audio Asisten'}"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    isSpeakingThis 
                      ? (state.isSpeechPaused ? 'bg-amber-500 text-white shadow-2xs' : 'bg-blue-600 text-white shadow-2xs') 
                      : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700'
                  }"
                >
                  <i data-lucide="${isSpeakingThis ? (state.isSpeechPaused ? 'play' : 'pause') : 'volume-2'}" class="w-3.5 h-3.5"></i>
                  <span>${isSpeakingThis ? (state.isSpeechPaused ? 'Resume' : 'Pause') : 'Listen'}</span>
                </button>

                
                ${isSpeakingThis ? `
                  <button 
                    type="button"
                    onclick="handleStopSpeech()" 
                    title="Hentikan Audio Sepenuhnya"
                    class="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <i data-lucide="square" class="w-3 h-3 fill-current"></i>
                  </button>

                  
                  <button 
                    type="button"
                    onclick="cycleSpeechRate(${idx})" 
                    title="Ubah Kecepatan Suara"
                    class="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold font-mono border border-slate-200/60 dark:border-slate-600 hover:border-blue-400 transition cursor-pointer"
                  >
                    ${state.speechRate}x
                  </button>
                ` : ''}
              </div>

              
              <button 
                type="button"
                onclick="handleCopyResponse(${idx})" 
                title="Salin Teks Jawaban"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Salin</span>
              </button>

              
              <button 
                type="button"
                onclick="handleExportResponseToDocs(${idx})" 
                title="Simpan Jawaban ini ke Google Docs"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
              >
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                <span>Export to Docs</span>
              </button>
            </div>

            
            <button 
              type="button"
              onclick="handleTogglePinMessage('${msgIdentifier}')" 
              title="${isPinned ? 'Lepas Pin / Bookmark' : 'Pin Pesan Penting Ini'}"
              class="p-1 rounded-lg transition cursor-pointer ${isPinned ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-amber-500'}"
            >
              <i data-lucide="bookmark" class="w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}"></i>
            </button>
          </div>
        `;
      }

      // Bar Aksi Khusus Pesan User: Salin & Edit Prompt
      let userActionsBar = '';
      if (isUser) {
        userActionsBar = `
          <div class="mt-2 pt-1.5 border-t border-blue-500/40 flex items-center justify-end gap-1.5 opacity-90 hover:opacity-100 transition">
            <button 
              type="button" 
              onclick="handleEditUserPrompt(${idx})" 
              title="Edit dan Kirim Ulang Prompt Ini" 
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-700/70 hover:bg-blue-800 text-white transition cursor-pointer"
            >
              <i data-lucide="edit-3" class="w-3 h-3"></i>
              <span>Edit</span>
            </button>
            <button 
              type="button" 
              onclick="handleCopyUserPrompt(${idx})" 
              title="Salin Pertanyaan / Prompt" 
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-700/70 hover:bg-blue-800 text-white transition cursor-pointer"
            >
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Salin</span>
            </button>
          </div>
        `;
      }

      const bubbleClass = isUser 
        ? 'bg-blue-600 text-white rounded-tr-none shadow-sm shadow-blue-500/10' 
        : 'assistant-chat-bubble bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/80 dark:border-slate-700 shadow-xs';
      const timeClass = isUser ? 'text-blue-200' : 'text-slate-400 dark:text-slate-300 font-mono';
      const userInitial = (state.config.student_name || (state.user ? state.user.name : 'A')).charAt(0).toUpperCase();

      return '<div class="flex gap-3 ' + (isUser ? 'justify-end' : 'justify-start') + '">' +
        (!isUser ? '<div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5"><i data-lucide="orbit" class="w-4 h-4"></i></div>' : '') +
        '<div class="max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 ' + bubbleClass + '">' +
          imageBlock +
          '<div class="markdown-content text-xs sm:text-sm leading-relaxed" id="chat-raw-msg-' + idx + '">' + formattedText + '</div>' +
          '<div class="text-[10px] mt-1 text-right ' + timeClass + '">' + (chat.timestamp || '') + '</div>' +
          assistantActionsBar +
          userActionsBar +
        '</div>' +
        (isUser ? '<div class="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">' + userInitial + '</div>' : '') +
      '</div>';
    }).join('');

    const dashBox = document.getElementById('chat-messages-dashboard');
    const fullBox = document.getElementById('chat-messages-full');
    if (dashBox) {
      dashBox.innerHTML = chatHtml;
      dashBox.scrollTop = dashBox.scrollHeight;
      renderMathInElementSafely(dashBox);
    }
    if (fullBox) {
      fullBox.innerHTML = chatHtml;
      fullBox.scrollTop = fullBox.scrollHeight;
      renderMathInElementSafely(fullBox);
    }
    lucide.createIcons();
  }

  function openEditScheduleModal(id) {
    const item = (state.schedules || []).find(s => String(s.id) === String(id));
    if (!item) return;

    let startTime = '07:00';
    let endTime = '08:00';

    if (item.time) {
      const raw = String(item.time).trim();
      if (raw.includes('-') || raw.includes('–')) {
        const parts = raw.split(/[-–]/);
        startTime = formatSingleTime(parts[0]);
        endTime = formatSingleTime(parts[1]);
      } else {
        startTime = formatSingleTime(raw);
        endTime = formatSingleTime(raw);
      }
    }

    document.getElementById('sched-id').value = item.id;
    document.getElementById('sched-time-start').value = startTime;
    document.getElementById('sched-time-end').value = endTime;
    document.getElementById('sched-title').value = item.title;
    document.getElementById('sched-desc').value = item.desc;
    document.getElementById('sched-tag').value = item.tag || '';
    document.getElementById('schedule-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function toggleScheduleComplete(id) {
    const strId = String(id);
    const dateKey = 'orbit_completed_scheds_' + new Date().toDateString();
    const idx = state.completedScheduleIds.indexOf(strId);

    if (idx > -1) {
      state.completedScheduleIds.splice(idx, 1);
    } else {
      state.completedScheduleIds.push(strId);
    }

    localStorage.setItem(dateKey, JSON.stringify(state.completedScheduleIds));
    renderScheduleLists();
  }

  function updateScheduleProgress() {
    const total = (state.schedules || []).length;
    let completed = 0;

    (state.schedules || []).forEach(item => {
      if (state.completedScheduleIds.includes(String(item.id))) {
        completed++;
      }
    });

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Progress Bar Dashboard
    const dashText = document.getElementById('dashboard-progress-text');
    const dashBar = document.getElementById('dashboard-progress-bar');
    if (dashText) dashText.innerText = `${completed}/${total} (${percent}%)`;
    if (dashBar) dashBar.style.width = percent + '%';

    // Progress Bar Halaman Penuh
    const fullText = document.getElementById('full-progress-text');
    const fullBar = document.getElementById('full-progress-bar');
    if (fullText) fullText.innerText = `${completed}/${total} Selesai (${percent}%)`;
    if (fullBar) fullBar.style.width = percent + '%';
  }

  function formatScheduleTime(rawTime) {
    if (!rawTime && rawTime !== 0) return '00:00 - 00:00';
    const str = String(rawTime).trim();
    
    // Jika formatnya sudah rentang (mengandung pemisah '-' atau '–')
    if (str.includes('-') || str.includes('–')) {
      const parts = str.split(/[-–]/);
      const start = formatSingleTime(parts[0]);
      const end = formatSingleTime(parts[1]);
      return `${start} - ${end}`;
    }
    
    // Fallback data jadwal lama yang hanya 1 jam (misal "07.00")
    return formatSingleTime(str);
  }

  function formatSingleTime(val) {
    if (!val) return '00:00';
    let t = String(val).trim().replace('.', ':');
    if (!t.includes(':')) {
      return t.padStart(2, '0') + ':00';
    }
    const p = t.split(':');
    return p[0].padStart(2, '0') + ':' + (p[1] || '00').padEnd(2, '0');
  }

  function renderScheduleLists() {
    const dashSchedContainer = document.getElementById('schedule-list-dashboard');
    const fullSchedContainer = document.getElementById('full-schedule-list');

    if (!state.schedules || state.schedules.length === 0) {
      const emptyHtml = `
        <div class="py-12 text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <i data-lucide="calendar-x" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Belum Ada Agenda</p>
          <p class="text-[11px] text-slate-400">Klik tombol Tambah Jadwal Baru untuk membuat rutinitas sekolah.</p>
        </div>
      `;
      if (dashSchedContainer) dashSchedContainer.innerHTML = emptyHtml;
      if (fullSchedContainer) fullSchedContainer.innerHTML = emptyHtml;
      updateScheduleProgress();
      lucide.createIcons();
      return;
    }

    // Tampilan Interaktif di Ringkasan (Dashboard)
    if (dashSchedContainer) {
      dashSchedContainer.innerHTML = state.schedules.map(item => {
        const isDone = state.completedScheduleIds.includes(String(item.id));
        const cleanDesc = (item.desc && item.desc.trim() !== '--' && item.desc.trim() !== '-') ? item.desc : 'Tidak ada catatan';
        return `
          <div class="py-2.5 px-2 flex items-center justify-between gap-3 group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-xl transition cursor-pointer select-none" onclick="toggleScheduleComplete('${item.id}')">
            <div class="flex items-center gap-3 min-w-0">
              <button type="button" class="w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-400 bg-white dark:bg-slate-800 shadow-2xs'}">
                <i data-lucide="check" class="w-3.5 h-3.5 ${isDone ? 'block' : 'hidden'}"></i>
              </button>
              <span class="text-xs font-bold ${isDone ? 'text-slate-400 dark:text-slate-400 line-through opacity-70' : 'text-slate-700 dark:text-slate-200'} bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0 border border-slate-200/60 dark:border-slate-700 font-mono">${formatScheduleTime(item.time)}</span>
              <div class="min-w-0">
                <p class="text-xs font-bold leading-snug truncate ${isDone ? 'text-slate-400 dark:text-slate-400 line-through opacity-70' : 'text-slate-800 dark:text-slate-100'}">${item.title}</p>
                <p class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate">${cleanDesc}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${item.tag ? `<span class="text-[9px] font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/60">${item.tag}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // Tampilan Interaktif di Halaman Penuh Jadwal Sekolah
    if (fullSchedContainer) {
      fullSchedContainer.innerHTML = state.schedules.map(item => {
        const isDone = state.completedScheduleIds.includes(String(item.id));
        const cleanDesc = (item.desc && item.desc.trim() !== '--' && item.desc.trim() !== '-') ? item.desc : 'Tidak ada catatan tambahan';
        return `
          <div class="p-3.5 rounded-2xl border transition flex items-center justify-between gap-4 ${isDone ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-800/40' : 'bg-slate-50/50 dark:bg-[#0B1329] border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/50 hover:border-slate-200'}">
            <div class="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer select-none" onclick="toggleScheduleComplete('${item.id}')">
              <button type="button" class="w-6 h-6 rounded-xl border flex items-center justify-center shrink-0 transition ${isDone ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' : 'border-slate-300 dark:border-slate-400 bg-white dark:bg-slate-800 shadow-2xs'}">
                <i data-lucide="check" class="w-4 h-4 ${isDone ? 'block' : 'hidden'}"></i>
              </button>
              <div class="px-2.5 h-10 rounded-xl ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700'} font-extrabold text-xs flex items-center justify-center shrink-0 font-mono shadow-2xs">
                ${formatScheduleTime(item.time)}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-0.5">
                  <h4 class="text-sm font-bold leading-snug truncate ${isDone ? 'text-slate-400 dark:text-slate-400 line-through opacity-70' : 'text-slate-900 dark:text-slate-100'}">${item.title}</h4>
                  ${item.tag ? `<span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 rounded-md shrink-0">${item.tag}</span>` : ''}
                </div>
                <p class="text-xs text-slate-400 dark:text-slate-400 leading-relaxed truncate">${cleanDesc}</p>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <button 
                type="button"
                onclick="event.stopPropagation(); openEditScheduleModal('${item.id}')" 
                title="Edit Jadwal"
                class="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition cursor-pointer shadow-2xs"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button 
                type="button"
                onclick="event.stopPropagation(); deleteScheduleItem('${item.id}')" 
                title="Hapus Jadwal"
                class="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition cursor-pointer shadow-2xs"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    updateScheduleProgress();
    lucide.createIcons();
  }

  // ==================== 7. CHAT SUBMISSION & UX ====================
  function handleChatScroll(source) {
    const boxId = source === 'dashboard' ? 'chat-messages-dashboard' : 'chat-messages-full';
    const btnId = source === 'dashboard' ? 'btn-scroll-bottom-dashboard' : 'btn-scroll-bottom-full';
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    if (!box || !btn) return;

    // Jika jarak scroll ke bagian paling bawah > 100px, tampilkan tombol scroll otomatis
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distanceFromBottom > 100) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  function scrollToBottomChat(source) {
    const boxId = source === 'dashboard' ? 'chat-messages-dashboard' : 'chat-messages-full';
    const btnId = source === 'dashboard' ? 'btn-scroll-bottom-dashboard' : 'btn-scroll-bottom-full';
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }
    if (btn) {
      btn.classList.add('hidden');
    }
  }

  function toggleChatInputExpanded(source) {
    const boxId = source === 'dashboard' ? 'chat-card-box-dashboard' : 'chat-card-box-full';
    const btnId = source === 'dashboard' ? 'btn-expand-dashboard' : 'btn-expand-full';
    const inputId = source === 'dashboard' ? 'chat-input-dashboard' : 'chat-input-full';
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    const inputEl = document.getElementById(inputId);
    if (!box || !btn) return;

    box.classList.toggle('is-super-expanded');
    const isSuper = box.classList.contains('is-super-expanded');
    btn.innerHTML = isSuper ? '<i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>' : '<i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>';
    btn.title = isSuper ? 'Kecilkan Area Teks' : 'Perluas Area Teks';
    lucide.createIcons();
    if (inputEl) {
      inputEl.focus();
      if (!isSuper) {
        handleChatInputLive(inputEl, source);
      }
    }
  }

  function handleChatInputLive(el, source) {
    if (!el) return;
    const boxId = source === 'dashboard' ? 'chat-card-box-dashboard' : 'chat-card-box-full';
    const btnId = source === 'dashboard' ? 'btn-expand-dashboard' : 'btn-expand-full';
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    if (!box) return;

    const val = el.value || '';

    // 1. Jika teks kosong atau hanya whitespace: reset seketika ke 1 baris semula
    if (val.trim() === '') {
      box.classList.remove('is-multiline');
      box.classList.remove('is-super-expanded');
      el.style.height = '';
      if (btn) {
        btn.innerHTML = '<i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>';
        btn.title = 'Perluas / Perkecil Area Teks';
        lucide.createIcons();
      }
      return;
    }

    // 2. Jika ada teks: cek apakah teks muat 1 baris atau butuh multi-line bertahap
    const hasNewline = val.includes('\n');
    
    // Lepas dulu kelas multiline sebentar jika teks masih pendek
    if (!hasNewline && val.length < 50) {
      box.classList.remove('is-multiline');
      el.style.height = '';
      if (el.scrollHeight <= 32) {
        return; // Masih muat di 1 baris kapsul horizontal
      }
    }

    // 3. Mode multi-line: bertambah tinggi bertahap baris demi baris (maksimal 135px agar tidak menutupi chat)
    box.classList.add('is-multiline');
    if (!box.classList.contains('is-super-expanded')) {
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollH, 44), 135);
      el.style.height = targetHeight + 'px';
    }
  }

  function autoResizeChatInput(el) {
    if (!el) return;
    const source = el.id === 'chat-input-dashboard' ? 'dashboard' : 'full';
    handleChatInputLive(el, source);
  }

  function handleChatInputKeydown(e, source) {
    // Tekan Enter saja = Kirim pesan, Shift + Enter = Buat baris baru
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmitWrapper(e, source);
    }
  }

  function handleChatSubmitWrapper(e, source) {
    if (e) e.preventDefault();
    const inputId = source === 'dashboard' ? 'chat-input-dashboard' : 'chat-input-full';
    const boxId = source === 'dashboard' ? 'chat-card-box-dashboard' : 'chat-card-box-full';
    const btnId = source === 'dashboard' ? 'btn-expand-dashboard' : 'btn-expand-full';
    const inputEl = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    const textVal = inputEl ? inputEl.value : '';
    handleChatSubmit(textVal);
    if (inputEl) {
      inputEl.value = '';
      inputEl.style.height = '';
    }
    if (box) {
      box.classList.remove('is-multiline');
      box.classList.remove('is-super-expanded');
    }
    if (btn) {
      btn.innerHTML = '<i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>';
      btn.title = 'Perluas / Perkecil Area Teks';
      lucide.createIcons();
    }
  }

  function handleChatSubmit(textVal, forceTopic) {
    // Validasi kuota harian di sisi browser
    const isSuper = state.user && state.user.role === 'superadmin';
    const limit = (state.user && state.user.dailyPromptLimit !== undefined) ? state.user.dailyPromptLimit : 50;
    const used = (state.user && state.user.promptsToday) || 0;

    if (!isSuper && limit > 0 && used >= limit) {
      showAppAlert('Batas Kuota Tercapai', 'Kuota pertanyaan Anda untuk hari ini sudah habis. Silakan hubungi Super Admin untuk kuota tambahan.', 'warning');
      return;
    }

    const attachedImage = state.activeAttachmentBase64;
    const cleanText = (textVal || '').trim();

    if (!cleanText && !attachedImage) return;

    const isPdfFile = String(attachedImage || '').startsWith('data:application/pdf');
    const defaultText = isPdfFile ? 'Tolong analisa dokumen PDF ini:' : 'Tolong analisa foto/soal berikut:';

    const userMsg = {
      role: 'user',
      message: cleanText || defaultText,
      image: attachedImage,
      fileName: activeAttachmentFileName || (isPdfFile ? 'Dokumen.pdf' : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      topic: forceTopic || 'General'
    };

    state.chats.push(userMsg);
    cancelImageAttachment();
    renderChatMessages();

    const loadingId = 'loading-' + Date.now();
    const loadingHtml = '<div id="' + loadingId + '" class="flex gap-3 justify-start">' +
      '<div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs shadow-sm">' +
        '<i data-lucide="orbit" class="w-4 h-4"></i>' +
      '</div>' +
      '<div class="bg-white rounded-2xl rounded-tl-none border border-slate-200/80 px-4 py-3 text-xs text-slate-400 flex items-center gap-2">' +
        '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>' +
        '<span>Orbit AI sedang memproses...</span>' +
      '</div>' +
    '</div>';

    document.querySelectorAll('.chat-container-stream').forEach(box => {
      box.insertAdjacentHTML('beforeend', loadingHtml);
      box.scrollTop = box.scrollHeight;
    });
    lucide.createIcons();

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          // Hapus bubble loading "Orbit AI sedang memproses..."
          document.querySelectorAll('#' + loadingId).forEach(el => el.remove());
          
          if (res && res.status === 'success') {
            if (res.imageUrl) {
              userMsg.image = res.imageUrl;
            }

            // Sinkronisasi sisa kuota lokal
            if (state.user && res.promptsToday !== undefined) {
              state.user.promptsToday = res.promptsToday;
              state.user.dailyPromptLimit = res.dailyPromptLimit;
              renderQuotaIndicator();
            }

            // Jalankan animasi mengetik kata demi kata secara realistis
            typeAssistantResponseStream(res.reply || '', res.timestamp || '');
          } else {
            state.chats.push({
              role: 'assistant',
              message: 'Terjadi kendala: ' + (res ? res.message : 'Gagal memproses pesan.'),
              timestamp: ''
            });
            renderChatMessages();
          }
        })
        .withFailureHandler((err) => {
          document.querySelectorAll('#' + loadingId).forEach(el => el.remove());
          state.chats.push({
            role: 'assistant',
            message: 'Error koneksi API: ' + err.message,
            timestamp: ''
          });
          renderChatMessages();
        })
        .sendSessionChatMessage(state.user.username, state.activeSessionId, userMsg.message, userMsg.topic, attachedImage);
    }
  }

  let recognitionInstance = null;
  let isRecordingVoice = false;
  let activeMicTarget = 'full'; // 'full' atau 'dashboard'

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAppAlert('Browser Tidak Mendukung', 'Browser Anda belum mendukung fitur Web Speech API. Silakan gunakan Google Chrome, Microsoft Edge, atau Safari terbaru.', 'warning');
      return null;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'id-ID'; // Mengatur bahasa utama ke Bahasa Indonesia
    recognizer.continuous = true; // Tetap merekam sampai tombol dimatikan
    recognizer.interimResults = true; // Menampilkan hasil transkripsi secara instan saat berbicara

    recognizer.onstart = function() {
      isRecordingVoice = true;
      updateMicButtonUI(true);
    };

    recognizer.onresult = function(event) {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const inputId = activeMicTarget === 'dashboard' ? 'chat-input-dashboard' : 'chat-input-full';
      const inputEl = document.getElementById(inputId);
      if (inputEl) {
        if (finalTranscript) {
          // Tambahkan teks ke input yang sudah ada
          inputEl.value = (inputEl.value + ' ' + finalTranscript).trim();
          autoResizeChatInput(inputEl);
        } else if (interimTranscript) {
          // Menampilkan teks sementara yang sedang diucapkan
          inputEl.placeholder = 'Mendengarkan: ' + interimTranscript + '...';
        }
      }
    };

    recognizer.onerror = function(event) {
      console.warn('Speech recognition error:', event.error);
      stopSpeechRecognition();
      if (event.error === 'not-allowed') {
        showAppAlert('Izin Mikrofon Ditolak', 'Harap izinkan akses mikrofon pada peramban Anda untuk menggunakan fitur ini.', 'error');
      }
    };

    recognizer.onend = function() {
      stopSpeechRecognition();
    };

    return recognizer;
  }

  function toggleSpeechRecognition(target) {
    activeMicTarget = target;

    if (isRecordingVoice) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }

  function startSpeechRecognition() {
    if (!recognitionInstance) {
      recognitionInstance = initSpeechRecognition();
    }
    if (!recognitionInstance) return;

    try {
      recognitionInstance.start();
    } catch (e) {
      // Jika instance sudah berjalan
      recognitionInstance.stop();
      setTimeout(() => recognitionInstance.start(), 150);
    }
  }

  function stopSpeechRecognition() {
    isRecordingVoice = false;
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {}
    }
    updateMicButtonUI(false);

    // Kembalikan placeholder default input
    const dashInput = document.getElementById('chat-input-dashboard');
    const fullInput = document.getElementById('chat-input-full');
    if (dashInput) dashInput.placeholder = 'Tanyakan soal langsung di sini...';
    if (fullInput) fullInput.placeholder = 'Ketik pertanyaan atau gunakan mic...';
  }

  function updateMicButtonUI(isRecording) {
    const btnDash = document.getElementById('mic-btn-dashboard');
    const btnFull = document.getElementById('mic-btn-full');

    const activeClass = 'p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30 transition cursor-pointer';
    const idleClass = 'p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition cursor-pointer';

    if (btnDash) {
      btnDash.className = (isRecording && activeMicTarget === 'dashboard') ? activeClass : idleClass;
    }
    if (btnFull) {
      btnFull.className = (isRecording && activeMicTarget === 'full') ? activeClass : idleClass;
    }
    lucide.createIcons();
  }

  // ==================== 8. ATTACHMENT & CAMERA ====================
  let activeAttachmentFileName = '';

  // Helper Engine: Kompresi Gambar Otomatis via Canvas di Browser
  function compressImageIfNeeded(file, maxDimension = 1600, quality = 0.8) {
    return new Promise((resolve) => {
      // Jika ukuran file <= 2 MB (2 * 1024 * 1024 bytes), gunakan file asli tanpa kompresi
      if (file.size <= 2 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
        return;
      }

      // Jika > 2 MB, proses resize dan kompresi melalui HTML5 Canvas
      const reader = new FileReader();
      reader.onload = function(readerEvent) {
        const img = new Image();
        img.onload = function() {
          let width = img.width;
          let height = img.height;

          // Hitung rasio aspek jika gambar melebihi dimensi batas
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Ekspor hasil kompresi ke format JPEG
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.src = readerEvent.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Batas aman hard-limit dokumen PDF / gambar ekstrem (15 MB)
    if (file.size > 15 * 1024 * 1024) {
      showAppAlert('Ukuran Terlalu Besar', 'Maksimal ukuran file adalah 15 MB.', 'warning');
      return;
    }

    activeAttachmentFileName = file.name;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // Dokumen PDF: baca langsung tanpa kompresi canvas
      const reader = new FileReader();
      reader.onload = function(e) {
        state.activeAttachmentBase64 = e.target.result;
        showAttachmentPreview(e.target.result, file.name, file.type);
      };
      reader.readAsDataURL(file);
    } else {
      // Gambar / Foto: jika > 2 MB, kompresi otomatis di browser
      const base64Result = await compressImageIfNeeded(file, 1600, 0.8);
      state.activeAttachmentBase64 = base64Result;
      showAttachmentPreview(base64Result, file.name, 'image/jpeg');
    }
  }

  function showAttachmentPreview(base64Uri, fileName, mimeType) {
    const isPdf = (mimeType === 'application/pdf') || base64Uri.startsWith('data:application/pdf');

    // Sinkronisasi komponen preview Full Chat & Dashboard
    const targets = [
      {
        bar: document.getElementById('image-preview-bar'),
        thumb: document.getElementById('preview-thumb'),
        pdfIcon: document.getElementById('preview-pdf-icon'),
        name: document.getElementById('preview-attachment-name'),
        sub: document.getElementById('preview-attachment-sub')
      },
      {
        bar: document.getElementById('image-preview-bar-dashboard'),
        thumb: document.getElementById('preview-thumb-dashboard'),
        pdfIcon: document.getElementById('preview-pdf-icon-dashboard'),
        name: document.getElementById('preview-attachment-name-dashboard'),
        sub: document.getElementById('preview-attachment-sub-dashboard')
      }
    ];

    targets.forEach(t => {
      if (isPdf) {
        if (t.thumb) t.thumb.classList.add('hidden');
        if (t.pdfIcon) t.pdfIcon.classList.remove('hidden');
        if (t.name) t.name.innerText = fileName || 'Dokumen.pdf';
        if (t.sub) t.sub.innerText = 'Dokumen PDF siap dianalisis';
      } else {
        if (t.pdfIcon) t.pdfIcon.classList.add('hidden');
        if (t.thumb) {
          t.thumb.src = base64Uri;
          t.thumb.classList.remove('hidden');
        }
        if (t.name) t.name.innerText = fileName || 'Foto Soal/Materi';
        if (t.sub) t.sub.innerText = 'Foto siap dianalisis';
      }
      if (t.bar) t.bar.classList.remove('hidden');
    });

    lucide.createIcons();
  }

  function cancelImageAttachment() {
    state.activeAttachmentBase64 = null;
    activeAttachmentFileName = '';
    const input = document.getElementById('image-file-input');
    if (input) input.value = '';

    const barFull = document.getElementById('image-preview-bar');
    const barDash = document.getElementById('image-preview-bar-dashboard');
    if (barFull) barFull.classList.add('hidden');
    if (barDash) barDash.classList.add('hidden');
  }

  async function openCameraModal() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');
    if (modal) modal.classList.remove('hidden');

    try {
      try {
        state.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (camErr) {
        state.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      if (video) {
        video.srcObject = state.cameraStream;
        video.play().catch(() => {});
      }
    } catch (err) {
      showAppAlert('Kamera Tidak Dapat Dibuka', err.message, 'error');
      closeCameraModal();
    }
  }

  function closeCameraModal() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }
    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.add('hidden');
  }

  function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    if (!video || !canvas) return;

    // Ambil resolusi video kamera dengan batas maksimal 1280px
    let w = video.videoWidth || 640;
    let h = video.videoHeight || 480;
    const maxDim = 1280;

    if (w > h && w > maxDim) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else if (h > maxDim) {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    // Kompresi hasil jepretan kamera ke 0.80 kualitas JPEG
    const dataUri = canvas.toDataURL('image/jpeg', 0.80);

    state.activeAttachmentBase64 = dataUri;
    activeAttachmentFileName = 'Kamera_' + new Date().getTime() + '.jpg';
    showAttachmentPreview(dataUri, activeAttachmentFileName, 'image/jpeg');
    closeCameraModal();
  }

  // ==================== 9A. MODAL PROFIL AKUN ====================
  function openProfileModal() {
    document.getElementById('profile-student-name').value = state.config.student_name || (state.user ? state.user.name : '');
    document.getElementById('profile-assistant-name').value = state.config.assistant_name || 'Orbit AI';
    document.getElementById('profile-assistant-status').value = state.config.assistant_status || 'Online';
    document.getElementById('profile-reminder-time').value = state.config.reminder_time || '19.00';
    document.getElementById('profile-reminder-desc').value = state.config.reminder_desc || '';
    
    // Reset input kata sandi baru setiap modal dibuka
    const passInput = document.getElementById('profile-new-password');
    if (passInput) passInput.value = '';

    updateModalAvatarPreview(state.user ? state.user.avatarUrl : null);
    document.getElementById('profile-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
  }

  function updateModalAvatarPreview(avatarUrl) {
    const previewImg = document.getElementById('modal-profile-avatar-preview');
    const fallbackBox = document.getElementById('modal-profile-avatar-fallback');
    const studentName = state.config.student_name || (state.user ? state.user.name : 'A');

    if (avatarUrl) {
      if (previewImg) {
        previewImg.src = avatarUrl;
        previewImg.classList.remove('hidden');
      }
      if (fallbackBox) fallbackBox.classList.add('hidden');
    } else {
      if (previewImg) previewImg.classList.add('hidden');
      if (fallbackBox) {
        fallbackBox.innerText = studentName.charAt(0).toUpperCase();
        fallbackBox.classList.remove('hidden');
      }
    }
  }

  function handleModalAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const base64Data = evt.target.result;
      setSyncStatus(true);

      if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
        google.script.run
          .withSuccessHandler((res) => {
            setSyncStatus(false);
            if (res && res.status === 'success') {
              state.user.avatarUrl = res.avatarUrl;
              localStorage.setItem('orbit_user', JSON.stringify(state.user));
              updateModalAvatarPreview(res.avatarUrl);
              renderUI();
              showAppAlert('Foto Profil Diperbarui', 'Foto profil berhasil disimpan ke folder Google Drive.', 'success');
            } else {
              showAppAlert('Gagal Upload', res.message || 'Gagal menyimpan foto', 'error');
            }
          })
          .withFailureHandler((err) => {
            setSyncStatus(false);
            showAppAlert('Error', err.message, 'error');
          })
          .uploadUserAvatar(state.user.username, base64Data);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSaveProfileForm(e) {
    e.preventDefault();
    const newPassInput = document.getElementById('profile-new-password');
    const newPass = newPassInput ? newPassInput.value.trim() : '';

    if (newPass && newPass.length < 6) {
      showAppAlert('Kata Sandi Lemah', 'Kata sandi baru minimal harus 6 karakter.', 'warning');
      return;
    }

    const btn = document.getElementById('save-profile-btn');
    if (btn) btn.innerText = 'Menyimpan...';

    const payload = {
      student_name: document.getElementById('profile-student-name').value.trim(),
      assistant_name: document.getElementById('profile-assistant-name').value.trim(),
      assistant_status: document.getElementById('profile-assistant-status').value,
      reminder_time: document.getElementById('profile-reminder-time').value.trim(),
      reminder_desc: document.getElementById('profile-reminder-desc').value.trim(),
      new_password: newPass
    };

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler(() => {
          if (btn) btn.innerText = 'Simpan Profil';
          closeProfileModal();
          showAppAlert('Profil Disimpan', 'Data profil Anda berhasil diperbarui ke Google Sheets.', 'success');
          refreshData();
        })
        .withFailureHandler((err) => {
          showAppAlert('Gagal Menyimpan Data', String(err.message || err), 'error');
          if (btn) btn.innerText = 'Simpan Profil';
        })
        .updateUserSettings(state.user.username, payload);
    }
  }

  // ==================== 9B. MODAL GEMINI API KEY ====================
  function openApiKeyModal() {
    document.getElementById('api-modal-key-input').value = state.config.user_api_key || '';
    document.getElementById('api-modal-key-input').type = 'password';
    document.getElementById('btn-toggle-apikey-vis').innerText = 'Tampilkan Key';

    if (state.config.gemini_model && document.getElementById('api-modal-gemini-model')) {
      document.getElementById('api-modal-gemini-model').value = state.config.gemini_model;
    }

    const errBox = document.getElementById('api-modal-error-box');
    if (errBox) errBox.classList.add('hidden');

    document.getElementById('api-key-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function closeApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    if (modal) modal.classList.add('hidden');
  }

  function toggleApiKeyInputVisibility() {
    const input = document.getElementById('api-modal-key-input');
    const btn = document.getElementById('btn-toggle-apikey-vis');
    if (!input || !btn) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerText = 'Sembunyikan Key';
    } else {
      input.type = 'password';
      btn.innerText = 'Tampilkan Key';
    }
  }

  function handleLoadModelsModal() {
    const apiKey = document.getElementById('api-modal-key-input').value.trim();
    const btn = document.getElementById('btn-load-models-modal');
    const errBox = document.getElementById('api-modal-error-box');
    const modelSelect = document.getElementById('api-modal-gemini-model');

    if (errBox) {
      errBox.classList.add('hidden');
      errBox.innerText = '';
    }

    if (!apiKey) {
      if (errBox) {
        errBox.innerText = 'Ketik atau tempelkan Gemini API Key terlebih dahulu!';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (btn) btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Cek Model</span>';
          lucide.createIcons();

          if (res && res.status === 'success' && res.models && res.models.length > 0) {
            if (modelSelect) {
              modelSelect.innerHTML = res.models.map(m => {
                const isSelected = m.id === (state.config.gemini_model || 'gemini-2.5-flash') ? 'selected' : '';
                return '<option value="' + m.id + '" ' + isSelected + '>' + m.id + ' (' + m.displayName + ')</option>';
              }).join('');
            }
            showAppAlert(
              'Model Ditemukan',
              'Koneksi berhasil! Ditemukan ' + res.models.length + ' model aktif yang siap digunakan.',
              'success'
            );
          } else {
            if (errBox) {
              errBox.innerText = (res ? res.message : 'Gagal memuat model. Periksa API Key Anda.');
              errBox.classList.remove('hidden');
            }
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Cek Model</span>';
          lucide.createIcons();
          if (errBox) {
            errBox.innerText = 'Error server: ' + err.message;
            errBox.classList.remove('hidden');
          }
        })
        .fetchAvailableGeminiModels(apiKey);
    }
  }

  function handleSaveApiKeyForm(e) {
    e.preventDefault();
    const btn = document.getElementById('save-apikey-btn');
    if (btn) btn.innerText = 'Menyimpan...';

    const payload = {
      gemini_api_key: document.getElementById('api-modal-key-input').value.trim(),
      gemini_model: document.getElementById('api-modal-gemini-model') ? document.getElementById('api-modal-gemini-model').value : 'gemini-2.5-flash'
    };

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler(() => {
          if (btn) btn.innerText = 'Simpan Kunci';
          closeApiKeyModal();
          showAppAlert('API Key Disimpan', 'Konfigurasi Gemini API Key berhasil diperbarui ke Google Sheets.', 'success');
          refreshData();
        })
        .withFailureHandler((err) => {
          showAppAlert('Gagal Menyimpan API Key', String(err.message || err), 'error');
          if (btn) btn.innerText = 'Simpan Kunci';
        })
        .updateUserSettings(state.user.username, payload);
    }
  }

  // ==================== 10. SCHEDULE MODAL & CRUD ====================
  function openAddScheduleModal() {
    document.getElementById('sched-id').value = '';
    document.getElementById('sched-time-start').value = '07:00';
    document.getElementById('sched-time-end').value = '08:30';
    document.getElementById('sched-title').value = '';
    document.getElementById('sched-desc').value = '';
    document.getElementById('sched-tag').value = '';
    document.getElementById('schedule-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
  }

  function handleSaveScheduleForm(e) {
    e.preventDefault();
    const startVal = document.getElementById('sched-time-start').value || '07:00';
    const endVal = document.getElementById('sched-time-end').value || '08:00';
    const combinedRange = `${startVal} - ${endVal}`;

    const item = {
      id: document.getElementById('sched-id').value,
      time: combinedRange,
      title: document.getElementById('sched-title').value.trim(),
      desc: document.getElementById('sched-desc').value.trim(),
      tag: document.getElementById('sched-tag').value.trim()
    };

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler(() => {
          closeScheduleModal();
          showAppAlert('Jadwal Disimpan', 'Agenda kegiatan berhasil diperbarui ke Google Sheets.', 'success');
          refreshData();
        })
        .saveUserSchedule(state.user.username, item);
    }
  }

  async function deleteScheduleItem(id) {
    const confirmed = await showAppConfirm(
      'Hapus Jadwal?',
      'Apakah kamu yakin ingin menghapus agenda kegiatan ini dari jadwal harianmu?',
      'warning'
    );
    if (!confirmed) return;

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler(() => {
          showAppAlert('Terhapus', 'Jadwal telah berhasil dihapus dari Google Sheets.', 'info');
          refreshData();
        })
        .deleteUserSchedule(state.user.username, id);
    }
  }

  // ==================== 11. SESSION MODAL & CRUD ====================
  function populateModalTagSuggestions(currentSelectedTag) {
    const datalist = document.getElementById('existing-tags-datalist');
    const chipsContainer = document.getElementById('modal-tag-chips-container');
    if (!datalist || !chipsContainer) return;

    // Ambil daftar tag unik dari seluruh sesi yang ada
    const uniqueTags = new Set();
    uniqueTags.add('Umum');
    (state.sessions || []).forEach(s => {
      const t = (s.tag || '').trim();
      if (t) uniqueTags.add(t);
    });

    const tagArray = Array.from(uniqueTags);

    // Isi HTML datalist autocomplete
    datalist.innerHTML = tagArray.map(t => `<option value="${t}"></option>`).join('');

    // Render quick-clickable chips di bawah input
    chipsContainer.innerHTML = '<span class="text-[10px] text-slate-400 font-semibold mr-1">Rekomendasi:</span>' +
      tagArray.map(t => {
        const isCurrent = (currentSelectedTag || '').toLowerCase() === t.toLowerCase();
        return `
          <button 
            type="button" 
            onclick="selectModalTag('${t}')"
            class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              isCurrent 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
            }"
          >
            ${t}
          </button>
        `;
      }).join('');
  }

  function selectModalTag(tagValue) {
    const input = document.getElementById('modal-session-tag');
    if (input) input.value = tagValue;
    populateModalTagSuggestions(tagValue);
  }

  function openCreateSessionModal() {
    toggleMobileChatSidebar(false);
    document.getElementById('session-modal-title').innerText = 'Buat Sesi Belajar Baru';
    document.getElementById('modal-session-id').value = '';
    document.getElementById('modal-session-title').value = '';
    document.getElementById('modal-session-tag').value = 'Umum';
    populateModalTagSuggestions('Umum');
    document.getElementById('session-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function openEditSessionModal(sessionId) {
    toggleMobileChatSidebar(false);
    const s = (state.sessions || []).find(item => item.sessionId === sessionId);
    if (!s) return;
    document.getElementById('session-modal-title').innerText = 'Edit Sesi Belajar';
    document.getElementById('modal-session-id').value = s.sessionId;
    document.getElementById('modal-session-title').value = s.title;
    document.getElementById('modal-session-tag').value = s.tag || 'Umum';
    populateModalTagSuggestions(s.tag || 'Umum');
    document.getElementById('session-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function editCurrentActiveSession() {
    if (state.activeSessionId) {
      openEditSessionModal(state.activeSessionId);
    }
  }

  function closeSessionModal() {
    document.getElementById('session-modal').classList.add('hidden');
  }

  // ==================== 12. ASSISTANT ACTIONS & EXPORT ENGINE ====================

  // ==================== CONTROLLER AUDIO FLEKSIBEL (PLAY / PAUSE / RATE) ====================

  function handleTogglePlayPauseSpeech(index) {
    if (!('speechSynthesis' in window)) {
      showAppAlert('TTS Tidak Didukung', 'Browser Anda belum mendukung pemutar suara Web Speech API.', 'warning');
      return;
    }

    // Kasus 1: Mengklik pesan yang sama saat sedang memutar audio
    if (state.activeSpeechIndex === index && window.speechSynthesis.speaking) {
      if (state.isSpeechPaused) {
        window.speechSynthesis.resume();
        state.isSpeechPaused = false;
        renderChatMessages();
      } else {
        window.speechSynthesis.pause();
        state.isSpeechPaused = true;
        renderChatMessages();
      }
      return;
    }

    // Kasus 2: Memulai pemutaran audio dari awal (atau beralih ke pesan lain)
    startSpeakingMessage(index);
  }

  function startSpeakingMessage(index) {
    window.speechSynthesis.cancel(); // Hentikan suara yang sedang berjalan sebelumnya
    state.isSpeechPaused = false;

    const targetChat = (state.chats || [])[index];
    if (!targetChat || !targetChat.message) return;

    // Bersihkan sintaks Markdown & rumus KaTeX agar pelafalan suara ramah didengar
    const cleanSpeechText = targetChat.message
      .replace(/\$\$[\s\S]*?\$\$/g, 'rumus matematika')
      .replace(/\$([^\$]+)\$/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[\r\n]+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.lang = 'id-ID'; // Bahasa Indonesia
    utterance.rate = state.speechRate || 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = function() {
      state.activeSpeechIndex = index;
      state.isSpeechPaused = false;
      renderChatMessages();
    };

    utterance.onend = function() {
      state.activeSpeechIndex = null;
      state.isSpeechPaused = false;
      renderChatMessages();
    };

    utterance.onerror = function() {
      state.activeSpeechIndex = null;
      state.isSpeechPaused = false;
      renderChatMessages();
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleStopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    state.activeSpeechIndex = null;
    state.isSpeechPaused = false;
    renderChatMessages();
  }

  function cycleSpeechRate(index) {
    // Pilihan rotasi kecepatan: 1.0x -> 1.25x -> 1.5x -> 2.0x -> kembali ke 1.0x
    const rates = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = rates.indexOf(state.speechRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    state.speechRate = rates[nextIndex];

    // Mulai ulang pemutaran dengan kecepatan baru
    startSpeakingMessage(index);
  }

  // 2. Fitur Copy Response Jawaban Asisten
  function handleCopyResponse(index) {
    const targetChat = (state.chats || [])[index];
    if (!targetChat || !targetChat.message) return;

    navigator.clipboard.writeText(targetChat.message)
      .then(() => {
        showAppAlert('Tersalin', 'Jawaban asisten berhasil disalin ke clipboard.', 'info');
      })
      .catch(() => {
        showAppAlert('Gagal', 'Izin clipboard diblokir pada browser Anda.', 'error');
      });
  }

  // 3. Export per Jawaban Asisten ke Google Docs
  function handleExportResponseToDocs(index) {
    const targetChat = (state.chats || [])[index];
    if (!targetChat || !targetChat.message || !state.user) return;

    const currentSession = (state.sessions || []).find(s => s.sessionId === state.activeSessionId);
    const sessionTitle = currentSession ? currentSession.title : 'Jawaban Orbit AI';

    setSyncStatus(true);
    showAppAlert('Membuat Dokumen', 'Sedang mengekspor jawaban ke Google Docs Anda...', 'info');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          setSyncStatus(false);
          if (res && res.status === 'success' && res.url) {
            // 1. Ekspor langsung unduhan Word (.docx) atau buka docs
            const docIdMatch = res.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            const docId = docIdMatch ? docIdMatch[1] : '';
            const downloadDocxUrl = docId ? `https://docs.google.com/document/d/${docId}/export?format=docx` : res.url;

            // Tampilkan dialog hanya dengan tombol Unduh .docx berwarna biru
            const cleanContentHtml = `
              <div class="space-y-3 pt-1">
                <p class="text-xs text-slate-500">Dokumen berhasil dibuat dan siap diunduh ke perangkat Anda.</p>
                <div class="pt-1">
                  <a 
                    href="${downloadDocxUrl}" 
                    target="_blank" 
                    class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer"
                  >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Unduh .docx</span>
                  </a>
                </div>
              </div>
            `;

            showAppAlert('Dokumen Berhasil Dibuat', cleanContentHtml, 'success');
          } else {
            showAppAlert('Gagal Ekspor', (res ? res.message : 'Terjadi kendala server.'), 'error');
          }
        })
        .withFailureHandler((err) => {
          setSyncStatus(false);
          showAppAlert('Error', err.message, 'error');
        })
        .exportResponseToGoogleDocs(state.user.username, sessionTitle, targetChat.message);
    }
  }

  // 4. Fitur Pin & Bookmark Pesan
  function handleTogglePinMessage(msgId) {
    const idx = state.pinnedMessageIds.indexOf(msgId);
    if (idx > -1) {
      state.pinnedMessageIds.splice(idx, 1);
    } else {
      state.pinnedMessageIds.push(msgId);
    }
    localStorage.setItem('orbit_pinned_msgs', JSON.stringify(state.pinnedMessageIds));
    renderChatMessages();
  }

  function togglePinnedFilter() {
    state.onlyShowPinned = !state.onlyShowPinned;
    const btn = document.getElementById('btn-filter-pinned');
    if (btn) {
      if (state.onlyShowPinned) {
        btn.className = 'p-2 rounded-xl bg-amber-500 text-white shadow-xs transition cursor-pointer';
      } else {
        btn.className = 'p-2 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition cursor-pointer';
      }
    }
    renderChatMessages();
  }

  // 5. Pencarian Pesan Riwayat (Full-Text Search)
  function handleSearchChatMessages(query) {
    state.chatSearchQuery = String(query || '').trim();
    renderChatMessages();
  }

  // 6. Ekspor Catatan Sesi ke Markdown (.md)
  function exportSessionToMarkdown() {
    const currentSession = (state.sessions || []).find(s => s.sessionId === state.activeSessionId);
    const title = currentSession ? currentSession.title : 'Catatan Belajar Orbit Assistant';
    const chats = state.chats || [];

    if (chats.length === 0) {
      showAppAlert('Pesan Kosong', 'Belum ada riwayat pesan di sesi ini untuk diekspor.', 'warning');
      return;
    }

    let mdContent = `# ${title}\n`;
    mdContent += `*Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}*\n`;
    mdContent += `*Tag Kategori: ${currentSession ? currentSession.tag : 'Umum'}*\n\n---\n\n`;

    chats.forEach(c => {
      const roleName = c.role === 'user' ? '👤 Siswa' : '🤖 Orbit AI';
      mdContent += `### ${roleName} (${c.timestamp || '-'})\n\n${c.message}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (title.replace(/[^a-zA-Z0-9_-]/g, '_')) + '.md';
    link.click();
    URL.revokeObjectURL(url);
    showAppAlert('Berhasil', 'File catatan Markdown (.md) berhasil diunduh.', 'success');
  }

  // 7. Ekspor Catatan Sesi ke PDF (Print View Browser)
  function exportSessionToPdf() {
    const currentSession = (state.sessions || []).find(s => s.sessionId === state.activeSessionId);
    const title = currentSession ? currentSession.title : 'Catatan Belajar Orbit Assistant';
    const chats = state.chats || [];

    if (chats.length === 0) {
      showAppAlert('Pesan Kosong', 'Belum ada riwayat percakapan untuk dicetak.', 'warning');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      showAppAlert('Popup Diblokir', 'Izinkan popup di browser Anda untuk mengunduh PDF.', 'error');
      return;
    }

    const bodyHtml = chats.map(c => `
      <div style="margin-bottom: 20px; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: ${c.role === 'user' ? '#eff6ff' : '#ffffff'};">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 5px;">
          ${c.role === 'user' ? '👤 Siswa' : '🤖 Orbit AI'} • ${c.timestamp || ''}
        </div>
        <div style="font-size: 13px; line-height: 1.6; color: #1e293b;">
          ${formatMathAndMarkdown(c.message || '')}
        </div>
      </div>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #0f172a; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p.sub { font-size: 12px; color: #64748b; margin-top: 0; margin-bottom: 25px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="sub">Orbit Assistant • Diekspor pada: ${new Date().toLocaleString('id-ID')}</p>
          ${bodyHtml}
          
            window.onload = function() {
              window.print();
            };
          <\/script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  function handleSaveSessionForm(e) {
    e.preventDefault();
    const sId = document.getElementById('modal-session-id').value;
    const title = document.getElementById('modal-session-title').value.trim();
    const tag = document.getElementById('modal-session-tag').value.trim() || 'Umum';
    const btn = document.getElementById('save-session-modal-btn');
    if (btn) btn.innerText = 'Menyimpan...';

    if (sId) {
      if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
        google.script.run
          .withSuccessHandler(() => {
            const item = state.sessions.find(s => s.sessionId === sId);
            if (item) {
              item.title = title;
              item.tag = tag;
            }
            if (btn) btn.innerText = 'Simpan Sesi';
            closeSessionModal();
            renderUI();
          })
          .updateChatSession(state.user.username, sId, title, tag);
      }
    } else {
      if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
        google.script.run
          .withSuccessHandler((newSession) => {
            state.sessions.unshift(newSession);
            state.activeSessionId = newSession.sessionId;
            state.chats = [];
            if (btn) btn.innerText = 'Simpan Sesi';
            closeSessionModal();
            renderUI();
          })
          .createNewChatSession(state.user.username, title, tag);
      }
    }
  }

  async function deleteSessionItem(sessionId) {
    const confirmed = await showAppConfirm(
      'Hapus Sesi Chat?',
      'Sesi belajar ini beserta seluruh riwayat percakapan di dalamnya akan dihapus permanen dari Spreadsheet.',
      'warning'
    );
    if (!confirmed) return;

    setSyncStatus(true);
    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler(() => {
          state.sessions = state.sessions.filter(s => s.sessionId !== sessionId);
          if (state.activeSessionId === sessionId) {
            state.activeSessionId = state.sessions.length > 0 ? state.sessions[0].sessionId : null;
            if (state.activeSessionId) {
              switchChatSession(state.activeSessionId);
            } else {
              state.chats = [];
            }
          }
          renderUI();
          setSyncStatus(false);
          showAppAlert('Selesai', 'Sesi percakapan berhasil dihapus.', 'info');
        })
        .deleteChatSession(state.user.username, sessionId);
    }
  }

  function deleteCurrentActiveSession() {
    if (state.activeSessionId) {
      deleteSessionItem(state.activeSessionId);
    }
  }

  function filterSessionsByTag(tag) {
    state.selectedTagFilter = tag;
    document.querySelectorAll('.session-tag-filter').forEach(btn => {
      if (btn.getAttribute('data-tag') === tag) {
        btn.className = 'session-tag-filter whitespace-nowrap px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold';
      } else {
        btn.className = 'session-tag-filter whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium';
      }
    });
    renderSessionTagFilters(); // Refresh tampilan tombol filter aktif
    renderSessionCards();      // Filter kartu sesi sesuai tag yang dipilih
  }

  function setSyncStatus(isSyncing) {
    const ind = document.getElementById('sync-indicator');
    if (ind) {
      ind.className = isSyncing 
        ? 'inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping' 
        : 'inline-block w-2 h-2 rounded-full bg-emerald-500';
    }
  }

  function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) {
      const isClosed = sidebar.classList.contains('-translate-x-full');
      if (isClosed) {
        sidebar.classList.remove('-translate-x-full');
        if (overlay) overlay.classList.remove('hidden');
      } else {
        sidebar.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
      }
    }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const base64Data = evt.target.result;
      setSyncStatus(true);

      if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
        google.script.run
          .withSuccessHandler((res) => {
            setSyncStatus(false);
            if (res && res.status === 'success') {
              state.user.avatarUrl = res.avatarUrl;
              localStorage.setItem('orbit_user', JSON.stringify(state.user));
              renderUI();
              showAppAlert('Foto Profil Diperbarui', 'Foto profil berhasil disimpan ke Google Drive Database.', 'success');
            } else {
              showAppAlert('Gagal Upload', res.message || 'Gagal menyimpan foto', 'error');
            }
          })
          .withFailureHandler((err) => {
            setSyncStatus(false);
            showAppAlert('Error', err.message, 'error');
          })
          .uploadUserAvatar(state.user.username, base64Data);
      }
    };
    reader.readAsDataURL(file);
  }

  let allUsersData = null;

  function getUsersSkeletonHtml() {
    return Array(4).fill(0).map(() => `
      <div class="bg-white dark:bg-[#111C44] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4 animate-pulse select-none">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700/60"></div>
            <div class="space-y-1.5">
              <div class="h-4 w-32 bg-slate-200 dark:bg-slate-700/60 rounded-md"></div>
              <div class="h-3 w-20 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
            </div>
          </div>
          <div class="h-6 w-16 bg-slate-200 dark:bg-slate-700/60 rounded-full"></div>
        </div>
        <div class="h-9 bg-slate-100 dark:bg-slate-900/60 rounded-xl"></div>
        <div class="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div class="h-3 w-1/3 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
          <div class="h-10 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700"></div>
        </div>
      </div>
    `).join('');
  }

  function loadUsersManagement(isForceRefresh = false) {
    if (!state.user || state.user.role !== 'superadmin') return;

    fetchRegistrationStatus(); // Sinkronisasi posisi sakelar setiap halaman dibuka
    const container = document.getElementById('users-cards-container');
    const refreshBtn = document.getElementById('btn-refresh-users');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    // Tampilkan skeleton loader modern
    if (isForceRefresh || !allUsersData || allUsersData.length === 0) {
      if (container) {
        container.innerHTML = getUsersSkeletonHtml();
      }
    } else {
      renderUsersCards(allUsersData);
    }

    // Muat konfigurasi pengumuman terkini ke form admin
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            const toggle = document.getElementById('toggle-announcement-switch');
            const inputMsg = document.getElementById('input-announcement-text');
            const selectType = document.getElementById('select-announcement-type');

            if (toggle) {
              toggle.checked = Boolean(res.enabled);
              updateAnnouncementStatusLabel(Boolean(res.enabled));
            }
            if (inputMsg && res.message) inputMsg.value = res.message;
            if (selectType && res.type) selectType.value = res.type;

            const inputExpiry = document.getElementById('input-announcement-expiry');
            const checkPerm = document.getElementById('check-announcement-permanent');
            if (inputExpiry && checkPerm) {
              if (res.expiresAt) {
                inputExpiry.value = res.expiresAt;
                checkPerm.checked = false;
                toggleAnnouncementExpiryInput(false);
              } else {
                inputExpiry.value = '';
                checkPerm.checked = true;
                toggleAnnouncementExpiryInput(true);
              }
            }
          }
        })
        .getGlobalAnnouncement();

      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success') {
            allUsersData = res.users || [];
            renderUsersCards(allUsersData);
          } else {
            if (container && (!allUsersData || allUsersData.length === 0)) {
              container.innerHTML = '<div class="col-span-1 md:col-span-2 py-8 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat daftar pengguna.') + '</div>';
            }
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (container && (!allUsersData || allUsersData.length === 0)) {
            container.innerHTML = '<div class="col-span-1 md:col-span-2 py-8 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</div>';
          }
        })
        .getAllUsersWithConfigs(state.user.username);
    }
  }

  function renderUsersCards(users) {
    const container = document.getElementById('users-cards-container');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<div class="col-span-1 md:col-span-2 py-10 text-center text-xs text-slate-400">Belum ada akun pengguna.</div>';
      return;
    }

    container.innerHTML = users.map(u => {
      const isUserActive = (u.status || 'Aktif').toLowerCase() === 'aktif';
      const statusBadge = isUserActive
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Aktif</span>'
        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">Tidak Aktif</span>';

      const avatarHtml = u.avatarUrl
        ? `<img src="${u.avatarUrl}" class="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs" alt="${u.name}">`
        : `<div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center shadow-2xs">${u.name.charAt(0).toUpperCase()}</div>`;

      return `
        <div class="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              ${avatarHtml}
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-extrabold text-slate-800 leading-snug">${u.name}</h3>
                  ${statusBadge}
                </div>
                <p class="text-[11px] text-slate-400 font-mono">@${u.username} • <span class="capitalize text-slate-500">${u.role}</span></p>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
            <button 
              onclick="openUserLogsModal('${u.username}')" 
              title="Lihat Log Aktivitas" 
              class="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
            >
              <i data-lucide="history" class="w-4 h-4"></i>
            </button>
            <button 
              onclick="openEditUserModal('${u.username}', '${u.name}', '${u.role}', '${u.status}', '${(u.config.api_key || '').replace(/'/g, "\\'")}', '${u.config.gemini_model || 'gemini-2.5-flash'}', ${u.config.daily_prompt_limit || 50})" 
              title="Edit Akun" 
              class="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            >
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            ${(state.user && state.user.username.toLowerCase() !== u.username.toLowerCase()) ? `
              <button 
                onclick="handleDeleteUser('${u.username}')" 
                title="Hapus Akun Pengguna" 
                class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>

        
        <div class="flex items-center justify-between px-3.5 py-2 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px]">
          <span class="text-slate-400 flex items-center gap-1.5 font-medium">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>Terakhir Login:</span>
          </span>
          <span class="font-bold text-slate-700 font-mono">${u.lastLogin || 'Belum pernah login'}</span>
        </div>

          <div class="bg-slate-50 rounded-2xl p-3.5 space-y-2.5 border border-slate-100 text-xs">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Konfigurasi Akun Aktif</span>
              <span class="${u.config.has_api_key ? 'text-emerald-600 font-bold' : 'text-amber-500 font-semibold'}">
                ${u.config.has_api_key ? '✓ API Key Tersedia' : '⚠ Belum Ada API Key'}
              </span>
            </div>

            
            <div class="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <span class="text-[10px] text-slate-400 block font-semibold">Gemini API Key:</span>
                <span class="font-mono text-xs font-bold text-slate-700 truncate block" id="key-display-${u.username}">
                  ${u.config.has_api_key ? (u.config.api_key.substring(0, 8) + '••••••••' + u.config.api_key.slice(-4)) : '<i class="text-slate-400 font-normal">Belum diisi</i>'}
                </span>
              </div>
              ${u.config.has_api_key ? `
                <button 
                  type="button" 
                  onclick="copyUserApiKey('${u.config.api_key}')" 
                  title="Salin API Key" 
                  class="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition"
                >
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>

            
            <div class="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs">
              <span class="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <i data-lucide="zap" class="w-3.5 h-3.5 text-blue-600"></i>
                <span>Kuota Hari Ini:</span>
              </span>
              <span class="font-mono font-extrabold ${
                (u.config.daily_prompt_limit <= 0) 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : ((u.config.prompts_today >= u.config.daily_prompt_limit) ? 'text-rose-600' : 'text-blue-700 dark:text-blue-300')
              }">
                ${u.config.prompts_today || 0} / ${(u.config.daily_prompt_limit <= 0) ? 'Unlimited (Bebas)' : (u.config.daily_prompt_limit + ' Tanya')}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-slate-400 block text-[10px]">Model Gemini:</span>
                <span class="font-mono font-semibold text-slate-700 truncate block">${u.config.gemini_model || 'gemini-2.5-flash'}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Nama Asisten:</span>
                <span class="font-semibold text-slate-700 truncate block">${u.config.assistant_name || 'Orbit AI'}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Pengingat:</span>
                <span class="font-semibold text-slate-700 truncate block">${u.config.reminder_time || '-'} WIB</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">Subteks:</span>
                <span class="font-semibold text-slate-700 truncate block">${u.config.reminder_desc || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  function toggleModalApiKeyVisibility() {
    const input = document.getElementById('modal-user-apikey');
    const btn = document.getElementById('btn-toggle-modal-key');
    if (!input || !btn) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerText = 'Sembunyikan';
    } else {
      input.type = 'password';
      btn.innerText = 'Lihat';
    }
  }

  function copyUserApiKey(apiKey) {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
      showAppAlert('Disalin', 'API Key berhasil disalin ke clipboard.', 'info');
    }).catch(() => {
      showAppAlert('Gagal Menyalin', 'Izin clipboard diblokir.', 'error');
    });
  }

  function openCreateUserModal() {
    document.getElementById('user-modal-title').innerText = 'Tambah Pengguna Baru';
    document.getElementById('modal-user-original-username').value = '';
    document.getElementById('modal-user-username').value = '';
    document.getElementById('modal-user-username').readOnly = false;
    document.getElementById('modal-user-name').value = '';
    document.getElementById('modal-user-password').value = '';
    document.getElementById('modal-user-apikey').value = '';
    document.getElementById('modal-user-apikey').type = 'password';
    document.getElementById('btn-toggle-modal-key').innerText = 'Lihat';
    document.getElementById('modal-user-role').value = 'student';
    document.getElementById('modal-user-status').value = 'Aktif';
    document.getElementById('modal-user-daily-limit').value = 50;
    
    const modelSelect = document.getElementById('modal-user-gemini-model');
    if (modelSelect) {
      modelSelect.innerHTML = `
        <option value="gemini-2.5-flash">gemini-2.5-flash (Default)</option>
        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
      `;
      modelSelect.value = 'gemini-2.5-flash';
    }

    document.getElementById('user-edit-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function openEditUserModal(username, name, role, status, apiKey, currentModel, dailyLimit) {
    const cleanU = String(username || '').replace(/^@/, '').trim();
    document.getElementById('user-modal-title').innerText = 'Edit Akun: @' + cleanU;
    document.getElementById('modal-user-original-username').value = cleanU;
    document.getElementById('modal-user-username').value = cleanU;
    document.getElementById('modal-user-username').readOnly = true;
    document.getElementById('modal-user-name').value = name;
    document.getElementById('modal-user-password').value = '';
    document.getElementById('modal-user-apikey').value = apiKey || '';
    document.getElementById('modal-user-apikey').type = 'password';
    document.getElementById('btn-toggle-modal-key').innerText = 'Lihat';
    document.getElementById('modal-user-role').value = role || 'student';
    document.getElementById('modal-user-status').value = status || 'Aktif';
    document.getElementById('modal-user-daily-limit').value = (dailyLimit !== undefined && dailyLimit !== null) ? dailyLimit : 50;

    let selectedModel = currentModel;
    if (!selectedModel) {
      const foundInApiKeys = (allApiKeysData || []).find(x => x.username.toLowerCase() === cleanU.toLowerCase());
      if (foundInApiKeys && foundInApiKeys.model) {
        selectedModel = foundInApiKeys.model;
      }
    }
    selectedModel = selectedModel || 'gemini-2.5-flash';

    const modelSelect = document.getElementById('modal-user-gemini-model');
    if (modelSelect) {
      modelSelect.innerHTML = `
        <option value="${selectedModel}" selected>${selectedModel} (Aktif)</option>
        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
      `;
      modelSelect.value = selectedModel;
    }

    document.getElementById('user-edit-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function closeUserEditModal() {
    document.getElementById('user-edit-modal').classList.add('hidden');
  }

  function handleSaveUserForm(e) {
    e.preventDefault();
    const btn = document.getElementById('save-user-btn');
    if (btn) btn.innerText = 'Menyimpan...';

    const origUser = document.getElementById('modal-user-original-username').value.trim();
    const formUser = document.getElementById('modal-user-username').value.replace(/^@/, '').trim();

    const modelSelect = document.getElementById('modal-user-gemini-model');
    const selectedModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';

    const payload = {
      original_username: origUser,
      username: formUser,
      name: document.getElementById('modal-user-name').value.trim(),
      password: document.getElementById('modal-user-password').value.trim(),
      api_key: document.getElementById('modal-user-apikey').value.trim(),
      gemini_model: selectedModel,
      daily_prompt_limit: (() => {
        const val = parseInt(document.getElementById('modal-user-daily-limit').value, 10);
        return isNaN(val) ? 50 : val;
      })(),
      role: document.getElementById('modal-user-role').value,
      status: document.getElementById('modal-user-status').value,
      adminUsername: state.user ? state.user.username : ''
    };

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      const currentAdmin = state.user ? state.user.username : 'superadmin';
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerText = 'Simpan Akun';
          if (res && res.status === 'success') {
            closeUserEditModal();

            // 1. Update State Lokal allApiKeysData secara instan (Optimistic UI)
            const targetIndex = (allApiKeysData || []).findIndex(item => 
              item.username.toLowerCase() === formUser.toLowerCase() || 
              (origUser && item.username.toLowerCase() === origUser.toLowerCase())
            );

            if (targetIndex > -1) {
              allApiKeysData[targetIndex].name = payload.name;
              allApiKeysData[targetIndex].apiKey = payload.api_key;
              allApiKeysData[targetIndex].hasKey = Boolean(payload.api_key && payload.api_key.trim().length > 5);
              applyApiKeysFilter(); // Langsung render ulang tabel detik ini juga
            }

            // 2. Fetch ulang dari backend untuk memastikan integritas data Spreadsheet
            loadApiKeysManagement();
            if (typeof loadUsersManagement === 'function') {
              loadUsersManagement();
            }

            // 3. Jika mengedit akun sendiri, perbarui state profil
            if (state.user && state.user.username.toLowerCase() === formUser.toLowerCase()) {
              refreshData();
            }

            showAppAlert('Tersimpan', 'Data akun @' + formUser + ' berhasil diperbarui.', 'success');
          } else {
            showAppAlert('Gagal', (res && res.message) ? res.message : 'Terjadi kesalahan.', 'error');
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerText = 'Simpan Akun';
          showAppAlert('Gagal Menyimpan', err.message, 'error');
        })
        .saveOrUpdateUser(currentAdmin, payload);
    }
  }

  function handleInspectUserApiKey() {
    const apiKey = document.getElementById('modal-user-apikey').value.trim();
    const btn = document.getElementById('btn-inspect-user-key');
    const modelSelect = document.getElementById('modal-user-gemini-model');

    if (!apiKey) {
      showAppAlert('Kunci Kosong', 'Ketik atau tempelkan Gemini API Key terlebih dahulu sebelum mengecek model.', 'warning');
      return;
    }

    if (btn) btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Cek Model</span>';
          lucide.createIcons();

          if (res && res.status === 'success' && res.models && res.models.length > 0) {
            const currentSelected = modelSelect.value || 'gemini-2.5-flash';
            modelSelect.innerHTML = res.models.map(m => {
              const isSelected = m.id === currentSelected ? 'selected' : '';
              return `<option value="${m.id}" ${isSelected}>${m.id} (${m.displayName})</option>`;
            }).join('');

            showAppAlert(
              'Model Berhasil Dimuat', 
              'Ditemukan ' + res.models.length + ' model aktif yang siap digunakan oleh akun ini. Silakan pilih model yang diinginkan pada dropdown.', 
              'success'
            );
          } else {
            showAppAlert('Pemeriksaan Gagal', (res ? res.message : 'API Key tidak valid atau kuota habis.'), 'error');
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Cek Model</span>';
          lucide.createIcons();
          showAppAlert('Koneksi Error', err.message, 'error');
        })
        .fetchAvailableGeminiModels(apiKey);
    }
  }

  function fetchRegistrationStatus() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          // Evaluasi ketat: hanya true jika nilainya benar-benar boolean true atau string 'true'
          const raw = res ? res.enabled : false;
          const isEnabled = raw === true || String(raw).toLowerCase().trim() === 'true';

          const navContainer = document.getElementById('register-nav-container');
          const noticeBox = document.getElementById('register-disabled-notice');
          const switchInput = document.getElementById('toggle-reg-switch');
          const statusLabel = document.getElementById('label-reg-status');

          if (navContainer) {
            if (isEnabled) {
              navContainer.classList.remove('hidden');
            } else {
              navContainer.classList.add('hidden');
            }
          }

          if (noticeBox) {
            if (isEnabled) {
              noticeBox.classList.add('hidden');
            } else {
              noticeBox.classList.remove('hidden');
            }
          }

          // Tampilan Sakelar Halaman Kelola Pengguna
          if (switchInput) switchInput.checked = isEnabled;
          if (statusLabel) {
            statusLabel.innerText = isEnabled ? 'Aktif' : 'Nonaktif';
            statusLabel.className = isEnabled 
              ? 'text-[11px] font-bold text-emerald-600' 
              : 'text-[11px] font-bold text-rose-500';
          }
        })
        .withFailureHandler(() => {
          console.warn('Gagal memuat status registrasi backend.');
        })
        .getRegistrationStatus();
    }
  }

  function handleToggleRegistration(isChecked) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const statusLabel = document.getElementById('label-reg-status');
    if (statusLabel) {
      statusLabel.innerText = 'Menyimpan...';
      statusLabel.className = 'text-[11px] font-bold text-slate-400';
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            const enabled = res.enabled;
            if (statusLabel) {
              statusLabel.innerText = enabled ? 'Aktif' : 'Nonaktif';
              statusLabel.className = enabled 
                ? 'text-[11px] font-bold text-emerald-600' 
                : 'text-[11px] font-bold text-rose-500';
            }
            showAppAlert(
              'Konfigurasi Disimpan',
              enabled ? 'Pendaftaran mandiri dibuka untuk umum.' : 'Pendaftaran mandiri resmi dinonaktifkan.',
              'success'
            );
          } else {
            showAppAlert('Gagal Menyimpan', res.message || 'Gagal mengubah status pendaftaran.', 'error');
            fetchRegistrationStatus();
          }
        })
        .withFailureHandler((err) => {
          showAppAlert('Error', err.message, 'error');
          fetchRegistrationStatus();
        })
        .toggleRegistrationSetting(state.user.username, isChecked);
    }
  }

  function openUserLogsModal(targetUsername) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const cleanUser = String(targetUsername).replace(/^@/, '').trim();
    const titleEl = document.getElementById('user-logs-title');
    const listEl = document.getElementById('user-logs-list');
    const modalEl = document.getElementById('user-logs-modal');

    if (titleEl) titleEl.innerText = 'Log Aktivitas: @' + cleanUser;
    if (listEl) {
      listEl.innerHTML = '<div class="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">Memuat riwayat log...</div>';
    }
    if (modalEl) modalEl.classList.remove('hidden');
    lucide.createIcons();

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            renderUserLogs(res.logs || []);
          } else {
            if (listEl) listEl.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat log.') + '</div>';
          }
        })
        .withFailureHandler((err) => {
          if (listEl) listEl.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</div>';
        })
        .getUserActivityLogs(state.user.username, cleanUser);
    }
  }

  function closeUserLogsModal() {
    const modalEl = document.getElementById('user-logs-modal');
    if (modalEl) modalEl.classList.add('hidden');
  }

  function renderUserLogs(logs) {
    const listEl = document.getElementById('user-logs-list');
    if (!listEl) return;

    if (logs.length === 0) {
      listEl.innerHTML = '<div class="py-10 text-center text-xs text-slate-400">Belum ada aktivitas tercatat untuk akun ini.</div>';
      return;
    }

    listEl.innerHTML = logs.map(log => {
      let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
      if (log.action === 'LOGIN') badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      else if (log.action.includes('DELETE')) badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      else if (log.action.includes('CREATE') || log.action.includes('UPDATE')) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

      return `
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeColor}">${log.action}</span>
              <span class="text-[11px] font-bold text-slate-700">${log.details || '-'}</span>
            </div>
            <p class="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              <span>${log.timestamp}</span>
            </p>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  let allSystemLogsData = [];
  let filteredSystemLogsData = [];
  let currentLogFilterAction = 'ALL';
  let currentLogSearchQuery = '';
  let currentLogPage = 1;
  let logsPerPage = 20;

  function getLogsSkeletonHtml() {
    return Array(6).fill(0).map(() => `
      <tr class="animate-pulse border-b border-slate-100 dark:border-slate-800">
        <td class="py-3.5 px-4"><div class="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/60 rounded font-mono"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-20 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
        <td class="py-3.5 px-4"><div class="h-5 w-16 bg-blue-100/60 dark:bg-blue-900/40 rounded-md"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
      </tr>
    `).join('');
  }

  function loadSystemLogs(isForceRefresh = false) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const tbody = document.getElementById('system-logs-table-body');
    const refreshBtn = document.getElementById('btn-refresh-logs');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    if (isForceRefresh || !allSystemLogsData || allSystemLogsData.length === 0) {
      if (tbody) {
        tbody.innerHTML = getLogsSkeletonHtml();
      }
    } else {
      applySystemLogsFiltering();
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success') {
            allSystemLogsData = res.logs || [];
            applySystemLogsFiltering();
          } else {
            if (tbody && (!allSystemLogsData || allSystemLogsData.length === 0)) {
              tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat log sistem.') + '</td></tr>';
            }
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (tbody && (!allSystemLogsData || allSystemLogsData.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-rose-500 font-semibold">Error server: ' + err.message + '</td></tr>';
          }
        })
        .getAllSystemActivityLogs(state.user.username);
    }
  }

  function filterSystemLogsByAction(action) {
    currentLogFilterAction = action;
    currentLogPage = 1; // Reset ke halaman pertama saat filter berubah

    document.querySelectorAll('.log-filter-chip').forEach(btn => {
      if (btn.getAttribute('data-action') === action) {
        btn.className = 'log-filter-chip px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white transition cursor-pointer shadow-2xs';
      } else {
        btn.className = 'log-filter-chip px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer';
      }
    });
    applySystemLogsFiltering();
  }

  function handleSearchSystemLogs(query) {
    currentLogSearchQuery = (query || '').toLowerCase().trim();
    currentLogPage = 1; // Reset ke halaman pertama saat pencarian berubah
    applySystemLogsFiltering();
  }

  function changeLogsPerPage(val) {
    logsPerPage = parseInt(val, 10) || 20;
    currentLogPage = 1;
    renderPaginatedLogs();
  }

  function changeLogPage(newPage) {
    const totalPages = Math.ceil(filteredSystemLogsData.length / logsPerPage) || 1;
    if (newPage < 1 || newPage > totalPages) return;
    currentLogPage = newPage;
    renderPaginatedLogs();
  }

  function applySystemLogsFiltering() {
    let filtered = allSystemLogsData || [];

    // Filter Kategori Action
    if (currentLogFilterAction !== 'ALL') {
      filtered = filtered.filter(l => (l.action || '').toUpperCase().includes(currentLogFilterAction));
    }

    // Filter Pencarian
    if (currentLogSearchQuery) {
      filtered = filtered.filter(l => 
        (l.username || '').toLowerCase().includes(currentLogSearchQuery) || 
        (l.details || '').toLowerCase().includes(currentLogSearchQuery) ||
        (l.action || '').toLowerCase().includes(currentLogSearchQuery)
      );
    }

    filteredSystemLogsData = filtered;
    renderPaginatedLogs();
  }

  function renderPaginatedLogs() {
    const totalItems = filteredSystemLogsData.length;
    const totalPages = Math.ceil(totalItems / logsPerPage) || 1;

    if (currentLogPage > totalPages) currentLogPage = totalPages;
    if (currentLogPage < 1) currentLogPage = 1;

    const startIndex = (currentLogPage - 1) * logsPerPage;
    const endIndex = Math.min(startIndex + logsPerPage, totalItems);
    const pageItems = filteredSystemLogsData.slice(startIndex, endIndex);

    // Render Baris Tabel
    renderSystemLogsTable(pageItems);

    // Update Teks Info Pagination
    const infoEl = document.getElementById('logs-pagination-info');
    if (infoEl) {
      if (totalItems === 0) {
        infoEl.innerText = 'Menampilkan 0 dari 0 aktivitas';
      } else {
        infoEl.innerText = 'Menampilkan ' + (startIndex + 1) + ' - ' + endIndex + ' dari ' + totalItems + ' aktivitas';
      }
    }

    // Render Tombol Pagination
    renderLogsPaginationControls(totalPages);
  }

  function renderSystemLogsTable(logs) {
    const tbody = document.getElementById('system-logs-table-body');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-xs text-slate-400">Tidak ada log aktivitas yang cocok dengan kriteria filter.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
      if (l.action === 'LOGIN') badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      else if (l.action.includes('DELETE')) badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      else if (l.action.includes('CREATE') || l.action.includes('UPDATE')) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

      return `
        <tr class="hover:bg-slate-50/70 transition">
          <td class="py-3 px-4 text-[11px] font-mono text-slate-500 whitespace-nowrap">${l.timestamp}</td>
          <td class="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] border border-slate-200/60">@${l.username}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeColor}">${l.action}</span>
          </td>
          <td class="py-3 px-4 text-xs text-slate-600 leading-snug">${l.details || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderLogsPaginationControls(totalPages) {
    const controlsEl = document.getElementById('logs-pagination-controls');
    if (!controlsEl) return;

    if (totalPages <= 1) {
      controlsEl.innerHTML = '';
      return;
    }

    let html = `
      <button 
        onclick="changeLogPage(${currentLogPage - 1})" 
        ${currentLogPage === 1 ? 'disabled' : ''}
        class="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
          currentLogPage === 1 ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer'
        } transition"
      >
        ‹ Prev
      </button>
    `;

    // Tampilkan tombol nomor halaman (Maksimal 5 nomor tombol dinamis)
    let startP = Math.max(1, currentLogPage - 2);
    let endP = Math.min(totalPages, startP + 4);
    if (endP - startP < 4) {
      startP = Math.max(1, endP - 4);
    }

    for (let p = startP; p <= endP; p++) {
      const isActive = p === currentLogPage;
      html += `
        <button 
          onclick="changeLogPage(${p})" 
          class="w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
            isActive 
              ? 'bg-blue-600 text-white shadow-2xs' 
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
          }"
        >
          ${p}
        </button>
      `;
    }

    html += `
      <button 
        onclick="changeLogPage(${currentLogPage + 1})" 
        ${currentLogPage === totalPages ? 'disabled' : ''}
        class="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold ${
          currentLogPage === totalPages ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer'
        } transition"
      >
        Next ›
      </button>
    `;

    controlsEl.innerHTML = html;
  }

  async function handleDeleteUser(targetUsername) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const cleanTarget = String(targetUsername).replace(/^@/, '').trim();

    // Konfirmasi dialog modal interaktif
    const confirmed = await showAppConfirm(
      'Hapus Akun Pengguna?',
      'Apakah Anda yakin ingin menghapus akun @' + cleanTarget + ' beserta seluruh riwayat chat, agenda jadwal, dan konfigurasinya secara permanen?',
      'warning'
    );

    if (!confirmed) return;

    setSyncStatus(true);

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          setSyncStatus(false);
          if (res && res.status === 'success') {
            showAppAlert('Akun Dihapus', 'Akun @' + cleanTarget + ' dan seluruh data terkait berhasil dihapus permanen.', 'success');
            loadUsersManagement();
          } else {
            showAppAlert('Gagal Menghapus', (res && res.message) ? res.message : 'Terjadi kesalahan sistem.', 'error');
          }
        })
        .withFailureHandler((err) => {
          setSyncStatus(false);
          showAppAlert('Error', err.message, 'error');
        })
        .deleteUserByAdmin(state.user.username, cleanTarget);
    }
  }

  let activeApiKeyTab = 'central';
  let allPoolKeysData = [];
  let filteredPoolKeysData = [];
  let currentPoolStatusFilter = 'ALL';
  let currentPoolSearchQuery = '';

  let allApiKeysData = [];
  let currentApiKeyFilter = 'ALL';
  let currentApiKeySearch = '';

  function switchApiKeyTab(tab) {
    activeApiKeyTab = tab;
    const btnCentral = document.getElementById('tab-btn-apikey-central');
    const btnUser = document.getElementById('tab-btn-apikey-user');
    const contCentral = document.getElementById('tab-content-central-keys');
    const contUser = document.getElementById('tab-content-user-keys');
    const btnAddPool = document.getElementById('btn-add-pool-key');

    if (tab === 'central') {
      if (btnCentral) btnCentral.className = 'px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-blue-600 text-white shadow-xs flex items-center gap-2';
      if (btnUser) btnUser.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer flex items-center gap-2';
      if (contCentral) contCentral.classList.remove('hidden');
      if (contUser) contUser.classList.add('hidden');
      if (btnAddPool) btnAddPool.classList.remove('hidden');
      loadCentralizedApiKeys();
    } else {
      if (btnCentral) btnCentral.className = 'px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer flex items-center gap-2';
      if (btnUser) btnUser.className = 'px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-blue-600 text-white shadow-xs flex items-center gap-2';
      if (contCentral) contCentral.classList.add('hidden');
      if (contUser) contUser.classList.remove('hidden');
      if (btnAddPool) btnAddPool.classList.add('hidden');
      loadApiKeysManagement();
    }
    lucide.createIcons();
  }

  function getApiKeysSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <tr class="animate-pulse border-b border-slate-100 dark:border-slate-800">
        <td class="py-3.5 px-4"><div class="h-4 w-36 bg-slate-200 dark:bg-slate-700/60 rounded-md"></div></td>
        <td class="py-3.5 px-4"><div class="h-5 w-16 bg-emerald-100/60 dark:bg-emerald-900/40 rounded-md"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-20 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-28 bg-slate-200 dark:bg-slate-700/60 rounded font-mono"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
        <td class="py-3.5 px-4 text-right"><div class="h-7 w-16 bg-slate-200 dark:bg-slate-700/60 rounded-xl ml-auto"></div></td>
      </tr>
    `).join('');
  }

  function refreshCurrentApiKeyTab(isForce = false) {
    if (activeApiKeyTab === 'central') {
      loadCentralizedApiKeys(isForce);
    } else {
      loadApiKeysManagement(isForce);
    }
  }

  // ==================== POOL KUNCI TERPUSAT CONTROLLER ====================
  function loadCentralizedApiKeys(isForceRefresh = false) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const tbody = document.getElementById('pool-keys-table-body');
    const refreshBtn = document.getElementById('btn-refresh-apikeys');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    if (isForceRefresh || !allPoolKeysData || allPoolKeysData.length === 0) {
      if (tbody) {
        tbody.innerHTML = getApiKeysSkeletonHtml();
      }
    } else {
      applyPoolKeysFilter();
      updatePoolKeyStats();
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success') {
            allPoolKeysData = res.data || [];
            applyPoolKeysFilter();
          } else {
            if (!allPoolKeysData || allPoolKeysData.length === 0) {
              allPoolKeysData = [];
              updatePoolKeyStats();
              if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs text-rose-500 font-semibold">' + ((res && res.message) ? res.message : 'Gagal memuat data dari spreadsheet.') + '</td></tr>';
              }
            }
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (!allPoolKeysData || allPoolKeysData.length === 0) {
            allPoolKeysData = [];
            updatePoolKeyStats();
            if (tbody) {
              tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs text-rose-500 font-semibold">Koneksi Error: ' + err.message + '</td></tr>';
            }
          }
        })
        .getCentralizedApiKeys(state.user.username);
    }
  }

  function filterPoolKeysByStatus(status) {
    currentPoolStatusFilter = status;
    document.querySelectorAll('.pool-filter-chip').forEach(btn => {
      const match = btn.getAttribute('data-status') === status;
      btn.className = match 
        ? 'pool-filter-chip px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white' 
        : 'pool-filter-chip px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200';
    });
    applyPoolKeysFilter();
  }

  function handleSearchPoolKeys(query) {
    currentPoolSearchQuery = (query || '').toLowerCase().trim();
    applyPoolKeysFilter();
  }

  function updatePoolKeyStats() {
    const list = allPoolKeysData || [];
    let total = list.length;
    let active = 0;
    let standby = 0;
    let failed = 0;

    list.forEach(k => {
      const st = String(k.status || '').toLowerCase().trim();
      if (st === 'aktif') active++;
      else if (st === 'standby') standby++;
      else if (st === 'tidak berfungsi') failed++;
    });

    const elTotal = document.getElementById('stat-pool-total');
    const elActive = document.getElementById('stat-pool-active');
    const elStandby = document.getElementById('stat-pool-standby');
    const elFailed = document.getElementById('stat-pool-failed');

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = active;
    if (elStandby) elStandby.innerText = standby;
    if (elFailed) elFailed.innerText = failed;
  }

  function applyPoolKeysFilter() {
    updatePoolKeyStats();

    let list = allPoolKeysData || [];

    if (currentPoolStatusFilter !== 'ALL') {
      list = list.filter(item => item.status.toLowerCase() === currentPoolStatusFilter.toLowerCase());
    }

    if (currentPoolSearchQuery) {
      list = list.filter(item => 
        item.label.toLowerCase().includes(currentPoolSearchQuery) ||
        item.apiKey.toLowerCase().includes(currentPoolSearchQuery)
      );
    }

    renderPoolKeysTable(list);
  }

  function renderPoolKeysTable(list) {
    const tbody = document.getElementById('pool-keys-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-xs text-slate-400">Tidak ada kunci yang cocok dengan kriteria.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => {
      let statusBadge = 'bg-amber-50 text-amber-600 border-amber-200';
      if (item.status === 'Aktif') statusBadge = 'bg-emerald-50 text-emerald-600 border-emerald-200';
      else if (item.status === 'Tidak Berfungsi') statusBadge = 'bg-rose-50 text-rose-600 border-rose-200';

      const maskedKey = item.apiKey.length > 10 
        ? (item.apiKey.substring(0, 8) + '••••••••' + item.apiKey.slice(-4)) 
        : item.apiKey;

      // Logika Warna Progress Bar Sisa Kuota
      const pct = item.remainingPercent !== undefined ? item.remainingPercent : 100;
      let barColor = 'bg-emerald-500';
      let textColor = 'text-emerald-600 dark:text-emerald-400';
      if (pct <= 20) {
        barColor = 'bg-rose-500';
        textColor = 'text-rose-600';
      } else if (pct <= 50) {
        barColor = 'bg-amber-500';
        textColor = 'text-amber-500';
      }

      const calls = item.callsToday || 0;
      const cap = item.dailyCap || 1500;

      return `
        <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 whitespace-nowrap">
            <p class="font-bold text-slate-800 dark:text-slate-100 text-xs">${item.label}</p>
            <span class="text-xs font-mono text-slate-400">${maskedKey}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${statusBadge}">${item.status}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-xs font-mono text-slate-800 dark:text-slate-200">${item.totalModels} Model</span>
              ${item.totalModels > 0 ? `
                <button 
                  onclick="viewModelsDetail('${item.id}')" 
                  class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                >
                  Lihat Detil →
                </button>
              ` : ''}
            </div>
          </td>
          
          <td class="py-3 px-4 whitespace-nowrap min-w-[200px]">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-mono text-[11px] text-slate-600 dark:text-slate-300 font-bold">${calls} / ${cap}</span>
                <span class="font-mono font-extrabold text-[11px] ${textColor}">${pct}% Sisa</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div class="h-full ${barColor} rounded-full transition-all duration-300" style="width: ${pct}%"></div>
              </div>

              
              <div class="flex flex-wrap gap-1 pt-0.5">
                ${Object.keys(item.modelUsage || {}).length === 0 
                  ? '<span class="text-[9px] text-slate-400 italic">Belum ada panggilan</span>' 
                  : Object.keys(item.modelUsage).map(m => `
                      <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        ${m.replace('gemini-', '')}: <b>${item.modelUsage[m]}</b>
                      </span>
                    `).join('')
                }
              </div>
            </div>
          </td>
          <td class="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
            ${item.lastChecked}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1">
              <button 
                id="btn-inspect-${item.id}"
                onclick="runInspectKey('${item.id}')" 
                title="Cek Validitas & Model" 
                class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <i data-lucide="scan" class="w-3.5 h-3.5"></i>
                <span>Inspeksi</span>
              </button>
              <button 
                onclick="copyUserApiKey('${item.apiKey}')" 
                title="Salin Key" 
                class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
              <button 
                onclick="openEditPoolKeyModal('${item.id}', '${item.label}', '${item.apiKey}', '${item.status}')" 
                title="Edit Kunci" 
                class="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
              >
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button 
                onclick="handleDeletePoolKey('${item.id}', '${item.label}')" 
                title="Hapus Kunci" 
                class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  function runInspectKey(keyId) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const btn = document.getElementById('btn-inspect-' + keyId);
    if (btn) btn.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            showAppAlert(
              'Kunci Valid & Aktif', 
              'API Key berfungsi dengan baik. Ditemukan ' + res.totalModels + ' model Gemini yang siap digunakan.', 
              'success'
            );
          } else {
            showAppAlert('Kunci Bermasalah', res.message || 'API Key tidak merespons.', 'error');
          }
          loadCentralizedApiKeys();
        })
        .withFailureHandler((err) => {
          showAppAlert('Error Koneksi', err.message, 'error');
          loadCentralizedApiKeys();
        })
        .inspectAndUpdateApiKey(state.user.username, keyId);
    }
  }

  function viewModelsDetail(keyId) {
    const modal = document.getElementById('models-detail-modal');
    const title = document.getElementById('models-detail-title');
    const sub = document.getElementById('models-detail-subtitle');
    const list = document.getElementById('models-detail-list');

    if (title) title.innerText = 'Memuat Daftar Model...';
    if (sub) sub.innerText = 'Menghubungkan ke database...';
    if (list) list.innerHTML = '<div class="py-10 text-center text-xs text-slate-400 animate-pulse">Mengambil data model...</div>';
    if (modal) modal.classList.remove('hidden');

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            if (title) title.innerText = 'Model Aktif: ' + res.label;
            if (sub) sub.innerText = res.totalModels + ' model terdeteksi via Gemini API';
            if (list) {
              list.innerHTML = (res.models || []).map(m => `
                <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <p class="font-bold text-xs text-slate-800 font-mono">${m.id}</p>
                    <p class="text-[11px] text-slate-500">${m.displayName}</p>
                  </div>
                  <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold text-[10px] border border-emerald-200 shrink-0">
                    generateContent
                  </span>
                </div>
              `).join('');
            }
          } else {
            if (list) list.innerHTML = '<div class="py-6 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat detail.') + '</div>';
          }
          lucide.createIcons();
        })
        .withFailureHandler((err) => {
          if (list) list.innerHTML = '<div class="py-6 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</div>';
        })
        .getKeyModelsDetail(state.user.username, keyId);
    }
  }

  function closeModelsDetailModal() {
    const modal = document.getElementById('models-detail-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openAddPoolKeyModal() {
    document.getElementById('pool-key-modal-title').innerText = 'Tambah Kunci Pool Baru';
    document.getElementById('modal-pool-key-id').value = '';
    document.getElementById('modal-pool-key-label').value = '';
    document.getElementById('modal-pool-key-value').value = '';
    document.getElementById('modal-pool-key-status').value = 'Standby';
    document.getElementById('pool-key-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function openEditPoolKeyModal(id, label, keyVal, status) {
    document.getElementById('pool-key-modal-title').innerText = 'Edit Kunci Pool';
    document.getElementById('modal-pool-key-id').value = id;
    document.getElementById('modal-pool-key-label').value = label;
    document.getElementById('modal-pool-key-value').value = keyVal;
    document.getElementById('modal-pool-key-status').value = status || 'Standby';
    document.getElementById('pool-key-modal').classList.remove('hidden');
    lucide.createIcons();
  }

  function closePoolKeyModal() {
    const modal = document.getElementById('pool-key-modal');
    if (modal) modal.classList.add('hidden');
  }

  function handleSavePoolKeyForm(e) {
    e.preventDefault();
    const btn = document.getElementById('save-pool-key-btn');
    if (btn) btn.innerText = 'Menyimpan...';

    const payload = {
      id: document.getElementById('modal-pool-key-id').value,
      label: document.getElementById('modal-pool-key-label').value.trim(),
      api_key: document.getElementById('modal-pool-key-value').value.trim(),
      status: document.getElementById('modal-pool-key-status').value
    };

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerText = 'Simpan Kunci';
          if (res && res.status === 'success') {
            closePoolKeyModal();
            showAppAlert('Berhasil', 'Data kunci pool berhasil disimpan.', 'success');
            loadCentralizedApiKeys();
          } else {
            showAppAlert('Gagal', res.message || 'Gagal menyimpan.', 'error');
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerText = 'Simpan Kunci';
          showAppAlert('Error', err.message, 'error');
        })
        .saveCentralizedApiKey(state.user.username, payload);
    }
  }

  async function handleDeletePoolKey(keyId, label) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const confirmed = await showAppConfirm(
      'Hapus Kunci Pool?',
      'Apakah Anda yakin ingin menghapus kunci "' + label + '" dari repositori terpusat?',
      'warning'
    );
    if (!confirmed) return;

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            showAppAlert('Terhapus', 'Kunci pool berhasil dihapus.', 'info');
            loadCentralizedApiKeys();
          } else {
            showAppAlert('Gagal', res.message || 'Gagal menghapus.', 'error');
          }
        })
        .deleteCentralizedApiKey(state.user.username, keyId);
    }
  }

  function loadApiKeysManagement() {
    if (!state.user || state.user.role !== 'superadmin') return;

    const tbody = document.getElementById('apikeys-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-xs text-slate-400 font-semibold animate-pulse">Memuat database API key...</td></tr>';
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            allApiKeysData = res.data || [];
            applyApiKeysFilter();
          } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat API Key.') + '</td></tr>';
          }
        })
        .withFailureHandler((err) => {
          if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</td></tr>';
        })
        .getAllApiKeysData(state.user.username);
    }
  }

  function filterApiKeysByStatus(status) {
    currentApiKeyFilter = status;
    document.querySelectorAll('.apikey-filter-chip').forEach(btn => {
      const match = btn.getAttribute('data-status') === status;
      btn.className = match 
        ? 'apikey-filter-chip px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white' 
        : 'apikey-filter-chip px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200';
    });
    applyApiKeysFilter();
  }

  function handleSearchApiKeys(query) {
    currentApiKeySearch = (query || '').toLowerCase().trim();
    applyApiKeysFilter();
  }

  function applyApiKeysFilter() {
    let list = allApiKeysData || [];

    if (currentApiKeyFilter === 'ACTIVE') {
      list = list.filter(item => item.hasKey);
    } else if (currentApiKeyFilter === 'EMPTY') {
      list = list.filter(item => !item.hasKey);
    }

    if (currentApiKeySearch) {
      list = list.filter(item => 
        item.username.toLowerCase().includes(currentApiKeySearch) ||
        item.name.toLowerCase().includes(currentApiKeySearch) ||
        item.apiKey.toLowerCase().includes(currentApiKeySearch)
      );
    }

    renderApiKeysTable(list);
  }

  function renderApiKeysTable(list) {
    const tbody = document.getElementById('apikeys-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-xs text-slate-400">Tidak ada data yang cocok.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => {
      const maskedKey = item.hasKey 
        ? (item.apiKey.substring(0, 7) + '••••••••' + item.apiKey.slice(-4)) 
        : '<span class="text-rose-500 font-normal italic">Belum diatur</span>';

      return `
        <tr class="hover:bg-slate-50/70 transition">
          <td class="py-3 px-4 whitespace-nowrap">
            <p class="font-bold text-slate-800">${item.name}</p>
            <span class="text-[11px] font-mono text-slate-400">@${item.username}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${item.hasKey ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}">
                ${item.hasKey ? 'Aktif' : 'Kosong'}
              </span>
              <span class="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">${item.model}</span>
            </div>
          </td>
          <td class="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
            ${maskedKey}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1">
              ${item.hasKey ? `
                <button onclick="copyUserApiKey('${item.apiKey}')" title="Salin Key" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
              <button onclick="openEditUserModal('${item.username}', '${item.name}', '${item.role}', 'Aktif', '${item.apiKey.replace(/'/g, "\\'")}', '${item.model || 'gemini-2.5-flash'}')" title="Edit Kunci & Akun" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  function openTagManagerModal() {
    renderTagManagerList();
    const modal = document.getElementById('tag-manager-modal');
    if (modal) modal.classList.remove('hidden');
    lucide.createIcons();
  }

  function closeTagManagerModal() {
    const modal = document.getElementById('tag-manager-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderTagManagerList() {
    const listEl = document.getElementById('user-tags-manager-list');
    if (!listEl) return;

    // Hitung jumlah sesi per tag milik user saat ini
    const tagCountMap = {};
    (state.sessions || []).forEach(s => {
      const t = (s.tag || 'Umum').trim();
      tagCountMap[t] = (tagCountMap[t] || 0) + 1;
    });

    const tags = Object.keys(tagCountMap).filter(t => t.toLowerCase() !== 'umum');

    if (tags.length === 0) {
      listEl.innerHTML = `
        <div class="py-8 text-center space-y-1">
          <p class="text-xs font-bold text-slate-600">Belum Ada Tag Kustom</p>
          <p class="text-[11px] text-slate-400">Seluruh sesi Anda masih menggunakan tag bawaan "Umum".</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = tags.map(tag => `
      <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3" id="tag-row-${tag}">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-800">${tag}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200/60 font-mono">
              ${tagCountMap[tag]} Sesi
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button 
            type="button" 
            onclick="promptEditTag('${tag}')" 
            title="Ubah Nama Tag" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
          <button 
            type="button" 
            onclick="confirmDeleteTag('${tag}')" 
            title="Hapus Tag (Sesi dialihkan ke Umum)" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');

    lucide.createIcons();
  }

  async function promptEditTag(oldTag) {
    const modal = document.getElementById('edit-tag-input-modal');
    const card = document.getElementById('edit-tag-card');
    const oldInput = document.getElementById('edit-tag-old-name');
    const newInput = document.getElementById('edit-tag-new-name');

    if (!modal || !newInput) return;

    oldInput.value = oldTag;
    newInput.value = oldTag;

    modal.classList.remove('hidden');
    setTimeout(() => {
      if (card) {
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
      }
      newInput.focus();
      newInput.select();
    }, 20);

    lucide.createIcons();
  }

  function closeEditTagModal() {
    const modal = document.getElementById('edit-tag-input-modal');
    const card = document.getElementById('edit-tag-card');
    if (card) {
      card.classList.remove('scale-100');
      card.classList.add('scale-95');
    }
    setTimeout(() => {
      if (modal) modal.classList.add('hidden');
    }, 150);
  }

  function handleSaveEditTagModal(e) {
    e.preventDefault();
    const oldTag = document.getElementById('edit-tag-old-name').value.trim();
    const newTag = document.getElementById('edit-tag-new-name').value.trim();
    const btn = document.getElementById('btn-confirm-save-tag');

    if (!newTag || newTag.toLowerCase() === oldTag.toLowerCase()) {
      closeEditTagModal();
      return;
    }

    if (btn) btn.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>';

    closeEditTagModal();
    setSyncStatus(true);

    // Optimistic Update lokal seketika
    (state.sessions || []).forEach(s => {
      if ((s.tag || 'Umum').toLowerCase() === oldTag.toLowerCase()) {
        s.tag = newTag;
      }
    });
    if (state.selectedTagFilter && state.selectedTagFilter.toLowerCase() === oldTag.toLowerCase()) {
      state.selectedTagFilter = newTag;
    }
    renderUI();
    renderTagManagerList();

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          setSyncStatus(false);
          if (btn) btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Simpan</span>';
          if (res && res.status === 'success') {
            showAppAlert('Tag Diperbarui', 'Nama tag berhasil diubah.', 'success');
          } else {
            showAppAlert('Gagal', res.message || 'Gagal mengubah tag.', 'error');
            refreshData();
          }
        })
        .withFailureHandler((err) => {
          setSyncStatus(false);
          if (btn) btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Simpan</span>';
          showAppAlert('Error', err.message, 'error');
          refreshData();
        })
        .renameUserSessionTag(state.user.username, oldTag, newTag);
    }
  }

  async function confirmDeleteTag(tagToDelete) {
    const confirmed = await showAppConfirm(
      'Hapus Tag "' + tagToDelete + '"?',
      'Tag ini akan dihapus. Semua sesi yang menggunakan tag ini akan dikembalikan ke tag "Umum" tanpa menghapus riwayat chat-nya.',
      'warning'
    );
    if (!confirmed) return;

    setSyncStatus(true);

    // Optimistic update lokal
    (state.sessions || []).forEach(s => {
      if ((s.tag || 'Umum').toLowerCase() === tagToDelete.toLowerCase()) {
        s.tag = 'Umum';
      }
    });
    if (state.selectedTagFilter && state.selectedTagFilter.toLowerCase() === tagToDelete.toLowerCase()) {
      state.selectedTagFilter = 'ALL';
    }
    renderUI();
    renderTagManagerList();

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          setSyncStatus(false);
          if (res && res.status === 'success') {
            showAppAlert('Tag Dihapus', 'Tag berhasil dihapus dan sesi dikembalikan ke "Umum".', 'info');
          } else {
            showAppAlert('Gagal', res.message || 'Gagal menghapus tag.', 'error');
            refreshData();
          }
        })
        .withFailureHandler((err) => {
          setSyncStatus(false);
          showAppAlert('Error', err.message, 'error');
          refreshData();
        })
        .deleteUserSessionTag(state.user.username, tagToDelete);
    }
  }

  let allChangelogsList = [];
  let isChangelogEditorMode = false;

  function getChangelogSkeletonHtml() {
    return Array(3).fill(0).map(() => `
      <div class="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 animate-pulse space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="h-6 w-20 bg-slate-200 dark:bg-slate-700/60 rounded-lg"></div>
            <div class="h-5 w-14 bg-blue-100/60 dark:bg-blue-900/40 rounded-md"></div>
          </div>
          <div class="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
        </div>
        <div class="space-y-2 pt-1">
          <div class="h-3.5 w-full bg-slate-200 dark:bg-slate-700/60 rounded"></div>
          <div class="h-3.5 w-5/6 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
          <div class="h-3.5 w-4/6 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
        </div>
      </div>
    `).join('');
  }

  function loadChangelogData(isForceRefresh = false) {
    const isSuper = state.user && String(state.user.role).toLowerCase() === 'superadmin';
    const actionBar = document.getElementById('changelog-admin-action-bar');
    const container = document.getElementById('changelog-public-cards-container');
    const refreshBtn = document.getElementById('btn-refresh-changelog');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (actionBar) {
      actionBar.classList.toggle('hidden', !isSuper);
    }

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    if (isForceRefresh || !allChangelogsList || allChangelogsList.length === 0) {
      if (container) {
        container.innerHTML = getChangelogSkeletonHtml();
      }
    } else {
      renderChangelogPublicCards();
      renderChangelogEditorCards();
      updateTopActiveVersion();
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success') {
            allChangelogsList = res.data || [];
            renderChangelogPublicCards();
            renderChangelogEditorCards();
            updateTopActiveVersion();
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          console.warn('Gagal memuat changelog:', err);
        })
        .getAppChangelogs();
    }
  }

  function toggleChangelogAdminView() {
    isChangelogEditorMode = !isChangelogEditorMode;
    const publicView = document.getElementById('changelog-view-card');
    const editorView = document.getElementById('changelog-editor-view');
    const labelToggle = document.getElementById('label-toggle-changelog-mode');

    if (isChangelogEditorMode) {
      if (publicView) publicView.classList.add('hidden');
      if (editorView) editorView.classList.remove('hidden');
      if (labelToggle) labelToggle.innerText = 'Tutup Editor (Lihat Preview)';
      renderChangelogEditorCards();
    } else {
      if (publicView) publicView.classList.remove('hidden');
      if (editorView) editorView.classList.add('hidden');
      if (labelToggle) labelToggle.innerText = 'Kelola Versi & Rilis';
      renderChangelogPublicCards();
    }
    lucide.createIcons();
  }

  function updateTopActiveVersion() {
    const topItem = allChangelogsList[0] || { version: 'v2.6.0' };
    const viewBadge = document.getElementById('view-active-version-badge');
    const sideBadge = document.getElementById('sidebar-version-badge');
    const editorDisplay = document.getElementById('editor-active-version-display');
    const totalBadge = document.getElementById('view-total-releases-badge');

    if (viewBadge) viewBadge.innerText = 'Version [ ' + topItem.version + ' ]';
    if (sideBadge) sideBadge.innerText = topItem.version;
    if (editorDisplay) editorDisplay.innerText = '[ ' + topItem.version + ' ]';
    if (totalBadge) totalBadge.innerText = allChangelogsList.length + ' Rilis';
  }

  // Render Tampilan Clean Blue Siswa / Umum
  function renderChangelogPublicCards() {
    const container = document.getElementById('changelog-public-cards-container');
    if (!container) return;

    if (allChangelogsList.length === 0) {
      container.innerHTML = '<div class="py-8 text-center text-xs text-slate-400">Belum ada catatan rilis.</div>';
      return;
    }

    container.innerHTML = allChangelogsList.map((item, idx) => {
      const isLatest = idx === 0;
      const formattedHtml = typeof marked !== 'undefined' ? marked.parse(item.content || '') : item.content;

      return `
        <div class="p-4 sm:p-5 rounded-2xl border ${isLatest ? 'border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/40 ring-1 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'} space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${isLatest ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
                [ ${item.version} ]
              </span>
              ${isLatest ? '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase">Terbaru</span>' : ''}
            </div>
            <span class="text-xs text-slate-400 dark:text-slate-400 font-mono font-medium">${item.releaseDate || '-'}</span>
          </div>

          <div class="text-xs text-slate-700 leading-relaxed markdown-content">
            ${formattedHtml}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  // Render Tampilan Editor Super Admin (Clean Blue & Slate)
  function renderChangelogEditorCards() {
    const container = document.getElementById('changelog-editor-cards-container');
    if (!container) return;

    if (allChangelogsList.length === 0) {
      addNewChangelogEditorItem();
      return;
    }

    container.innerHTML = allChangelogsList.map((item, idx) => {
      const isTop = idx === 0;
      return `
        <div class="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs" id="editor-card-${idx}">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                #${idx + 1}
              </span>
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${isTop ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600'}">
                ${isTop ? 'Aktif' : 'Arsip'}
              </span>
            </div>

            <div class="flex-1 max-w-xs">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Versi Rilis</label>
              <input 
                type="text" 
                id="edit-ver-${idx}" 
                value="${item.version}" 
                oninput="syncEditorMemory(${idx})"
                class="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500 focus:bg-white transition"
                placeholder="[ ISI NOMOR VERSION ]"
              >
            </div>

            <div class="flex-1 max-w-xs">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Tanggal Rilis</label>
              <input 
                type="text" 
                id="edit-date-${idx}" 
                value="${item.releaseDate}" 
                oninput="syncEditorMemory(${idx})"
                class="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500 focus:bg-white transition"
                placeholder="23-Oct-2026"
              >
            </div>

            <button 
              type="button" 
              onclick="removeChangelogEditorItem(${idx})" 
              title="Hapus Versi" 
              class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            >
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Catatan Perubahan (Mendukung format Markdown: ### Header, **Tebal**, * Poin)
            </label>
            <textarea 
              id="edit-content-${idx}" 
              rows="4" 
              oninput="syncEditorMemory(${idx})"
              class="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 focus:bg-white leading-relaxed transition"
            >${item.content}</textarea>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  function syncEditorMemory(idx) {
    const verEl = document.getElementById('edit-ver-' + idx);
    const dateEl = document.getElementById('edit-date-' + idx);
    const contentEl = document.getElementById('edit-content-' + idx);

    if (allChangelogsList[idx]) {
      if (verEl) allChangelogsList[idx].version = verEl.value.trim();
      if (dateEl) allChangelogsList[idx].releaseDate = dateEl.value.trim();
      if (contentEl) allChangelogsList[idx].content = contentEl.value;
    }
    updateTopActiveVersion();
  }

  function addNewChangelogEditorItem() {
    // 1. Simpan input yang sedang diketik user sebelum menambah baris baru
    allChangelogsList.forEach((_, i) => syncEditorMemory(i));

    // 2. Generate tanggal client-side secara aman tanpa objek backend Utilities
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = String(now.getDate()).padStart(2, '0') + '-' + months[now.getMonth()] + '-' + now.getFullYear();

    // 3. Tambahkan baris versi rilis baru di urutan paling atas
    allChangelogsList.unshift({
      id: 'chg_' + new Date().getTime(),
      version: 'v' + (allChangelogsList.length + 1) + '.0.0',
      releaseDate: formattedDate,
      content: '### Fitur Baru & Peningkatan:\n* Pembaruan sistem dan performa.',
      isActive: true,
      order: 1
    });

    renderChangelogEditorCards();
    updateTopActiveVersion();

    // 4. Fokuskan kursor otomatis ke input versi baru yang baru saja ditambahkan
    setTimeout(() => {
      const firstInput = document.getElementById('edit-ver-0');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 50);
  }

  async function removeChangelogEditorItem(idx) {
    // Gunakan modal konfirmasi modern Orbit Assistant
    const confirmed = await showAppConfirm(
      'Hapus Rilis Versi?',
      'Apakah Anda yakin ingin menghapus catatan rilis versi ini dari daftar?',
      'warning'
    );
    if (!confirmed) return;

    allChangelogsList.splice(idx, 1);
    renderChangelogEditorCards();
    updateTopActiveVersion();
  }

  function handleSaveAllChangelogs() {
    if (!state.user || state.user.role !== 'superadmin') return;

    // Pastikan seluruh data di input ter-update ke memori
    allChangelogsList.forEach((_, idx) => syncEditorMemory(idx));

    const btn = document.getElementById('btn-save-changelogs-all');
    if (btn) btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Menyimpan...';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Pengaturan Website</span>';
          if (res && res.status === 'success') {
            showAppAlert('Tersimpan', 'Seluruh riwayat Changelog berhasil diperbarui dan aktif.', 'success');
            toggleChangelogAdminView(); // Kembali ke mode preview resmi
          } else {
            showAppAlert('Gagal', (res ? res.message : 'Gagal menyimpan.'), 'error');
          }
          lucide.createIcons();
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Pengaturan Website</span>';
          showAppAlert('Error', err.message, 'error');
          lucide.createIcons();
        })
        .saveAppChangelogs(state.user.username, allChangelogsList);
    }
  }

  // ==================== 13. GLOBAL FULL-TEXT SEARCH CONTROLLER ====================
  function openGlobalSearchModal() {
    const modal = document.getElementById('global-search-modal');
    const input = document.getElementById('global-search-input');
    if (modal) modal.classList.remove('hidden');
    if (input) {
      input.focus();
      input.select();
    }
    lucide.createIcons();
  }

  function closeGlobalSearchModal() {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.classList.add('hidden');
  }

  function triggerGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const resultsBox = document.getElementById('global-search-results');
    const query = input ? input.value.trim() : '';

    if (!query || query.length < 2) {
      showAppAlert('Kata Kunci Terlalu Pendek', 'Ketik minimal 2 karakter untuk pencarian.', 'warning');
      return;
    }

    if (resultsBox) {
      resultsBox.innerHTML = '<div class="py-12 text-center text-xs text-slate-400 animate-pulse">Mencari percakapan di seluruh database...</div>';
    }

    if (typeof google !== 'undefined' && google.script && google.script.run && state.user) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            renderGlobalSearchResults(res.results || [], query);
          } else {
            if (resultsBox) resultsBox.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-semibold">Gagal mencari pesan.</div>';
          }
        })
        .withFailureHandler((err) => {
          if (resultsBox) resultsBox.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</div>';
        })
        .searchAllUserChats(state.user.username, query);
    }
  }

  function renderGlobalSearchResults(results, query) {
    const resultsBox = document.getElementById('global-search-results');
    if (!resultsBox) return;

    if (results.length === 0) {
      resultsBox.innerHTML = `
        <div class="py-10 text-center space-y-1">
          <p class="text-xs font-bold text-slate-700">Tidak ada hasil ditemukan</p>
          <p class="text-[11px] text-slate-400">Tidak ada pesan yang cocok dengan "${query}".</p>
        </div>
      `;
      return;
    }

    resultsBox.innerHTML = results.map(item => {
      const isUser = item.role === 'user';
      // Highlight kata kunci yang cocok dengan tag mark kuning
      const regex = new RegExp(`(${query})`, 'gi');
      const highlightedMsg = (item.message || '').replace(regex, '<mark class="bg-amber-200 text-slate-900 rounded px-0.5 font-bold">$1</mark>');

      return `
        <div 
          onclick="jumpToSessionFromSearch('${item.sessionId}')" 
          class="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-2xl transition cursor-pointer space-y-1.5"
        >
          <div class="flex items-center justify-between text-[10px]">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-extrabold text-blue-600 truncate max-w-[180px]">${item.sessionTitle}</span>
              <span class="px-1.5 py-0.5 rounded border bg-white text-slate-500 font-semibold">${item.sessionTag}</span>
            </div>
            <span class="text-slate-400 font-mono">${item.timestamp}</span>
          </div>
          <p class="text-xs text-slate-700 leading-relaxed line-clamp-3">
            <b class="${isUser ? 'text-blue-600' : 'text-slate-900'}">${isUser ? 'Siswa: ' : 'Orbit AI: '}</b>
            ${highlightedMsg}
          </p>
        </div>
      `;
    }).join('');
  }

  function jumpToSessionFromSearch(sessionId) {
    closeGlobalSearchModal();
    switchChatSession(sessionId);
    showAppAlert('Sesi Dibuka', 'Berhasil beralih ke sesi percakapan yang dipilih.', 'info');
  }

  // ==================== 14. DARK MODE CONTROLLER ====================
  function initTheme() {
    const savedTheme = localStorage.getItem('orbit_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    applyTheme(isDark);
  }

  function toggleDarkMode() {
    const isDarkNow = document.documentElement.classList.contains('dark');
    applyTheme(!isDarkNow);
  }

  function applyTheme(isDark) {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const switchInput = document.getElementById('sidebar-darkmode-switch');

    if (isDark) {
      htmlEl.classList.add('dark');
      bodyEl.classList.add('dark');
      localStorage.setItem('orbit_theme', 'dark');
      if (switchInput) switchInput.checked = true;

      document.querySelectorAll('.theme-icon-moon').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.theme-icon-sun').forEach(el => el.classList.remove('hidden'));
    } else {
      htmlEl.classList.remove('dark');
      bodyEl.classList.remove('dark');
      localStorage.setItem('orbit_theme', 'light');
      if (switchInput) switchInput.checked = false;

      document.querySelectorAll('.theme-icon-moon').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.theme-icon-sun').forEach(el => el.classList.add('hidden'));
    }

    lucide.createIcons();
  }

  // Toggle Lihat / Sembunyikan Kata Sandi
  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = '<i data-lucide="' + (isPass ? 'eye-off' : 'eye') + '" class="w-4 h-4"></i>';
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  // 1. Salin Prompt Pesan User ke Clipboard
  function handleCopyUserPrompt(index) {
    const targetChat = (state.chats || [])[index];
    if (!targetChat || !targetChat.message) return;

    navigator.clipboard.writeText(targetChat.message)
      .then(() => {
        showAppAlert('Prompt Disalin', 'Pertanyaan Anda berhasil disalin ke clipboard.', 'info');
      })
      .catch(() => {
        showAppAlert('Gagal Menyalin', 'Izin clipboard diblokir pada browser Anda.', 'error');
      });
  }

  // 2. Edit Prompt Pesan User dan Masukkan ke Input Box
  function handleEditUserPrompt(index) {
    const targetChat = (state.chats || [])[index];
    if (!targetChat || !targetChat.message) return;

    const fullInput = document.getElementById('chat-input-full');
    const dashInput = document.getElementById('chat-input-dashboard');

    // Isi kedua input chat agar tersinkronisasi
    if (fullInput) {
      fullInput.value = targetChat.message;
      autoResizeChatInput(fullInput);
    }
    if (dashInput) {
      dashInput.value = targetChat.message;
      autoResizeChatInput(dashInput);
    }

    // Fokuskan kursor otomatis ke input aktif
    const activeInput = state.currentPage === 'chat' ? fullInput : dashInput;
    if (activeInput) {
      activeInput.focus();
      // Pindahkan posisi kursor ke akhir teks
      activeInput.setSelectionRange(activeInput.value.length, activeInput.value.length);
    }

    showAppAlert('Prompt Dimuat', 'Pertanyaan telah dimasukkan ke kotak input. Silakan modifikasi dan kirim kembali.', 'info');
  }

  // ==================== 15. TYPING STREAM EFFECT ENGINE ====================
  function typeAssistantResponseStream(fullText, timestamp) {
    if (!fullText) return;

    // 1. Masukkan kerangka balasan baru ke state.chats
    const newChatIndex = state.chats.length;
    state.chats.push({
      role: 'assistant',
      message: '',
      timestamp: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // 2. Render antarmuka dasar pesan
    renderChatMessages();

    // 3. Cari kontainer teks pesan asisten yang baru dirender
    const dashBox = document.getElementById('chat-messages-dashboard');
    const fullBox = document.getElementById('chat-messages-full');
    const targetDashEl = dashBox ? dashBox.querySelector('#chat-raw-msg-' + newChatIndex) : null;
    const targetFullEl = fullBox ? fullBox.querySelector('#chat-raw-msg-' + newChatIndex) : null;

    // 4. Pecah teks menjadi token kata agar ritme ketikan natural
    const words = fullText.split(' ');
    let currentWordIndex = 0;
    let accumulatedText = '';

    // Kecepatan adaptif (antara 18ms - 35ms per token)
    const streamSpeed = Math.max(16, Math.min(32, Math.floor(1800 / (words.length || 1))));

    const streamInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        accumulatedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        currentWordIndex++;

        // Render Markdown sementara ditambah kursor berkedip biru
        const parsedTempHtml = marked.parse(accumulatedText) + '<span class="inline-block w-1.5 h-3.5 bg-blue-600 dark:bg-blue-400 ml-1 animate-pulse rounded-xs align-middle"></span>';

        if (targetDashEl) targetDashEl.innerHTML = parsedTempHtml;
        if (targetFullEl) targetFullEl.innerHTML = parsedTempHtml;

        // Auto-scroll ke bawah mengikuti ketikan
        if (dashBox) dashBox.scrollTop = dashBox.scrollHeight;
        if (fullBox) fullBox.scrollTop = fullBox.scrollHeight;
      } else {
        // Selesai mengetik: bersihkan interval
        clearInterval(streamInterval);

        // Update teks final ke state
        state.chats[newChatIndex].message = fullText;

        // Render final dan proses parsing rumus matematika KaTeX
        renderChatMessages();
      }
    }, streamSpeed);
  }

  // ==================== 16. CLIPBOARD PASTE IMAGE ENGINE ====================
  function initClipboardPasteHandler() {
    const inputDash = document.getElementById('chat-input-dashboard');
    const inputFull = document.getElementById('chat-input-full');

    // Tangani event paste pada kedua elemen input chat
    if (inputDash) {
      inputDash.addEventListener('paste', handleChatInputPaste);
    }
    if (inputFull) {
      inputFull.addEventListener('paste', handleChatInputPaste);
    }

    // Tangani juga paste global saat kursor berada di ruang chat aktif
    window.addEventListener('paste', (e) => {
      // Lewati jika user sedang mengetik pada form profil, API key, atau input teks lain
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (activeEl.id !== 'chat-input-dashboard' && activeEl.id !== 'chat-input-full') {
          return;
        }
      }
      handleChatInputPaste(e);
    });
  }

  async function handleChatInputPaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const items = clipboardData.items;
    let imageFile = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    // Jika yang di-paste adalah gambar
    if (imageFile) {
      e.preventDefault(); // Cegah karakter binary string masuk ke kolom teks

      // Berikan nama berkas otomatis
      const timestamp = new Date().getTime();
      activeAttachmentFileName = 'Screenshot_' + timestamp + '.png';

      // Kompresi otomatis via Canvas jika ukuran > 2MB
      const base64Result = await compressImageIfNeeded(imageFile, 1600, 0.85);
      state.activeAttachmentBase64 = base64Result;

      // Munculkan preview lampiran di Dashboard dan Full Chat
      showAttachmentPreview(base64Result, activeAttachmentFileName, 'image/png');

      showAppAlert('Gambar Ditempelkan', 'Gambar dari papan klip (clipboard) siap dianalisis oleh Orbit AI.', 'info');
    }
  }

  // ==================== 17. DRAG AND DROP FILE ENGINE ====================
  function initDragAndDropHandler() {
    const dropTargets = [
      {
        container: document.getElementById('chat-messages-dashboard') ? document.getElementById('chat-messages-dashboard').parentElement : null,
        overlay: document.getElementById('drop-overlay-dashboard')
      },
      {
        container: document.getElementById('chat-messages-full') ? document.getElementById('chat-messages-full').parentElement : null,
        overlay: document.getElementById('drop-overlay-full')
      }
    ];

    dropTargets.forEach(({ container, overlay }) => {
      if (!container || !overlay) return;

      let dragCounter = 0;

      // Event saat file diseret masuk
      container.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        overlay.classList.remove('hidden');
        lucide.createIcons();
      });

      // Event saat file digeser di dalam kontainer
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      // Event saat kursor keluar membawa file
      container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          overlay.classList.add('hidden');
        }
      });

      // Event saat file dilepas (drop)
      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        overlay.classList.add('hidden');

        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (!files || files.length === 0) return;

        const file = files[0];
        await processDroppedFile(file);
      });
    });

    // Mencegah browser membuka file secara default jika di-drop di luar kontainer
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  async function processDroppedFile(file) {
    if (!file) return;

    // Batasan ukuran aman 15 MB
    if (file.size > 15 * 1024 * 1024) {
      showAppAlert('Ukuran Terlalu Besar', 'Maksimal ukuran berkas adalah 15 MB.', 'warning');
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      showAppAlert('Format Tidak Didukung', 'Hanya berkas format Gambar (JPG, PNG, WebP) atau Dokumen PDF yang didukung.', 'warning');
      return;
    }

    activeAttachmentFileName = file.name;

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = function(e) {
        state.activeAttachmentBase64 = e.target.result;
        showAttachmentPreview(e.target.result, file.name, file.type);
        showAppAlert('Dokumen Diterima', `Dokumen PDF "${file.name}" siap dianalisis.`, 'info');
      };
      reader.readAsDataURL(file);
    } else {
      // Kompresi otomatis via Canvas jika ukuran > 2 MB
      const base64Result = await compressImageIfNeeded(file, 1600, 0.85);
      state.activeAttachmentBase64 = base64Result;
      showAttachmentPreview(base64Result, file.name, 'image/jpeg');
      showAppAlert('Gambar Diterima', `Foto "${file.name}" siap dianalisis.`, 'info');
    }
  }

  // ==================== 18. ATTACHMENT GALLERY ENGINE ====================
  let allGalleryAttachments = [];
  let currentGalleryFilter = 'ALL';

  function openGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    if (modal) modal.classList.remove('hidden');
    loadGalleryAttachments();
    lucide.createIcons();
  }

  function closeGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    if (modal) modal.classList.add('hidden');
  }

  function loadGalleryCountBadge() {
    if (!state.user || typeof google === 'undefined' || !google.script || !google.script.run) return;
    google.script.run
      .withSuccessHandler((res) => {
        if (res && res.status === 'success') {
          allGalleryAttachments = res.attachments || [];
          const badge = document.getElementById('gallery-counter-badge-sidebar');
          if (badge) badge.innerText = allGalleryAttachments.length;
        }
      })
      .getUserAttachmentsGallery(state.user.username);
  }

  function loadGalleryAttachments() {
    const container = document.getElementById('gallery-items-container');
    if (!state.user) {
      if (container) container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400">Silakan login terlebih dahulu.</div>';
      return;
    }

    if (container) {
      container.innerHTML = '<div class="py-16 text-center text-xs text-slate-400 animate-pulse">Menghubungkan ke arsip lampiran...</div>';
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            allGalleryAttachments = res.attachments || [];
            applyGalleryFiltering();
            const badge = document.getElementById('gallery-counter-badge-sidebar');
            if (badge) badge.innerText = allGalleryAttachments.length;
          } else {
            if (container) container.innerHTML = '<div class="py-12 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat galeri.') + '</div>';
          }
        })
        .withFailureHandler((err) => {
          if (container) container.innerHTML = '<div class="py-12 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</div>';
        })
        .getUserAttachmentsGallery(state.user.username);
    }
  }

  function filterGalleryItems(filterType) {
    currentGalleryFilter = filterType;
    document.querySelectorAll('.gallery-filter-chip').forEach(btn => {
      const match = btn.getAttribute('data-filter') === filterType;
      if (match) {
        btn.className = 'gallery-filter-chip px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer';
      } else {
        btn.className = 'gallery-filter-chip px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer';
      }
    });
    applyGalleryFiltering();
    lucide.createIcons();
  }

  function applyGalleryFiltering() {
    let list = allGalleryAttachments || [];

    if (currentGalleryFilter !== 'ALL') {
      list = list.filter(item => item.fileType === currentGalleryFilter);
    }

    const totalEl = document.getElementById('gallery-total-counter');
    if (totalEl) totalEl.innerText = `${list.length} Lampiran`;

    renderGalleryGrid(list);
  }

  function renderGalleryGrid(items) {
    const container = document.getElementById('gallery-items-container');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <i data-lucide="folder-x" class="w-6 h-6"></i>
          </div>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Belum Ada Lampiran</p>
          <p class="text-[11px] text-slate-400">Unggah foto soal atau berkas PDF saat bertanya kepada Orbit AI.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-2">
        ${items.map(item => {
          const isPdf = item.fileType === 'pdf';
          const cleanUrl = getDirectImageUrl(item.fileUrl);

          // Ekstrak ID file Google Drive
          let driveFileId = '';
          const matchDrive = String(item.fileUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
          const matchParam = String(item.fileUrl || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (matchDrive && matchDrive[1]) driveFileId = matchDrive[1];
          else if (matchParam && matchParam[1]) driveFileId = matchParam[1];

          // URL untuk THUMBNAIL PREVIEW (gambar cover)
          const previewImgSrc = (isPdf && driveFileId) 
            ? ('https://drive.google.com/thumbnail?id=' + driveFileId + '&sz=w600') 
            : cleanUrl;

          // URL untuk penampil embed PDF & link penuh
          const pdfPreviewUrl = (isPdf && driveFileId) 
            ? ('https://drive.google.com/file/d/' + driveFileId + '/preview') 
            : cleanUrl;
          const pdfViewUrl = (isPdf && driveFileId) 
            ? ('https://drive.google.com/file/d/' + driveFileId + '/view') 
            : cleanUrl;

          // Jika PDF, gunakan onclick modal; jika gambar, buka link gambar
          const clickAction = isPdf 
            ? `onclick="event.preventDefault(); openPdfViewerModal('${pdfPreviewUrl}', '${pdfViewUrl}', '${item.sessionTitle.replace(/'/g, "\\'")}')"` 
            : '';
          const hrefAttr = isPdf ? 'javascript:void(0)' : cleanUrl;
          const targetAttr = isPdf ? '' : 'target="_blank"';

          const mediaPreviewHtml = `
            <div class="h-36 bg-slate-100 dark:bg-slate-900 overflow-hidden relative group flex items-center justify-center border-b border-slate-100 dark:border-slate-800">
              <img 
                src="${previewImgSrc}" 
                class="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" 
                alt="${item.fileName || 'Preview'}" 
                loading="lazy"
                onerror="this.onerror=null; this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');"
              >

              
              <div class="hidden flex-col items-center justify-center gap-1.5 p-4 text-slate-400">
                <i data-lucide="${isPdf ? 'file-text' : 'image'}" class="w-8 h-8 text-slate-300"></i>
                <span class="text-[10px] font-bold">${isPdf ? 'Dokumen PDF' : 'Foto Soal'}</span>
              </div>

              
              <div class="absolute top-2 left-2 z-10">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold shadow-sm backdrop-blur-md ${isPdf ? 'bg-rose-500/90 text-white' : 'bg-slate-900/80 text-white'}">
                  <i data-lucide="${isPdf ? 'file-text' : 'image'}" class="w-3 h-3"></i>
                  <span>${isPdf ? 'PDF' : 'IMG'}</span>
                </span>
              </div>

              
              <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-[1px]">
                <i data-lucide="external-link" class="w-4 h-4"></i>
                <span>Buka Berkas</span>
              </div>
            </div>
          `;

          return `
            <div class="bg-white dark:bg-[#0B1329] border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <a href="${hrefAttr}" ${targetAttr} ${clickAction} class="block cursor-pointer">
                  ${mediaPreviewHtml}
                </a>

                <div class="p-3.5 space-y-1.5">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-extrabold uppercase px-2 py-0.5 rounded-md border ${getTagColorClass(item.sessionTag)} font-mono">${item.sessionTag}</span>
                    <span class="text-slate-400 font-mono">${item.timestamp}</span>
                  </div>

                  <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title="${item.sessionTitle}">
                    ${item.sessionTitle}
                  </h4>

                  <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    ${item.promptSnippet ? `"${item.promptSnippet}..."` : 'Tanpa catatan tambahan'}
                  </p>
                </div>
              </div>

              
              <div class="p-3.5 pt-0 flex items-center gap-2">
                <button 
                  type="button"
                  onclick="jumpToSessionFromGallery('${item.sessionId}')" 
                  class="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                  <span>Buka Sesi</span>
                </button>
                <a 
                  href="${hrefAttr}" 
                  ${targetAttr} 
                  ${clickAction}
                  title="Lihat Pratinjau PDF" 
                  class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition flex items-center justify-center cursor-pointer"
                >
                  <i data-lucide="eye" class="w-4 h-4"></i>
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    lucide.createIcons();
  }

  function jumpToSessionFromGallery(sessionId) {
    closeGalleryModal();
    // Beralih ke halaman chat jika sedang berada di dashboard
    if (state.currentPage !== 'chat') {
      navigateToPage('chat');
    }
    switchChatSession(sessionId);
    showAppAlert('Sesi Terbuka', 'Berhasil beralih ke sesi pembahasan lampiran ini.', 'info');
  }

  function openPdfViewerModal(previewUrl, driveViewUrl, title) {
    const modal = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-viewer-frame');
    const titleEl = document.getElementById('pdf-viewer-title');
    const externalBtn = document.getElementById('pdf-viewer-external-btn');

    if (!modal || !iframe) return;

    if (titleEl) titleEl.innerText = title || 'Pratinjau Dokumen PDF';
    if (externalBtn) externalBtn.href = driveViewUrl || previewUrl;

    // Masukkan URL penampil Google Drive (menggunakan /preview)
    iframe.src = previewUrl;

    modal.classList.remove('hidden');
    lucide.createIcons();
  }

  function closePdfViewerModal() {
    const modal = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-viewer-frame');

    if (iframe) iframe.src = ''; // Bersihkan src agar hemat memori & audio/video terhenti
    if (modal) modal.classList.add('hidden');
  }

  let allTokenAnalyticsData = null;

  function getAnalyticsSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <tr class="animate-pulse border-b border-slate-100 dark:border-slate-800">
        <td class="py-3.5 px-4"><div class="h-5 w-6 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-28 bg-slate-200 dark:bg-slate-700/60 rounded"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/60 rounded font-mono"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-20 bg-slate-200 dark:bg-slate-700/60 rounded font-mono"></div></td>
        <td class="py-3.5 px-4"><div class="h-3.5 w-20 bg-emerald-100/60 dark:bg-emerald-900/40 rounded font-mono"></div></td>
        <td class="py-3.5 px-4 text-right"><div class="h-3.5 w-24 bg-amber-100/60 dark:bg-amber-900/40 rounded font-mono ml-auto"></div></td>
      </tr>
    `).join('');
  }

  function loadTokenAnalyticsData(isForceRefresh = false) {
    if (!state.user || state.user.role !== 'superadmin') return;

    const tableBody = document.getElementById('analytics-ranking-table-body');
    const refreshBtn = document.getElementById('btn-refresh-analytics');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    if (isForceRefresh || !allTokenAnalyticsData) {
      if (tableBody) {
        tableBody.innerHTML = getAnalyticsSkeletonHtml();
      }
    } else {
      renderTokenAnalyticsView(allTokenAnalyticsData);
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success' && res.data) {
            allTokenAnalyticsData = res.data;
            renderTokenAnalyticsView(res.data);
          } else {
            if (tableBody && !allTokenAnalyticsData) {
              tableBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs text-rose-500 font-semibold">' + (res ? res.message : 'Gagal memuat analitik.') + '</td></tr>';
            }
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (tableBody && !allTokenAnalyticsData) {
            tableBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs text-rose-500 font-semibold">Error: ' + err.message + '</td></tr>';
          }
        })
        .getCostAndTokenAnalytics(state.user.username);
    }
  }

function renderTokenAnalyticsView(data) {
  // 1. KPI Widget Card
  const elCalls = document.getElementById('an-total-calls');
  const elTokens = document.getElementById('an-total-tokens');
  const elBreakdown = document.getElementById('an-token-breakdown');
  const elUsd = document.getElementById('an-cost-usd');
  const elIdr = document.getElementById('an-cost-idr');

  if (elCalls) elCalls.innerText = data.totalCalls.toLocaleString('id-ID');
  if (elTokens) elTokens.innerText = data.totalTokens.toLocaleString('id-ID');
  if (elBreakdown) elBreakdown.innerText = `In: ${data.totalInputTokens.toLocaleString('id-ID')} | Out: ${data.totalOutputTokens.toLocaleString('id-ID')}`;
  if (elUsd) elUsd.innerText = `$${data.estCostUsd}`;
  if (elIdr) elIdr.innerText = `Rp ${data.estCostIdr.toLocaleString('id-ID')}`;

  // 2. Visual Bar Frekuensi Model
  const modelsContainer = document.getElementById('analytics-models-container');
  if (modelsContainer) {
    const models = Object.keys(data.modelBreakdown || {});
    if (models.length === 0) {
      modelsContainer.innerHTML = '<div class="py-4 text-center text-xs text-slate-400">Belum ada aktivitas panggilan API yang tercatat.</div>';
    } else {
      modelsContainer.innerHTML = models.map(m => {
        const item = data.modelBreakdown[m];
        const percent = data.totalCalls > 0 ? Math.round((item.calls / data.totalCalls) * 100) : 0;
        return `
          <div class="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between text-xs">
              <span class="font-extrabold font-mono text-slate-800 dark:text-slate-100">${m}</span>
              <span class="text-slate-500 dark:text-slate-400 font-mono text-[11px]">${item.calls} Panggilan (${percent}%) • ${(item.inTokens + item.outTokens).toLocaleString('id-ID')} Tokens</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-blue-600 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3. Tabel Ranking Konsumsi Siswa (Dari Terbanyak ke Terkecil)
  const rankingBadge = document.getElementById('an-total-users-badge');
  if (rankingBadge) rankingBadge.innerText = `${(data.userRanking || []).length} Pengguna`;

  const tbody = document.getElementById('analytics-ranking-table-body');
  if (!tbody) return;

  if (!data.userRanking || data.userRanking.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-xs text-slate-400">Belum ada rekaman pemakaian token oleh akun siswa.</td></tr>';
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.userRanking.map((u, idx) => {
    let rankBadge = `<span class="w-6 h-6 rounded-lg bg-slate-100 font-bold text-xs flex items-center justify-center font-mono">${idx + 1}</span>`;
    if (idx === 0) rankBadge = '<span class="w-6 h-6 rounded-lg bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">🥇</span>';
    else if (idx === 1) rankBadge = '<span class="w-6 h-6 rounded-lg bg-slate-300 text-slate-800 font-extrabold text-xs flex items-center justify-center shadow-xs">🥈</span>';
    else if (idx === 2) rankBadge = '<span class="w-6 h-6 rounded-lg bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">🥉</span>';

    return `
      <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="flex items-center gap-2.5">
            ${rankBadge}
            <div>
              <p class="font-extrabold text-slate-800 dark:text-slate-100 text-xs">${u.name}</p>
              <span class="text-[10px] font-mono text-slate-400">@${u.username}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 font-mono font-bold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
          ${u.calls.toLocaleString('id-ID')}
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
          ${u.inTokens.toLocaleString('id-ID')}
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
          ${u.outTokens.toLocaleString('id-ID')}
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold font-mono text-xs border border-indigo-200/60 dark:border-indigo-800/40">
            ${u.totalTokens.toLocaleString('id-ID')}
          </span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <p class="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs font-mono">$${u.costUsd}</p>
          <span class="text-[10px] text-slate-400 font-mono">≈ Rp ${u.costIdr.toLocaleString('id-ID')}</span>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function renderAnnouncementBanner(announcement) {
    const banner = document.getElementById('global-announcement-bar');
    const textEl = document.getElementById('announcement-text');
    const iconEl = document.getElementById('announcement-icon');
    const iconBadge = document.getElementById('announcement-icon-badge');

    if (!banner || !announcement) return;

    // Jika pengumuman aktif dan ada pesannya
    if (announcement.enabled && announcement.message) {
      // Cek apakah user sudah menutup banner ini secara lokal di sesi ini
      const dismissedKey = 'orbit_dismissed_announcement';
      const lastDismissedMsg = sessionStorage.getItem(dismissedKey);
      if (lastDismissedMsg === announcement.message) {
        banner.classList.add('hidden');
        return;
      }

      textEl.innerText = announcement.message;
      const type = announcement.type || 'info';

      if (type === 'warning') {
        banner.className = 'px-4 py-2.5 bg-amber-500 text-white shadow-md z-30 shrink-0';
        iconBadge.className = 'w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-white';
        iconEl.setAttribute('data-lucide', 'alert-triangle');
      } else if (type === 'danger') {
        banner.className = 'px-4 py-2.5 bg-rose-600 text-white shadow-md z-30 shrink-0';
        iconBadge.className = 'w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-white';
        iconEl.setAttribute('data-lucide', 'alert-octagon');
      } else {
        banner.className = 'px-4 py-2.5 bg-blue-600 text-white shadow-md z-30 shrink-0';
        iconBadge.className = 'w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-white';
        iconEl.setAttribute('data-lucide', 'info');
      }

      banner.classList.remove('hidden');
      lucide.createIcons();
    } else {
      banner.classList.add('hidden');
    }
  }

  function dismissAnnouncementBar() {
    const banner = document.getElementById('global-announcement-bar');
    const textEl = document.getElementById('announcement-text');
    if (banner && textEl) {
      banner.classList.add('hidden');
      sessionStorage.setItem('orbit_dismissed_announcement', textEl.innerText);
    }
  }

  function updateAnnouncementStatusLabel(isChecked) {
    const label = document.getElementById('label-announcement-toggle');
    if (label) {
      label.innerText = isChecked ? 'Aktif' : 'Nonaktif';
      label.className = isChecked ? 'text-xs font-bold text-emerald-600' : 'text-xs font-bold text-slate-500';
    }
  }

  function toggleAnnouncementExpiryInput(isPermanent) {
    const inputExpiry = document.getElementById('input-announcement-expiry');
    if (inputExpiry) {
      inputExpiry.disabled = isPermanent;
      if (isPermanent) {
        inputExpiry.value = '';
        inputExpiry.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        inputExpiry.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  }

  function handleSaveAnnouncementForm(e) {
    e.preventDefault();
    if (!state.user || state.user.role !== 'superadmin') return;

    const btn = document.getElementById('btn-save-announcement');
    const isEnabled = document.getElementById('toggle-announcement-switch').checked;
    const msg = document.getElementById('input-announcement-text').value.trim();
    const type = document.getElementById('select-announcement-type').value;
    const isPermanent = document.getElementById('check-announcement-permanent').checked;
    const expiryVal = isPermanent ? '' : (document.getElementById('input-announcement-expiry').value || '');

    if (btn) btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Menyimpan...';

    const payload = {
      enabled: isEnabled,
      message: msg,
      type: type,
      expiresAt: expiryVal
    };

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Terapkan Pengumuman</span>';
          lucide.createIcons();
          if (res && res.status === 'success') {
            showAppAlert('Pengumuman Disimpan', 'Konfigurasi banner pengumuman global berhasil diterapkan.', 'success');
            // Langsung perbarui tampilan banner di sesi admin saat ini
            sessionStorage.removeItem('orbit_dismissed_announcement');
            renderAnnouncementBanner(payload);
          } else {
            showAppAlert('Gagal', res.message || 'Gagal menyimpan pengumuman.', 'error');
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Terapkan Pengumuman</span>';
          lucide.createIcons();
          showAppAlert('Error', err.message, 'error');
        })
        .saveGlobalAnnouncement(state.user.username, payload);
    }
  }

  let modAllSessions = [];
  let modActiveSessionId = null;

  function getModerationSessionsSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <div class="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 animate-pulse space-y-2">
        <div class="flex items-center justify-between">
          <div class="h-4 w-20 bg-slate-200 dark:bg-slate-700/60 rounded-md"></div>
          <div class="h-3 w-16 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
        </div>
        <div class="h-3.5 w-4/5 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
        <div class="flex items-center justify-between pt-1">
          <div class="h-3 w-12 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
          <div class="h-3 w-14 bg-slate-200 dark:bg-slate-700/60 rounded"></div>
        </div>
      </div>
    `).join('');
  }

  function getModerationChatSkeletonHtml() {
    return `
      <div class="h-full space-y-5 p-2 animate-pulse select-none">
        <div class="flex flex-col items-end space-y-1.5">
          <div class="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div class="h-14 w-2/3 max-w-md bg-blue-100 dark:bg-blue-900/30 rounded-2xl rounded-tr-none"></div>
        </div>
        <div class="flex flex-col items-start space-y-1.5">
          <div class="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div class="h-36 w-4/5 max-w-lg bg-slate-200 dark:bg-slate-800/60 rounded-2xl rounded-tl-none space-y-2.5 p-4">
            <div class="h-3.5 w-full bg-slate-300 dark:bg-slate-700 rounded"></div>
            <div class="h-3.5 w-4/5 bg-slate-300 dark:bg-slate-700 rounded"></div>
            <div class="h-10 w-2/3 bg-slate-300/80 dark:bg-slate-700/60 rounded-xl"></div>
          </div>
        </div>
      </div>
    `;
  }

  function initModerationPage() {
    if (!state.user || state.user.role !== 'superadmin') return;
    loadModerationUserFilter();
    loadModerationSessions(false);
  }

  function loadModerationUserFilter() {
    if (typeof google === 'undefined' || !google.script || !google.script.run) return;
    google.script.run
      .withSuccessHandler((res) => {
        if (res && res.status === 'success' && res.data) {
          const select = document.getElementById('mod-select-user');
          if (!select) return;
          const currentVal = select.value;
          select.innerHTML = '<option value="">Semua Akun Siswa</option>' + 
            res.data.map(u => `<option value="${u.username}">${u.name} (@${u.username})</option>`).join('');
          select.value = currentVal;
        }
      })
      .getAllUsersWithConfigs(state.user.username);
  }

  function loadModerationSessions(isForceRefresh = false) {
    const container = document.getElementById('mod-sessions-list');
    const selectUserEl = document.getElementById('mod-select-user');
    const selectedUser = selectUserEl ? selectUserEl.value : '';
    const refreshBtn = document.getElementById('btn-refresh-mod');
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('i') : null;

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    // Tampilkan skeleton loader yang halus dan cepat
    if (isForceRefresh || !modAllSessions || modAllSessions.length === 0 || selectedUser) {
      if (container) {
        container.innerHTML = getModerationSessionsSkeletonHtml();
      }
    } else {
      renderModerationSessionsList(modAllSessions);
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (res && res.status === 'success') {
            if (res.users && res.users.length > 0 && selectUserEl) {
              const currentSelected = selectUserEl.value;
              selectUserEl.innerHTML = '<option value="">Semua Akun Siswa</option>' + 
                res.users.map(u => `<option value="${u.username}">${u.name} (@${u.username})</option>`).join('');
              selectUserEl.value = currentSelected;
            }

            modAllSessions = res.data || [];
            renderModerationSessionsList(modAllSessions);

            // Buka otomatis sesi pertama jika belum ada sesi aktif
            if (modAllSessions.length > 0 && !modActiveSessionId) {
              inspectModerationSession(modAllSessions[0].id);
            }
          } else {
            if (container) container.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-bold">' + (res ? res.message : 'Gagal memuat sesi') + '</div>';
          }
        })
        .withFailureHandler((err) => {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
          if (container) container.innerHTML = '<div class="py-8 text-center text-xs text-rose-500 font-bold">Error: ' + err.message + '</div>';
        })
        .getModerationUserSessions(state.user.username, selectedUser);
    }
  }

  function filterModerationByUser() {
    loadModerationSessions(true);
  }

  function renderModerationSessionsList(list) {
    const container = document.getElementById('mod-sessions-list');
    const counter = document.getElementById('mod-sessions-count');
    if (counter) counter.innerText = `${list.length} sesi`;
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400">Tidak ada arsip sesi percakapan yang ditemukan.</div>';
      return;
    }

    container.innerHTML = list.map(item => {
      const isActive = (item.id === modActiveSessionId);
      const isFlagged = (item.moderationStatus === 'FLAGGED');

      return `
        <div 
          onclick="inspectModerationSession('${item.id}')"
          class="p-3 rounded-2xl border transition cursor-pointer text-left ${
            isFlagged 
              ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 shadow-xs' 
              : (isActive 
                  ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-xs ring-1 ring-blue-500/20' 
                  : 'bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border-slate-100 dark:border-slate-800/60')
          }"
        >
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${isFlagged ? 'bg-rose-600 text-white' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40'}">
              @${item.username}
            </span>
            <span class="text-[10px] text-slate-400 font-mono">${item.updatedAt}</span>
          </div>
          <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-snug">${item.title}</h4>
          <div class="flex items-center justify-between gap-1.5 mt-1.5 text-[10px]">
            <span class="text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60 font-medium">${item.category}</span>
            ${isFlagged ? '<span class="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono">🚩 Melanggar</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  // State global untuk moderasi
  let modCurrentTargetUser = '';
  let modCurrentIsFlagged = false;

  function inspectModerationSession(sessionId) {
    modActiveSessionId = sessionId;
    renderModerationSessionsList(modAllSessions);

    const container = document.getElementById('mod-chat-messages-container');
    const titleEl = document.getElementById('mod-active-title');
    const subEl = document.getElementById('mod-active-sub');
    const countEl = document.getElementById('mod-msg-counter');
    const actionBtns = document.getElementById('mod-action-buttons');

    // Munculkan tombol "Tandai Pelanggaran" & "Beri Peringatan"
    if (actionBtns) actionBtns.classList.remove('hidden');

    const sessObj = modAllSessions.find(s => s.id === sessionId);
    if (sessObj) {
      modCurrentTargetUser = sessObj.username;
      modCurrentIsFlagged = (sessObj.moderationStatus === 'FLAGGED');
      if (titleEl) titleEl.innerText = sessObj.title;
      if (subEl) subEl.innerText = `Siswa: @${sessObj.username} • ID Sesi: ${sessionId}`;
      updateFlagButtonUI(modCurrentIsFlagged);
    }

    // Tampilkan skeleton loader chat
    if (container) {
      container.innerHTML = getModerationChatSkeletonHtml();
    }

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.status === 'success') {
            renderModerationChatView(res.chats || []);
            if (countEl) countEl.innerText = `${(res.chats || []).length} Pesan`;
          } else {
            if (container) container.innerHTML = '<div class="p-6 text-center text-xs text-rose-500 font-bold">' + (res ? res.message : 'Gagal memuat chat.') + '</div>';
          }
        })
        .withFailureHandler((err) => {
          if (container) container.innerHTML = '<div class="p-6 text-center text-xs text-rose-500 font-bold">Error: ' + err.message + '</div>';
        })
        .getModerationSessionChats(state.user.username, sessionId);
    }
  }

  function updateFlagButtonUI(isFlagged) {
    const btnText = document.getElementById('btn-mod-flag-text');
    const btn = document.getElementById('btn-mod-flag');
    if (!btn || !btnText) return;

    if (isFlagged) {
      btnText.innerText = 'Hapus Tanda Pelanggaran';
      btn.className = 'px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer';
    } else {
      btnText.innerText = 'Tandai Pelanggaran';
      btn.className = 'px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer';
    }
    lucide.createIcons();
  }

  function handleToggleSessionFlag() {
    if (!modActiveSessionId || !state.user || state.user.role !== 'superadmin') return;

    const modalEl = document.getElementById('modal-confirm-flag');
    const titleEl = document.getElementById('modal-flag-title');
    const descEl = document.getElementById('modal-flag-desc');
    const targetLabel = document.getElementById('modal-flag-target-label');
    const confirmBtn = document.getElementById('btn-confirm-flag-action');
    const confirmText = document.getElementById('btn-confirm-flag-text');
    const iconContainer = document.getElementById('modal-flag-icon-container');

    if (targetLabel) targetLabel.innerText = `@${modCurrentTargetUser || 'pengguna'} • ${modActiveSessionId}`;

    if (modCurrentIsFlagged) {
      if (titleEl) titleEl.innerText = 'Padam Penanda Pelanggaran';
      if (descEl) descEl.innerText = 'Padamkan penanda pelanggaran daripada sesi perbualan ini dan pulihkan statusnya kepada sedia ada?';
      if (confirmText) confirmText.innerText = 'Padam Penanda';
      if (confirmBtn) confirmBtn.className = 'px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer';
      if (iconContainer) iconContainer.className = 'w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center font-bold';
    } else {
      if (titleEl) titleEl.innerText = 'Tandai Pelanggaran Sesi';
      if (descEl) descEl.innerText = 'Tandakan sesi ini sebagai pelanggaran peraturan perkhidmatan?';
      if (confirmText) confirmText.innerText = 'Tandai Pelanggaran';
      if (confirmBtn) confirmBtn.className = 'px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer';
      if (iconContainer) iconContainer.className = 'w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-bold';
    }

    if (modalEl) modalEl.classList.remove('hidden');
    lucide.createIcons();
  }

  function closeFlagModal() {
    const modalEl = document.getElementById('modal-confirm-flag');
    if (modalEl) modalEl.classList.add('hidden');
  }

  function executeToggleSessionFlag() {
    if (!modActiveSessionId || !state.user || state.user.role !== 'superadmin') return;

    const btn = document.getElementById('btn-confirm-flag-action');
    const newStatus = modCurrentIsFlagged ? 'CLEAN' : 'FLAGGED';

    if (btn) btn.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Memproses...';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          closeFlagModal();
          if (btn) btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span id="btn-confirm-flag-text">Sahkan</span>';
          lucide.createIcons();
          if (res && res.status === 'success') {
            modCurrentIsFlagged = (newStatus === 'FLAGGED');
            const targetSess = modAllSessions.find(s => s.id === modActiveSessionId);
            if (targetSess) {
              targetSess.moderationStatus = newStatus;
            }
            updateFlagButtonUI(modCurrentIsFlagged);
            renderModerationSessionsList(modAllSessions);
            showAppAlert('Status Diperbarui', `Sesi berhasil ${modCurrentIsFlagged ? 'ditandai sebagai pelanggaran' : 'dibersihkan'}.`, 'success');
          } else {
            showAppAlert('Gagal', res.message || 'Gagal mengubah status penanda.', 'error');
          }
        })
        .withFailureHandler((err) => {
          closeFlagModal();
          if (btn) btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span id="btn-confirm-flag-text">Sahkan</span>';
          lucide.createIcons();
          showAppAlert('Ralat', err.message, 'error');
        })
        .flagModerationSession(state.user.username, modActiveSessionId, newStatus, 'Ditandakan oleh admin');
    }
  }

  function openWarningModal() {
    if (!modCurrentTargetUser) return;
    const targetLabel = document.getElementById('modal-warning-target-label');
    const inputEl = document.getElementById('input-warning-user-text');
    const modalEl = document.getElementById('modal-warning-user');

    if (targetLabel) targetLabel.innerText = `@${modCurrentTargetUser}`;
    if (inputEl) inputEl.value = '';
    if (modalEl) modalEl.classList.remove('hidden');
    lucide.createIcons();
  }

  function closeWarningModal() {
    const modalEl = document.getElementById('modal-warning-user');
    if (modalEl) modalEl.classList.add('hidden');
  }

  function handleSubmitWarningUser(e) {
    e.preventDefault();
    if (!state.user || state.user.role !== 'superadmin' || !modCurrentTargetUser) return;

    const btn = document.getElementById('btn-submit-warning');
    const inputEl = document.getElementById('input-warning-user-text');
    const msg = inputEl ? inputEl.value.trim() : '';

    if (btn) btn.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Mengirim...';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((res) => {
          if (btn) btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Kirim Peringatan</span>';
          closeWarningModal();
          lucide.createIcons();
          if (res && res.status === 'success') {
            showAppAlert('Peringatan Terkirim', `Pesan peringatan berhasil dikirim ke akun @${modCurrentTargetUser}.`, 'success');
          } else {
            showAppAlert('Gagal', res.message || 'Gagal mengirim peringatan.', 'error');
          }
        })
        .withFailureHandler((err) => {
          if (btn) btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Kirim Peringatan</span>';
          closeWarningModal();
          lucide.createIcons();
          showAppAlert('Error', err.message, 'error');
        })
        .sendWarningToUser(state.user.username, modCurrentTargetUser, msg);
    }
  }

  function renderModerationChatView(chats) {
    const container = document.getElementById('mod-chat-messages-container');
    if (!container) return;

    if (!chats || chats.length === 0) {
      container.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400 text-xs font-medium">Belum ada riwayat percakapan di dalam sesi ini.</div>';
      return;
    }

    container.innerHTML = chats.map(msg => {
      const isUser = (String(msg.role || '').toLowerCase() === 'user');
      const isPdf = msg.imageUrl && (msg.imageUrl.startsWith('data:application/pdf') || (msg.fileName && msg.fileName.toLowerCase().endsWith('.pdf')));

      let attachmentHtml = '';
      if (msg.imageUrl) {
        if (isPdf) {
          attachmentHtml = `
            <div class="mt-2.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 max-w-sm">
              <div class="flex items-center gap-2 truncate">
                <i data-lucide="file-text" class="w-5 h-5 text-rose-500 shrink-0"></i>
                <span class="text-xs font-semibold truncate text-slate-700 dark:text-slate-200">${msg.fileName || 'Dokumen PDF'}</span>
              </div>
              <a href="${msg.imageUrl}" target="_blank" class="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-bold shrink-0 hover:bg-blue-700 transition">
                Buka PDF
              </a>
            </div>
          `;
        } else {
          attachmentHtml = `
            <div class="mt-2.5">
              <a href="${msg.imageUrl}" target="_blank" title="Klik untuk perbesar foto">
                <img src="${msg.imageUrl}" class="max-h-48 rounded-xl border border-black/10 dark:border-white/10 shadow-xs hover:opacity-90 transition object-cover" alt="Lampiran">
              </a>
            </div>
          `;
        }
      }

      // Render pesan menggunakan parser Markdown & KaTeX rumus matematika
      const formattedText = formatMathAndMarkdown(msg.message || '');

      return `
        <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1">
          <div class="flex items-center gap-1.5 px-1 text-[10px] text-slate-400 font-mono">
            <span class="font-bold ${isUser ? 'text-blue-500' : 'text-emerald-500'}">${isUser ? '👤 Siswa' : '🤖 Orbit AI'}</span>
            <span>•</span>
            <span>${msg.timestamp || '-'}</span>
          </div>
          <div class="max-w-[88%] sm:max-w-[82%] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none shadow-xs' 
              : 'assistant-chat-bubble bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-none shadow-xs'
          }">
            <div class="markdown-content">${formattedText}</div>
            ${attachmentHtml}
          </div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
    renderMathInElementSafely(container);
  }

  let warningCountdownInterval = null;

  function triggerStudentWarningPopup(message) {
    const modal = document.getElementById('modal-student-warning-countdown');
    const msgEl = document.getElementById('student-warning-message-body');
    const btn = document.getElementById('btn-dismiss-student-warning');
    const timerText = document.getElementById('btn-warning-timer-text');

    if (!modal || !msgEl || !btn || !timerText) return;

    msgEl.innerText = message;
    modal.classList.remove('hidden');

    let secondsLeft = 10;
    btn.disabled = true;
    btn.className = 'w-full py-3 px-5 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-extrabold text-xs transition duration-200 cursor-not-allowed flex items-center justify-center gap-2';
    timerText.innerText = `Mohon tunggu (${secondsLeft} detik)`;

    if (warningCountdownInterval) clearInterval(warningCountdownInterval);

    warningCountdownInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        timerText.innerText = `Mohon tunggu (${secondsLeft} detik)`;
      } else {
        clearInterval(warningCountdownInterval);
        btn.disabled = false;
        btn.className = 'w-full py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-rose-600/30';
        btn.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Saya Mengerti & Akan Mematuhi Aturan</span>';
        lucide.createIcons();
      }
    }, 1000);

    lucide.createIcons();
  }

  function handleDismissStudentWarning() {
    const modal = document.getElementById('modal-student-warning-countdown');
    if (modal) modal.classList.add('hidden');

    if (state.user && state.user.username) {
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.dismissAccountWarning(state.user.username);
      }
    }
  }