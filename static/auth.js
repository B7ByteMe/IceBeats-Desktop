// IceBeats Supabase Auth & Synchronization Configuration
const SUPABASE_URL = "https://jiytrtynlucsbbjpbybr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppeXRydHlubHVjc2JianBieWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDg4ODQsImV4cCI6MjEwNDk4NDg4NH0.BQQVZ8GghQqGIHPpUWx9n3VKc8Vqx0gQfDjYR2fEhDo";
const GOOGLE_CLIENT_ID = "819666700409-5l1o73qivkk44har3q617fkgemjfub2s.apps.googleusercontent.com";

window.isGuestMode = false;
let currentQrToken = null;
let qrPollInterval = null;
let qrExpiresTimeout = null;

// Helper headers for Supabase API
function getSupabaseHeaders(customToken) {
    const token = customToken || localStorage.getItem('supabase_access_token') || SUPABASE_ANON_KEY;
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Initialize Desktop QR Code Login Session
 */
window.initQrLogin = async function() {
    if (qrPollInterval) clearInterval(qrPollInterval);
    if (qrExpiresTimeout) clearTimeout(qrExpiresTimeout);

    const qrBox = document.getElementById('qr-code-box');
    const expiredOverlay = document.getElementById('qr-expired-overlay');
    const laser = document.getElementById('qr-laser');
    const statusText = document.getElementById('qr-status-text');

    if (!qrBox) return;

    qrBox.innerHTML = '';
    if (expiredOverlay) expiredOverlay.style.display = 'none';
    if (laser) laser.style.display = 'block';
    if (statusText) statusText.innerHTML = 'Arahkan pemindai di HP ke layar ini';

    // Generate random secure token
    const tokenRandom = Math.random().toString(36).substring(2, 10);
    const timeStr = Date.now().toString(36);
    currentQrToken = `ib_qr_${timeStr}_${tokenRandom}`;

    // Payload for mobile scanner: JSON containing app name, action, and token
    const qrPayload = JSON.stringify({
        app: "IceBeats",
        action: "desktop_login",
        token: currentQrToken,
        created: Date.now()
    });

    // Render QR Code using QRCode library
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrBox, {
            text: qrPayload,
            width: 196,
            height: 196,
            colorDark: "#06090e",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        // Fallback to QR API image if library is loading
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=196x196&data=${encodeURIComponent(qrPayload)}`;
        img.style.width = '196px';
        img.style.height = '196px';
        qrBox.appendChild(img);
    }

    // Publish session to Supabase
    const sessionData = {
        id: currentQrToken,
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };

    try {
        // 1. Post to storage bucket (backups/qr_sessions/${currentQrToken}.json)
        await fetch(`${SUPABASE_URL}/storage/v1/object/backups/qr_sessions/${currentQrToken}.json`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'x-upsert': 'true',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });

        // 2. Also attempt post to SQL table if it exists
        fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions`, {
            method: 'POST',
            headers: getSupabaseHeaders(),
            body: JSON.stringify(sessionData)
        }).catch(() => {});
    } catch (e) {
        console.warn('Failed to publish initial QR session to cloud', e);
    }

    // Start polling every 1500ms
    const startTime = Date.now();
    qrPollInterval = setInterval(async () => {
        // Expire after 5 minutes
        if (Date.now() - startTime > 5 * 60 * 1000) {
            clearInterval(qrPollInterval);
            if (expiredOverlay) expiredOverlay.style.display = 'flex';
            if (laser) laser.style.display = 'none';
            if (statusText) statusText.innerHTML = 'Sesi QR telah kedaluwarsa';
            return;
        }

        try {
            let sessionResult = null;

            // Check bucket first (accessible to public without RLS)
            const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/backups/qr_sessions/${currentQrToken}.json?_t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (bucketRes.ok) {
                sessionResult = await bucketRes.json();
            } else {
                // Fallback check SQL table
                const tableRes = await fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions?id=eq.${currentQrToken}&select=*`, {
                    headers: getSupabaseHeaders()
                });
                if (tableRes.ok) {
                    const rows = await tableRes.json();
                    if (rows && rows.length > 0) sessionResult = rows[0];
                }
            }

            if (sessionResult && sessionResult.status === 'approved') {
                clearInterval(qrPollInterval);
                if (laser) laser.style.display = 'none';
                if (statusText) statusText.innerHTML = '<span style="color:#1ed760;"><i class="fas fa-check-circle"></i> Berhasil! Menghubungkan akun...</span>';

                // Save session details
                const uid = sessionResult.user_id;
                const email = sessionResult.user_email || 'user@icebeats.app';
                const name = sessionResult.user_name || email.split('@')[0];
                const avatar = sessionResult.user_avatar || '';
                const token = sessionResult.auth_token || '';

                localStorage.setItem('auth_state', 'logged_in');
                localStorage.setItem('auth_email', email);
                localStorage.setItem('icebeats_user_id', uid);
                localStorage.setItem('airbeats_user_id', uid);
                localStorage.setItem('icebeats_user_name', name);
                localStorage.setItem('airbeats_user_name', name);
                if (avatar) {
                    localStorage.setItem('icebeats_user_avatar', avatar);
                    localStorage.setItem('airbeats_user_avatar', avatar);
                }
                if (token) {
                    localStorage.setItem('supabase_access_token', token);
                }
                window.isGuestMode = false;

                // Restore user library from Supabase
                await window.restoreFromSupabase(uid);

                // Clean up session in cloud
                fetch(`${SUPABASE_URL}/storage/v1/object/backups/qr_sessions/${currentQrToken}.json`, {
                    method: 'DELETE',
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                }).catch(() => {});

                // Hide overlay and reload
                const overlay = document.getElementById('auth-overlay');
                if (overlay) overlay.style.display = 'none';

                window.location.reload();
            }
        } catch (err) {
            console.error('Polling QR session error', err);
        }
    }, 1500);
};

/**
 * Restore Favorites & Playlists from Supabase (identical database logic to APK)
 */
window.restoreFromSupabase = async function(userId) {
    if (!userId) return;
    try {
        const headers = getSupabaseHeaders();

        // 1. Fetch user_favorites
        const favRes = await fetch(`${SUPABASE_URL}/rest/v1/user_favorites?user_id=eq.${userId}&select=*`, {
            headers: { ...headers, 'Cache-Control': 'no-cache' }
        });
        if (favRes.ok) {
            const favRows = await favRes.json();
            if (Array.isArray(favRows) && favRows.length > 0) {
                const mappedFavs = favRows.map(row => ({
                    id: row.song_id,
                    name: row.title,
                    artist: row.artist_name || 'Unknown Artist',
                    album: row.album_name || '',
                    image: row.thumbnail_url || '',
                    duration: row.duration || 0
                }));
                localStorage.setItem('favoriteSongs', JSON.stringify(mappedFavs));
            }
        }

        // 2. Fetch user_playlists & user_playlist_songs
        const plRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlists?user_id=eq.${userId}&select=*`, {
            headers: { ...headers, 'Cache-Control': 'no-cache' }
        });
        const plSongsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlist_songs?user_id=eq.${userId}&select=*&order=position.asc`, {
            headers: { ...headers, 'Cache-Control': 'no-cache' }
        });

        if (plRes.ok && plSongsRes.ok) {
            const playlists = await plRes.json();
            const allSongs = await plSongsRes.json();

            if (Array.isArray(playlists) && playlists.length > 0) {
                const structuredPlaylists = playlists.map(pl => {
                    const songsForPl = allSongs.filter(s => s.playlist_id === pl.playlist_id).map(s => ({
                        id: s.song_id,
                        name: s.title,
                        artist: s.artist_name || 'Unknown Artist',
                        album: s.album_name || '',
                        image: s.thumbnail_url || '',
                        duration: s.duration || 0
                    }));
                    return {
                        id: pl.playlist_id,
                        name: pl.name,
                        songs: songsForPl
                    };
                });
                localStorage.setItem('user_playlists', JSON.stringify(structuredPlaylists));
            }
        }

        // 3. Check for full backup file in storage as supplement
        const backupRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/backups/icebeats_backup_${userId}.backup?_t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (backupRes.ok) {
            const backupData = await backupRes.json();
            if (backupData.saved_albums) localStorage.setItem('saved_albums', backupData.saved_albums);
            if (backupData.subscribedArtists) localStorage.setItem('subscribedArtists', backupData.subscribedArtists);
            if (backupData.searchHistory) localStorage.setItem('searchHistory', backupData.searchHistory);
            if (backupData.playedArtists) localStorage.setItem('playedArtists', backupData.playedArtists);
            if (backupData.lastPlayedAlbum) localStorage.setItem('lastPlayedAlbum', backupData.lastPlayedAlbum);
        }

        console.log('Successfully restored library from Supabase Cloud!');
    } catch (err) {
        console.error('Failed to restore from Supabase:', err);
    }
};

window.restoreFromCloud = window.restoreFromSupabase;

/**
 * Backup Favorites & Playlists to Supabase Cloud
 */
window.autoBackup = async function() {
    if (window.isGuestMode) return;
    const userId = localStorage.getItem('icebeats_user_id') || localStorage.getItem('airbeats_user_id');
    if (!userId) return;

    try {
        const headers = getSupabaseHeaders();

        // 1. Sync Favorites to user_favorites table
        const favStr = localStorage.getItem('favoriteSongs') || '[]';
        const favorites = JSON.parse(favStr);
        if (Array.isArray(favorites) && favorites.length > 0) {
            const favPayload = favorites.map(f => ({
                user_id: userId,
                song_id: f.id,
                title: f.name || 'Song',
                artist_name: f.artist || 'Unknown Artist',
                album_name: f.album || '',
                thumbnail_url: f.image || '',
                duration: f.duration || 0
            }));

            fetch(`${SUPABASE_URL}/rest/v1/user_favorites?on_conflict=user_id,song_id`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(favPayload)
            }).catch(() => {});
        }

        // 2. Sync Playlists to user_playlists & user_playlist_songs
        const plStr = localStorage.getItem('user_playlists') || '[]';
        const playlists = JSON.parse(plStr);
        if (Array.isArray(playlists) && playlists.length > 0) {
            const plPayload = [];
            const plSongsPayload = [];

            playlists.forEach(pl => {
                plPayload.push({
                    user_id: userId,
                    playlist_id: pl.id,
                    name: pl.name,
                    song_count: pl.songs ? pl.songs.length : 0
                });

                if (Array.isArray(pl.songs)) {
                    pl.songs.forEach((s, idx) => {
                        plSongsPayload.push({
                            user_id: userId,
                            playlist_id: pl.id,
                            song_id: s.id,
                            title: s.name || 'Song',
                            artist_name: s.artist || 'Unknown Artist',
                            album_name: s.album || '',
                            thumbnail_url: s.image || '',
                            duration: s.duration || 0,
                            position: idx
                        });
                    });
                }
            });

            fetch(`${SUPABASE_URL}/rest/v1/user_playlists?on_conflict=user_id,playlist_id`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(plPayload)
            }).catch(() => {});

            if (plSongsPayload.length > 0) {
                fetch(`${SUPABASE_URL}/rest/v1/user_playlist_songs?on_conflict=user_id,playlist_id,song_id`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify(plSongsPayload)
                }).catch(() => {});
            }
        }

        // 3. Upload complete JSON backup to storage bucket
        const fullBackup = {
            favoriteSongs: favStr,
            user_playlists: plStr,
            saved_albums: localStorage.getItem('saved_albums') || '{}',
            subscribedArtists: localStorage.getItem('subscribedArtists') || '[]',
            searchHistory: localStorage.getItem('searchHistory') || '[]',
            playedArtists: localStorage.getItem('playedArtists') || '[]',
            lastPlayedAlbum: localStorage.getItem('lastPlayedAlbum') || 'null',
            icebeats_user_id: userId,
            icebeats_user_name: localStorage.getItem('icebeats_user_name') || '',
            icebeats_user_avatar: localStorage.getItem('icebeats_user_avatar') || ''
        };

        fetch(`${SUPABASE_URL}/storage/v1/object/backups/icebeats_backup_${userId}.backup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'x-upsert': 'true',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fullBackup)
        }).catch(() => {});

        console.log('Supabase autoBackup complete');
    } catch (e) {
        console.error('Supabase autoBackup error', e);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById('auth-overlay');
    const btnGoogle = document.getElementById('btn-google-login');
    const btnGuest = document.getElementById('btn-guest-login');
    const errorDiv = document.getElementById('auth-error');

    const authState = localStorage.getItem('auth_state');
    if (authState === 'guest') {
        window.isGuestMode = true;
        if (overlay) overlay.style.display = 'none';
    } else if (authState === 'logged_in') {
        window.isGuestMode = false;
        if (overlay) overlay.style.display = 'none';
    } else {
        if (overlay) {
            overlay.style.display = 'flex';
            window.initQrLogin();
        }
    }

    if (btnGuest) {
        btnGuest.addEventListener('click', () => {
            if (qrPollInterval) clearInterval(qrPollInterval);
            localStorage.setItem('auth_state', 'guest');
            window.isGuestMode = true;
            if (overlay) overlay.style.display = 'none';
        });
    }

    // Google Sign-In setup
    let tokenClient;
    function setupGoogleClient() {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile openid',
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        try {
                            btnGoogle.innerText = "Connecting...";
                            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                            });
                            const userInfo = await res.json();
                            
                            if (userInfo.email) {
                                if (qrPollInterval) clearInterval(qrPollInterval);
                                const uid = userInfo.sub || 'g_' + userInfo.email.replace(/[^a-zA-Z0-9]/g, '_');
                                const name = userInfo.name || userInfo.email.split('@')[0];
                                const avatar = userInfo.picture || '';

                                localStorage.setItem('auth_state', 'logged_in');
                                localStorage.setItem('auth_email', userInfo.email);
                                localStorage.setItem('icebeats_user_id', uid);
                                localStorage.setItem('airbeats_user_id', uid);
                                localStorage.setItem('icebeats_user_name', name);
                                localStorage.setItem('airbeats_user_name', name);
                                if (avatar) {
                                    localStorage.setItem('icebeats_user_avatar', avatar);
                                    localStorage.setItem('airbeats_user_avatar', avatar);
                                }
                                window.isGuestMode = false;

                                btnGoogle.innerText = "Restoring library...";
                                await window.restoreFromSupabase(uid);

                                if (overlay) overlay.style.display = 'none';
                                window.location.reload();
                            }
                        } catch (err) {
                            console.error('Google profile fetch failed', err);
                            if (errorDiv) {
                                errorDiv.innerText = "Failed to fetch Google profile.";
                                errorDiv.style.display = 'block';
                            }
                            btnGoogle.innerText = "Continue with Google";
                            btnGoogle.disabled = false;
                        }
                    }
                }
            });
        }
    }

    setupGoogleClient();

    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            if (!tokenClient) {
                setupGoogleClient();
            }
            if (!tokenClient) {
                if (errorDiv) {
                    errorDiv.innerText = "Google Services are still loading or unavailable. Please try QR Code.";
                    errorDiv.style.display = 'block';
                }
                return;
            }
            btnGoogle.innerText = "Waiting for Google...";
            tokenClient.requestAccessToken();
        });
    }
});

window.logoutUser = function() {
    localStorage.removeItem('auth_state');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('icebeats_user_id');
    localStorage.removeItem('airbeats_user_id');
    localStorage.removeItem('icebeats_user_name');
    localStorage.removeItem('airbeats_user_name');
    localStorage.removeItem('icebeats_user_avatar');
    localStorage.removeItem('airbeats_user_avatar');
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('favoriteSongs');
    localStorage.removeItem('user_playlists');
    localStorage.removeItem('saved_albums');
    localStorage.removeItem('subscribedArtists');
    window.location.reload();
};

const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    const trackedKeys = ['favoriteSongs', 'user_playlists', 'saved_albums', 'subscribedArtists', 'searchHistory', 'playedArtists', 'lastPlayedAlbum'];
    if (trackedKeys.includes(key)) {
        if (window.autoBackup && !window.isGuestMode) {
            clearTimeout(window.backupTimeout);
            window.backupTimeout = setTimeout(() => {
                window.autoBackup();
            }, 2000);
        }
    }
};
