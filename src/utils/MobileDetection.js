/**
 * 모바일 환경 감지 유틸리티
 * 기기 타입, 운영체제, 브라우저, 네트워크 등을 감지
 */
export class MobileDetection {
    constructor() {
        this.deviceInfo = {
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            platform: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            browser: 'unknown',
            browserVersion: 'unknown',
            screenSize: 'unknown',
            pixelRatio: 1,
            touchSupport: false,
            orientation: 'unknown',
            networkType: 'unknown',
            batterySupported: false,
            performanceClass: 'unknown'
        };
        
        this.capabilities = {
            webgl: false,
            webgl2: false,
            webworkers: false,
            indexeddb: false,
            localstorage: false,
            geolocation: false,
            notifications: false,
            vibration: false,
            gamepad: false,
            devicemotion: false,
            deviceorientation: false
        };
        
        this.networkInfo = {
            type: 'unknown',
            effectiveType: 'unknown',
            downlink: 0,
            rtt: 0,
            saveData: false
        };
        
        this.batteryInfo = {
            level: 1,
            charging: false,
            chargingTime: 0,
            dischargingTime: 0
        };
        
        this.init();
    }

    /**
     * 초기화
     */
    init() {
        this.detectPlatform();
        this.detectOperatingSystem();
        this.detectBrowser();
        this.detectScreenInfo();
        this.detectCapabilities();
        this.detectNetworkInfo();
        this.detectBatteryInfo();
        this.estimatePerformance();
        this.setupEventListeners();
    }

    /**
     * 플랫폼 감지 (모바일, 태블릿, 데스크톱)
     */
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // 모바일 기기 패턴
        const mobilePatterns = [
            /android.*mobile/,
            /iphone/,
            /ipod/,
            /blackberry/,
            /windows phone/,
            /mobile/
        ];
        
        // 태블릿 기기 패턴
        const tabletPatterns = [
            /ipad/,
            /android(?!.*mobile)/,
            /tablet/,
            /kindle/,
            /playbook/,
            /nook/
        ];
        
        // 터치 지원 감지
        this.deviceInfo.touchSupport = ('ontouchstart' in window) || 
                                       (navigator.maxTouchPoints > 0) ||
                                       (navigator.msMaxTouchPoints > 0);
        
        // 플랫폼 분류
        if (tabletPatterns.some(pattern => pattern.test(userAgent))) {
            this.deviceInfo.platform = 'tablet';
            this.deviceInfo.isTablet = true;
        } else if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
            this.deviceInfo.platform = 'mobile';
            this.deviceInfo.isMobile = true;
        } else {
            this.deviceInfo.platform = 'desktop';
            this.deviceInfo.isDesktop = true;
        }
        
        // 추가 모바일 감지 (화면 크기 기반)
        if (window.screen && window.screen.width <= 768) {
            this.deviceInfo.isMobile = true;
            this.deviceInfo.platform = 'mobile';
        }
    }

    /**
     * 운영체제 감지
     */
    detectOperatingSystem() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        // iOS 감지
        if (/iPad|iPhone|iPod/.test(userAgent)) {
            this.deviceInfo.os = 'ios';
            const match = userAgent.match(/OS (\d+)_(\d+)/);
            if (match) {
                this.deviceInfo.osVersion = `${match[1]}.${match[2]}`;
            }
        }
        // Android 감지
        else if (/Android/.test(userAgent)) {
            this.deviceInfo.os = 'android';
            const match = userAgent.match(/Android (\d+(?:\.\d+)*)/);
            if (match) {
                this.deviceInfo.osVersion = match[1];
            }
        }
        // Windows 감지
        else if (/Windows/.test(userAgent)) {
            this.deviceInfo.os = 'windows';
            if (/Windows NT 10/.test(userAgent)) this.deviceInfo.osVersion = '10';
            else if (/Windows NT 6\.3/.test(userAgent)) this.deviceInfo.osVersion = '8.1';
            else if (/Windows NT 6\.2/.test(userAgent)) this.deviceInfo.osVersion = '8';
            else if (/Windows NT 6\.1/.test(userAgent)) this.deviceInfo.osVersion = '7';
        }
        // macOS 감지
        else if (/Mac OS X/.test(userAgent) || /Macintosh/.test(platform)) {
            this.deviceInfo.os = 'macos';
            const match = userAgent.match(/Mac OS X (\d+_\d+)/);
            if (match) {
                this.deviceInfo.osVersion = match[1].replace('_', '.');
            }
        }
        // Linux 감지
        else if (/Linux/.test(platform)) {
            this.deviceInfo.os = 'linux';
        }
    }

    /**
     * 브라우저 감지
     */
    detectBrowser() {
        const userAgent = navigator.userAgent;
        
        // Chrome 감지
        if (/Chrome/.test(userAgent) && !/Edge|Edg/.test(userAgent)) {
            this.deviceInfo.browser = 'chrome';
            const match = userAgent.match(/Chrome\/(\d+)/);
            if (match) this.deviceInfo.browserVersion = match[1];
        }
        // Safari 감지
        else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
            this.deviceInfo.browser = 'safari';
            const match = userAgent.match(/Version\/(\d+)/);
            if (match) this.deviceInfo.browserVersion = match[1];
        }
        // Firefox 감지
        else if (/Firefox/.test(userAgent)) {
            this.deviceInfo.browser = 'firefox';
            const match = userAgent.match(/Firefox\/(\d+)/);
            if (match) this.deviceInfo.browserVersion = match[1];
        }
        // Edge 감지
        else if (/Edge|Edg/.test(userAgent)) {
            this.deviceInfo.browser = 'edge';
            const match = userAgent.match(/(?:Edge|Edg)\/(\d+)/);
            if (match) this.deviceInfo.browserVersion = match[1];
        }
        // Samsung Internet 감지
        else if (/SamsungBrowser/.test(userAgent)) {
            this.deviceInfo.browser = 'samsung';
            const match = userAgent.match(/SamsungBrowser\/(\d+)/);
            if (match) this.deviceInfo.browserVersion = match[1];
        }
    }

    /**
     * 화면 정보 감지
     */
    detectScreenInfo() {
        // 화면 크기
        const width = window.screen.width;
        const height = window.screen.height;
        
        if (width <= 480) {
            this.deviceInfo.screenSize = 'small';
        } else if (width <= 768) {
            this.deviceInfo.screenSize = 'medium';
        } else if (width <= 1024) {
            this.deviceInfo.screenSize = 'large';
        } else {
            this.deviceInfo.screenSize = 'xlarge';
        }
        
        // 픽셀 비율
        this.deviceInfo.pixelRatio = window.devicePixelRatio || 1;
        
        // 화면 방향
        this.updateOrientation();
    }

    /**
     * 화면 방향 업데이트
     */
    updateOrientation() {
        if (screen.orientation) {
            this.deviceInfo.orientation = screen.orientation.angle === 0 || screen.orientation.angle === 180 
                ? 'portrait' : 'landscape';
        } else {
            this.deviceInfo.orientation = window.innerHeight > window.innerWidth 
                ? 'portrait' : 'landscape';
        }
    }

    /**
     * 브라우저 기능 감지
     */
    detectCapabilities() {
        // WebGL 지원
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            this.capabilities.webgl = !!gl;
            
            if (gl) {
                const gl2 = canvas.getContext('webgl2');
                this.capabilities.webgl2 = !!gl2;
            }
        } catch (e) {
            this.capabilities.webgl = false;
            this.capabilities.webgl2 = false;
        }
        
        // Web Workers
        this.capabilities.webworkers = typeof Worker !== 'undefined';
        
        // IndexedDB
        this.capabilities.indexeddb = 'indexedDB' in window;
        
        // Local Storage
        this.capabilities.localstorage = 'localStorage' in window;
        
        // Geolocation
        this.capabilities.geolocation = 'geolocation' in navigator;
        
        // Notifications
        this.capabilities.notifications = 'Notification' in window;
        
        // Vibration
        this.capabilities.vibration = 'vibrate' in navigator;
        
        // Gamepad
        this.capabilities.gamepad = 'getGamepads' in navigator;
        
        // Device Motion/Orientation
        this.capabilities.devicemotion = 'DeviceMotionEvent' in window;
        this.capabilities.deviceorientation = 'DeviceOrientationEvent' in window;
    }

    /**
     * 네트워크 정보 감지
     */
    detectNetworkInfo() {
        // Navigator connection API
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        if (connection) {
            this.networkInfo.type = connection.type || 'unknown';
            this.networkInfo.effectiveType = connection.effectiveType || 'unknown';
            this.networkInfo.downlink = connection.downlink || 0;
            this.networkInfo.rtt = connection.rtt || 0;
            this.networkInfo.saveData = connection.saveData || false;
            
            // 네트워크 변경 감지
            connection.addEventListener('change', () => {
                this.updateNetworkInfo();
            });
        }
    }

    /**
     * 네트워크 정보 업데이트
     */
    updateNetworkInfo() {
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        if (connection) {
            this.networkInfo.type = connection.type || 'unknown';
            this.networkInfo.effectiveType = connection.effectiveType || 'unknown';
            this.networkInfo.downlink = connection.downlink || 0;
            this.networkInfo.rtt = connection.rtt || 0;
            this.networkInfo.saveData = connection.saveData || false;
        }
    }

    /**
     * 배터리 정보 감지
     */
    async detectBatteryInfo() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.batteryInfo.level = battery.level;
                this.batteryInfo.charging = battery.charging;
                this.batteryInfo.chargingTime = battery.chargingTime;
                this.batteryInfo.dischargingTime = battery.dischargingTime;
                this.deviceInfo.batterySupported = true;
                
                // 배터리 이벤트 리스너
                battery.addEventListener('levelchange', () => this.updateBatteryInfo(battery));
                battery.addEventListener('chargingchange', () => this.updateBatteryInfo(battery));
            } catch (error) {
                console.warn('Battery API not supported:', error);
            }
        }
    }

    /**
     * 배터리 정보 업데이트
     */
    updateBatteryInfo(battery) {
        this.batteryInfo.level = battery.level;
        this.batteryInfo.charging = battery.charging;
        this.batteryInfo.chargingTime = battery.chargingTime;
        this.batteryInfo.dischargingTime = battery.dischargingTime;
    }

    /**
     * 기기 성능 추정
     */
    estimatePerformance() {
        let performanceScore = 0;
        
        // CPU 코어 수
        const cores = navigator.hardwareConcurrency || 2;
        performanceScore += Math.min(cores / 8, 1) * 30;
        
        // 메모리
        const memory = navigator.deviceMemory || 2;
        performanceScore += Math.min(memory / 8, 1) * 30;
        
        // WebGL 지원
        if (this.capabilities.webgl2) {
            performanceScore += 20;
        } else if (this.capabilities.webgl) {
            performanceScore += 10;
        }
        
        // 픽셀 비율 (높은 DPI는 성능에 부담)
        if (this.deviceInfo.pixelRatio <= 1.5) {
            performanceScore += 10;
        } else if (this.deviceInfo.pixelRatio <= 2) {
            performanceScore += 5;
        }
        
        // 플랫폼별 조정
        if (this.deviceInfo.isMobile) {
            performanceScore *= 0.8; // 모바일은 일반적으로 성능이 낮음
        }
        
        // 성능 클래스 분류
        if (performanceScore >= 70) {
            this.deviceInfo.performanceClass = 'high';
        } else if (performanceScore >= 40) {
            this.deviceInfo.performanceClass = 'medium';
        } else {
            this.deviceInfo.performanceClass = 'low';
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 화면 방향 변경
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.updateOrientation(), 100);
        });
        
        // 화면 크기 변경
        window.addEventListener('resize', () => {
            this.detectScreenInfo();
        });
    }

    /**
     * 모바일 여부 확인
     * @returns {boolean}
     */
    isMobile() {
        return this.deviceInfo.isMobile;
    }

    /**
     * 태블릿 여부 확인
     * @returns {boolean}
     */
    isTablet() {
        return this.deviceInfo.isTablet;
    }

    /**
     * 데스크톱 여부 확인
     * @returns {boolean}
     */
    isDesktop() {
        return this.deviceInfo.isDesktop;
    }

    /**
     * 터치 지원 여부 확인
     * @returns {boolean}
     */
    hasTouchSupport() {
        return this.deviceInfo.touchSupport;
    }

    /**
     * 특정 OS 확인
     * @param {string} os 
     * @returns {boolean}
     */
    isOS(os) {
        return this.deviceInfo.os === os.toLowerCase();
    }

    /**
     * 특정 브라우저 확인
     * @param {string} browser 
     * @returns {boolean}
     */
    isBrowser(browser) {
        return this.deviceInfo.browser === browser.toLowerCase();
    }

    /**
     * 네트워크 상태 확인
     * @returns {Object}
     */
    getNetworkInfo() {
        return { ...this.networkInfo };
    }

    /**
     * 배터리 정보 확인
     * @returns {Object}
     */
    getBatteryInfo() {
        return { ...this.batteryInfo };
    }

    /**
     * 저전력 모드 여부 확인
     * @returns {boolean}
     */
    isLowPowerMode() {
        return this.batteryInfo.level < 0.2 || 
               this.networkInfo.saveData || 
               this.deviceInfo.performanceClass === 'low';
    }

    /**
     * 게임에 적합한 환경인지 확인
     * @returns {Object}
     */
    getGameCompatibility() {
        const compatibility = {
            score: 0,
            issues: [],
            recommendations: []
        };
        
        // WebGL 지원
        if (this.capabilities.webgl) {
            compatibility.score += 40;
        } else {
            compatibility.issues.push('WebGL not supported');
            compatibility.recommendations.push('Update browser or device');
        }
        
        // 성능 클래스
        switch (this.deviceInfo.performanceClass) {
            case 'high':
                compatibility.score += 30;
                break;
            case 'medium':
                compatibility.score += 20;
                break;
            case 'low':
                compatibility.issues.push('Low performance device');
                compatibility.recommendations.push('Reduce graphics quality');
                break;
        }
        
        // 네트워크
        if (this.networkInfo.effectiveType === '4g' || this.networkInfo.effectiveType === '3g') {
            compatibility.score += 20;
        } else if (this.networkInfo.effectiveType === '2g') {
            compatibility.issues.push('Slow network connection');
            compatibility.recommendations.push('Use WiFi for better experience');
        }
        
        // 배터리
        if (this.batteryInfo.level > 0.3) {
            compatibility.score += 10;
        } else {
            compatibility.issues.push('Low battery');
            compatibility.recommendations.push('Charge device');
        }
        
        return compatibility;
    }

    /**
     * 전체 기기 정보 반환
     * @returns {Object}
     */
    getDeviceInfo() {
        return {
            device: { ...this.deviceInfo },
            capabilities: { ...this.capabilities },
            network: { ...this.networkInfo },
            battery: { ...this.batteryInfo },
            compatibility: this.getGameCompatibility()
        };
    }

    /**
     * 요약 정보 반환
     * @returns {Object}
     */
    getSummary() {
        return {
            platform: this.deviceInfo.platform,
            os: `${this.deviceInfo.os} ${this.deviceInfo.osVersion}`,
            browser: `${this.deviceInfo.browser} ${this.deviceInfo.browserVersion}`,
            screen: this.deviceInfo.screenSize,
            performance: this.deviceInfo.performanceClass,
            touch: this.deviceInfo.touchSupport,
            webgl: this.capabilities.webgl,
            network: this.networkInfo.effectiveType
        };
    }
}

// 싱글톤 인스턴스
export const mobileDetection = new MobileDetection();