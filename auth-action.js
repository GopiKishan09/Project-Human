import {
  auth,
  isFirebaseEnabled,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode
} from './firebase.js?v=2.3.1';

/**
 * Firebase's own action handler is an unstyled white page. Pointing the
 * console's "action URL" at this file keeps password resets and email
 * verification inside the app's own skin.
 *
 * Firebase appends: mode, oobCode, apiKey, continueUrl, lang.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const continueUrl = params.get('continueUrl');

  const el = id => document.getElementById(id);

  function show(state) {
    document.querySelectorAll('.action-state').forEach(s => s.classList.remove('active'));
    const target = el('state-' + state);
    if (target) target.classList.add('active');
  }

  function fail(message) {
    if (message) el('error-sub').textContent = message;
    show('error');
  }

  function setResetError(message) {
    const box = el('reset-error');
    box.textContent = message || '';
    box.style.display = message ? 'block' : 'none';
  }

  function describe(error) {
    switch (error && error.code) {
      case 'auth/expired-action-code':
        return 'This link has expired. Request a new one from the sign-in screen.';
      case 'auth/invalid-action-code':
        return 'This link is no longer valid — it may already have been used.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account matches this link any more.';
      case 'auth/weak-password':
        return 'Passwords need at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  /**
   * Only send people onward to a continueUrl that belongs to this origin —
   * the parameter arrives in a link and must not become an open redirect.
   */
  function safeContinueUrl(raw) {
    if (!raw) return './index.html';
    try {
      const url = new URL(raw, window.location.origin);
      return url.origin === window.location.origin ? url.href : './index.html';
    } catch (e) {
      return './index.html';
    }
  }

  async function handleResetPassword() {
    let email;
    try {
      email = await verifyPasswordResetCode(auth, oobCode);
    } catch (e) {
      fail(describe(e));
      return;
    }

    el('reset-email').textContent = email;
    show('reset');
    setTimeout(() => el('new-password').focus(), 80);

    el('reset-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const password = el('new-password').value || '';
      const confirm = el('confirm-password').value || '';

      if (password.length < 6) {
        setResetError('Choose a password with at least 6 characters.');
        el('new-password').focus();
        return;
      }
      if (password !== confirm) {
        setResetError('Both passwords need to match.');
        el('confirm-password').focus();
        return;
      }

      const button = el('reset-submit');
      button.disabled = true;
      button.textContent = 'Saving...';
      setResetError('');

      try {
        await confirmPasswordReset(auth, oobCode, password);
        el('done-link').href = safeContinueUrl(continueUrl);
        show('done');
      } catch (e) {
        button.disabled = false;
        button.textContent = 'Save new password';
        setResetError(describe(e));
      }
    });
  }

  async function handleVerifyEmail() {
    try {
      await applyActionCode(auth, oobCode);
      el('done-title').textContent = 'Email verified';
      el('done-sub').textContent = 'Your email address is confirmed.';
      el('done-link').href = safeContinueUrl(continueUrl);
      show('done');
    } catch (e) {
      fail(describe(e));
    }
  }

  function start() {
    if (!isFirebaseEnabled) {
      fail('Sign-in is not configured for this app.');
      return;
    }
    if (!oobCode) {
      fail('This link is missing its security code.');
      return;
    }

    if (mode === 'resetPassword') {
      handleResetPassword();
    } else if (mode === 'verifyEmail') {
      handleVerifyEmail();
    } else {
      fail('This link asks for something this app cannot handle.');
    }
  }

  start();
})();
