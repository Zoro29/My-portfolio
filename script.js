// Retro RPG Portfolio JavaScript
class RetroPortfolio {
    constructor() {
        this.currentLevel = 'about';
        this.loadingProgress = 0;
        this.isMuted = false;
        this.soundsEnabled = true;

        this.gameStarted = false;

        // Cached DOM references (populated in cacheDom())
        this.dom = {};

        // Timers/loops
        this.loadingIntervalId = null;
        this.loadingBeepIntervalId = null;
        this.bgIntervalId = null;
        this.parallaxIntervalId = null;

        // Audio (lazy-init to avoid autoplay restrictions)
        this.audioContext = null;
        this.bgOscillator = null;
        this.bgGainNode = null;

        // Simple throttles
        this.lastHoverSoundAt = 0;
        this.lastParticleAt = 0;

        this.init();
    }

    init() {
        this.cacheDom();
        this.setupEventListeners();
        this.startLoadingSequence();
        this.setupAudio();
        this.setupTypewriterEffects();
        this.setupParallaxEffects();
        this.setupInteractiveElements();
        this.setupMobileMenu();
    }

    cacheDom() {
        this.dom.startBtn = document.getElementById('start-btn');
        this.dom.loadingScreen = document.getElementById('loading-screen');
        this.dom.mainGame = document.getElementById('main-game');
        this.dom.bgMusic = document.getElementById('bg-music');
        this.dom.audioIcon = document.querySelector('.audio-icon');
        this.dom.gameMenu = document.querySelector('.game-menu');
    }

    ensureAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        if (!this.audioContext) {
            try {
                this.audioContext = new AudioCtx();
            } catch {
                return null;
            }
        }

        // Some browsers start AudioContext suspended until user interaction.
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        return this.audioContext;
    }

    playSoundThrottled(type, minIntervalMs = 100) {
        const now = Date.now();
        if (now - this.lastHoverSoundAt < minIntervalMs) return;
        this.lastHoverSoundAt = now;
        this.playSound(type);
    }

    setupEventListeners() {
        // Start button
        const startBtn = this.dom.startBtn || document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }

        // Level navigation
        const levelBtns = document.querySelectorAll('.level-btn');
        levelBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.target.dataset.level;
                this.switchLevel(level);
                this.playSound('menu-select');
            });
        });

        // Audio controls
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleAudio());
        }

        // Restart game
        const restartBtn = document.querySelector('.restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        // Hover effects for interactive elements
        this.setupHoverEffects();
    }

    startLoadingSequence() {
        const loadingProgress = document.querySelector('.loading-progress');
        const loadingPercentage = document.querySelector('.loading-percentage');
        const startBtn = this.dom.startBtn || document.getElementById('start-btn');

        if (this.loadingIntervalId) {
            clearInterval(this.loadingIntervalId);
            this.loadingIntervalId = null;
        }

        this.loadingIntervalId = setInterval(() => {
            this.loadingProgress += Math.random() * 3 + 1;
            
            if (this.loadingProgress >= 100) {
                this.loadingProgress = 100;
                clearInterval(this.loadingIntervalId);
                this.loadingIntervalId = null;
                
                setTimeout(() => {
                    if (startBtn) {
                        startBtn.style.display = 'block';
                        startBtn.style.animation = 'fadeIn 0.5s ease-in-out';
                    }
                }, 500);
            }

            if (loadingProgress) {
                loadingProgress.style.width = `${this.loadingProgress}%`;
            }
            if (loadingPercentage) {
                loadingPercentage.textContent = `${Math.floor(this.loadingProgress)}%`;
            }
        }, 100);

        // Add loading sound effect simulation
        this.playLoadingBeeps();
    }

    playLoadingBeeps() {
        let beepCount = 0;

        if (this.loadingBeepIntervalId) {
            clearInterval(this.loadingBeepIntervalId);
            this.loadingBeepIntervalId = null;
        }

        this.loadingBeepIntervalId = setInterval(() => {
            if (this.soundsEnabled) {
                this.createBeep(400 + (beepCount * 50), 100);
            }
            beepCount++;
            
            if (beepCount >= 10 || this.loadingProgress >= 100) {
                clearInterval(this.loadingBeepIntervalId);
                this.loadingBeepIntervalId = null;
            }
        }, 200);
    }

    createBeep(frequency, duration) {
        const audioContext = this.ensureAudioContext();
        if (this.isMuted || !this.soundsEnabled || !audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);

        oscillator.onended = () => {
            try { oscillator.disconnect(); } catch {}
            try { gainNode.disconnect(); } catch {}
        };
    }

    startGame() {
        if (this.gameStarted) return;
        this.gameStarted = true;

        // Ensure audio can start after a user gesture
        this.ensureAudioContext();

        const loadingScreen = this.dom.loadingScreen || document.getElementById('loading-screen');
        const mainGame = this.dom.mainGame || document.getElementById('main-game');

        this.playSound('game-start');
        
        if (loadingScreen) {
            loadingScreen.style.transition = 'opacity 1s ease-out';
            loadingScreen.style.opacity = '0';
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                if (mainGame) {
                    mainGame.style.display = 'flex';
                    mainGame.style.animation = 'fadeIn 1s ease-in-out';
                }
                this.startBackgroundMusic();
                this.animateSkillBars();
            }, 1000);
        }
    }

    switchLevel(levelName) {
        // Hide all level contents
        const allLevels = document.querySelectorAll('.level-content');
        const allBtns = document.querySelectorAll('.level-btn');
        
        allLevels.forEach(level => {
            level.classList.remove('active');
        });
        
        allBtns.forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected level
        const targetLevel = document.getElementById(levelName);
        const targetBtn = document.querySelector(`[data-level="${levelName}"]`);
        
        if (targetLevel) {
            targetLevel.classList.add('active');
        }
        
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        this.currentLevel = levelName;
        
        // Trigger level-specific animations
        this.triggerLevelAnimations(levelName);
    }

    triggerLevelAnimations(levelName) {
        switch(levelName) {
            case 'skills':
                setTimeout(() => this.animateSkillBars(), 300);
                break;
            case 'projects':
                setTimeout(() => this.animateProjectCards(), 300);
                break;
            case 'achievements':
                setTimeout(() => this.animateAchievements(), 300);
                break;
            case 'about':
                setTimeout(() => this.restartTypewriter(), 300);
                break;
        }
    }

    animateSkillBars() {
        const skillBars = document.querySelectorAll('.skill-progress');
        skillBars.forEach((bar, index) => {
            setTimeout(() => {
                const width = bar.style.width;
                bar.style.width = '0%';
                bar.style.transition = 'width 1.5s ease-out';
                
                setTimeout(() => {
                    bar.style.width = width;
                }, 100);
            }, index * 100);
        });
    }

    animateProjectCards() {
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    animateAchievements() {
        const achievements = document.querySelectorAll('.achievement-card');
        achievements.forEach((achievement, index) => {
            achievement.style.opacity = '0';
            achievement.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                achievement.style.transition = 'all 0.5s ease-out';
                achievement.style.opacity = '1';
                achievement.style.transform = 'scale(1)';
                
                // Add glow effect
                setTimeout(() => {
                    const glow = achievement.querySelector('.achievement-glow');
                    if (glow) {
                        glow.style.left = '100%';
                    }
                }, 200);
            }, index * 150);
        });
    }

    setupTypewriterEffects() {
        const typewriterTexts = document.querySelectorAll('.typewriter-text');
        
        typewriterTexts.forEach((text, index) => {
            const delay = text.dataset.delay ? parseInt(text.dataset.delay) : index * 1000;
            
            setTimeout(() => {
                this.typewriterEffect(text);
            }, delay);
        });
    }

    typewriterEffect(element) {
        const text = element.textContent;
        element.textContent = '';
        element.style.opacity = '1';
        
        let i = 0;
        const typeInterval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                
                // Add typing sound effect
                if (this.soundsEnabled && i % 3 === 0) {
                    this.createBeep(300, 50);
                }
            } else {
                clearInterval(typeInterval);
            }
        }, 50);
    }

    restartTypewriter() {
        const typewriterTexts = document.querySelectorAll('#about .typewriter-text');
        typewriterTexts.forEach((text) => {
            text.style.opacity = '0';
        });
        
        setTimeout(() => {
            this.setupTypewriterEffects();
        }, 100);
    }

    setupAudio() {
        const bgMusic = this.dom.bgMusic || document.getElementById('bg-music');
        if (bgMusic) {
            bgMusic.volume = 0.3;
        }
    }

    startBackgroundMusic() {
        if (!this.isMuted) {
            const bgMusic = this.dom.bgMusic || document.getElementById('bg-music');
            if (bgMusic) {
                // Create a simple 8-bit style melody using Web Audio API
                this.createBackgroundMusic();
            }
        }
    }

    createBackgroundMusic() {
        const audioContext = this.ensureAudioContext();
        if (!audioContext) return;

        // Prevent duplicate background loops when starting/restarting.
        if (this.bgOscillator || this.bgIntervalId) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 220; // A note
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(this.isMuted ? 0.0 : 0.05, audioContext.currentTime);

        oscillator.start(audioContext.currentTime);

        this.bgOscillator = oscillator;
        this.bgGainNode = gainNode;

        // Create a simple melody pattern
        const notes = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0];
        let noteIndex = 0;

        this.bgIntervalId = setInterval(() => {
            if (!this.isMuted && this.soundsEnabled && this.bgOscillator) {
                this.bgOscillator.frequency.value = notes[noteIndex % notes.length];
                noteIndex++;
            }
        }, 2000);
    }

    stopBackgroundMusic() {
        if (this.bgIntervalId) {
            clearInterval(this.bgIntervalId);
            this.bgIntervalId = null;
        }

        if (this.bgOscillator) {
            try { this.bgOscillator.stop(); } catch {}
            try { this.bgOscillator.disconnect(); } catch {}
            this.bgOscillator = null;
        }

        if (this.bgGainNode) {
            try { this.bgGainNode.disconnect(); } catch {}
            this.bgGainNode = null;
        }
    }

    toggleAudio() {
        this.isMuted = !this.isMuted;
        const audioIcon = this.dom.audioIcon || document.querySelector('.audio-icon');
        const bgMusic = this.dom.bgMusic || document.getElementById('bg-music');
        
        if (audioIcon) {
            audioIcon.textContent = this.isMuted ? '🔇' : '🔊';
        }
        
        if (bgMusic) {
            bgMusic.muted = this.isMuted;
        }

        if (this.bgGainNode && this.audioContext) {
            try {
                this.bgGainNode.gain.setValueAtTime(this.isMuted ? 0.0 : 0.05, this.audioContext.currentTime);
            } catch {}
        }
        
        this.soundsEnabled = !this.isMuted;
        this.playSound('menu-click');
    }

    playSound(type) {
        if (!this.soundsEnabled || this.isMuted) return;
        
        const frequencies = {
            'menu-select': 523.25,
            'menu-click': 659.25,
            'game-start': 783.99,
            'level-complete': 880.00
        };
        
        const frequency = frequencies[type] || 440;
        this.createBeep(frequency, 150);
    }

    downloadResume() {
        this.playSound('level-complete');
        
        // Create a temporary download link
        const link = document.createElement('a');
        link.href = 'resume.pdf';
        link.download = 'resume.pdf';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Downloading resume...', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 255, 0.9);
            color: #000;
            padding: 1rem 1.5rem;
            border: 2px solid #00ffff;
            font-family: 'VT323', monospace;
            font-size: 16px;
            z-index: 10000;
            animation: slideIn 0.5s ease-out;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.5s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }

    restartGame() {
        this.playSound('game-start');

        // Prevent runaway intervals/loops across restarts.
        this.stopBackgroundMusic();
        if (this.loadingIntervalId) {
            clearInterval(this.loadingIntervalId);
            this.loadingIntervalId = null;
        }
        if (this.loadingBeepIntervalId) {
            clearInterval(this.loadingBeepIntervalId);
            this.loadingBeepIntervalId = null;
        }

        this.gameStarted = false;
        
        // Reset to loading screen
        const loadingScreen = this.dom.loadingScreen || document.getElementById('loading-screen');
        const mainGame = this.dom.mainGame || document.getElementById('main-game');
        
        if (mainGame) {
            mainGame.style.display = 'none';
        }
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.style.opacity = '1';
        }
        
        // Reset progress and restart
        this.loadingProgress = 0;
        const startBtn = this.dom.startBtn || document.getElementById('start-btn');
        if (startBtn) {
            startBtn.style.display = 'none';
        }
        
        setTimeout(() => {
            this.startLoadingSequence();
        }, 500);
    }

    setupHoverEffects() {
        // Project cards hover effects
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.playSoundThrottled('menu-click', 100);
                card.style.transform = 'translateY(-10px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });

        // Achievement cards hover effects
        const achievementCards = document.querySelectorAll('.achievement-card');
        achievementCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.playSoundThrottled('menu-click', 100);
            });
        });

        // Skill items hover effects
        const skillItems = document.querySelectorAll('.skill-item');
        skillItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const progress = item.querySelector('.skill-progress');
                if (progress) {
                    progress.style.boxShadow = '0 0 15px var(--accent-cyan)';
                }
            });
            
            item.addEventListener('mouseleave', () => {
                const progress = item.querySelector('.skill-progress');
                if (progress) {
                    progress.style.boxShadow = '0 0 8px var(--accent-cyan)';
                }
            });
        });

        // Button hover effects
        const allButtons = document.querySelectorAll('button, .action-btn');
        allButtons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                this.playSoundThrottled('menu-click', 100);
            });
        });
    }

    setupParallaxEffects() {
        if (this.parallaxIntervalId) return;
        let ticking = false;

        const updateParallax = () => {
            const scrollTop = window.pageYOffset;
            
            // Move stars at different speeds
            const stars = document.querySelector('.stars');
            if (stars) {
                stars.style.transform = `translateY(${scrollTop * 0.5}px)`;
            }
            
            // Character floating animation
            const character = document.querySelector('.pixel-character');
            if (character) {
                const time = Date.now() * 0.002;
                const floatY = Math.sin(time) * 3;
                character.style.transform = `translateY(${floatY}px)`;
            }
            
            ticking = false;
        };

        const requestTick = () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };

        window.addEventListener('scroll', requestTick);
        
        // Start the character animation
        this.parallaxIntervalId = setInterval(() => {
            if (!ticking) {
                updateParallax();
            }
        }, 16); // ~60fps
    }

    setupInteractiveElements() {
        // Add interactive particles to certain elements
        this.createInteractiveParticles();
        
        // Setup inventory item interactions
        const inventoryItems = document.querySelectorAll('.inventory-item');
        inventoryItems.forEach(item => {
            item.addEventListener('click', (event) => {
                this.handleInventoryClick(item, event);
            });
        });
        
        // Setup contact link interactions
        const contactLinks = document.querySelectorAll('.contact-link');
        contactLinks.forEach(link => {
            link.addEventListener('mouseenter', () => {
                this.playSoundThrottled('menu-click', 100);
            });
        });
    }

    createInteractiveParticles() {
        const containers = document.querySelectorAll('.pixel-character, .contact-avatar, .pixel-avatar');
        
        containers.forEach(container => {
            container.addEventListener('click', (e) => {
                const now = Date.now();
                if (now - this.lastParticleAt < 150) return;
                this.lastParticleAt = now;
                this.createParticleExplosion(e.clientX, e.clientY);
            });
        });
    }

    createParticleExplosion(x, y) {
        const particleCount = 10;
        const colors = ['#00ffff', '#00ff41', '#ff6b35', '#9d4edd'];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 4px;
                height: 4px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                pointer-events: none;
                z-index: 9999;
                left: ${x}px;
                top: ${y}px;
            `;
            
            document.body.appendChild(particle);
            
            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = 50 + Math.random() * 50;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity;
            
            let posX = x;
            let posY = y;
            let alpha = 1;
            
            const animateParticle = () => {
                posX += dx * 0.02;
                posY += dy * 0.02;
                alpha -= 0.02;
                
                particle.style.left = posX + 'px';
                particle.style.top = posY + 'px';
                particle.style.opacity = alpha;
                
                if (alpha > 0) {
                    requestAnimationFrame(animateParticle);
                } else {
                    document.body.removeChild(particle);
                }
            };
            
            requestAnimationFrame(animateParticle);
        }
        
        this.playSound('menu-select');
    }

    handleInventoryClick(item, event) {
        const itemNameEl = item.querySelector('.item-name');
        const itemName = itemNameEl ? itemNameEl.textContent.trim() : 'ITEM';

        if (item.id === 'resume-item') {
            // If the user clicked the explicit download link/button, let the browser handle it.
            if (event?.target && event.target.closest('a')) {
                this.playSound('level-complete');
                return;
            }

            this.downloadResume();
            return;
        }

        this.playSound('menu-click');
        this.showNotification(`Used ${itemName}!`, 'success');

        // Add visual feedback
        item.style.transform = 'scale(0.95)';
        setTimeout(() => {
            item.style.transform = 'scale(1)';
        }, 150);
    }

    setupMobileMenu() {
        // Create mobile menu toggle
        const mobileToggle = document.createElement('button');
        mobileToggle.className = 'mobile-menu-toggle';
        mobileToggle.innerHTML = '☰';
        mobileToggle.setAttribute('aria-label', 'Toggle Menu');
        
        document.body.appendChild(mobileToggle);

        const gameMenu = this.dom.gameMenu || document.querySelector('.game-menu');
        if (!gameMenu) return;
        
        mobileToggle.addEventListener('click', () => {
            gameMenu.classList.toggle('mobile-open');
            this.playSound('menu-click');
        });
        
        // Close menu when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !gameMenu.contains(e.target) && 
                !mobileToggle.contains(e.target)) {
                gameMenu.classList.remove('mobile-open');
            }
        });
    }

    // Utility method for smooth scrolling
    smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // Method to handle keyboard navigation
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Toggle mobile menu on mobile
                if (window.innerWidth <= 768) {
                    const gameMenu = document.querySelector('.game-menu');
                    gameMenu.classList.toggle('mobile-open');
                }
            }
            
            // Arrow key navigation for levels
            const levels = ['about', 'skills', 'projects', 'achievements', 'contact'];
            const currentIndex = levels.indexOf(this.currentLevel);
            
            if (e.key === 'ArrowDown' && currentIndex < levels.length - 1) {
                this.switchLevel(levels[currentIndex + 1]);
                this.playSound('menu-select');
            } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                this.switchLevel(levels[currentIndex - 1]);
                this.playSound('menu-select');
            }
        });
    }
}

// Initialize the portfolio when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const portfolio = new RetroPortfolio();
    
    // Setup keyboard navigation
    portfolio.setupKeyboardNavigation();
    
    // Add CSS animations for notification
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add some fun easter eggs
    let konamiCode = [];
    const konamiSequence = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    
    document.addEventListener('keydown', (e) => {
        konamiCode.push(e.code);
        
        if (konamiCode.length > konamiSequence.length) {
            konamiCode.shift();
        }
        
        if (konamiCode.length === konamiSequence.length &&
            konamiCode.every((key, index) => key === konamiSequence[index])) {
            
            // Easter egg: Make everything rainbow
            document.body.style.filter = 'hue-rotate(0deg)';
            let hue = 0;
            const rainbowInterval = setInterval(() => {
                hue += 5;
                document.body.style.filter = `hue-rotate(${hue}deg)`;
                
                if (hue >= 360) {
                    clearInterval(rainbowInterval);
                    document.body.style.filter = 'none';
                }
            }, 50);
            
            portfolio.showNotification('🌈 KONAMI CODE ACTIVATED! RAINBOW MODE! 🌈', 'success');
            portfolio.playSound('level-complete');
            konamiCode = [];
        }
    });
});

// Add service worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}