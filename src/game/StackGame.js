import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GameState } from "./GameState.js";
import { TouchControls } from "./TouchControls.js";
import { FlutterBridge } from "../flutter/FlutterBridge.js";
import { Analytics } from "./Analytics.js";
import { Settings } from "./Settings.js";
import { mobileDetection } from "../utils/MobileDetection.js";

class FreeMovementGame {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.mixer = null;
    this.walkAction = null;
    this.clock = new THREE.Clock();
    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };
    this.moveSpeed = 0.1;

    // 점프 관련 변수
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.gravity = -0.01;
    this.jumpHeight = 0.15;
    this.groundY = 0;

    // 다리 범위 제한
    this.bridgeWidth = 1.5; // 다리 폭의 절반
    this.isFalling = false;

    // 배경음악
    this.bgMusic = null;
    this.screamSound = null;

    // 게임 상태 관리
    this.gameState = null;
    this.touchControls = null;
    this.analytics = null;
    this.settings = null;

    // 점수/진행도 관련
    this.startTime = null;
    this.lastDistance = 0;
    this.maxDistance = 0;
    this.distanceMultiplier = 10; // 거리당 점수 배수
    this.lastPerfectLanding = false;

    // 모바일 최적화
    this.deviceInfo = mobileDetection.getDeviceInfo();
    this.performanceMode = 'auto';
    this.adaptiveQuality = true;

    this.init();
    this.setupEventListeners();
    this.animate();
  }

  async init() {
    const canvas = document.getElementById("gameCanvas");

    // 설정 시스템 초기화
    this.settings = new Settings();
    await this.settings.init();

    // 게임 상태 초기화
    this.gameState = new GameState();
    await this.gameState.init();

    // 분석 시스템 초기화
    this.analytics = new Analytics(this.gameState);

    // 터치 컨트롤 초기화
    this.touchControls = new TouchControls(canvas, this.gameState);
    this.setupTouchControlEvents();

    // 모바일 최적화 적용
    this.applyMobileOptimizations();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a); // 더 어두운 밤하늘

    // 반응형 카메라 설정
    this.setupResponsiveCamera();

    // 성능에 따른 렌더러 설정
    this.setupOptimizedRenderer(canvas);

    this.setupLighting();
    this.createEnvironment();
    this.setupBackgroundMusic();
    this.createPlayer();

    // 게임 준비 완료 알림 (확장된 정보)
    FlutterBridge.notifyGameReady({
      canvas: { width: canvas.width, height: canvas.height },
      controls: { 
        keyboard: true, 
        touch: this.touchControls.isMobile,
        gestures: this.deviceInfo.device.touchSupport 
      },
      device: this.deviceInfo.device,
      performance: this.deviceInfo.compatibility
    });

    // 이벤트 리스너 설정
    this.setupGameStateEvents();
    this.setupAnalyticsEvents();
    this.setupSettingsEvents();

    // 초기 분석 이벤트 기록
    this.analytics.trackEvent('game_initialized', {
      deviceInfo: this.deviceInfo,
      performanceMode: this.performanceMode
    });
  }

  setupLighting() {
    // 어두운 환경광
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
    this.scene.add(ambientLight);

    // 위에서 아래로 비추는 극적인 조명
    const directionalLight = new THREE.DirectionalLight(0xffffcc, 1.2);
    directionalLight.position.set(0, 20, 0);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
  }

  createEnvironment() {
    // 세로 방향 좁은 다리 생성
    const bridgeGeometry = new THREE.PlaneGeometry(3, 50); // 폭 3, 길이 50
    const bridgeMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // 갈색 나무색
    });
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
    bridge.rotation.x = -Math.PI / 2; // 수평으로 눕히기
    bridge.position.set(0, -0.1, -10); // 약간 아래에, 앞으로 뻗어나가게
    bridge.receiveShadow = true;
    this.scene.add(bridge);

    // 안개 효과로 깊이감 표현
    this.scene.fog = new THREE.Fog(0x0a0a0a, 20, 100);
  }

  setupBackgroundMusic() {
    // HTML5 Audio 요소 생성
    this.bgMusic = new Audio('/music/bgm.mp3');
    this.bgMusic.loop = true; // 반복 재생
    this.bgMusic.volume = 0.3; // 볼륨 30%
    this.bgMusic.preload = 'auto';

    // 비명 소리 설정
    this.screamSound = new Audio('/music/scream.mp3');
    this.screamSound.volume = 0.7; // 볼륨 70% (더 크게)
    this.screamSound.preload = 'auto';

    // 첫 번째 사용자 상호작용 후 재생 시작
    this.startMusicOnInteraction();
  }

  startMusicOnInteraction() {
    const startMusic = () => {
      if (this.bgMusic && this.bgMusic.paused) {
        this.bgMusic.play().then(() => {
          console.log('배경음악 재생 시작');
          
          // 음악 힌트 숨기기
          const musicHint = document.getElementById('music-hint');
          if (musicHint) {
            musicHint.style.display = 'none';
          }
        }).catch((error) => {
          console.log('음악 재생 실패:', error);
        });
      }
      
      // 이벤트 리스너 제거 (한 번만 실행)
      document.removeEventListener('keydown', startMusic);
      document.removeEventListener('click', startMusic);
      document.removeEventListener('touchstart', startMusic);
    };

    // 사용자 상호작용 감지
    document.addEventListener('keydown', startMusic);
    document.addEventListener('click', startMusic);
    document.addEventListener('touchstart', startMusic);
  }

  createPlayer() {
    const loader = new GLTFLoader();

    loader.load(
      "/models/Animation_Walking_withSkin.glb",
      (gltf) => {
        this.player = gltf.scene;
        this.player.position.set(0, 0, 0);

        // 모델 크기 조정 (필요시)
        this.player.scale.set(1, 1, 1);

        // 애니메이션 설정
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.player);
          this.walkAction = this.mixer.clipAction(gltf.animations[0]);
          this.walkAction.setLoop(THREE.LoopRepeat);
          console.log("애니메이션 로드 완료:", gltf.animations.length, "개");
        }

        this.scene.add(this.player);
        console.log("모델 로드 완료");
      },
      (progress) => {
        console.log(
          "모델 로딩 중:",
          Math.round((progress.loaded / progress.total) * 100) + "%"
        );
      },
      (error) => {
        console.error("모델 로딩 실패:", error);
        // 폴백: 기본 정육면체 생성
        this.createFallbackPlayer();
      }
    );
  }

  createFallbackPlayer() {
    console.log("폴백 모드: 기본 정육면체 생성");
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    this.player = new THREE.Mesh(geometry, material);
    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
  }

  updatePlayerMovement() {
    if (!this.player) return;

    let isMoving = false;
    let moveDirection = null;

    // 방향키 상태에 따라 플레이어 이동 (제한 없이 자유 이동)
    if (this.keys.ArrowUp) {
      this.player.position.z -= this.moveSpeed;
      isMoving = true;
      moveDirection = 'forward';
      // 캐릭터가 앞을 바라보도록 회전
      this.player.rotation.y = Math.PI;
    }
    if (this.keys.ArrowDown) {
      this.player.position.z += this.moveSpeed;
      isMoving = true;
      moveDirection = 'backward';
      // 캐릭터가 뒤를 바라보도록 회전
      this.player.rotation.y = 0;
    }
    if (this.keys.ArrowLeft) {
      this.player.position.x -= this.moveSpeed;
      isMoving = true;
      moveDirection = 'left';
      // 캐릭터가 왼쪽을 바라보도록 회전
      this.player.rotation.y = -Math.PI / 2;
    }
    if (this.keys.ArrowRight) {
      this.player.position.x += this.moveSpeed;
      isMoving = true;
      moveDirection = 'right';
      // 캐릭터가 오른쪽을 바라보도록 회전
      this.player.rotation.y = Math.PI / 2;
    }

    // 이동시 액션 기록 및 점수 계산
    if (isMoving && this.gameState) {
      this.gameState.recordAction(FlutterBridge.PLAYER_ACTIONS.MOVE, {
        direction: moveDirection,
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z
        }
      });

      this.updateScore();
    }

    // 다리 위에 있는지 체크 (물리 기반)
    this.checkBridgeCollision();

    // 애니메이션 제어
    this.updateAnimation(isMoving);
  }

  checkBridgeCollision() {
    if (!this.player) return;

    // 다리 범위: X축 -1.5 ~ 1.5, Z축 -35 ~ 15 (다리 길이 고려)
    const playerX = this.player.position.x;
    const playerZ = this.player.position.z;
    const playerY = this.player.position.y;

    const onBridge = (
      playerX >= -this.bridgeWidth && 
      playerX <= this.bridgeWidth &&
      playerZ >= -35 && 
      playerZ <= 15 &&
      playerY <= 0.5 // 다리 위 또는 약간 위
    );

    // 다리 위에 있지 않고 아직 떨어지지 않았다면
    if (!onBridge && !this.isFalling && playerY <= 0.1) {
      this.startNaturalFalling();
    }
  }

  startNaturalFalling() {
    this.isFalling = true;
    console.log("플레이어가 다리에서 벗어났습니다 - 자연 추락 시작!");
    
    // 추락 액션 기록
    if (this.gameState) {
      this.gameState.recordAction(FlutterBridge.PLAYER_ACTIONS.FALL, {
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z
        },
        reason: 'bridge_collision'
      });

      // 게임 오버 상태로 변경
      this.gameState.changeState(FlutterBridge.GAME_STATUS.GAME_OVER);
    }
    
    // 비명 소리 재생
    if (this.screamSound) {
      this.screamSound.currentTime = 0; // 처음부터 재생
      this.screamSound.play().then(() => {
        console.log('비명 소리 재생 시작');
      }).catch((error) => {
        console.log('비명 소리 재생 실패:', error);
      });
    }
  }

  respawnPlayer() {
    if (!this.player) return;
    
    // 시작 위치로 리스폰
    this.player.position.set(0, 0, 0);
    this.player.rotation.set(0, 0, 0);
    this.isFalling = false;
    this.jumpVelocity = 0;
    
    // 게임 상태 리셋
    if (this.gameState) {
      this.gameState.changeState(FlutterBridge.GAME_STATUS.RESTART);
      this.startTime = Date.now(); // 시작 시간 재설정
      this.lastDistance = 0;
      this.maxDistance = 0;
    }
    
    console.log("플레이어가 리스폰되었습니다!");
  }

  updateAnimation(isMoving) {
    if (!this.walkAction) return;

    if (isMoving && !this.isJumping) {
      // 이동 중이고 점프하지 않을 때만 걷기 애니메이션 재생
      if (!this.walkAction.isRunning()) {
        this.walkAction.play();
      }
    } else {
      // 정지 중이거나 점프 중이면 애니메이션 정지
      if (this.walkAction.isRunning()) {
        this.walkAction.stop();
      }
    }
  }

  jump() {
    // 이미 점프 중이거나 공중에 있거나 추락 중이면 점프 불가
    if (this.isJumping || !this.player || this.isFalling) return;

    this.isJumping = true;
    this.jumpVelocity = this.jumpHeight;

    // 점프 액션 기록
    if (this.gameState) {
      this.gameState.recordAction(FlutterBridge.PLAYER_ACTIONS.JUMP, {
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z
        },
        velocity: this.jumpVelocity
      });
    }
  }

  updateJump() {
    if (!this.player) return;

    // 점프 중이거나 추락 중일 때 중력 적용
    if (this.isJumping || this.isFalling) {
      this.jumpVelocity += this.gravity;
      this.player.position.y += this.jumpVelocity;

      // 추락 중일 때는 회전 효과 추가
      if (this.isFalling) {
        this.player.rotation.x += 0.05;
        this.player.rotation.z += 0.03;
      }
    }

    // 다리 위에 착지했는지 확인
    if (this.player.position.y <= this.groundY) {
      const playerX = this.player.position.x;
      const playerZ = this.player.position.z;
      
      // 다리 범위 내에 착지한 경우
      if (playerX >= -this.bridgeWidth && 
          playerX <= this.bridgeWidth &&
          playerZ >= -35 && 
          playerZ <= 15) {
        
        // 완벽한 착지 판정 (중앙에 가까울수록 완벽)
        const centerDistance = Math.abs(playerX);
        const isPerfectLanding = centerDistance < this.bridgeWidth * 0.3; // 중앙 30% 영역
        
        this.player.position.y = this.groundY;
        this.player.rotation.x = 0; // 회전 복원
        this.player.rotation.z = 0; // 회전 복원
        
        const wasJumping = this.isJumping;
        this.isJumping = false;
        this.isFalling = false;
        this.jumpVelocity = 0;
        this.lastPerfectLanding = isPerfectLanding;

        // 착지 액션 기록
        if (wasJumping && this.gameState) {
          this.gameState.recordAction(FlutterBridge.PLAYER_ACTIONS.LAND, {
            position: {
              x: this.player.position.x,
              y: this.player.position.y,
              z: this.player.position.z
            },
            perfect: isPerfectLanding,
            centerDistance: centerDistance
          });

          // 완벽한 착지시 보너스 점수
          if (isPerfectLanding) {
            this.gameState.updateScore(50); // 보너스 점수
          }
        }
      }
    }

    // 너무 깊이 떨어지면 리스폰
    if (this.player.position.y < -20) {
      this.respawnPlayer();
    }
  }

  setupEventListeners() {
    // 키보드 입력 감지
    window.addEventListener("keydown", (event) => {
      if (this.keys.hasOwnProperty(event.code)) {
        event.preventDefault();
        this.keys[event.code] = true;
      }

      // 스페이스바 점프
      if (event.code === "Space") {
        event.preventDefault();
        this.jump();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (this.keys.hasOwnProperty(event.code)) {
        event.preventDefault();
        this.keys[event.code] = false;
      }
    });

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    // 애니메이션 믹서 업데이트
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // 플레이어 이동 업데이트
    this.updatePlayerMovement();

    // 점프 업데이트
    this.updateJump();

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 터치 컨트롤 이벤트 설정
   */
  setupTouchControlEvents() {
    if (!this.touchControls) return;

    // 터치 컨트롤 활성화
    this.touchControls.enable();

    // 점프 이벤트
    this.touchControls.on('jump', (data) => {
      this.jump();
    });

    // 스와이프 이벤트
    this.touchControls.on('swipeUp', (data) => {
      this.keys.ArrowUp = true;
      setTimeout(() => { this.keys.ArrowUp = false; }, 100);
    });

    this.touchControls.on('swipeDown', (data) => {
      this.keys.ArrowDown = true;
      setTimeout(() => { this.keys.ArrowDown = false; }, 100);
    });

    this.touchControls.on('swipeLeft', (data) => {
      this.keys.ArrowLeft = true;
      setTimeout(() => { this.keys.ArrowLeft = false; }, 100);
    });

    this.touchControls.on('swipeRight', (data) => {
      this.keys.ArrowRight = true;
      setTimeout(() => { this.keys.ArrowRight = false; }, 100);
    });

    // 더블탭 이벤트 (특수 액션)
    this.touchControls.on('doubleTap', (data) => {
      if (this.gameState) {
        this.gameState.changeState(FlutterBridge.GAME_STATUS.PAUSED);
      }
    });

    // 롱프레스 이벤트 (설정 등)
    this.touchControls.on('longPress', (data) => {
      // 향후 설정 메뉴 열기 등에 활용
      console.log('Long press detected');
    });
  }

  /**
   * 게임 상태 이벤트 설정
   */
  setupGameStateEvents() {
    if (!this.gameState) return;

    // 상태 변경 이벤트
    this.gameState.on('stateChanged', (data) => {
      console.log(`게임 상태 변경: ${data.previousState} → ${data.newState}`);
      
      switch (data.newState) {
        case FlutterBridge.GAME_STATUS.PLAYING:
          this.startGame();
          break;
        case FlutterBridge.GAME_STATUS.PAUSED:
          this.pauseGame();
          break;
        case FlutterBridge.GAME_STATUS.GAME_OVER:
          this.endGame();
          break;
        case FlutterBridge.GAME_STATUS.RESTART:
          this.restartGame();
          break;
      }
    });

    // 업적 해제 이벤트
    this.gameState.on('achievementUnlocked', (data) => {
      console.log(`업적 해제: ${data.achievementId}`);
      // 향후 UI 알림 표시
    });

    // 설정 변경 이벤트
    this.gameState.on('settingsChanged', (settings) => {
      this.applySettings(settings);
    });
  }

  /**
   * 점수 업데이트
   */
  updateScore() {
    if (!this.player || !this.gameState) return;

    // 거리 기반 점수 계산
    const currentDistance = Math.abs(this.player.position.z);
    
    if (currentDistance > this.lastDistance) {
      const distanceGained = currentDistance - this.lastDistance;
      const points = Math.floor(distanceGained * this.distanceMultiplier);
      
      if (points > 0) {
        this.gameState.updateScore(points);
        this.lastDistance = currentDistance;
      }
    }

    // 최대 거리 업데이트
    if (currentDistance > this.maxDistance) {
      this.maxDistance = currentDistance;
      this.gameState.updateDistance(this.maxDistance);
    }
  }

  /**
   * 게임 시작
   */
  startGame() {
    this.startTime = Date.now();
    this.lastDistance = 0;
    this.maxDistance = 0;
    
    if (this.touchControls) {
      this.touchControls.enable();
    }
  }

  /**
   * 게임 일시정지
   */
  pauseGame() {
    if (this.touchControls) {
      this.touchControls.disable();
    }
    
    // 배경음악 일시정지
    if (this.bgMusic && !this.bgMusic.paused) {
      this.bgMusic.pause();
    }
  }

  /**
   * 게임 종료
   */
  endGame() {
    if (this.touchControls) {
      this.touchControls.disable();
    }
    
    // 배경음악 정지
    if (this.bgMusic && !this.bgMusic.paused) {
      this.bgMusic.pause();
    }
  }

  /**
   * 게임 재시작
   */
  restartGame() {
    this.respawnPlayer();
    this.gameState.changeState(FlutterBridge.GAME_STATUS.PLAYING);
  }

  /**
   * 설정 적용
   * @param {Object} settings 
   */
  applySettings(settings) {
    // 음량 설정
    if (this.bgMusic) {
      this.bgMusic.volume = settings.musicVolume || 0.3;
    }
    if (this.screamSound) {
      this.screamSound.volume = settings.sfxVolume || 0.7;
    }

    // 터치 컨트롤 설정
    if (this.touchControls) {
      this.touchControls.updateConfig({
        sensitivity: settings.touchSensitivity || 1.0,
        vibrationEnabled: settings.vibration !== false
      });
    }

    // 그래픽 설정 (향후 구현)
    if (settings.graphics) {
      this.applyGraphicsSettings(settings.graphics);
    }
  }

  /**
   * 그래픽 설정 적용
   * @param {string} quality 
   */
  applyGraphicsSettings(quality) {
    switch (quality) {
      case 'low':
        this.renderer.shadowMap.enabled = false;
        break;
      case 'medium':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        break;
      case 'high':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
    }
  }

  /**
   * 모바일 최적화 적용
   */
  applyMobileOptimizations() {
    const device = this.deviceInfo.device;
    
    // 성능 모드 설정
    if (device.performanceClass === 'low') {
      this.performanceMode = 'low';
    } else if (device.performanceClass === 'high') {
      this.performanceMode = 'high';
    } else {
      this.performanceMode = 'medium';
    }
    
    // 모바일별 이동 속도 조정
    if (device.isMobile) {
      this.moveSpeed = 0.08; // 모바일에서 약간 느리게
    }
    
    // 배터리 절약 모드
    if (mobileDetection.isLowPowerMode()) {
      this.performanceMode = 'low';
      this.adaptiveQuality = true;
    }
    
    // 네트워크 기반 최적화
    const networkInfo = mobileDetection.getNetworkInfo();
    if (networkInfo.effectiveType === '2g' || networkInfo.saveData) {
      this.performanceMode = 'low';
    }
  }

  /**
   * 반응형 카메라 설정
   */
  setupResponsiveCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    
    // 화면 비율에 따른 카메라 위치 조정
    if (aspect < 1) {
      // 세로 모드 (모바일)
      this.camera.position.set(0, 10, 18);
      this.camera.fov = 80;
    } else if (aspect < 1.5) {
      // 태블릿
      this.camera.position.set(0, 9, 16);
      this.camera.fov = 75;
    } else {
      // 데스크톱/와이드스크린
      this.camera.position.set(0, 8, 15);
      this.camera.fov = 75;
    }
    
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * 성능 최적화된 렌더러 설정
   */
  setupOptimizedRenderer(canvas) {
    const rendererOptions = {
      canvas: canvas,
      antialias: this.performanceMode !== 'low',
      alpha: false,
      powerPreference: this.deviceInfo.device.isMobile ? 'low-power' : 'high-performance'
    };
    
    this.renderer = new THREE.WebGLRenderer(rendererOptions);
    
    // 성능 모드별 설정
    switch (this.performanceMode) {
      case 'low':
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
        this.renderer.shadowMap.enabled = false;
        break;
      case 'medium':
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        break;
      case 'high':
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
    }
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 모바일에서 추가 최적화
    if (this.deviceInfo.device.isMobile) {
      this.renderer.outputColorSpace = THREE.sRGBColorSpace;
      this.renderer.physicallyCorrectLights = false;
    }
  }

  /**
   * 분석 이벤트 설정
   */
  setupAnalyticsEvents() {
    if (!this.analytics) return;

    // 플레이어 액션 추적
    const originalRecordAction = this.gameState.recordAction.bind(this.gameState);
    this.gameState.recordAction = (action, data) => {
      originalRecordAction(action, data);
      this.analytics.trackPlayerAction(action, data);
    };

    // 성능 메트릭 수집
    setInterval(() => {
      if (this.renderer && this.renderer.info) {
        this.analytics.trackPerformance({
          geometries: this.renderer.info.memory.geometries,
          textures: this.renderer.info.memory.textures,
          calls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          frameTime: this.clock.getDelta() * 1000
        });
      }
    }, 5000);

    // 게임 이벤트 추적
    this.analytics.trackGameEvent('game_started', {
      deviceInfo: this.deviceInfo,
      performanceMode: this.performanceMode
    });
  }

  /**
   * 설정 이벤트 설정
   */
  setupSettingsEvents() {
    if (!this.settings) return;

    // 설정 변경 이벤트
    this.settings.on('settingChanged', (change) => {
      this.applySettingChange(change.path, change.newValue);
      
      if (this.analytics) {
        this.analytics.trackEvent('setting_changed', change);
      }
    });

    // 초기 설정 적용
    this.applyAllSettings();
  }

  /**
   * 개별 설정 변경 적용
   */
  applySettingChange(path, value) {
    switch (path) {
      case 'audio.musicVolume':
        if (this.bgMusic) {
          this.bgMusic.volume = value;
        }
        break;
      case 'audio.sfxVolume':
        if (this.screamSound) {
          this.screamSound.volume = value;
        }
        break;
      case 'graphics.quality':
        this.updateGraphicsQuality(value);
        break;
      case 'controls.touchSensitivity':
        if (this.touchControls) {
          this.touchControls.updateConfig({ sensitivity: value });
        }
        break;
      case 'performance.adaptiveQuality':
        this.adaptiveQuality = value;
        if (value) {
          this.monitorPerformanceAndAdjust();
        }
        break;
    }
  }

  /**
   * 모든 설정 적용
   */
  applyAllSettings() {
    const settings = this.settings.getAllSettings();
    
    // 오디오 설정
    if (this.bgMusic) {
      this.bgMusic.volume = settings.audio.musicVolume;
    }
    if (this.screamSound) {
      this.screamSound.volume = settings.audio.sfxVolume;
    }
    
    // 그래픽 설정
    this.updateGraphicsQuality(settings.graphics.quality);
    
    // 터치 컨트롤 설정
    if (this.touchControls) {
      this.touchControls.updateConfig({
        sensitivity: settings.controls.touchSensitivity,
        vibrationEnabled: settings.controls.vibration
      });
    }
    
    // 성능 설정
    this.adaptiveQuality = settings.performance.adaptiveQuality;
  }

  /**
   * 그래픽 품질 업데이트
   */
  updateGraphicsQuality(quality) {
    if (!this.renderer) return;
    
    switch (quality) {
      case 'low':
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
        this.scene.fog.far = 50;
        break;
      case 'medium':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.scene.fog.far = 80;
        break;
      case 'high':
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.scene.fog.far = 100;
        break;
    }
  }

  /**
   * 성능 모니터링 및 자동 조정
   */
  monitorPerformanceAndAdjust() {
    let frameCount = 0;
    let totalFrameTime = 0;
    const monitorInterval = 2000; // 2초마다 체크
    
    const monitor = () => {
      if (!this.adaptiveQuality) return;
      
      frameCount++;
      totalFrameTime += this.clock.getDelta() * 1000;
      
      if (frameCount >= 60) { // 60프레임 샘플
        const avgFrameTime = totalFrameTime / frameCount;
        const fps = 1000 / avgFrameTime;
        
        // FPS가 30 미만이면 품질 낮춤
        if (fps < 30 && this.performanceMode !== 'low') {
          this.performanceMode = 'low';
          this.updateGraphicsQuality('low');
          
          if (this.analytics) {
            this.analytics.trackEvent('performance_downgrade', { 
              fps, 
              avgFrameTime,
              newMode: this.performanceMode 
            });
          }
        }
        // FPS가 55 이상이면 품질 높임
        else if (fps > 55 && this.performanceMode === 'low') {
          this.performanceMode = 'medium';
          this.updateGraphicsQuality('medium');
          
          if (this.analytics) {
            this.analytics.trackEvent('performance_upgrade', { 
              fps, 
              avgFrameTime,
              newMode: this.performanceMode 
            });
          }
        }
        
        frameCount = 0;
        totalFrameTime = 0;
      }
      
      setTimeout(monitor, monitorInterval);
    };
    
    monitor();
  }

  /**
   * 게임 정리
   */
  destroy() {
    if (this.touchControls) {
      this.touchControls.destroy();
    }
    
    if (this.gameState) {
      this.gameState.saveToStorage();
    }
    
    if (this.analytics) {
      this.analytics.destroy();
    }
    
    if (this.settings) {
      this.settings.destroy();
    }
    
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic = null;
    }
    
    if (this.screamSound) {
      this.screamSound.pause();
      this.screamSound = null;
    }
  }
}

export default FreeMovementGame;
