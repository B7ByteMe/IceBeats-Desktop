/* IceBeats Landing Page Interactive Script */

/* ==========================================
   Download Handler â€” Dynamic Multi-Platform Releases
   Fetches latest release from GitHub API:
   - Android: B7ByteMe/IceBeats
   - Windows, Linux, MacBook: B7ByteMe/IceBeats-Desktop
   ========================================== */

const _hiddenUrls = {};
function _hideUrl(url) {
    const id = 'dl_' + Math.random().toString(36).substr(2, 9);
    _hiddenUrls[id] = btoa(unescape(encodeURIComponent(url)));
    return id;
}
function _getHiddenUrl(id) {
    if (!id) return null;
    const obf = _hiddenUrls[id];
    if (!obf) {
        // If not found in obfuscated map, check if it's already a direct URL
        if (id.startsWith('http://') || id.startsWith('https://')) return id;
        return null;
    }
    try {
        return decodeURIComponent(escape(atob(obf)));
    } catch (e) {
        return null;
    }
}

const _repos = {
    android: {
        repo: 'B7ByteMe/IceBeats',
        releaseUrl: 'https://github.com/B7ByteMe/IceBeats/releases',
        latestTag: 'v7.0.8',
        badgeId: 'badge_android',
        selectId: 'archSelect_android',
        btnId: 'btnDownloadAndroid',
        btnTextId: 'btnDownloadAndroidText',
        defaultBtnText: 'Download APK',
        defaultDownloadUrl: 'https://github.com/B7ByteMe/IceBeats/releases/download/v7.0.8/IceBeats-v7.0.8.apk',
        fallbackAssets: [
            { name: 'IceBeats-v7.0.8.apk', label: 'Universal APK (.apk) - Recommended', url: 'https://github.com/B7ByteMe/IceBeats/releases/download/v7.0.8/IceBeats-v7.0.8.apk' },
            { name: 'IceBeats-v7.0.8-arm64-v8a.apk', label: 'ARM64-v8a (.apk)', url: 'https://github.com/B7ByteMe/IceBeats/releases/download/v7.0.8/IceBeats-v7.0.8-arm64-v8a.apk' }
        ]
    },
    windows: {
        repo: 'B7ByteMe/IceBeats-Desktop',
        releaseUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases',
        latestTag: 'v0.0.6',
        badgeId: 'badge_windows',
        selectId: 'archSelect_windows',
        btnId: 'btnDownloadWindows',
        btnTextId: 'btnDownloadWindowsText',
        defaultBtnText: 'Download (.exe)',
        defaultDownloadUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-setup.exe',
        fallbackAssets: [
            { name: 'IceBeats-v0.0.6-setup.exe', label: 'Setup Installer (.exe) - Recommended', url: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-setup.exe' },
            { name: 'IceBeats-v0.0.6-portable.exe', label: 'Portable (.exe)', url: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-portable.exe' }
        ]
    },
    linux: {
        repo: 'B7ByteMe/IceBeats-Desktop',
        releaseUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases',
        latestTag: 'v0.0.6',
        badgeId: 'badge_linux',
        selectId: 'archSelect_linux',
        btnId: 'btnDownloadLinux',
        btnTextId: 'btnDownloadLinuxText',
        defaultBtnText: 'Download (.AppImage)',
        defaultDownloadUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-linux.AppImage',
        fallbackAssets: [
            { name: 'IceBeats-v0.0.6-linux.AppImage', label: 'AppImage (.AppImage) - Standalone', url: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-linux.AppImage' },
            { name: 'IceBeats-v0.0.6-linux.deb', label: 'Debian / Ubuntu (.deb)', url: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-linux.deb' }
        ]
    },
    mac: {
        repo: 'B7ByteMe/IceBeats-Desktop',
        releaseUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases',
        latestTag: 'v0.0.6',
        badgeId: 'badge_mac',
        selectId: 'archSelect_mac',
        btnId: 'btnDownloadMac',
        btnTextId: 'btnDownloadMacText',
        defaultBtnText: 'Download (.dmg)',
        defaultDownloadUrl: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-mac.dmg',
        fallbackAssets: [
            { name: 'IceBeats-v0.0.6-mac.dmg', label: 'Apple Disk Image (.dmg) - Universal', url: 'https://github.com/B7ByteMe/IceBeats-Desktop/releases/download/v0.0.6/IceBeats-v0.0.6-mac.dmg' }
        ]
    }
};

(function () {
    // Populate select elements with default/fallback assets
    function _populateDropdown(platform, items) {
        const config = _repos[platform];
        if (!config) return;
        const sel = document.getElementById(config.selectId);
        if (!sel) return;
        sel.innerHTML = '';
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = _hideUrl(item.url || item.browser_download_url);
            opt.textContent = item.label || item.name;
            sel.appendChild(opt);
        });
    }

    // Set badge version text
    function _setVersionBadge(platform, ver) {
        const config = _repos[platform];
        if (!config) return;
        const badge = document.getElementById(config.badgeId);
        if (badge) badge.textContent = ver;
    }

    // Fetch latest release via GitHub REST API
    async function _fetchRepoRelease(repoPath) {
        try {
            const res = await fetch(`https://api.github.com/repos/${repoPath}/releases/latest`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    // Initialize: populate fallback assets immediately, then fetch live data from GitHub API
    window._initDownloadSection = async function () {
        // Initial fallback population
        Object.keys(_repos).forEach(key => {
            const cfg = _repos[key];
            _setVersionBadge(key, cfg.latestTag);
            _populateDropdown(key, cfg.fallbackAssets);
        });

        // Parallel fetch for Android & Desktop releases
        const [androidRes, desktopRes] = await Promise.allSettled([
            _fetchRepoRelease('B7ByteMe/IceBeats'),
            _fetchRepoRelease('B7ByteMe/IceBeats-Desktop')
        ]);

        // Process Android release
        if (androidRes.status === 'fulfilled' && androidRes.value) {
            const data = androidRes.value;
            const tag = data.tag_name || _repos.android.latestTag;
            _repos.android.latestTag = tag;
            _setVersionBadge('android', tag);

            const apkAssets = (data.assets || []).filter(a => a.name.endsWith('.apk'));
            if (apkAssets.length > 0) {
                const items = apkAssets.map(a => {
                    let label = a.name.replace('.apk', '').replace('IceBeats-', '');
                    if (label.startsWith(tag + '-')) {
                        label = label.replace(tag + '-', '');
                    }
                    if (label.toLowerCase() === tag.toLowerCase() || label === '') {
                        label = 'Universal (.apk) - Recommended';
                    } else if (label.toLowerCase().includes('arm64')) {
                        label = 'ARM64-v8a (.apk)';
                    } else {
                        label = `${label} (.apk)`;
                    }
                    return {
                        name: a.name,
                        label: label,
                        url: a.browser_download_url
                    };
                });
                _populateDropdown('android', items);
                _repos.android.defaultDownloadUrl = apkAssets[0].browser_download_url;
            }
        }

        // Process Desktop releases (Windows, Linux, MacBook)
        if (desktopRes.status === 'fulfilled' && desktopRes.value) {
            const data = desktopRes.value;
            const tag = data.tag_name || _repos.windows.latestTag;
            const assets = data.assets || [];

            // Update tags
            ['windows', 'linux', 'mac'].forEach(p => {
                _repos[p].latestTag = tag;
                _setVersionBadge(p, tag);
            });

            // 1. Windows assets (.exe)
            const winAssets = assets.filter(a => a.name.endsWith('.exe'));
            if (winAssets.length > 0) {
                const items = winAssets.map(a => {
                    let label = 'Windows Executable (.exe)';
                    if (a.name.toLowerCase().includes('setup')) {
                        label = 'Setup Installer (.exe) - Recommended';
                    } else if (a.name.toLowerCase().includes('portable')) {
                        label = 'Portable (.exe)';
                    }
                    return { name: a.name, label: label, url: a.browser_download_url };
                });
                // Sort setup to be first
                items.sort((a, b) => b.label.includes('Recommended') ? 1 : -1);
                _populateDropdown('windows', items);
                _repos.windows.defaultDownloadUrl = items[0].url;
            }

            // 2. Linux assets (.AppImage, .deb, .rpm, .tar.gz)
            const linuxAssets = assets.filter(a =>
                a.name.endsWith('.AppImage') || a.name.endsWith('.deb') || a.name.endsWith('.rpm') || a.name.endsWith('.tar.gz')
            );
            if (linuxAssets.length > 0) {
                const items = linuxAssets.map(a => {
                    let label = a.name;
                    if (a.name.endsWith('.AppImage')) {
                        label = 'AppImage (.AppImage) - Standalone Universal';
                    } else if (a.name.endsWith('.deb')) {
                        label = 'Debian / Ubuntu Package (.deb)';
                    } else if (a.name.endsWith('.rpm')) {
                        label = 'RedHat / Fedora Package (.rpm)';
                    }
                    return { name: a.name, label: label, url: a.browser_download_url };
                });
                // Sort AppImage to be first
                items.sort((a, b) => b.label.includes('AppImage') ? 1 : -1);
                _populateDropdown('linux', items);
                _repos.linux.defaultDownloadUrl = items[0].url;
            }

            // 3. Mac assets (.dmg, .pkg, .zip)
            const macAssets = assets.filter(a =>
                a.name.endsWith('.dmg') || a.name.endsWith('.pkg') || (a.name.toLowerCase().includes('mac') && a.name.endsWith('.zip'))
            );
            if (macAssets.length > 0) {
                const items = macAssets.map(a => {
                    let label = 'Apple Disk Image (.dmg) - Universal';
                    if (a.name.toLowerCase().includes('arm64') || a.name.toLowerCase().includes('m1') || a.name.toLowerCase().includes('silicon')) {
                        label = 'Apple Silicon (.dmg)';
                    } else if (a.name.toLowerCase().includes('intel') || a.name.toLowerCase().includes('x64')) {
                        label = 'Intel Mac (.dmg)';
                    }
                    return { name: a.name, label: label, url: a.browser_download_url };
                });
                _populateDropdown('mac', items);
                _repos.mac.defaultDownloadUrl = items[0].url;
            }
        }
    };

    // Generic Platform Download Handler
    window.handlePlatformDownload = function (platform) {
        const config = _repos[platform];
        if (!config) return;

        const sel = document.getElementById(config.selectId);
        const btn = document.getElementById(config.btnId);
        const btnText = document.getElementById(config.btnTextId);
        const icon = btn ? btn.querySelector('.material-symbols-outlined') : null;

        if (!btn || !icon) return;

        // Resolve download URL
        let url = null;
        if (sel && sel.value) {
            url = _getHiddenUrl(sel.value);
        }
        if (!url) {
            url = config.defaultDownloadUrl || config.releaseUrl;
        }

        // Animate button
        btn.classList.add('loading');
        const origIcon = icon.textContent;
        const origText = btnText ? btnText.textContent : config.defaultBtnText;
        icon.textContent = 'sync';
        if (btnText) btnText.textContent = 'Preparingâ€¦';

        setTimeout(function () {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (err) {
                window.open(config.releaseUrl, '_blank');
            }

            setTimeout(function () {
                btn.classList.remove('loading');
                icon.textContent = origIcon;
                if (btnText) btnText.textContent = origText;
            }, 2000);
        }, 400);
    };

    // Legacy alias
    window.handleAndroidDownload = function () {
        window.handlePlatformDownload('android');
    };
})();

document.addEventListener('DOMContentLoaded', () => {

    // Fetch latest release from GitHub API & update downloads section
    if (typeof _initDownloadSection === 'function') {
        _initDownloadSection();
    }

    // ==========================================
    // 1. Language Dropdown Toggle
    // ==========================================
    const langSelector = document.getElementById('langSelector');
    const langBtn = langSelector.querySelector('.lang-btn');
    const langOpts = langSelector.querySelectorAll('.lang-opt');
    const langBtnText = langSelector.querySelector('.lang-text');

    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langSelector.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        langSelector.classList.remove('open');
    });

    langOpts.forEach(opt => {
        opt.addEventListener('click', (e) => {
            langOpts.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            langBtnText.textContent = opt.dataset.lang.toUpperCase();
            langSelector.classList.remove('open');
            e.stopPropagation();
        });
    });

    // ==========================================
    // 2. Mobile Menu Toggle
    // ==========================================
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');

    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
        mobileToggle.classList.toggle('open');
    });

    // Close mobile menu when clicking a link
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('open');
            mobileToggle.classList.remove('open');
        });
    });

    // ==========================================
    // 3. The Interface Showcase Slide System
    // ==========================================
    const viewsData = [
        {
            badge: "Material 3 Expressive",
            title: "Immersive Player",
            description: "Album artwork focus, customized Samsons track playback, wavy progress indicator, and circular control layout.",
            screenHtml: `
        <img src="screenshot_player.png" alt="IceBeats Player Screen" class="mockup-img">
      `
        },
        {
            badge: "Dynamic Library",
            title: "Smart Library",
            description: "Browse trending playlists, new releases, and all-time favorites with personalized greeting and quick filter pills.",
            screenHtml: `
        <img src="screenshot_home.png" alt="IceBeats Home Screen" class="mockup-img">
      `
        },
        {
            badge: "Advanced Controls",
            title: "Advanced Settings",
            description: "Features the official Valora IceBeats brand logo, developer credits, and settings categories like Appearance, Account, and Audio.",
            screenHtml: `
        <img src="screenshot_settings.png" alt="IceBeats Settings Screen" class="mockup-img">
      `
        }
    ];

    let currentViewIndex = 0;

    const showcaseBadgeText = document.getElementById('showcaseBadgeText');
    const showcaseTitle = document.getElementById('showcaseTitle');
    const showcaseDescription = document.getElementById('showcaseDescription');
    const showcaseScreen = document.getElementById('showcaseScreen');
    const prevShowcaseBtn = document.getElementById('prevShowcaseBtn');
    const nextShowcaseBtn = document.getElementById('nextShowcaseBtn');
    const dots = document.querySelectorAll('.dot');
    const tabItems = document.querySelectorAll('.showcase-tab-item');
    const activeViewNum = document.getElementById('activeViewNum');

    function updateShowcaseView(index) {
        currentViewIndex = index;
        const view = viewsData[index];

        // Add transition fade out/in effect
        showcaseScreen.style.opacity = 0;

        setTimeout(() => {
            showcaseBadgeText.textContent = view.badge;
            showcaseTitle.textContent = view.title;
            showcaseDescription.textContent = view.description;
            showcaseScreen.innerHTML = view.screenHtml;
            showcaseScreen.style.opacity = 1;
        }, 200);

        activeViewNum.textContent = `0${index + 1}`;

        // Update dot indicators
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === index);
        });

        // Update side tabs
        tabItems.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === index);
        });
    }

    // Event Listeners for controls
    prevShowcaseBtn.addEventListener('click', () => {
        let nextIdx = currentViewIndex - 1;
        if (nextIdx < 0) nextIdx = viewsData.length - 1;
        updateShowcaseView(nextIdx);
    });

    nextShowcaseBtn.addEventListener('click', () => {
        let nextIdx = currentViewIndex + 1;
        if (nextIdx >= viewsData.length) nextIdx = 0;
        updateShowcaseView(nextIdx);
    });

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const idx = parseInt(dot.dataset.index);
            updateShowcaseView(idx);
        });
    });

    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            const idx = parseInt(tab.dataset.index);
            updateShowcaseView(idx);
        });
    });

    // Initialize view
    updateShowcaseView(0);


    // ==========================================
    // 4. View Demo Interactive Modal & Synthesizer
    // ==========================================
    const viewDemoBtn = document.getElementById('viewDemoBtn');
    const demoModal = document.getElementById('demoModal');
    const closeDemoBtn = document.getElementById('closeDemoBtn');
    const modalBackdrop = demoModal.querySelector('.modal-backdrop');

    const demoPlayBtn = document.getElementById('demoPlayBtn');
    const demoPlayIcon = document.getElementById('demoPlayIcon');
    const demoVinyl = demoModal.querySelector('.demo-vinyl');
    const visualizer = document.getElementById('visualizer');
    const volumeRange = document.getElementById('demoVolumeRange');

    // Web Audio Synth Variables
    let audioCtx = null;
    let isPlaying = false;
    let synthInterval = null;
    let masterGain = null;

    // Open modal
    viewDemoBtn.addEventListener('click', () => {
        demoModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    });

    // Close modal helper
    function closeModal() {
        demoModal.classList.remove('open');
        document.body.style.overflow = '';
        stopSynthesizer();
    }

    closeDemoBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // Synth Play/Pause trigger
    demoPlayBtn.addEventListener('click', () => {
        if (!isPlaying) {
            startSynthesizer();
        } else {
            stopSynthesizer();
        }
    });

    // Synthesizer Audio Generation (Dynamic Lofi Tone Sequence)
    function startSynthesizer() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume audio context if suspended (browser security)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isPlaying = true;
        demoPlayIcon.textContent = 'pause';
        demoPlayBtn.querySelector('span:last-child').textContent = 'Pause Demo';
        demoVinyl.classList.add('playing');
        visualizer.classList.add('active');

        // Create main gain
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(parseFloat(volumeRange.value), audioCtx.currentTime);

        // Add low pass filter for warm lofi sound
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioCtx.currentTime);

        // Connect nodes
        masterGain.connect(filter);
        filter.connect(audioCtx.destination);

        // Dynamic sequence patterns (chords: Fm7, Bb7, Ebmaj7, C7)
        const chords = [
            [174.61, 207.65, 261.63, 311.13], // Fm7
            [233.08, 277.18, 349.23, 440.00], // Bb7
            [155.56, 196.00, 233.08, 293.66], // Ebmaj7
            [130.81, 164.81, 196.00, 261.63]  // C7
        ];
        let chordIndex = 0;

        function playNote(freq, time, duration) {
            if (!isPlaying) return;
            const osc = audioCtx.createOscillator();
            const noteGain = audioCtx.createGain();

            // Triangle wave for smooth soft sound
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            // Envelope
            noteGain.gain.setValueAtTime(0, time);
            noteGain.gain.linearRampToValueAtTime(0.2, time + 0.1);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

            osc.connect(noteGain);
            noteGain.connect(masterGain);

            osc.start(time);
            osc.stop(time + duration);
        }

        // Play loop
        let step = 0;
        synthInterval = setInterval(() => {
            const now = audioCtx.currentTime;

            // Play a chord note on step 0, 2, 4, 6
            if (step % 8 === 0) {
                const currentChord = chords[chordIndex];
                currentChord.forEach(freq => {
                    playNote(freq, now, 1.8);
                });
                chordIndex = (chordIndex + 1) % chords.length;
            }

            // Random melodic soft arpeggio on offbeats
            if (step % 2 === 1 && Math.random() > 0.4) {
                const baseChord = chords[(chordIndex - 1 + chords.length) % chords.length];
                // Play higher octave note
                const randomFreq = baseChord[Math.floor(Math.random() * baseChord.length)] * 2;
                playNote(randomFreq, now, 0.4);
            }

            // Dynamic visualizer bars animation
            const bars = visualizer.querySelectorAll('span');
            bars.forEach(bar => {
                const height = Math.floor(Math.random() * 32) + 6;
                bar.style.height = `${height}px`;
            });

            step = (step + 1) % 16;
        }, 250);
    }

    function stopSynthesizer() {
        isPlaying = false;
        demoPlayIcon.textContent = 'play_arrow';
        demoPlayBtn.querySelector('span:last-child').textContent = 'Play Demo Music';
        demoVinyl.classList.remove('playing');
        visualizer.classList.remove('active');

        if (synthInterval) {
            clearInterval(synthInterval);
            synthInterval = null;
        }

        if (masterGain) {
            try {
                masterGain.disconnect();
            } catch (e) { }
            masterGain = null;
        }

        // Reset visualizer bars
        const bars = visualizer.querySelectorAll('span');
        bars.forEach(bar => bar.style.height = '4px');
    }

    // Adjust volume range slider listener
    volumeRange.addEventListener('input', () => {
        if (masterGain && audioCtx) {
            masterGain.gain.setValueAtTime(parseFloat(volumeRange.value), audioCtx.currentTime);
        }
    });

    // ==========================================
    // 5. Changelog & Versions Modals
    // ==========================================

    // Caches per repo
    const _clData = {};
    const _verData = {};

    function _closeInfoModal(id) {
        const m = document.getElementById(id);
        if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
    }

    // --- CHANGELOG MODAL ---
    window.showChangelog = async function (platformOrType = 'android') {
        const isDesktop = platformOrType === 'desktop' || platformOrType === 'windows' || platformOrType === 'linux' || platformOrType === 'mac';
        const repo = isDesktop ? 'B7ByteMe/IceBeats-Desktop' : 'B7ByteMe/IceBeats';
        const modalTitle = isDesktop ? "IceBeats Desktop - What's New" : "IceBeats Android - What's New";

        const modal = document.getElementById('changelogModal');
        const body = document.getElementById('changelogModalBody');
        const title = document.getElementById('changelogModalTitle');
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        if (_clData[repo]) {
            _renderChangelog(_clData[repo], body, title, modalTitle);
            return;
        }

        body.innerHTML = _loadingHtml('Loading release notesâ€¦');
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
                headers: { Accept: 'application/vnd.github.v3+json' }
            });
            if (!res.ok) throw new Error("GitHub API Error " + res.status);
            _clData[repo] = await res.json();
            _renderChangelog(_clData[repo], body, title, modalTitle);
        } catch (e) {
            const releaseUrl = isDesktop ? 'https://github.com/B7ByteMe/IceBeats-Desktop/releases' : 'https://github.com/B7ByteMe/IceBeats/releases';
            body.innerHTML = _errorHtml(`Could not load changelog. <br><a href="${releaseUrl}" target="_blank" style="color:var(--accent); text-decoration:underline; margin-top:10px; display:inline-block;">View Releases on GitHub â†’</a>`);
        }
    };

    function _renderChangelog(data, body, title, defaultTitle) {
        if (title) title.textContent = data.name || data.tag_name || defaultTitle;
        const date = data.published_at
            ? new Date(data.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : '';
        body.innerHTML = `
      <div class="cl-meta">
        <span class="cl-tag">${data.tag_name || ''}</span>
        ${date ? `<span class="cl-date"><span class="material-symbols-outlined">calendar_today</span>${date}</span>` : ''}
        ${data.prerelease ? '<span class="cl-pre">Pre-release</span>' : ''}
      </div>
      <div class="cl-body">${_mdToHtml(data.body)}</div>
    `;
    }

    // --- VERSIONS MODAL ---
    window.showVersions = async function (platformOrType = 'android') {
        const isDesktop = platformOrType === 'desktop' || platformOrType === 'windows' || platformOrType === 'linux' || platformOrType === 'mac';
        const repo = isDesktop ? 'B7ByteMe/IceBeats-Desktop' : 'B7ByteMe/IceBeats';

        const modal = document.getElementById('versionsModal');
        const body = document.getElementById('versionsModalBody');
        const hint = modal.querySelector('.modal-header-hint');
        if (hint) {
            hint.textContent = isDesktop ? 'Releases for Windows, Linux & macOS' : 'Releases for Android';
        }

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        if (_verData[repo]) {
            _renderVersions(_verData[repo], body, isDesktop);
            return;
        }

        body.innerHTML = _loadingHtml('Loading versionsâ€¦');
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`, {
                headers: { Accept: 'application/vnd.github.v3+json' }
            });
            if (!res.ok) throw new Error("GitHub API Error " + res.status);
            _verData[repo] = await res.json();
            _renderVersions(_verData[repo], body, isDesktop);
        } catch (e) {
            const releaseUrl = isDesktop ? 'https://github.com/B7ByteMe/IceBeats-Desktop/releases' : 'https://github.com/B7ByteMe/IceBeats/releases';
            body.innerHTML = _errorHtml(`Could not load versions list. <br><a href="${releaseUrl}" target="_blank" style="color:var(--accent); text-decoration:underline; margin-top:10px; display:inline-block;">View Releases on GitHub â†’</a>`);
        }
    };

    function _renderVersions(releases, body, isDesktop) {
        if (!Array.isArray(releases) || releases.length === 0) {
            body.innerHTML = _errorHtml('No releases found.'); return;
        }
        const rows = releases.map((r) => {
            const date = r.published_at
                ? new Date(r.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : '';
            const allAssets = r.assets || [];

            let filteredAssets = [];
            if (isDesktop) {
                // All desktop executables and packages
                filteredAssets = allAssets.filter(a =>
                    a.name.endsWith('.exe') || a.name.endsWith('.AppImage') ||
                    a.name.endsWith('.deb') || a.name.endsWith('.dmg') ||
                    a.name.endsWith('.pkg') || a.name.endsWith('.zip')
                );
            } else {
                // Android APK
                filteredAssets = allAssets.filter(a => a.name.endsWith('.apk'));
            }

            let buttonsHtml = '<span class="ver-no-dl">No files</span>';
            if (filteredAssets.length > 0) {
                buttonsHtml = `<div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">` +
                    filteredAssets.map(a => {
                        let btnName = a.name;
                        const lower = a.name.toLowerCase();
                        if (lower.endsWith('.apk')) {
                            btnName = lower.includes('arm64') ? 'ARM64 APK' : 'APK';
                        } else if (lower.endsWith('.exe')) {
                            btnName = lower.includes('setup') ? 'Win Setup' : (lower.includes('portable') ? 'Win Portable' : 'Windows .exe');
                        } else if (lower.endsWith('.appimage')) {
                            btnName = 'AppImage';
                        } else if (lower.endsWith('.deb')) {
                            btnName = 'Debian .deb';
                        } else if (lower.endsWith('.dmg')) {
                            btnName = 'macOS .dmg';
                        }
                        return `<button class="btn-ver-dl" data-url="${_hideUrl(a.browser_download_url)}" title="Download ${a.name}">
                      <span class="material-symbols-outlined">download</span>
                      <span>${btnName}</span>
                    </button>`;
                    }).join('') + `</div>`;
            }

            return `
        <div class="ver-row">
          <div class="ver-info">
            <span class="ver-tag">${r.tag_name || ''}</span>
            <span class="ver-name">${r.name || r.tag_name || ''}</span>
            ${date ? `<span class="ver-date">${date}</span>` : ''}
          </div>
          ${buttonsHtml}
        </div>`;
        }).join('');
        body.innerHTML = rows;

        // Bind download buttons
        body.querySelectorAll('.btn-ver-dl').forEach(btn => {
            btn.addEventListener('click', function () {
                const urlId = this.dataset.url;
                const url = _getHiddenUrl(urlId);
                if (!url) return;
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        });
    }

    // Shared helpers
    function _loadingHtml(msg) {
        return `<div class="modal-status"><span class="material-symbols-outlined anim-spin">sync</span><p>${msg}</p></div>`;
    }
    function _errorHtml(msg) {
        return `<div class="modal-status modal-status--error"><span class="material-symbols-outlined">error_outline</span><p>${msg}</p></div>`;
    }

    // Close buttons & backdrops
    document.getElementById('closeChangelogBtn')?.addEventListener('click', () => _closeInfoModal('changelogModal'));
    document.getElementById('closeVersionsBtn')?.addEventListener('click', () => _closeInfoModal('versionsModal'));
    document.getElementById('changelogBackdrop')?.addEventListener('click', () => _closeInfoModal('changelogModal'));
    document.getElementById('versionsBackdrop')?.addEventListener('click', () => _closeInfoModal('versionsModal'));

});


