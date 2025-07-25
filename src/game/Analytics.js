import { FlutterBridge } from '../flutter/FlutterBridge.js';

/**
 * 게임 분석 및 로깅 시스템
 * 플레이어 행동, 성능, 오류 등을 수집하고 분석
 */
export class Analytics {
    constructor(gameState) {
        this.gameState = gameState;
        
        // 세션 정보
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = Date.now();
        this.isActive = false;
        
        // 분석 데이터 버퍼
        this.eventBuffer = [];
        this.performanceBuffer = [];
        this.errorBuffer = [];
        
        // 설정
        this.config = {
            bufferSize: 100,
            flushInterval: 30000, // 30초마다 전송
            enabledMetrics: {
                performance: true,
                userActions: true,
                errors: true,
                gameplay: true
            },
            sampling: {
                performance: 0.1, // 10% 샘플링
                actions: 1.0,     // 모든 액션
                errors: 1.0       // 모든 오류
            }
        };
        
        // 성능 메트릭
        this.performanceMetrics = {
            fps: 0,
            frameTime: 0,
            memoryUsage: 0,
            loadTime: 0,
            renderTime: 0
        };
        
        // 게임플레이 메트릭
        this.gameplayMetrics = {
            totalClicks: 0,
            totalSwipes: 0,
            totalJumps: 0,
            totalFalls: 0,
            avgSessionLength: 0,
            maxStreak: 0,
            currentStreak: 0
        };
        
        // 타이머
        this.flushTimer = null;
        this.performanceTimer = null;
        
        this.init();
    }

    /**
     * 초기화
     */
    init() {
        this.startSession();
        this.setupPerformanceMonitoring();
        this.setupEventListeners();
        this.startFlushTimer();
    }

    /**
     * 세션 시작
     */
    startSession() {
        this.isActive = true;
        this.sessionStartTime = Date.now();
        
        const sessionData = {
            sessionId: this.sessionId,
            startTime: this.sessionStartTime,
            userAgent: navigator.userAgent,
            platform: this.detectPlatform(),
            screenSize: {
                width: window.screen.width,
                height: window.screen.height
            },
            devicePixelRatio: window.devicePixelRatio || 1
        };

        this.trackEvent('session_start', sessionData);
    }

    /**
     * 세션 종료
     */
    endSession() {
        if (!this.isActive) return;

        const sessionDuration = Date.now() - this.sessionStartTime;
        
        const sessionData = {
            sessionId: this.sessionId,
            duration: sessionDuration,
            totalEvents: this.eventBuffer.length,
            gameplayMetrics: { ...this.gameplayMetrics },
            performanceMetrics: this.getAveragePerformanceMetrics()
        };

        this.trackEvent('session_end', sessionData);
        this.flush(); // 세션 종료시 즉시 전송
        
        this.isActive = false;
    }

    /**
     * 이벤트 추적
     * @param {string} eventName - 이벤트 이름
     * @param {Object} eventData - 이벤트 데이터
     * @param {number} timestamp - 타임스탬프 (선택적)
     */
    trackEvent(eventName, eventData = {}, timestamp = Date.now()) {
        if (!this.isActive) return;

        // 샘플링 체크
        if (!this.shouldSample('actions')) return;

        const event = {
            sessionId: this.sessionId,
            eventName,
            eventData,
            timestamp,
            gameState: this.gameState ? {
                currentState: this.gameState.currentState,
                score: this.gameState.currentScore,
                distance: this.gameState.currentDistance
            } : null
        };

        this.eventBuffer.push(event);
        
        // 버퍼 크기 초과시 오래된 이벤트 제거
        if (this.eventBuffer.length > this.config.bufferSize) {
            this.eventBuffer.shift();
        }

        // 특정 이벤트는 즉시 전송
        if (this.isHighPriorityEvent(eventName)) {
            this.sendEvent(event);
        }
    }

    /**
     * 플레이어 액션 추적
     * @param {string} action - 액션 타입
     * @param {Object} details - 상세 정보
     */
    trackPlayerAction(action, details = {}) {
        // 게임플레이 메트릭 업데이트
        switch (action) {
            case 'jump':
                this.gameplayMetrics.totalJumps++;
                break;
            case 'fall':
                this.gameplayMetrics.totalFalls++;
                this.gameplayMetrics.currentStreak = 0;
                break;
            case 'move':
                if (details.direction) {
                    this.gameplayMetrics.currentStreak++;
                    this.gameplayMetrics.maxStreak = Math.max(
                        this.gameplayMetrics.maxStreak, 
                        this.gameplayMetrics.currentStreak
                    );
                }
                break;
            case 'click':
                this.gameplayMetrics.totalClicks++;
                break;
            case 'swipe':
                this.gameplayMetrics.totalSwipes++;
                break;
        }

        this.trackEvent('player_action', {
            action,
            details,
            gameplayMetrics: { ...this.gameplayMetrics }
        });
    }

    /**
     * 성능 메트릭 추적
     * @param {Object} metrics - 성능 지표
     */
    trackPerformance(metrics) {
        if (!this.config.enabledMetrics.performance) return;
        if (!this.shouldSample('performance')) return;

        const performanceData = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            ...metrics
        };

        this.performanceBuffer.push(performanceData);

        // 성능 메트릭 업데이트
        Object.assign(this.performanceMetrics, metrics);

        // 버퍼 크기 관리
        if (this.performanceBuffer.length > this.config.bufferSize) {
            this.performanceBuffer.shift();
        }
    }

    /**
     * 오류 추적
     * @param {string} errorType - 오류 타입
     * @param {Error|string} error - 오류 객체 또는 메시지
     * @param {Object} context - 추가 컨텍스트
     */
    trackError(errorType, error, context = {}) {
        if (!this.config.enabledMetrics.errors) return;

        const errorData = {
            sessionId: this.sessionId,
            errorType,
            message: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : null,
            timestamp: Date.now(),
            context: {
                ...context,
                userAgent: navigator.userAgent,
                url: window.location.href,
                gameState: this.gameState ? this.gameState.getCurrentState() : null
            }
        };

        this.errorBuffer.push(errorData);
        
        // 오류는 즉시 전송
        this.sendError(errorData);

        // Flutter에도 오류 전송
        FlutterBridge.sendError(errorType, errorData.message, errorData.context);
    }

    /**
     * 게임 이벤트 추적
     * @param {string} eventType - 이벤트 타입
     * @param {Object} eventData - 이벤트 데이터
     */
    trackGameEvent(eventType, eventData = {}) {
        if (!this.config.enabledMetrics.gameplay) return;

        this.trackEvent('game_event', {
            type: eventType,
            data: eventData,
            timestamp: Date.now()
        });
    }

    /**
     * 성능 모니터링 설정
     */
    setupPerformanceMonitoring() {
        if (!this.config.enabledMetrics.performance) return;

        // FPS 모니터링
        this.performanceTimer = setInterval(() => {
            this.collectPerformanceMetrics();
        }, 5000); // 5초마다 수집

        // 페이지 로드 시간
        if (performance.timing) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            this.trackPerformance({ loadTime });
        }

        // 메모리 사용량 모니터링 (지원되는 브라우저에서)
        if (performance.memory) {
            this.trackPerformance({
                memoryUsage: performance.memory.usedJSHeapSize / 1024 / 1024 // MB
            });
        }
    }

    /**
     * 성능 메트릭 수집
     */
    collectPerformanceMetrics() {
        const now = performance.now();
        
        // 프레임률 계산 (대략적)
        this.lastFrameTime = this.lastFrameTime || now;
        const frameDelta = now - this.lastFrameTime;
        const fps = frameDelta > 0 ? 1000 / frameDelta : 0;
        this.lastFrameTime = now;

        const metrics = {
            fps: fps,
            frameTime: frameDelta,
            timestamp: Date.now()
        };

        // 메모리 정보 (지원되는 경우)
        if (performance.memory) {
            metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
        }

        this.trackPerformance(metrics);
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 페이지 언로드시 세션 종료
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // 에러 리스너
        window.addEventListener('error', (event) => {
            this.trackError('javascript_error', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Promise rejection 리스너
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError('promise_rejection', event.reason);
        });

        // 가시성 변경 감지
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden');
            } else {
                this.trackEvent('page_visible');
            }
        });
    }

    /**
     * 데이터 전송 타이머 시작
     */
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }

    /**
     * 버퍼된 데이터 전송
     */
    flush() {
        if (this.eventBuffer.length === 0 && this.performanceBuffer.length === 0) {
            return;
        }

        const analyticsData = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            events: [...this.eventBuffer],
            performance: [...this.performanceBuffer],
            summary: {
                sessionDuration: Date.now() - this.sessionStartTime,
                totalEvents: this.eventBuffer.length,
                gameplayMetrics: { ...this.gameplayMetrics },
                averagePerformance: this.getAveragePerformanceMetrics()
            }
        };

        // Flutter로 분석 데이터 전송
        FlutterBridge.sendMessage('ANALYTICS_DATA', analyticsData);

        // 버퍼 클리어
        this.eventBuffer = [];
        this.performanceBuffer = [];
    }

    /**
     * 개별 이벤트 즉시 전송
     * @param {Object} event 
     */
    sendEvent(event) {
        FlutterBridge.sendMessage('ANALYTICS_EVENT', event);
    }

    /**
     * 오류 즉시 전송
     * @param {Object} errorData 
     */
    sendError(errorData) {
        FlutterBridge.sendMessage('ANALYTICS_ERROR', errorData);
    }

    /**
     * 샘플링 체크
     * @param {string} type 
     * @returns {boolean}
     */
    shouldSample(type) {
        const rate = this.config.sampling[type] || 1.0;
        return Math.random() < rate;
    }

    /**
     * 고우선순위 이벤트 체크
     * @param {string} eventName 
     * @returns {boolean}
     */
    isHighPriorityEvent(eventName) {
        const highPriorityEvents = [
            'session_start',
            'session_end',
            'game_over',
            'error',
            'crash'
        ];
        return highPriorityEvents.includes(eventName);
    }

    /**
     * 플랫폼 감지
     * @returns {string}
     */
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/android/i.test(userAgent)) return 'android';
        if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
        if (/windows/i.test(userAgent)) return 'windows';
        if (/mac/i.test(userAgent)) return 'mac';
        if (/linux/i.test(userAgent)) return 'linux';
        
        return 'unknown';
    }

    /**
     * 평균 성능 메트릭 계산
     * @returns {Object}
     */
    getAveragePerformanceMetrics() {
        if (this.performanceBuffer.length === 0) {
            return { ...this.performanceMetrics };
        }

        const avg = {};
        const keys = ['fps', 'frameTime', 'memoryUsage'];
        
        keys.forEach(key => {
            const values = this.performanceBuffer
                .filter(p => p[key] !== undefined)
                .map(p => p[key]);
                
            if (values.length > 0) {
                avg[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
            }
        });

        return avg;
    }

    /**
     * 세션 ID 생성
     * @returns {string}
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 설정 업데이트
     * @param {Object} newConfig 
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 현재 분석 상태 반환
     * @returns {Object}
     */
    getAnalyticsState() {
        return {
            sessionId: this.sessionId,
            isActive: this.isActive,
            sessionDuration: Date.now() - this.sessionStartTime,
            eventBufferSize: this.eventBuffer.length,
            performanceBufferSize: this.performanceBuffer.length,
            gameplayMetrics: { ...this.gameplayMetrics },
            performanceMetrics: { ...this.performanceMetrics }
        };
    }

    /**
     * 정리
     */
    destroy() {
        this.endSession();
        
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
            this.performanceTimer = null;
        }
        
        // 이벤트 리스너 정리
        window.removeEventListener('beforeunload', this.endSession);
    }
}