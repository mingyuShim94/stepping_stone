// Flutter 통신 전담 클래스
export class FlutterBridge {
    // 게임 이벤트 타입 상수
    static EVENT_TYPES = {
        SCORE: 'score',
        GAME_STATUS: 'game_status',
        PLAYER_ACTION: 'player_action',
        GAME_EVENT: 'game_event',
        STATISTICS: 'statistics',
        ACHIEVEMENT: 'achievement',
        SESSION_DATA: 'session_data',
        ERROR: 'error',
        SETTINGS: 'settings'
    };

    // 게임 상태 상수
    static GAME_STATUS = {
        LOADING: 'loading',
        MENU: 'menu', 
        PLAYING: 'playing',
        PAUSED: 'paused',
        GAME_OVER: 'gameover',
        RESTART: 'restart'
    };

    // 플레이어 액션 상수
    static PLAYER_ACTIONS = {
        JUMP: 'jump',
        MOVE: 'move',
        FALL: 'fall',
        LAND: 'land',
        COLLISION: 'collision'
    };

    /**
     * Flutter WebView로 점수 전송
     * @param {number} score - 게임 점수
     */
    static sendScore(score) {
        this.sendMessage(this.EVENT_TYPES.SCORE, { score });
    }

    /**
     * Flutter WebView로 게임 상태 전송
     * @param {string} status - 게임 상태
     */
    static sendGameStatus(status) {
        this.sendMessage(this.EVENT_TYPES.GAME_STATUS, { status });
    }

    /**
     * 플레이어 액션 전송
     * @param {string} action - 액션 타입
     * @param {Object} data - 추가 데이터
     */
    static sendPlayerAction(action, data = {}) {
        this.sendMessage(this.EVENT_TYPES.PLAYER_ACTION, { action, ...data });
    }

    /**
     * 게임 이벤트 전송
     * @param {string} event - 이벤트 타입
     * @param {Object} data - 이벤트 데이터
     */
    static sendGameEvent(event, data = {}) {
        this.sendMessage(this.EVENT_TYPES.GAME_EVENT, { event, ...data });
    }

    /**
     * 플레이어 통계 전송
     * @param {Object} stats - 통계 데이터
     */
    static sendStatistics(stats) {
        this.sendMessage(this.EVENT_TYPES.STATISTICS, stats);
    }

    /**
     * 성과/업적 달성 알림
     * @param {string} achievementId - 업적 ID
     * @param {Object} data - 업적 관련 데이터
     */
    static sendAchievement(achievementId, data = {}) {
        this.sendMessage(this.EVENT_TYPES.ACHIEVEMENT, { achievementId, ...data });
    }

    /**
     * 게임 세션 데이터 전송
     * @param {Object} sessionData - 세션 데이터
     */
    static sendSessionData(sessionData) {
        this.sendMessage(this.EVENT_TYPES.SESSION_DATA, sessionData);
    }

    /**
     * 오류 정보 전송
     * @param {string} errorType - 오류 타입
     * @param {string} message - 오류 메시지
     * @param {Object} details - 추가 세부사항
     */
    static sendError(errorType, message, details = {}) {
        this.sendMessage(this.EVENT_TYPES.ERROR, { 
            errorType, 
            message, 
            timestamp: Date.now(),
            ...details 
        });
    }

    /**
     * 통합 메시지 전송 메서드
     * @param {string} type - 메시지 타입
     * @param {Object} data - 전송할 데이터
     */
    static sendMessage(type, data) {
        try {
            const message = {
                type,
                data,
                timestamp: Date.now()
            };

            // 타입별 채널 선택
            let channel = null;
            switch (type) {
                case this.EVENT_TYPES.SCORE:
                    channel = window.ScoreChannel;
                    break;
                case this.EVENT_TYPES.GAME_STATUS:
                    channel = window.GameStatusChannel;
                    break;
                default:
                    channel = window.GameEventChannel || window.ScoreChannel;
            }

            if (channel && channel.postMessage) {
                channel.postMessage(JSON.stringify(message));
                console.log(`Flutter로 ${type} 전송:`, data);
            } else {
                console.warn(`Flutter ${type} 채널이 사용할 수 없습니다.`);
                // 개발 환경에서 테스트용
                if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
                    console.log(`[개발 모드] ${type}:`, data);
                }
            }
        } catch (error) {
            console.error(`Flutter ${type} 전송 실패:`, error);
            this.sendError('BRIDGE_ERROR', `메시지 전송 실패: ${type}`, { originalData: data });
        }
    }

    /**
     * Flutter에서 오는 메시지 수신 처리
     * @param {Function} callback - 메시지 처리 콜백 함수
     */
    static onFlutterMessage(callback) {
        // Flutter에서 JavaScript로 메시지를 보낼 때 사용
        window.addEventListener('message', (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                callback(data);
            } catch (error) {
                console.error('Flutter 메시지 처리 실패:', error);
                this.sendError('MESSAGE_PARSE_ERROR', 'Flutter 메시지 파싱 실패', { 
                    originalData: event.data 
                });
            }
        });
    }

    /**
     * 게임 설정 명령 수신 리스너 등록
     * @param {Function} settingsCallback - 설정 변경 콜백
     */
    static onSettingsUpdate(settingsCallback) {
        this.onFlutterMessage((data) => {
            if (data.type === 'SETTINGS_UPDATE') {
                settingsCallback(data.settings);
            }
        });
    }

    /**
     * 게임 제어 명령 수신 리스너 등록
     * @param {Function} controlCallback - 제어 명령 콜백
     */
    static onGameControl(controlCallback) {
        this.onFlutterMessage((data) => {
            if (data.type === 'GAME_CONTROL') {
                controlCallback(data.command, data.params);
            }
        });
    }

    /**
     * Flutter WebView 환경 확인
     * @returns {boolean} Flutter WebView 환경 여부
     */
    static isFlutterEnvironment() {
        return !!(window.ScoreChannel || window.GameStatusChannel || window.GameEventChannel);
    }

    /**
     * Flutter 통신 상태 확인
     * @returns {Object} 각 채널의 사용 가능 여부
     */
    static getChannelStatus() {
        return {
            scoreChannel: !!window.ScoreChannel,
            gameStatusChannel: !!window.GameStatusChannel,
            gameEventChannel: !!window.GameEventChannel,
            isFlutterEnvironment: this.isFlutterEnvironment()
        };
    }

    /**
     * 게임 초기화 완료 알림
     * @param {Object} gameInfo - 게임 정보
     */
    static notifyGameReady(gameInfo = {}) {
        this.sendMessage(this.EVENT_TYPES.GAME_EVENT, {
            event: 'GAME_READY',
            gameInfo: {
                version: '1.0.0',
                features: ['webgl', '3d', 'audio'],
                ...gameInfo
            }
        });
    }

    /**
     * 게임 성능 메트릭 전송
     * @param {Object} metrics - 성능 지표
     */
    static sendPerformanceMetrics(metrics) {
        this.sendMessage(this.EVENT_TYPES.GAME_EVENT, {
            event: 'PERFORMANCE_METRICS',
            metrics
        });
    }
}