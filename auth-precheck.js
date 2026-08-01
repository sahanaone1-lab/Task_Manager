(function () {
  const style = document.createElement('style');
  style.id = 'auth-hide-style';
  style.innerHTML = 'html { display: none !important; }';
  document.documentElement.appendChild(style);

  const path = window.location.pathname;
  const currentPage = path.split('/').pop() || 'index.html';
  const isAuthPage = currentPage === 'login.html' || currentPage === 'register.html';

  function showPage() {
    const el = document.getElementById('auth-hide-style');
    if (el) {
      el.remove();
    }
  }

  function handleUnauthenticated() {
    sessionStorage.removeItem('user');
    if (!isAuthPage && window.location.protocol !== 'file:') {
      window.location.replace('login.html');
    } else {
      showPage();
    }
  }

  function handleAuthenticated(user) {
    sessionStorage.setItem('user', JSON.stringify(user));
    if (isAuthPage) {
      window.location.replace('index.html');
    } else {
      showPage();
    }
  }

  if (window.location.protocol === 'file:') {
    showPage();
    return;
  }

  fetch('auth-status.php', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    })
    .then(data => {
      if (data && data.success && data.user) {
        handleAuthenticated(data.user);
      } else {
        handleUnauthenticated();
      }
    })
    .catch(error => {
      handleUnauthenticated();
    });
})();
