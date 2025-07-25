/**
 * 모바일 터치 제어 시스템
 * 터치 제스처를 게임 입력으로 변환
 */
export class TouchControls {
    constructor(canvas, gameState) {
        this.canvas = canvas;
        this.gameState = gameState;
        
        // 터치 상태
        this.isActive = false;
        this.touches = new Map();
        this.gestureInProgress = false;
        
        // 제스처 설정
        this.config = {
            swipeThreshold: 50,      // 스와이프 최소 거리
            swipeTimeout: 300,       // 스와이프 최대 시간
            tapTimeout: 200,         // 탭 최대 시간
            longPressTimeout: 500,   // 롱프레스 시간
            doubleTapTimeout: 300,   // 더블탭 간격
            sensitivity: 1.0,        // 제스처 감도
            vibrationEnabled: true   // 햅틱 피드백
        };
        
        // 제스처 상태
        this.lastTapTime = 0;
        this.tapCount = 0;
        this.longPressTimer = null;
        this.swipeStartTime = 0;
        this.swipeStartPosition = { x: 0, y: 0 };
        
        // 이벤트 콜백
        this.eventCallbacks = {};
        
        this.init();
    }

    /**
     * 초기화
     */
    init() {
        this.setupTouchEvents();
        this.loadSettings();
        
        // 모바일 환경 확인
        this.isMobile = this.detectMobileDevice();
        
        if (this.isMobile) {
            this.optimizeForMobile();
        }
    }

    /**
     * 터치 이벤트 설정
     */
    setupTouchEvents() {
        // 터치 시작
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e);
        }, { passive: false });

        // 터치 이동
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e);
        }, { passive: false });

        // 터치 종료
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e);
        }, { passive: false });

        // 터치 취소
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.handleTouchCancel(e);
        }, { passive: false });

        // 마우스 이벤트 (데스크톱 테스트용)
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });

        // 컨텍스트 메뉴 비활성화
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * 터치 시작 처리
     * @param {TouchEvent} event 
     */
    handleTouchStart(event) {
        if (!this.isActive) return;

        const touches = Array.from(event.changedTouches);
        
        touches.forEach(touch => {
            const touchData = {
                id: touch.identifier,
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                startTime: Date.now(),
                moved: false
            };
            
            this.touches.set(touch.identifier, touchData);
        });

        // 첫 번째 터치인 경우
        if (this.touches.size === 1) {
            const touch = touches[0];
            this.startGesture(touch.clientX, touch.clientY);
        }

        // 멀티터치 제스처 처리
        if (this.touches.size > 1) {
            this.handleMultiTouch();
        }
    }

    /**
     * 터치 이동 처리
     * @param {TouchEvent} event 
     */
    handleTouchMove(event) {
        if (!this.isActive) return;

        const touches = Array.from(event.changedTouches);
        
        touches.forEach(touch => {
            const touchData = this.touches.get(touch.identifier);
            if (touchData) {
                touchData.currentX = touch.clientX;
                touchData.currentY = touch.clientY;
                touchData.moved = true;
                
                // 스와이프 거리 계산
                const deltaX = touch.clientX - touchData.startX;
                const deltaY = touch.clientY - touchData.startY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // 스와이프 임계값 초과시 롱프레스 취소
                if (distance > this.config.swipeThreshold && this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        });
    }

    /**
     * 터치 종료 처리
     * @param {TouchEvent} event 
     */
    handleTouchEnd(event) {
        if (!this.isActive) return;

        const touches = Array.from(event.changedTouches);
        
        touches.forEach(touch => {
            const touchData = this.touches.get(touch.identifier);
            if (touchData) {
                this.processGesture(touchData);
                this.touches.delete(touch.identifier);
            }
        });

        // 모든 터치가 끝났을 때
        if (this.touches.size === 0) {
            this.endGesture();
        }
    }

    /**
     * 터치 취소 처리
     * @param {TouchEvent} event 
     */
    handleTouchCancel(event) {
        const touches = Array.from(event.changedTouches);
        
        touches.forEach(touch => {
            this.touches.delete(touch.identifier);
        });

        this.cancelGesture();
    }

    /**
     * 제스처 시작
     * @param {number} x 
     * @param {number} y 
     */
    startGesture(x, y) {
        this.gestureInProgress = true;
        this.swipeStartTime = Date.now();
        this.swipeStartPosition = { x, y };

        // 롱프레스 타이머 시작
        this.longPressTimer = setTimeout(() => {
            this.handleLongPress(x, y);
        }, this.config.longPressTimeout);
    }

    /**
     * 제스처 처리
     * @param {Object} touchData 
     */
    processGesture(touchData) {
        const duration = Date.now() - touchData.startTime;
        const deltaX = touchData.currentX - touchData.startX;
        const deltaY = touchData.currentY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 롱프레스 타이머 취소
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // 제스처 타입 판별
        if (!touchData.moved && duration < this.config.tapTimeout) {
            this.handleTap(touchData.startX, touchData.startY);
        } else if (distance > this.config.swipeThreshold && duration < this.config.swipeTimeout) {
            this.handleSwipe(deltaX, deltaY, distance, duration);
        }
    }

    /**
     * 탭 처리
     * @param {number} x 
     * @param {number} y 
     */
    handleTap(x, y) {
        const currentTime = Date.now();
        
        // 더블탭 감지
        if (currentTime - this.lastTapTime < this.config.doubleTapTimeout) {
            this.tapCount++;
            if (this.tapCount === 2) {
                this.handleDoubleTap(x, y);
                this.tapCount = 0;
                return;
            }
        } else {
            this.tapCount = 1;
        }
        
        this.lastTapTime = currentTime;
        
        // 단일 탭 처리 (지연 후 더블탭이 없으면)
        setTimeout(() => {
            if (this.tapCount === 1) {
                this.handleSingleTap(x, y);
                this.tapCount = 0;
            }
        }, this.config.doubleTapTimeout);
    }

    /**
     * 단일 탭 처리 (점프)
     * @param {number} x 
     * @param {number} y 
     */
    handleSingleTap(x, y) {
        this.vibrate(50); // 짧은 진동
        this.emit('jump', { x, y, type: 'tap' });
    }

    /**
     * 더블탭 처리
     * @param {number} x 
     * @param {number} y 
     */
    handleDoubleTap(x, y) {
        this.vibrate(100); // 중간 진동
        this.emit('doubleTap', { x, y });
    }

    /**
     * 롱프레스 처리
     * @param {number} x 
     * @param {number} y 
     */
    handleLongPress(x, y) {
        this.vibrate(200); // 긴 진동
        this.emit('longPress', { x, y });
    }

    /**
     * 스와이프 처리
     * @param {number} deltaX 
     * @param {number} deltaY 
     * @param {number} distance 
     * @param {number} duration 
     */
    handleSwipe(deltaX, deltaY, distance, duration) {
        const velocity = distance / duration;
        
        // 스와이프 방향 결정
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        let direction;
        
        if (angle >= -45 && angle <= 45) {
            direction = 'right';
        } else if (angle >= 45 && angle <= 135) {
            direction = 'down';
        } else if (angle >= -135 && angle <= -45) {
            direction = 'up';
        } else {
            direction = 'left';
        }

        this.vibrate(75); // 스와이프 진동
        
        this.emit('swipe', {
            direction,
            deltaX,
            deltaY,
            distance,
            velocity,
            duration
        });

        // 방향별 이벤트
        this.emit(`swipe${direction.charAt(0).toUpperCase() + direction.slice(1)}`, {
            distance,
            velocity,
            duration
        });
    }

    /**
     * 멀티터치 처리
     */
    handleMultiTouch() {
        if (this.touches.size === 2) {
            // 핀치 줌 또는 회전 제스처
            const touchArray = Array.from(this.touches.values());
            const touch1 = touchArray[0];
            const touch2 = touchArray[1];
            
            // 두 터치 포인트 간 거리
            const distance = Math.sqrt(
                Math.pow(touch2.currentX - touch1.currentX, 2) +
                Math.pow(touch2.currentY - touch1.currentY, 2)
            );
            
            this.emit('pinch', { distance, touches: touchArray });
        }
    }

    /**
     * 제스처 종료
     */
    endGesture() {
        this.gestureInProgress = false;
        
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    /**
     * 제스처 취소
     */
    cancelGesture() {
        this.endGesture();
        this.touches.clear();
    }

    /**
     * 마우스 이벤트 처리 (데스크톱 테스트용)
     */
    handleMouseDown(event) {
        if (this.isMobile) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.startGesture(x, y);
    }

    handleMouseMove(event) {
        // 마우스 드래그 처리 (필요시)
    }

    handleMouseUp(event) {
        if (this.isMobile) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.handleSingleTap(x, y);
        this.endGesture();
    }

    /**
     * 햅틱 피드백 (진동)
     * @param {number} duration - 진동 시간 (ms)
     */
    vibrate(duration) {
        if (this.config.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }

    /**
     * 모바일 기기 감지
     * @returns {boolean}
     */
    detectMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    /**
     * 모바일 최적화
     */
    optimizeForMobile() {
        // 모바일에서 스크롤 방지
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        
        // 터치 액션 비활성화
        this.canvas.style.touchAction = 'none';
        
        // 선택 비활성화
        this.canvas.style.userSelect = 'none';
        this.canvas.style.webkitUserSelect = 'none';
        
        // 확대/축소 비활성화
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }

    /**
     * 설정 로드
     */
    loadSettings() {
        if (this.gameState && this.gameState.settings) {
            const settings = this.gameState.settings;
            this.config.sensitivity = settings.touchSensitivity || 1.0;
            this.config.vibrationEnabled = settings.vibration !== false;
        }
    }

    /**
     * 터치 컨트롤 활성화
     */
    enable() {
        this.isActive = true;
    }

    /**
     * 터치 컨트롤 비활성화
     */
    disable() {
        this.isActive = false;
        this.cancelGesture();
    }

    /**
     * 설정 업데이트
     * @param {Object} newConfig 
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 이벤트 리스너 등록
     * @param {string} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this.eventCallbacks[event]) {
            this.eventCallbacks[event] = [];
        }
        this.eventCallbacks[event].push(callback);
    }

    /**
     * 이벤트 발생
     * @param {string} event 
     * @param {Object} data 
     */
    emit(event, data) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].forEach(callback => {
                callback(data);
            });
        }
    }

    /**
     * 터치 정보 반환
     */
    getTouchInfo() {
        return {
            isActive: this.isActive,
            touchCount: this.touches.size,
            isMobile: this.isMobile,
            gestureInProgress: this.gestureInProgress,
            config: { ...this.config }
        };
    }

    /**
     * 정리
     */
    destroy() {
        this.disable();
        this.eventCallbacks = {};
        
        // 이벤트 리스너 제거
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    }
}