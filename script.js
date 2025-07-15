class WinampPlayer {
    constructor() {
        this.audio = new Audio();
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        this.currentThemeColors = ['#00ff00', '#00cc00', '#008800']; // Colores por defecto
        
        // Ecualizador
        this.eqFrequenciesFull = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        this.eqFrequenciesMobile = [60, 310, 1000, 6000, 16000];
        this.eqFrequencies = [];
        this.eqFilters = [];
        this.eqSliders = [];
        this.eqSource = null;

        this.initializeElements();
        this.setupEventListeners();
        this.setupAudioContext();
        this.setupResponsiveEqualizer();
        this.loadPlaylistFromStorage();
        window.addEventListener('resize', () => this.setupResponsiveEqualizer());
    }

    initializeElements() {
        // Elementos de control
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.addBtn = document.getElementById('addBtn');
        this.fileInput = document.getElementById('fileInput');
        
        // Elementos de información
        this.songTitle = document.getElementById('songTitle');
        this.songArtist = document.getElementById('songArtist');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.totalTimeDisplay = document.getElementById('totalTime');
        
        // Elementos de control
        this.progressSlider = document.getElementById('progressSlider');
        this.progressFill = document.getElementById('progressFill');
        this.volumeSlider = document.getElementById('volumeSlider');
        
        // Visualizador
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        
        // Playlist
        this.playlistContainer = document.getElementById('playlist');
    }

    setupEventListeners() {
        // Controles de reproducción
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.previous());
        this.nextBtn.addEventListener('click', () => this.next());
        this.stopBtn.addEventListener('click', () => this.stop());
        
        // Agregar archivos
        this.addBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag & drop
        this.playlistContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.playlistContainer.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Controles de audio
        this.progressSlider.addEventListener('input', (e) => this.seek(e.target.value));
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        
        // Eventos del audio
        this.audio.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('error', (e) => this.handleAudioError(e));
        
        // Controles de ventana
        document.querySelector('.minimize-btn').addEventListener('click', () => this.minimize());
        document.querySelector('.maximize-btn').addEventListener('click', () => this.maximize());
        document.querySelector('.close-btn').addEventListener('click', () => this.close());
        
        // Selector de tema
        const themeSelector = document.getElementById('themeSelector');
        themeSelector.addEventListener('change', (e) => this.changeTheme(e.target.value));
        
        // Cargar tema guardado
        this.loadSavedTheme();
    }

    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
        } catch (error) {
            console.log('AudioContext no soportado');
        }
    }

    setupResponsiveEqualizer() {
        // Decide qué frecuencias usar según el ancho de pantalla
        const width = window.innerWidth;
        if (width < 700) {
            this.eqFrequencies = this.eqFrequenciesMobile;
        } else {
            this.eqFrequencies = this.eqFrequenciesFull;
        }
        this.renderEqualizerBands();
        this.setupEqualizer();
    }

    renderEqualizerBands() {
        const bandsContainer = document.getElementById('equalizerBands');
        if (!bandsContainer) return;
        bandsContainer.innerHTML = '';
        this.eqFrequencies.forEach(freq => {
            const band = document.createElement('div');
            band.className = 'eq-band';
            const gainValue = document.createElement('span');
            gainValue.className = 'eq-gain-value';
            gainValue.textContent = '0 dB';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = -12;
            slider.max = 12;
            slider.value = 0;
            slider.step = 0.5;
            slider.className = 'eq-slider';
            slider.setAttribute('data-freq', freq);
            const label = document.createElement('label');
            label.textContent = freq >= 1000 ? (freq/1000) + 'kHz' : freq + 'Hz';
            band.appendChild(gainValue);
            band.appendChild(slider);
            band.appendChild(label);
            bandsContainer.appendChild(band);
        });
    }

    setupEqualizer() {
        // Obtener sliders del DOM
        this.eqSliders = Array.from(document.querySelectorAll('.eq-slider'));
        this.eqGainLabels = Array.from(document.querySelectorAll('.eq-gain-value'));
        if (!this.audioContext) return;
        // Crear filtros
        this.eqFilters = this.eqFrequencies.map((freq, i) => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.1;
            filter.gain.value = 0;
            return filter;
        });
        // Enlazar sliders a filtros y actualizar el valor mostrado
        this.eqSliders.forEach((slider, i) => {
            slider.addEventListener('input', (e) => {
                const gain = parseFloat(e.target.value);
                this.eqFilters[i].gain.value = gain;
                if (this.eqGainLabels[i]) {
                    // Formato consistente: siempre con signo y dos dígitos
                    const gainStr = `${gain >= 0 ? '+' : ''}${gain.toFixed(0).padStart(2, '0')} dB`;
                    this.eqGainLabels[i].textContent = gainStr;
                }
            });
            // Inicializar el valor mostrado
            if (this.eqGainLabels[i]) {
                const gain = parseFloat(slider.value);
                const gainStr = `${gain >= 0 ? '+' : ''}${gain.toFixed(0).padStart(2, '0')} dB`;
                this.eqGainLabels[i].textContent = gainStr;
            }
        });
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        await this.addFiles(files);
        event.target.value = '';
    }

    async handleDrop(event) {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        await this.addFiles(files);
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }

    async addFiles(files) {
        const audioFiles = files.filter(file => file.type.startsWith('audio/'));
        
        for (const file of audioFiles) {
            const song = {
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: 'Artista Desconocido',
                duration: '0:00',
                file: file,
                url: URL.createObjectURL(file)
            };
            
            // Intentar obtener metadatos si es posible
            try {
                const audio = new Audio();
                audio.src = song.url;
                await new Promise((resolve, reject) => {
                    audio.addEventListener('loadedmetadata', () => {
                        song.duration = this.formatTime(audio.duration);
                        resolve();
                    });
                    audio.addEventListener('error', reject);
                });
            } catch (error) {
                console.log('No se pudieron obtener metadatos para:', file.name);
            }
            
            this.playlist.push(song);
        }
        
        this.updatePlaylistDisplay();
        this.savePlaylistToStorage();
        
        if (this.playlist.length === 1) {
            this.loadSong(0);
        }
    }

    togglePlay() {
        if (this.playlist.length === 0) return;
        
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        if (this.playlist.length === 0) return;
        
        try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            await this.audio.play();
            this.isPlaying = true;
            this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.startVisualizer();
        } catch (error) {
            console.error('Error al reproducir:', error);
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.stopVisualizer();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.stopVisualizer();
        this.updateProgress();
    }

    previous() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadSong(this.currentIndex);
    }

    next() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.loadSong(this.currentIndex);
    }

    async loadSong(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        const song = this.playlist[index];
        this.currentIndex = index;
        
        this.audio.src = song.url;
        this.songTitle.textContent = song.name;
        this.songArtist.textContent = song.artist;
        this.totalTimeDisplay.textContent = song.duration;
        
        this.updatePlaylistDisplay();
        
        if (this.isPlaying) {
            await this.play();
        }
    }

    seek(value) {
        if (this.audio.duration) {
            this.audio.currentTime = (value / 100) * this.audio.duration;
        }
    }

    setVolume(value) {
        this.audio.volume = value / 100;
    }

    updateProgress() {
        if (this.audio.duration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressFill.style.width = progress + '%';
            this.progressSlider.value = progress;
            this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateTimeDisplay() {
        this.totalTimeDisplay.textContent = this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    startVisualizer() {
        if (!this.analyser) return;
        // Desconectar conexiones previas si existen
        if (this.eqSource) {
            try { 
                this.eqSource.disconnect(); 
            } catch (e) {}
            try {
                this.eqSource.mediaElement = null;
            } catch (e) {}
            this.eqSource = null;
        }
        // Crear nueva fuente
        this.eqSource = this.audioContext.createMediaElementSource(this.audio);
        // Conectar filtros en cadena
        let node = this.eqSource;
        this.eqFilters.forEach(filter => {
            node.connect(filter);
            node = filter;
        });
        // node ahora es el último filtro
        node.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.animate();
    }

    stopVisualizer() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.clearCanvas();
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        this.analyser.getByteFrequencyData(this.dataArray);
        this.drawVisualizer();
    }

    drawVisualizer() {
        this.clearCanvas();
        
        const barWidth = (this.canvas.width / this.bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        // Usar colores del tema actual
        const colors = this.currentThemeColors || ['#00ff00', '#00cc00', '#008800'];
        
        for (let i = 0; i < this.bufferLength; i++) {
            barHeight = (this.dataArray[i] / 255) * this.canvas.height;
            
            // Crear gradiente para cada barra con colores del tema
            const gradient = this.ctx.createLinearGradient(0, this.canvas.height - barHeight, 0, this.canvas.height);
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(0.5, colors[1]);
            gradient.addColorStop(1, colors[2]);
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    updatePlaylistDisplay() {
        this.playlistContainer.innerHTML = '';
        
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = '<div class="playlist-placeholder">Arrastra archivos de música aquí o haz clic en "Agregar"</div>';
            return;
        }
        
        this.playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === this.currentIndex ? 'active' : ''}`;
            item.innerHTML = `
                <i class="fas fa-music"></i>
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${song.name}</div>
                    <div class="playlist-item-duration">${song.duration}</div>
                </div>
                <button class="remove-btn" onclick="player.removeSong(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            item.addEventListener('click', () => this.loadSong(index));
            this.playlistContainer.appendChild(item);
        });
    }

    removeSong(index) {
        if (index === this.currentIndex && this.isPlaying) {
            this.stop();
        }
        
        // Liberar URL del objeto
        URL.revokeObjectURL(this.playlist[index].url);
        
        this.playlist.splice(index, 1);
        
        if (this.currentIndex >= this.playlist.length) {
            this.currentIndex = Math.max(0, this.playlist.length - 1);
        }
        
        this.updatePlaylistDisplay();
        this.savePlaylistToStorage();
        
        if (this.playlist.length > 0) {
            this.loadSong(this.currentIndex);
        } else {
            this.songTitle.textContent = 'No hay canción seleccionada';
            this.songArtist.textContent = '-';
            this.totalTimeDisplay.textContent = '0:00';
        }
    }

    savePlaylistToStorage() {
        const playlistData = this.playlist.map(song => ({
            name: song.name,
            artist: song.artist,
            duration: song.duration
        }));
        localStorage.setItem('winamp2-playlist', JSON.stringify(playlistData));
    }

    loadPlaylistFromStorage() {
        const saved = localStorage.getItem('winamp2-playlist');
        if (saved) {
            try {
                const playlistData = JSON.parse(saved);
                // Nota: No podemos restaurar los archivos reales, solo los metadatos
                console.log('Playlist guardada encontrada:', playlistData);
            } catch (error) {
                console.error('Error al cargar playlist:', error);
            }
        }
    }

    handleAudioError(error) {
        console.error('Error de audio:', error);
        this.songTitle.textContent = 'Error al reproducir';
        this.songArtist.textContent = 'Verifica el archivo';
    }

    minimize() {
        // Implementar minimizar
        console.log('Minimizar ventana');
    }

    maximize() {
        // Implementar maximizar
        console.log('Maximizar ventana');
    }

    close() {
        // Implementar cerrar
        console.log('Cerrar aplicación');
    }

    changeTheme(themeName) {
        // Seleccionar el contenedor principal
        const container = document.querySelector('.winamp-container');
        if (!container) return;
        // Remover todas las clases de tema
        container.classList.remove('theme-classic', 'theme-modern', 'theme-retro', 'theme-neon', 'theme-minimal', 'theme-dark');
        // Agregar la nueva clase de tema
        container.classList.add(`theme-${themeName}`);
        // Guardar el tema en localStorage
        localStorage.setItem('winamp2-theme', themeName);
        // Actualizar el selector
        document.getElementById('themeSelector').value = themeName;
        // Actualizar colores del visualizador según el tema
        this.updateVisualizerColors(themeName);
        // Cambiar el color de la barra de navegador
        this.updateThemeColorMeta(themeName);
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('winamp2-theme');
        if (savedTheme) {
            this.changeTheme(savedTheme);
        } else {
            // Tema por defecto
            this.changeTheme('classic');
        }
    }

    updateVisualizerColors(themeName) {
        // Actualizar colores del visualizador según el tema
        this.visualizerColors = {
            classic: ['#00ff00', '#00cc00', '#008800'],
            modern: ['#667eea', '#764ba2', '#5a6fd8'],
            retro: ['#f1c40f', '#f39c12', '#e67e22'],
            neon: ['#00ffff', '#ff00ff', '#ffff00'],
            minimal: ['#007bff', '#0056b3', '#004085'],
            dark: ['#ffffff', '#cccccc', '#999999']
        };
        
        this.currentThemeColors = this.visualizerColors[themeName] || this.visualizerColors.classic;
    }

    updateThemeColorMeta(themeName) {
        const themeColors = {
            classic: '#00ff00',
            modern: '#667eea',
            retro: '#f1c40f',
            neon: '#00ffff',
            minimal: '#007bff',
            dark: '#222222'
        };
        const color = themeColors[themeName] || '#00ff00';
        const meta = document.getElementById('themeColorMeta');
        if (meta) meta.setAttribute('content', color);
    }
}

// Inicializar el reproductor cuando se carga la página
let player;
document.addEventListener('DOMContentLoaded', () => {
    player = new WinampPlayer();
});

// Prevenir comportamiento por defecto del drag & drop
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault()); 