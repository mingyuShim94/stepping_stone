import { FlutterBridge } from '../flutter/FlutterBridge.js';

/**
 * 게임 설정 관리 시스템
 * 모든 게임 설정을 중앙에서 관리하고 Flutter와 동기화
 */
export class Settings {
    constructor() {
        // 기본 설정값
        this.defaultSettings = {
            // 오디오 설정
            audio: {
                musicVolume: 0.7,
                sfxVolume: 0.8,
                muteMusic: false,
                muteSfx: false,
                audioEnabled: true
            },
            
            // 그래픽 설정
            graphics: {
                quality: 'medium', // low, medium, high
                shadows: true,
                particles: true,
                fog: true,
                antialiasing: true,
                vsync: true
            },
            
            // 컨트롤 설정
            controls: {
                touchSensitivity: 1.0,
                swipeThreshold: 50,
                vibration: true,
                gestureTimeout: 300,
                doubleTapEnabled: true,
                longPressEnabled: true
            },
            
            // 게임플레이 설정
            gameplay: {
                showFPS: false,
                showScore: true,
                showDistance: true,
                autoSave: true,
                pauseOnFocusLoss: true,
                confirmBeforeExit: true
            },
            
            // 접근성 설정
            accessibility: {
                highContrast: false,
                largeText: false,
                reducedMotion: false,
                screenReader: false,
                colorblindMode: 'none' // none, deuteranopia, protanopia, tritanopia
            },
            
            // 개발자 설정 (디버그용)
            developer: {
                debugMode: false,
                showHitboxes: false,
                godMode: false,
                freeCamera: false,
                analytics: true
            },
            
            // 언어 및 지역 설정
            localization: {
                language: 'auto', // auto, ko, en, ja, zh, etc.
                region: 'auto',
                dateFormat: 'auto',
                numberFormat: 'auto'
            },
            
            // 성능 설정
            performance: {
                targetFPS: 60,
                adaptiveQuality: true,
                memoryManagement: true,
                preloadAssets: true,
                backgroundThrottling: true
            }
        };
        
        // 현재 설정
        this.currentSettings = {};
        
        // 설정 유효성 검증 규칙
        this.validationRules = {
            'audio.musicVolume': { type: 'number', min: 0, max: 1 },
            'audio.sfxVolume': { type: 'number', min: 0, max: 1 },
            'graphics.quality': { type: 'string', values: ['low', 'medium', 'high'] },
            'controls.touchSensitivity': { type: 'number', min: 0.1, max: 3.0 },
            'controls.swipeThreshold': { type: 'number', min: 10, max: 200 },
            'accessibility.colorblindMode': { 
                type: 'string', 
                values: ['none', 'deuteranopia', 'protanopia', 'tritanopia'] 
            },
            'localization.language': { 
                type: 'string', 
                values: ['auto', 'ko', 'en', 'ja', 'zh', 'es', 'fr', 'de'] 
            },
            'performance.targetFPS': { type: 'number', values: [30, 60, 120] }
        };
        
        // 이벤트 리스너
        this.eventListeners = {};
        
        // 설정 변경 감지용
        this.settingsProxy = null;
        
        this.init();
    }

    /**
     * 초기화
     */
    async init() {
        // 저장된 설정 로드
        await this.loadSettings();
        
        // 시스템 설정 감지
        this.detectSystemSettings();
        
        // Flutter 통신 설정
        this.setupFlutterSync();
        
        // 설정 변경 감지 프록시 생성
        this.createSettingsProxy();
        
        // 기본 이벤트 리스너 설정
        this.setupEventListeners();
    }

    /**
     * 설정 로드
     */
    async loadSettings() {
        try {
            const savedSettings = localStorage.getItem('steppingStoneSettings');
            
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.currentSettings = this.mergeWithDefaults(parsed);
            } else {
                this.currentSettings = this.deepClone(this.defaultSettings);
            }
            
            // 설정 유효성 검증
            this.validateSettings();
            
        } catch (error) {
            console.error('설정 로드 실패:', error);
            FlutterBridge.sendError('SETTINGS_LOAD_ERROR', '설정 로드 실패', { error: error.message });
            
            // 기본 설정으로 복구
            this.currentSettings = this.deepClone(this.defaultSettings);
        }
    }

    /**
     * 설정 저장
     */
    async saveSettings() {
        try {
            const settingsToSave = {
                ...this.currentSettings,
                lastSaved: Date.now(),
                version: '1.0'
            };
            
            localStorage.setItem('steppingStoneSettings', JSON.stringify(settingsToSave));
            
            // Flutter에 설정 변경 알림
            FlutterBridge.sendMessage(FlutterBridge.EVENT_TYPES.SETTINGS, {
                action: 'settings_saved',
                settings: this.currentSettings
            });
            
            this.emit('settingsSaved', this.currentSettings);
            
        } catch (error) {
            console.error('설정 저장 실패:', error);
            FlutterBridge.sendError('SETTINGS_SAVE_ERROR', '설정 저장 실패', { error: error.message });
        }
    }

    /**
     * 개별 설정 업데이트
     * @param {string} path - 설정 경로 (예: 'audio.musicVolume')
     * @param {*} value - 새로운 값
     */
    setSetting(path, value) {
        const oldValue = this.getSetting(path);
        
        // 유효성 검증
        if (!this.validateSetting(path, value)) {
            console.warn(`유효하지 않은 설정값: ${path} = ${value}`);
            return false;
        }
        
        // 설정 적용
        this.setNestedProperty(this.currentSettings, path, value);
        
        // 이벤트 발생
        this.emit('settingChanged', { path, oldValue, newValue: value });
        
        // 자동 저장
        if (this.currentSettings.gameplay.autoSave) {
            this.saveSettings();
        }
        
        return true;
    }

    /**
     * 설정값 조회
     * @param {string} path - 설정 경로
     * @returns {*} 설정값
     */
    getSetting(path) {
        return this.getNestedProperty(this.currentSettings, path);
    }

    /**
     * 여러 설정 일괄 업데이트
     * @param {Object} settings - 설정 객체
     */
    updateSettings(settings) {
        const changes = [];
        
        Object.entries(settings).forEach(([path, value]) => {
            const oldValue = this.getSetting(path);
            if (this.setSetting(path, value)) {
                changes.push({ path, oldValue, newValue: value });
            }
        });
        
        if (changes.length > 0) {
            this.emit('settingsChanged', changes);
        }
        
        return changes.length;
    }

    /**
     * 설정 초기화
     * @param {string} category - 카테고리 (선택적)
     */
    resetSettings(category = null) {
        if (category) {
            this.currentSettings[category] = this.deepClone(this.defaultSettings[category]);
            this.emit('categoryReset', category);
        } else {
            this.currentSettings = this.deepClone(this.defaultSettings);
            this.emit('allSettingsReset');
        }
        
        this.saveSettings();
    }

    /**
     * 시스템 설정 자동 감지
     */
    detectSystemSettings() {
        // 다크 모드 감지
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setSetting('accessibility.highContrast', true);
        }
        
        // 모션 감소 선호도 감지
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.setSetting('accessibility.reducedMotion', true);
        }
        
        // 언어 감지
        if (this.getSetting('localization.language') === 'auto') {
            const browserLang = navigator.language.split('-')[0];
            const supportedLangs = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de'];
            
            if (supportedLangs.includes(browserLang)) {
                this.setSetting('localization.language', browserLang);
            } else {
                this.setSetting('localization.language', 'en');
            }
        }
        
        // 성능 기반 그래픽 품질 조정
        if (this.getSetting('performance.adaptiveQuality')) {
            this.adjustGraphicsQuality();
        }
    }

    /**
     * 그래픽 품질 자동 조정
     */
    adjustGraphicsQuality() {
        const deviceMemory = navigator.deviceMemory || 4; // GB
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        
        let quality = 'medium';
        
        // 저사양 기기 감지
        if (deviceMemory <= 2 || hardwareConcurrency <= 2) {
            quality = 'low';
        }
        // 고사양 기기 감지
        else if (deviceMemory >= 8 && hardwareConcurrency >= 8) {
            quality = 'high';
        }
        
        this.setSetting('graphics.quality', quality);
    }

    /**
     * Flutter 동기화 설정
     */
    setupFlutterSync() {
        // Flutter에서 설정 업데이트 수신
        FlutterBridge.onSettingsUpdate((flutterSettings) => {
            this.updateSettings(flutterSettings);
        });
        
        // 초기 설정을 Flutter에 전송
        FlutterBridge.sendMessage(FlutterBridge.EVENT_TYPES.SETTINGS, {
            action: 'initial_settings',
            settings: this.currentSettings
        });
    }

    /**
     * 설정 변경 감지 프록시 생성
     */
    createSettingsProxy() {
        this.settingsProxy = new Proxy(this.currentSettings, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;
                
                this.emit('directSettingChanged', { property, oldValue, newValue: value });
                return true;
            }
        });
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 페이지 가시성 변경
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.getSetting('gameplay.pauseOnFocusLoss')) {
                this.emit('shouldPauseGame');
            }
        });
        
        // 미디어 쿼리 변경 감지
        if (window.matchMedia) {
            // 다크 모드 변경
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (e.matches) {
                    this.setSetting('accessibility.highContrast', true);
                }
            });
            
            // 모션 감소 선호도 변경
            window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
                this.setSetting('accessibility.reducedMotion', e.matches);
            });
        }
    }

    /**
     * 설정 유효성 검증
     */
    validateSettings() {
        let hasInvalidSettings = false;
        
        Object.entries(this.validationRules).forEach(([path, rule]) => {
            const value = this.getSetting(path);
            if (!this.validateSetting(path, value)) {
                console.warn(`유효하지 않은 설정 감지: ${path}`);
                const defaultValue = this.getNestedProperty(this.defaultSettings, path);
                this.setNestedProperty(this.currentSettings, path, defaultValue);
                hasInvalidSettings = true;
            }
        });
        
        if (hasInvalidSettings) {
            this.saveSettings();
        }
    }

    /**
     * 개별 설정 유효성 검증
     * @param {string} path 
     * @param {*} value 
     * @returns {boolean}
     */
    validateSetting(path, value) {
        const rule = this.validationRules[path];
        if (!rule) return true; // 규칙이 없으면 유효
        
        // 타입 검증
        if (rule.type && typeof value !== rule.type) {
            return false;
        }
        
        // 숫자 범위 검증
        if (rule.type === 'number') {
            if (rule.min !== undefined && value < rule.min) return false;
            if (rule.max !== undefined && value > rule.max) return false;
        }
        
        // 허용값 검증
        if (rule.values && !rule.values.includes(value)) {
            return false;
        }
        
        return true;
    }

    /**
     * 기본값과 병합
     * @param {Object} userSettings 
     * @returns {Object}
     */
    mergeWithDefaults(userSettings) {
        return this.deepMerge(this.deepClone(this.defaultSettings), userSettings);
    }

    /**
     * 깊은 복사
     * @param {Object} obj 
     * @returns {Object}
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 깊은 병합
     * @param {Object} target 
     * @param {Object} source 
     * @returns {Object}
     */
    deepMerge(target, source) {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        });
        return target;
    }

    /**
     * 중첩 속성 설정
     * @param {Object} obj 
     * @param {string} path 
     * @param {*} value 
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * 중첩 속성 조회
     * @param {Object} obj 
     * @param {string} path 
     * @returns {*}
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * 설정 내보내기
     * @returns {string} JSON 문자열
     */
    exportSettings() {
        return JSON.stringify({
            settings: this.currentSettings,
            exportTime: Date.now(),
            version: '1.0'
        }, null, 2);
    }

    /**
     * 설정 가져오기
     * @param {string} settingsJson 
     * @returns {boolean} 성공 여부
     */
    importSettings(settingsJson) {
        try {
            const imported = JSON.parse(settingsJson);
            
            if (imported.settings) {
                this.currentSettings = this.mergeWithDefaults(imported.settings);
                this.validateSettings();
                this.saveSettings();
                
                this.emit('settingsImported', this.currentSettings);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('설정 가져오기 실패:', error);
            FlutterBridge.sendError('SETTINGS_IMPORT_ERROR', '설정 가져오기 실패', { error: error.message });
            return false;
        }
    }

    /**
     * 이벤트 리스너 등록
     * @param {string} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 이벤트 발생
     * @param {string} event 
     * @param {*} data 
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                callback(data);
            });
        }
    }

    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getAllSettings() {
        return this.deepClone(this.currentSettings);
    }

    /**
     * 기본 설정 반환
     * @returns {Object}
     */
    getDefaultSettings() {
        return this.deepClone(this.defaultSettings);
    }

    /**
     * 설정 차이점 확인
     * @returns {Object}
     */
    getSettingsDiff() {
        const diff = {};
        
        const compareObjects = (current, defaults, path = '') => {
            Object.keys(current).forEach(key => {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (typeof current[key] === 'object' && !Array.isArray(current[key])) {
                    compareObjects(current[key], defaults[key] || {}, currentPath);
                } else if (current[key] !== defaults[key]) {
                    diff[currentPath] = {
                        current: current[key],
                        default: defaults[key]
                    };
                }
            });
        };
        
        compareObjects(this.currentSettings, this.defaultSettings);
        return diff;
    }

    /**
     * 정리
     */
    destroy() {
        this.saveSettings();
        this.eventListeners = {};
    }
}