document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const authError = document.querySelector('#authError');

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  function showError(message) {
    if (authError) {
      authError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
      authError.classList.remove('hidden');
    }
  }

  if (isFileProtocol()) {
    showError('Notice: You opened this file directly. Please start XAMPP and open <strong>http://localhost/task-manager/login.html</strong> or <strong>http://localhost/task-manager/register.html</strong> in your browser so PHP backend endpoints can run.');
  }

  async function getAuthStatus() {
    if (isFileProtocol()) return null;
    const cachedUser = sessionStorage.getItem('user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {}
    }
    try {
      const response = await fetch('auth-status.php');
      if (!response.ok) return null;
      const data = await response.json();
      if (data.success && data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async function redirectIfLoggedIn() {
    const user = await getAuthStatus();
    if (user) {
      window.location.replace('index.html');
    }
  }

  async function redirectIfNotLoggedIn() {
    const user = await getAuthStatus();
    if (!user) {
      window.location.replace('login.html');
    }
  }

  if (loginForm || registerForm) {
    redirectIfLoggedIn();
  } else {
    redirectIfNotLoggedIn();
  }

  function setBtnLoading(btn, loadingText) {
    if (!btn) return () => {};
    const originalText = btn.innerHTML;
    if (loadingText) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = loadingText;
    }
    return function reset() {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      btn.innerHTML = originalText;
    };
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      authError.classList.add('hidden');

      if (isFileProtocol()) {
        showError('Cannot process login from file:// URL. Please open <strong>http://localhost/task-manager/login.html</strong> in your browser with XAMPP running.');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const resetBtn = setBtnLoading(submitBtn, 'Signing in...');

      try {
        const formData = new FormData(loginForm);
        const response = await fetch('login.php', { method: 'POST', body: formData });
        const data = await response.json();
        if (!data.success) {
          showError(data.message || 'Invalid login credentials.');
          resetBtn();
          return;
        }
        if (data.user) {
          sessionStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = 'index.html';
      } catch (err) {
        showError('Unable to connect to PHP server. Make sure XAMPP Apache is running and you are accessing via http://localhost/task-manager/login.html');
        resetBtn();
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      authError.classList.add('hidden');

      if (isFileProtocol()) {
        showError('Cannot complete registration from file:// URL. Please open <strong>http://localhost/task-manager/register.html</strong> in your browser with XAMPP running.');
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');

      const formData = new FormData(registerForm);
      const password = formData.get('password');
      const confirmPassword = formData.get('confirm_password');
      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
      }

      const resetBtn = setBtnLoading(submitBtn, 'Creating account...');
      try {
        const response = await fetch('register.php', { method: 'POST', body: formData });
        const data = await response.json();
        if (!data.success) {
          showError(data.message || 'Registration failed.');
          resetBtn();
          return;
        }
        if (data.user) {
          sessionStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = 'index.html';
      } catch (err) {
        showError('Unable to complete registration. Make sure XAMPP Apache & MySQL are running and you opened http://localhost/task-manager/register.html');
        resetBtn();
      }
    });
  }
});
