import { FlutterBridge } from '../flutter/FlutterBridge.js';

/**
 * 게임 상태 관리 클래스
 * 점수, 통계, 설정, 업적 등 모든 게임 데이터를 관리
 */
export class GameState {
    constructor() {
        // 게임 상태
        this.currentState = FlutterBridge.GAME_STATUS.LOADING;
        this.previousState = null;
        
        // 점수 관련
        this.currentScore = 0;
        this.bestScore = 0;
        this.currentDistance = 0;
        this.bestDistance = 0;
        
        // 세션 통계
        this.sessionStats = {
            playTime: 0,
            jumpCount: 0,
            totalDistance: 0,
            fallCount: 0,
            perfectLandings: 0,
            sessionStartTime: Date.now()
        };
        
        // 전체 통계
        this.totalStats = {
            totalPlayTime: 0,
            totalJumps: 0,
            totalGames: 0,
            totalFalls: 0,
            averageScore: 0,
            longestSession: 0
        };
        
        // 업적 관련
        this.achievements = new Set();
        this.achievementProgress = {};
        
        // 게임 설정
        this.settings = {
            musicVolume: 0.7,
            sfxVolume: 0.8,
            graphics: 'medium',
            controlType: 'keyboard',
            vibration: true
        };
        
        // 이벤트 리스너
        this.eventListeners = {};
        
        this.init();
    }

    /**
     * 초기화
     */
    async init() {
        await this.loadFromStorage();
        this.setupFlutterListeners();
        this.changeState(FlutterBridge.GAME_STATUS.MENU);
    }

    /**
     * 게임 상태 변경
     * @param {string} newState - 새로운 상태
     */
    changeState(newState) {
        if (this.currentState === newState) return;
        
        this.previousState = this.currentState;
        this.currentState = newState;
        
        // Flutter에 상태 변경 알림
        FlutterBridge.sendGameStatus(newState);
        
        // 상태별 처리
        this.handleStateChange(newState);
        
        // 이벤트 발생
        this.emit('stateChanged', { 
            newState, 
            previousState: this.previousState 
        });
    }

    /**
     * 상태 변경 처리
     * @param {string} state - 새로운 상태
     */
    handleStateChange(state) {
        switch (state) {
            case FlutterBridge.GAME_STATUS.PLAYING:
                this.startSession();
                break;
            case FlutterBridge.GAME_STATUS.PAUSED:
                this.pauseSession();
                break;
            case FlutterBridge.GAME_STATUS.GAME_OVER:
                this.endSession();
                break;
            case FlutterBridge.GAME_STATUS.RESTART:
                this.resetSession();
                break;
        }
    }

    /**
     * 게임 세션 시작
     */
    startSession() {
        this.sessionStats.sessionStartTime = Date.now();
        this.currentScore = 0;
        this.currentDistance = 0;
        this.sessionStats.jumpCount = 0;
        this.sessionStats.fallCount = 0;
        this.sessionStats.perfectLandings = 0;
        
        this.totalStats.totalGames++;
    }

    /**
     * 게임 세션 일시정지
     */
    pauseSession() {
        this.updatePlayTime();
    }

    /**
     * 게임 세션 종료
     */
    endSession() {
        this.updatePlayTime();
        this.updateBestRecords();
        this.updateTotalStats();
        this.checkAchievements();
        this.saveToStorage();
        
        // 세션 데이터 Flutter에 전송
        FlutterBridge.sendSessionData({
            score: this.currentScore,
            distance: this.currentDistance,
            playTime: this.sessionStats.playTime,
            jumps: this.sessionStats.jumpCount,
            falls: this.sessionStats.fallCount,
            perfectLandings: this.sessionStats.perfectLandings
        });
    }

    /**
     * 게임 세션 리셋
     */
    resetSession() {
        this.changeState(FlutterBridge.GAME_STATUS.PLAYING);
    }

    /**
     * 점수 업데이트
     * @param {number} points - 추가할 점수
     */
    updateScore(points) {
        this.currentScore += points;
        FlutterBridge.sendScore(this.currentScore);
        
        // 점수 기반 업적 확인
        this.checkScoreAchievements();
    }

    /**
     * 거리 업데이트
     * @param {number} distance - 현재 거리
     */
    updateDistance(distance) {
        this.currentDistance = distance;
        this.sessionStats.totalDistance = distance;
        
        // 거리 기반 업적 확인
        this.checkDistanceAchievements();
    }

    /**
     * 플레이어 액션 기록
     * @param {string} action - 액션 타입
     * @param {Object} data - 추가 데이터
     */
    recordAction(action, data = {}) {
        // 통계 업데이트
        switch (action) {
            case FlutterBridge.PLAYER_ACTIONS.JUMP:
                this.sessionStats.jumpCount++;
                break;
            case FlutterBridge.PLAYER_ACTIONS.FALL:
                this.sessionStats.fallCount++;
                break;
            case FlutterBridge.PLAYER_ACTIONS.LAND:
                if (data.perfect) {
                    this.sessionStats.perfectLandings++;
                }
                break;
        }
        
        // Flutter에 액션 전송
        FlutterBridge.sendPlayerAction(action, data);
        
        // 액션별 업적 확인
        this.checkActionAchievements(action, data);
    }

    /**
     * 플레이 시간 업데이트
     */
    updatePlayTime() {
        const currentTime = Date.now();
        const sessionTime = currentTime - this.sessionStats.sessionStartTime;
        this.sessionStats.playTime = sessionTime;
    }

    /**
     * 베스트 기록 업데이트
     */
    updateBestRecords() {
        let newRecord = false;
        
        if (this.currentScore > this.bestScore) {
            this.bestScore = this.currentScore;
            newRecord = true;
            
            FlutterBridge.sendAchievement('NEW_HIGH_SCORE', {
                score: this.bestScore,
                previousBest: this.bestScore
            });
        }
        
        if (this.currentDistance > this.bestDistance) {
            this.bestDistance = this.currentDistance;
            newRecord = true;
            
            FlutterBridge.sendAchievement('NEW_DISTANCE_RECORD', {
                distance: this.bestDistance
            });
        }
        
        return newRecord;
    }

    /**
     * 전체 통계 업데이트
     */
    updateTotalStats() {
        this.totalStats.totalPlayTime += this.sessionStats.playTime;
        this.totalStats.totalJumps += this.sessionStats.jumpCount;
        this.totalStats.totalFalls += this.sessionStats.fallCount;
        
        // 평균 점수 계산
        this.totalStats.averageScore = this.totalStats.totalGames > 0 ? 
            (this.totalStats.averageScore * (this.totalStats.totalGames - 1) + this.currentScore) / this.totalStats.totalGames : 
            this.currentScore;
        
        // 최장 세션 업데이트
        if (this.sessionStats.playTime > this.totalStats.longestSession) {
            this.totalStats.longestSession = this.sessionStats.playTime;
        }
        
        // 통계 Flutter에 전송
        FlutterBridge.sendStatistics(this.totalStats);
    }

    /**
     * 점수 기반 업적 확인
     */
    checkScoreAchievements() {
        const scoreThresholds = [100, 500, 1000, 5000, 10000];
        
        scoreThresholds.forEach(threshold => {
            const achievementId = `SCORE_${threshold}`;
            if (this.currentScore >= threshold && !this.achievements.has(achievementId)) {
                this.unlockAchievement(achievementId, { score: this.currentScore });
            }
        });
    }

    /**
     * 거리 기반 업적 확인
     */
    checkDistanceAchievements() {
        const distanceThresholds = [10, 50, 100, 500, 1000];
        
        distanceThresholds.forEach(threshold => {
            const achievementId = `DISTANCE_${threshold}`;
            if (this.currentDistance >= threshold && !this.achievements.has(achievementId)) {
                this.unlockAchievement(achievementId, { distance: this.currentDistance });
            }
        });
    }

    /**
     * 액션 기반 업적 확인
     */
    checkActionAchievements(action, data) {
        switch (action) {
            case FlutterBridge.PLAYER_ACTIONS.JUMP:
                if (this.sessionStats.jumpCount === 100 && !this.achievements.has('JUMP_MASTER')) {
                    this.unlockAchievement('JUMP_MASTER', { jumps: this.sessionStats.jumpCount });
                }
                break;
            case FlutterBridge.PLAYER_ACTIONS.LAND:
                if (data.perfect && this.sessionStats.perfectLandings === 10 && !this.achievements.has('PERFECT_LANDING_10')) {
                    this.unlockAchievement('PERFECT_LANDING_10', { perfectLandings: this.sessionStats.perfectLandings });
                }
                break;
        }
    }

    /**
     * 업적 해제
     * @param {string} achievementId - 업적 ID
     * @param {Object} data - 업적 관련 데이터
     */
    unlockAchievement(achievementId, data = {}) {
        if (this.achievements.has(achievementId)) return;
        
        this.achievements.add(achievementId);
        FlutterBridge.sendAchievement(achievementId, data);
        
        this.emit('achievementUnlocked', { achievementId, data });
    }

    /**
     * 모든 업적 확인
     */
    checkAchievements() {
        this.checkScoreAchievements();
        this.checkDistanceAchievements();
        
        // 세션 기반 업적
        if (this.sessionStats.fallCount === 0 && this.currentDistance > 10 && !this.achievements.has('NO_FALL_RUN')) {
            this.unlockAchievement('NO_FALL_RUN', { distance: this.currentDistance });
        }
        
        // 시간 기반 업적
        if (this.sessionStats.playTime > 300000 && !this.achievements.has('MARATHON_PLAYER')) { // 5분
            this.unlockAchievement('MARATHON_PLAYER', { playTime: this.sessionStats.playTime });
        }
    }

    /**
     * 설정 업데이트
     * @param {Object} newSettings - 새로운 설정
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveToStorage();
        
        this.emit('settingsChanged', this.settings);
    }

    /**
     * Flutter 리스너 설정
     */
    setupFlutterListeners() {
        // 설정 업데이트 수신
        FlutterBridge.onSettingsUpdate((settings) => {
            this.updateSettings(settings);
        });
        
        // 게임 제어 명령 수신
        FlutterBridge.onGameControl((command, params) => {
            switch (command) {
                case 'PAUSE':
                    this.changeState(FlutterBridge.GAME_STATUS.PAUSED);
                    break;
                case 'RESUME':
                    this.changeState(FlutterBridge.GAME_STATUS.PLAYING);
                    break;
                case 'RESTART':
                    this.changeState(FlutterBridge.GAME_STATUS.RESTART);
                    break;
                case 'RESET_STATS':
                    this.resetStats();
                    break;
            }
        });
    }

    /**
     * 통계 리셋
     */
    resetStats() {
        this.totalStats = {
            totalPlayTime: 0,
            totalJumps: 0,
            totalGames: 0,
            totalFalls: 0,
            averageScore: 0,
            longestSession: 0
        };
        
        this.achievements.clear();
        this.achievementProgress = {};
        this.bestScore = 0;
        this.bestDistance = 0;
        
        this.saveToStorage();
    }

    /**
     * 로컬 스토리지에서 데이터 로드
     */
    async loadFromStorage() {
        try {
            const savedData = localStorage.getItem('steppingStoneGameState');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                this.bestScore = data.bestScore || 0;
                this.bestDistance = data.bestDistance || 0;
                this.totalStats = { ...this.totalStats, ...data.totalStats };
                this.settings = { ...this.settings, ...data.settings };
                
                if (data.achievements) {
                    this.achievements = new Set(data.achievements);
                }
                
                if (data.achievementProgress) {
                    this.achievementProgress = data.achievementProgress;
                }
            }
        } catch (error) {
            console.error('게임 데이터 로드 실패:', error);
            FlutterBridge.sendError('STORAGE_LOAD_ERROR', '저장된 데이터 로드 실패', { error: error.message });
        }
    }

    /**
     * 로컬 스토리지에 데이터 저장
     */
    saveToStorage() {
        try {
            const dataToSave = {
                bestScore: this.bestScore,
                bestDistance: this.bestDistance,
                totalStats: this.totalStats,
                settings: this.settings,
                achievements: Array.from(this.achievements),
                achievementProgress: this.achievementProgress,
                lastSaved: Date.now()
            };
            
            localStorage.setItem('steppingStoneGameState', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('게임 데이터 저장 실패:', error);
            FlutterBridge.sendError('STORAGE_SAVE_ERROR', '데이터 저장 실패', { error: error.message });
        }
    }

    /**
     * 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 이벤트 발생
     * @param {string} event - 이벤트 이름
     * @param {Object} data - 이벤트 데이터
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                callback(data);
            });
        }
    }

    /**
     * 현재 게임 상태 반환
     */
    getCurrentState() {
        return {
            state: this.currentState,
            score: this.currentScore,
            distance: this.currentDistance,
            bestScore: this.bestScore,
            bestDistance: this.bestDistance,
            sessionStats: { ...this.sessionStats },
            totalStats: { ...this.totalStats },
            achievements: Array.from(this.achievements),
            settings: { ...this.settings }
        };
    }
}