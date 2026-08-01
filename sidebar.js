document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('#sidebarToggle');
  const closeButtons = document.querySelectorAll('.sidebar-close');
  const userNameEl = document.querySelector('#sidebarUserName');
  const userEmailEl = document.querySelector('#sidebarUserEmail');

  function loadAuthUserSync() {
    const cachedUser = sessionStorage.getItem('user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) { }
    }
    return null;
  }

  async function loadAuthUser() {
    const cached = loadAuthUserSync();
    if (cached) return cached;
    try {
      const response = await fetch('auth-status.php');
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (data && data.success && data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  function loadChatbot() {
    if (document.getElementById('chatbot-script-tag')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'chatbot.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.id = 'chatbot-script-tag';
    script.src = 'chatbot.js';
    document.body.appendChild(script);
  }

  window.getUserInitials = function (name) {
    if (!name || typeof name !== 'string') return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  window.renderUserAvatar = function (container, user, sizeClass = 'avatar-md', allowCamera = false) {
    if (!container) return;
    container.className = `avatar-container ${sizeClass}`;
    
    const initials = window.getUserInitials(user ? user.name : '');
    const cameraOverlay = allowCamera ? `<div class="avatar-camera-overlay" title="Upload or Change Profile Photo"><i class="fas fa-camera"></i><span>${user && user.avatar ? 'Change' : 'Upload'}</span></div>` : '';

    if (user && user.avatar && user.avatar.trim() !== '' && !user.avatar.includes('pravatar')) {
      container.innerHTML = `<img src="${user.avatar}" class="avatar-img" alt="${user.name || 'User'}">${cameraOverlay}`;
    } else {
      container.innerHTML = `<div class="avatar-initials">${initials}</div>${cameraOverlay}`;
    }
  };

  function initializeSidebar() {
    const currentPage = window.location.pathname.split('/').pop();
    const isAuthPage = currentPage === 'login.html' || currentPage === 'register.html';

    function setupUserUI(activeUser) {
      if (userNameEl) userNameEl.textContent = activeUser.name || 'Team Lead';
      if (userEmailEl) userEmailEl.textContent = activeUser.email || 'team@taskflow.dev';

      const profileAvatarContainer = document.querySelector('#sidebarProfileAvatar') || document.querySelector('#sidebarProfileImage')?.parentElement;
      if (profileAvatarContainer) {
        window.renderUserAvatar(profileAvatarContainer, activeUser, 'avatar-lg', true);
        profileAvatarContainer.style.cursor = 'pointer';
        profileAvatarContainer.onclick = function() {
          if (window.triggerAvatarUploadModal) {
            window.triggerAvatarUploadModal();
          }
        };
      }

      const userPhoneEl = document.querySelector('#sidebarUserPhone');
      if (userPhoneEl) {
        userPhoneEl.textContent = activeUser.phone || 'No phone added';
      }

      if (isAuthPage) {
        window.location.replace('index.html');
        return;
      }
      loadChatbot();
    }

    const user = loadAuthUserSync();
    if (user) {
      setupUserUI(user);
    } else {
      loadAuthUser().then(asyncUser => {
        if (asyncUser) {
          setupUserUI(asyncUser);
        } else if (!isAuthPage) {
          window.location.replace('login.html');
        }
      });
    }

    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        const appShell = document.querySelector('.app-shell');

        if (window.matchMedia('(max-width: 940px)').matches) {
          sidebar.classList.toggle('open');
        } else {
          sidebar.classList.toggle('collapsed');
          if (appShell) appShell.classList.toggle('sidebar-collapsed');
        }
      });
    }

    closeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (sidebar) sidebar.classList.remove('open', 'collapsed');
        document.querySelector('.app-shell')?.classList.remove('sidebar-collapsed');
      });
    });

    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href === currentPage || (href === 'index.html' && currentPage === '')) {
        link.classList.add('active');
      }
      link.addEventListener('click', function () {
        if (sidebar) sidebar.classList.remove('open', 'collapsed');
        document.querySelector('.app-shell')?.classList.remove('sidebar-collapsed');
      });
    });
  }

  initializeSidebar();
});
