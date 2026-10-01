const container = document.getElementById('island-container');
const minArt = document.getElementById('min-art');
const expArt = document.getElementById('exp-art');
const expTitle = document.getElementById('exp-title');
const expArtist = document.getElementById('exp-artist');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const progressBarFill = document.getElementById('progress-bar-fill');
const playBtn = document.getElementById('btn-play');
const playIcon = playBtn.querySelector('i');

let hideTimeout;
let pauseHideTimeout;
let isExpanded = false;
let isPlaying = false;

minArt.onerror = () => { minArt.src = 'icon.png'; };
expArt.onerror = () => { expArt.src = 'icon.png'; };

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetTimer() {
    if (hideTimeout) clearTimeout(hideTimeout);
    if (isExpanded) {
        hideTimeout = setTimeout(() => {
            if (window.electronAPI && window.electronAPI.shrinkIsland) {
                window.electronAPI.shrinkIsland();
            }
            container.className = 'island minimized';
            isExpanded = false;
        }, 5000);
    }
}

container.addEventListener('click', (e) => {
    // If clicking on control buttons, don't trigger expand toggle
    if (e.target.closest('.control-btn')) return;
    
    if (!isExpanded) {
        if (window.electronAPI && window.electronAPI.expandIsland) {
            window.electronAPI.expandIsland(true);
        }
    }
});

// Double-click anywhere on island (when expanded) restores the main window
container.addEventListener('dblclick', (e) => {
    if (e.target.closest('.control-btn')) return;
    window.electronAPI?.sendAction('restore-window');
});

// Click on track-info area (title/artist) when expanded also restores window
document.querySelector('.track-info')?.addEventListener('click', (e) => {
    if (isExpanded) {
        window.electronAPI?.sendAction('restore-window');
    }
});

if (window.electronAPI) {
    if (window.electronAPI.onDoExpand) {
        window.electronAPI.onDoExpand(() => {
            container.className = 'island expanded';
            isExpanded = true;
            resetTimer();
        });
    }

    if (window.electronAPI.onDoShrink) {
        window.electronAPI.onDoShrink(() => {
            if (isExpanded) {
                if (window.electronAPI.shrinkIsland) {
                    window.electronAPI.shrinkIsland();
                }
                container.className = 'island minimized';
                isExpanded = false;
                if (hideTimeout) clearTimeout(hideTimeout);
            }
        });
    }
}

// Control Buttons
document.getElementById('btn-prev')?.addEventListener('click', () => {
    window.electronAPI?.sendAction('prev');
    resetTimer();
});
document.getElementById('btn-next')?.addEventListener('click', () => {
    window.electronAPI?.sendAction('next');
    resetTimer();
});
playBtn?.addEventListener('click', () => {
    window.electronAPI?.sendAction('play-pause');
    resetTimer();
});
document.getElementById('btn-heart')?.addEventListener('click', () => {
    window.electronAPI?.sendAction('like');
    resetTimer();
});
document.getElementById('btn-repeat')?.addEventListener('click', () => {
    window.electronAPI?.sendAction('repeat');
    resetTimer();
});
document.getElementById('btn-open-app')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI?.sendAction('restore-window');
});

const progressBarBg = document.querySelector('.progress-bar-bg');
progressBarBg?.addEventListener('click', (e) => {
    const rect = progressBarBg.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    window.electronAPI?.sendAction({ type: 'seek', pct: pct });
    resetTimer();
});

if (window.electronAPI && window.electronAPI.onTrackUpdated) {
    window.electronAPI.onTrackUpdated((data) => {
        if (data.type === 'state') {
            isPlaying = data.state === 'play';
            playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
            
            if (!isPlaying) {
                // Island stays visible when paused — never auto-hide
                if (pauseHideTimeout) clearTimeout(pauseHideTimeout);
            } else {
                if (pauseHideTimeout) clearTimeout(pauseHideTimeout);
                if (container.classList.contains('hidden')) {
                    container.className = 'island minimized';
                }
            }
            return;
        }

        if (data.type === 'time') {
            timeCurrent.innerText = formatTime(data.currentTime);
            timeTotal.innerText = formatTime(data.duration);
            if (data.duration > 0) {
                progressBarFill.style.width = ((data.currentTime / data.duration) * 100) + '%';
            }
            return;
        }

        if (data.type === 'repeat') {
            const btnRepeat = document.getElementById('btn-repeat');
            if (btnRepeat) btnRepeat.style.color = data.active ? '#1ed760' : '';
            return;
        }

        if (data.type === 'like') {
            const btnHeartIcon = document.querySelector('#btn-heart i');
            if (btnHeartIcon) {
                btnHeartIcon.className = data.active ? 'fas fa-heart' : 'far fa-heart';
                btnHeartIcon.style.color = data.active ? '#1ed760' : '';
            }
            return;
        }

        // It's a new track
        if (pauseHideTimeout) clearTimeout(pauseHideTimeout);
        expTitle.innerText = data.title || 'IceBeats Desktop';
        expArtist.innerText = data.artist || 'Ready to play';
        
        const smallImg = data.image ? data.image.replace('w500-h500', 'w120-h120') : 'icon.png';
        minArt.src = smallImg;
        expArt.src = smallImg;

        const btnHeartIcon = document.querySelector('#btn-heart i');
        if (btnHeartIcon) {
            btnHeartIcon.className = data.isFav ? 'fas fa-heart' : 'far fa-heart';
            btnHeartIcon.style.color = data.isFav ? '#1ed760' : '';
        }
        const btnRepeat = document.getElementById('btn-repeat');
        if (btnRepeat) {
            btnRepeat.style.color = data.isRepeat ? '#1ed760' : '';
        }

        isPlaying = true;
        playIcon.className = 'fas fa-pause';

        // Auto-expand on new track
        window.electronAPI?.expandIsland();
    });
}
