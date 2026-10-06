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
        // Await publishing to both storage bucket AND SQL table for guaranteed mobile sync
        await Promise.allSettled([
            fetch(`${SUPABASE_URL}/storage/v1/object/backups/qr_sessions/${currentQrToken}.json`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-upsert': 'true',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            }),
            fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions`, {
                method: 'POST',
                headers: getSupabaseHeaders(),
                body: JSON.stringify(sessionData)
            })
        ]);
    } catch (e) {
        console.warn('Failed to publish initial QR session to cloud', e);
    }

    // Start polling every 1200ms
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

            // 1. Check storage bucket first (fastest sync with mobile app)
            try {
                const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/backups/qr_sessions/${currentQrToken}.json?_t=${Date.now()}`, {
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (bucketRes.ok) {
                    const bData = await bucketRes.json();
                    if (bData && (bData.status === 'approved' || bData.status === 'completed')) {
                        sessionResult = bData;
                    }
                }
            } catch(e) {}

            // 2. Check SQL table if not approved via bucket
            if (!sessionResult) {
                try {
                    const tableRes = await fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions?id=eq.${currentQrToken}&select=*`, {
                        headers: getSupabaseHeaders()
                    });
                    if (tableRes.ok) {
                        const rows = await tableRes.json();
                        if (rows && rows.length > 0) {
                            const r = rows[0];
                            if (r.status === 'approved' || r.status === 'completed') {
                                sessionResult = r;
                            }
                        }
                    }
                } catch(e) {}
            }

            if (sessionResult && (sessionResult.status === 'approved' || sessionResult.status === 'completed')) {
                clearInterval(qrPollInterval);
                if (laser) laser.style.display = 'none';
                if (statusText) statusText.innerHTML = '<span style="color:#1ed760;"><i class="fas fa-check-circle"></i> Berhasil! Menghubungkan akun...</span>';

                // Save session details (support both direct fields and user_data)
                const s = sessionResult.user_data || sessionResult;
                const uid = s.user_id || s.uid;
                const email = s.user_email || s.email || 'user@icebeats.app';
                const name = s.user_name || s.name || email.split('@')[0];
                const avatar = s.user_avatar || s.avatar || '';
                const token = s.auth_token || s.access_token || '';

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
    }, 1200);
};

/**
 * Restore Favorites & Playlists from Supabase (identical database logic to APK)
 * Synchronizes seamlessly with the IceBeats Android App
 */
window.restoreFromSupabase = async function(userId) {
    if (!userId) return;
    try {
        const headers = getSupabaseHeaders();
        const email = localStorage.getItem('auth_email') || '';

        // 1. Fetch user_favorites (query by userId and email to guarantee Android compatibility)
        let favRows = [];
        try {
            const favRes = await fetch(`${SUPABASE_URL}/rest/v1/user_favorites?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
                headers: { ...headers, 'Cache-Control': 'no-cache' }
            });
            if (favRes.ok) {
                const resJson = await favRes.json();
                if (Array.isArray(resJson)) favRows.push(...resJson);
            }
        } catch(e) {}

        if (email && email !== userId) {
            try {
                const favEmailRes = await fetch(`${SUPABASE_URL}/rest/v1/user_favorites?user_id=eq.${encodeURIComponent(email)}&select=*`, {
                    headers: { ...headers, 'Cache-Control': 'no-cache' }
                });
                if (favEmailRes.ok) {
                    const resJson = await favEmailRes.json();
                    if (Array.isArray(resJson)) favRows.push(...resJson);
                }
            } catch(e) {}
        }

        if (favRows.length > 0) {
            const existingFavs = JSON.parse(localStorage.getItem('favoriteSongs') || '[]');
            const songMap = new Map();
            existingFavs.forEach(s => { if (s && s.id) songMap.set(String(s.id), s); });

            favRows.forEach(row => {
                if (row && row.song_id) {
                    songMap.set(String(row.song_id), {
                        id: String(row.song_id),
                        name: row.title || 'Song',
                        artist: row.artist_name || 'Unknown Artist',
                        album: row.album_name || '',
                        image: row.thumbnail_url || '',
                        duration: row.duration || 0
                    });
                }
            });

            const mergedFavs = Array.from(songMap.values());
            localStorage.setItem('favoriteSongs', JSON.stringify(mergedFavs));
            if (typeof window.favoriteSongs !== 'undefined') {
                window.favoriteSongs = mergedFavs;
            }
        }

        // 2. Fetch user_playlists & user_playlist_songs
        let playlists = [];
        let allSongs = [];
        try {
            const plRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlists?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
                headers: { ...headers, 'Cache-Control': 'no-cache' }
            });
            if (plRes.ok) {
                const r = await plRes.json();
                if (Array.isArray(r)) playlists.push(...r);
            }

            const plSongsRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlist_songs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=position.asc`, {
                headers: { ...headers, 'Cache-Control': 'no-cache' }
            });
            if (plSongsRes.ok) {
                const r = await plSongsRes.json();
                if (Array.isArray(r)) allSongs.push(...r);
            }
        } catch(e) {}

        if (email && email !== userId) {
            try {
                const plEmailRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlists?user_id=eq.${encodeURIComponent(email)}&select=*`, {
                    headers: { ...headers, 'Cache-Control': 'no-cache' }
                });
                if (plEmailRes.ok) {
                    const r = await plEmailRes.json();
                    if (Array.isArray(r)) playlists.push(...r);
                }

                const plSongsEmailRes = await fetch(`${SUPABASE_URL}/rest/v1/user_playlist_songs?user_id=eq.${encodeURIComponent(email)}&select=*&order=position.asc`, {
                    headers: { ...headers, 'Cache-Control': 'no-cache' }
                });
                if (plSongsEmailRes.ok) {
                    const r = await plSongsEmailRes.json();
                    if (Array.isArray(r)) allSongs.push(...r);
                }
            } catch(e) {}
        }

        if (playlists.length > 0) {
            const existingPlaylists = JSON.parse(localStorage.getItem('user_playlists') || '[]');
            const plMap = new Map();
            existingPlaylists.forEach(p => { if (p && p.id) plMap.set(String(p.id), p); });

            playlists.forEach(pl => {
                const pid = String(pl.playlist_id);
                const songsForPl = allSongs.filter(s => String(s.playlist_id) === pid).map(s => ({
                    id: String(s.song_id),
                    name: s.title || 'Song',
                    artist: s.artist_name || 'Unknown Artist',
                    album: s.album_name || '',
                    image: s.thumbnail_url || '',
                    duration: s.duration || 0
                }));
                plMap.set(pid, {
                    id: pid,
                    name: pl.name,
                    songs: songsForPl
                });
            });

            localStorage.setItem('user_playlists', JSON.stringify(Array.from(plMap.values())));
        }

        // 3. Check for full backup file in Supabase storage & local backend proxy
        const checkBackupFile = async (url) => {
            try {
                const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
                if (res.ok) {
                    const backupData = await res.json();
                    if (backupData) {
                        if (backupData.saved_albums) localStorage.setItem('saved_albums', typeof backupData.saved_albums === 'string' ? backupData.saved_albums : JSON.stringify(backupData.saved_albums));
                        if (backupData.subscribedArtists) localStorage.setItem('subscribedArtists', typeof backupData.subscribedArtists === 'string' ? backupData.subscribedArtists : JSON.stringify(backupData.subscribedArtists));
                        if (backupData.searchHistory) localStorage.setItem('searchHistory', typeof backupData.searchHistory === 'string' ? backupData.searchHistory : JSON.stringify(backupData.searchHistory));
                        if (backupData.playedArtists) localStorage.setItem('playedArtists', typeof backupData.playedArtists === 'string' ? backupData.playedArtists : JSON.stringify(backupData.playedArtists));
                        if (backupData.lastPlayedAlbum) localStorage.setItem('lastPlayedAlbum', typeof backupData.lastPlayedAlbum === 'string' ? backupData.lastPlayedAlbum : JSON.stringify(backupData.lastPlayedAlbum));
                    }
                }
            } catch(e) {}
        };

        await checkBackupFile(`${SUPABASE_URL}/storage/v1/object/public/backups/icebeats_backup_${userId}.backup?_t=${Date.now()}`);
        if (email) {
            await checkBackupFile(`${SUPABASE_URL}/storage/v1/object/public/backups/icebeats_backup_${email}.backup?_t=${Date.now()}`);
            await checkBackupFile(`/api/auth/restore?email=${encodeURIComponent(email)}`);
        }

        console.log('[Supabase Sync] Successfully synchronized library with Android and Cloud!');
    } catch (err) {
        console.error('[Supabase Sync] Failed to synchronize from Supabase:', err);
    }
};

window.restoreFromCloud = window.restoreFromSupabase;

/**
 * Backup Favorites & Playlists to Supabase Cloud
 * Syncs seamlessly back to the Android APK
 */
window.autoBackup = async function() {
    if (window.isGuestMode) return;
    const userId = localStorage.getItem('icebeats_user_id') || localStorage.getItem('airbeats_user_id');
    if (!userId) return;
    const email = localStorage.getItem('auth_email') || '';

    try {
        const headers = getSupabaseHeaders();

        // 1. Sync Favorites to user_favorites table
        const favStr = localStorage.getItem('favoriteSongs') || '[]';
        const favorites = JSON.parse(favStr);
        if (Array.isArray(favorites) && favorites.length > 0) {
            const favPayload = favorites.map(f => ({
                user_id: userId,
                song_id: String(f.id),
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
                    playlist_id: String(pl.id),
                    name: pl.name,
                    song_count: pl.songs ? pl.songs.length : 0
                });

                if (Array.isArray(pl.songs)) {
                    pl.songs.forEach((s, idx) => {
                        plSongsPayload.push({
                            user_id: userId,
                            playlist_id: String(pl.id),
                            song_id: String(s.id),
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

        if (email) {
            // Also sync to backend proxy endpoint
            fetch(`/api/auth/backup?email=${encodeURIComponent(email)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullBackup)
            }).catch(() => {});
        }

        console.log('[Supabase Sync] autoBackup complete (synced to cloud)');
    } catch (e) {
        console.error('[Supabase Sync] autoBackup error', e);
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
        
        // Auto-sync from Supabase / Android in background on every app startup!
        const uid = localStorage.getItem('icebeats_user_id') || localStorage.getItem('airbeats_user_id');
        if (uid && window.restoreFromSupabase) {
            window.restoreFromSupabase(uid).catch(() => {});
        }
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

    // Google Sign-In setup via Local Server & Website / Cloud Sync
    let googleBrowserPollInterval = null;

    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const sessionToken = `ib_g_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
            
            // 1. Register pending session to Supabase
            const sessionData = {
                id: sessionToken,
                status: "pending",
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            };

            try {
                await Promise.allSettled([
                    fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions`, {
                        method: 'POST',
                        headers: getSupabaseHeaders(),
                        body: JSON.stringify(sessionData)
                    }),
                    fetch(`${SUPABASE_URL}/storage/v1/object/backups/qr_sessions/${sessionToken}.json`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'x-upsert': 'true',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(sessionData)
                    })
                ]);
            } catch (err) {
                console.warn('Failed to publish Google session to Supabase', err);
            }

            // 2. Open login in external browser:
            // Prefer direct local OAuth callback (fast, robust, no redirect loops)
            // with seamless fallback to official website
            const localLoginUrl = 'http://127.0.0.1:8000/auth/google/login';
            const webLoginUrl = `https://icebeats.pages.dev/auth/login?session=${encodeURIComponent(sessionToken)}`;
            const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || !!window.electronAPI;
            const targetLoginUrl = isLocal ? localLoginUrl : webLoginUrl;

            if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(targetLoginUrl);
            } else {
                window.open(targetLoginUrl, '_blank');
            }

            btnGoogle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menunggu login di browser...';
            btnGoogle.disabled = true;
            if (errorDiv) errorDiv.style.display = 'none';

            if (googleBrowserPollInterval) clearInterval(googleBrowserPollInterval);

            // 3. Poll local server session and Supabase Cloud for completed session
            googleBrowserPollInterval = setInterval(async () => {
                try {
                    let s = null;

                    // Priority A: Local server session (instantaneous for desktop app)
                    try {
                        const res = await fetch('/api/auth/session');
                        const json = await res.json();
                        if (json && json.logged_in && json.session) {
                            s = json.session;
                        }
                    } catch (e) {}

                    // Priority B: Supabase cloud SQL table
                    if (!s) {
                        try {
                            const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/auth_qr_sessions?id=eq.${encodeURIComponent(sessionToken)}&select=*`, {
                                headers: getSupabaseHeaders()
                            });
                            const supaRows = await supaRes.json();
                            if (Array.isArray(supaRows) && supaRows.length > 0) {
                                const row = supaRows[0];
                                if (row.status === 'completed' || row.status === 'approved') {
                                    s = row.user_data || {
                                        uid: row.user_id,
                                        email: row.user_email,
                                        name: row.user_name,
                                        avatar: row.user_avatar,
                                        access_token: row.auth_token
                                    };
                                }
                            }
                        } catch (e) {}
                    }

                    // Priority C: Supabase cloud storage bucket
                    if (!s) {
                        try {
                            const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/backups/qr_sessions/${encodeURIComponent(sessionToken)}.json?_t=${Date.now()}`, {
                                headers: { 'Cache-Control': 'no-cache' }
                            });
                            if (bucketRes.ok) {
                                const bData = await bucketRes.json();
                                if (bData && (bData.status === 'completed' || bData.status === 'approved')) {
                                    s = bData.user_data || {
                                        uid: bData.user_id,
                                        email: bData.user_email,
                                        name: bData.user_name,
                                        avatar: bData.user_avatar,
                                        access_token: bData.auth_token
                                    };
                                }
                            }
                        } catch (e) {}
                    }
                    
                    if (s) {
                        clearInterval(googleBrowserPollInterval);
                        googleBrowserPollInterval = null;

                        const uid = s.uid || s.user_id || 'g_' + (s.email || s.user_email || 'user').replace(/[^a-zA-Z0-9]/g, '_');
                        const name = s.name || s.user_name || ((s.email || s.user_email) ? (s.email || s.user_email).split('@')[0] : 'User');
                        const avatar = s.avatar || s.user_avatar || '';
                        const accessToken = s.access_token || s.auth_token || '';

                        localStorage.setItem('auth_state', 'logged_in');
                        if (s.email || s.user_email) localStorage.setItem('auth_email', s.email || s.user_email);
                        localStorage.setItem('icebeats_user_id', uid);
                        localStorage.setItem('airbeats_user_id', uid);
                        localStorage.setItem('icebeats_user_name', name);
                        localStorage.setItem('airbeats_user_name', name);
                        if (avatar) {
                            localStorage.setItem('icebeats_user_avatar', avatar);
                            localStorage.setItem('airbeats_user_avatar', avatar);
                        }
                        if (accessToken) {
                            localStorage.setItem('supabase_access_token', accessToken);
                        }
                        window.isGuestMode = false;

                        btnGoogle.innerHTML = '<i class="fas fa-check"></i> Berhasil masuk!';
                        await window.restoreFromSupabase(uid);

                        if (overlay) overlay.style.display = 'none';
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('Polling auth session error', e);
                }
            }, 1000);

            // Timeout after 3 minutes if user didn't complete login
            setTimeout(() => {
                if (googleBrowserPollInterval) {
                    clearInterval(googleBrowserPollInterval);
                    googleBrowserPollInterval = null;
                    btnGoogle.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" style="width: 18px;"> Continue with Google';
                    btnGoogle.disabled = false;
                }
            }, 180000);
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
