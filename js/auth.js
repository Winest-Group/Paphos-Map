// Auth helpers shared across pages

async function requireAuth() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function signOut() {
    await window.sb.auth.signOut();
    window.location.href = 'login.html';
}

async function getCurrentUserEmail() {
    const { data: { user } } = await window.sb.auth.getUser();
    return user ? user.email : null;
}

window.requireAuth = requireAuth;
window.signOut = signOut;
window.getCurrentUserEmail = getCurrentUserEmail;
