import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FlutterBridge } from "../flutter/FlutterBridge.js";

class FreeMovementGame {
  constructor(isFlutterEnvironment = false) {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.mixer = null;
    this.walkAction = null;
    this.clock = new THREE.Clock();
    
    // 입력 상태
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
    this.bridgeWidth = 1.5;
    this.isFalling = false;

    // 배경음악
    this.bgMusic = null;
    this.screamSound = null;

    // 조이스틱 관련 (적응형 최대 거리)
    this.joystick = {
      active: false,
      centerX: 0,
      centerY: 0,
      currentX: 0,
      currentY: 0,
      get maxDistance() {
        // 화면 크기에 비례한 최대 거리 (조이스틱 베이스 크기의 40%)
        return Math.min(window.innerWidth, window.innerHeight) * 0.06;
      }
    };

    // 모바일 감지
    this.isMobile = this.detectMobile();

    // Flutter 통신 관련
    this.isFlutterEnvironment = isFlutterEnvironment;
    this.gameStats = {
      score: 0,
      bestDistance: 0,
      jumps: 0,
      falls: 0,
      playTime: 0,
      isPlaying: true
    };
    this.gameStartTime = Date.now();
    
    // 점수 계산 관련 변수
    this.scoreData = {
      startPosition: 0, // 게임 시작 지점
      maxDistance: 0,   // 최대 도달한 거리
      lastScoreUpdate: 0, // 마지막 점수 업데이트 시간
      scoreMultiplier: 10 // 거리 1당 10점
    };

    // 성능 모니터링 변수
    this.performanceMonitor = {
      lastTime: performance.now(),
      frameCount: 0,
      fps: 60,
      enabled: false
    };

    this.init();
    this.setupEventListeners();
    this.setupPerformanceMonitor();
    this.setupLoadingProgressUI();
    this.setupGameOverUI();
    this.animate();
  }

  init() {
    const canvas = document.getElementById("gameCanvas");
    
    try {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0a0a0a);

      // 카메라 설정
      this.setupCamera();

      // 렌더러 설정
      this.setupRenderer(canvas);

      this.setupLighting();
      this.createEnvironment();
      this.setupBackgroundMusic();
      this.createPlayer();

      console.log("게임 초기화 완료");
    } catch (error) {
      console.error("게임 초기화 실패:", error);
      this.createFallbackGame(canvas);
    }
  }

  // MDN 권장 방식의 모바일 감지 (main.js와 동일한 로직)
  detectMobile() {
    // 1차: 터치 이벤트 지원 확인
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 2차: 미디어 쿼리 기반 감지
    const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    
    // 3차: UserAgent 보조 확인
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 4차: 화면 방향 변경 이벤트 지원
    const hasOrientationChange = 'orientation' in window;
    
    // 5차: body 클래스 확인 (main.js에서 설정)
    const bodyClassCheck = document.body.classList.contains('mobile-device');
    
    // 결합 로직
    const result = hasTouch && (isSmallScreen || isTouchDevice || userAgentMobile || hasOrientationChange || bodyClassCheck);
    
    console.log('게임 내 모바일 감지 결과:', {
      hasTouch,
      isSmallScreen,
      isTouchDevice,
      userAgentMobile,
      hasOrientationChange,
      bodyClassCheck,
      result
    });
    
    return result;
  }

  // 카메라 설정
  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    
    if (aspect < 1) {
      // 모바일 세로 모드
      this.camera.position.set(0, 10, 18);
      this.camera.fov = 80;
    } else {
      // 데스크톱 또는 가로 모드
      this.camera.position.set(0, 8, 15);
      this.camera.fov = 75;
    }
    
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  // 렌더러 설정 (모바일 최적화)
  setupRenderer(canvas) {
    // 모바일 렌더링 옵션 최적화
    const rendererOptions = {
      canvas: canvas,
      alpha: false,
      premultipliedAlpha: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance'
    };

    // 안티앨리어싱 설정
    if (this.isMobile) {
      // 모바일에서는 FXAA로 대체 (성능 향상)
      rendererOptions.antialias = false;
    } else {
      rendererOptions.antialias = true;
    }

    this.renderer = new THREE.WebGLRenderer(rendererOptions);
    
    // 모바일 최적화된 픽셀 비율
    const pixelRatio = this.isMobile 
      ? Math.min(window.devicePixelRatio, 1.5) 
      : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 그림자 설정 (모바일 최적화)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isMobile 
      ? THREE.BasicShadowMap 
      : THREE.PCFSoftShadowMap;
    
    // 모바일 성능 최적화 설정
    if (this.isMobile) {
      this.renderer.shadowMap.autoUpdate = false; // 그림자 자동 업데이트 비활성화
      this.renderer.info.autoReset = false; // 렌더링 정보 자동 리셋 비활성화
    }
    
    // 렌더러 추가 최적화
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  // Fallback 게임 생성
  createFallbackGame(canvas) {
    console.log("Fallback 모드로 실행");
    // 기본 2D 캔버스로 간단한 게임 구현 가능
  }

  setupLighting() {
    // 어두운 환경광
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4); // 약간 밝게 (그림자 품질 보상)
    this.scene.add(ambientLight);

    // 위에서 아래로 비추는 극적인 조명 (모바일 최적화)
    const directionalLight = new THREE.DirectionalLight(0xffffcc, this.isMobile ? 1.0 : 1.2);
    directionalLight.position.set(0, 20, 0);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    
    // 모바일 최적화된 그림자 맵 크기
    const shadowMapSize = this.isMobile ? 1024 : 2048;
    directionalLight.shadow.mapSize.width = shadowMapSize;
    directionalLight.shadow.mapSize.height = shadowMapSize;
    
    // 그림자 카메라 설정
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = this.isMobile ? 30 : 50; // 모바일에서 범위 축소
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    
    // 모바일에서 그림자 품질 조정
    if (this.isMobile) {
      directionalLight.shadow.radius = 2;
      directionalLight.shadow.blurSamples = 4;
    }
    
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
    
    // 성능 모니터링을 위해 라이트 참조 저장
    this.directionalLight = directionalLight;
  }

  createEnvironment() {
    // 세로 방향 좁은 다리 생성 (모바일 최적화)
    const bridgeGeometry = new THREE.PlaneGeometry(3, 50);
    
    // 모바일에서는 Lambert 대신 Basic 머티리얼 사용 (성능 향상)
    const bridgeMaterial = this.isMobile 
      ? new THREE.MeshBasicMaterial({ 
          color: 0x8B4513,
          transparent: false,
          fog: true
        })
      : new THREE.MeshLambertMaterial({ 
          color: 0x8B4513
        });
    
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
    bridge.rotation.x = -Math.PI / 2;
    bridge.position.set(0, -0.1, -10);
    bridge.receiveShadow = !this.isMobile; // 모바일에서는 그림자 수신 비활성화
    this.scene.add(bridge);

    // 안개 효과 (모바일 최적화)
    const fogNear = this.isMobile ? 15 : 20;
    const fogFar = this.isMobile ? 80 : 100;
    this.scene.fog = new THREE.Fog(0x0a0a0a, fogNear, fogFar);
    
    // 성능 참조 저장
    this.bridge = bridge;
  }

  setupBackgroundMusic() {
    try {
      // 오디오 컨텍스트 초기화 (모바일 호환성)
      this.initAudioContext();
      
      // HTML5 Audio 요소 생성
      this.bgMusic = new Audio('/music/bgm.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.3;
      this.bgMusic.preload = 'metadata';
      
      // 모바일 최적화 속성
      if (this.isMobile) {
        this.bgMusic.muted = false;
        this.bgMusic.playsInline = true;
        this.bgMusic.controls = false;
        // iOS에서 중요한 속성
        this.bgMusic.setAttribute('webkit-playsinline', 'true');
        this.bgMusic.setAttribute('playsinline', 'true');
      }

      // 비명 소리 설정
      this.screamSound = new Audio('/music/scream.mp3');
      this.screamSound.volume = 0.7;
      this.screamSound.preload = 'metadata';
      
      if (this.isMobile) {
        this.screamSound.playsInline = true;
        this.screamSound.setAttribute('webkit-playsinline', 'true');
        this.screamSound.setAttribute('playsinline', 'true');
      }

      // 점프 웃음 소리 설정
      this.laughSound = new Audio('/music/laugh.mp3');
      this.laughSound.volume = 0.5;
      this.laughSound.preload = 'metadata';
      
      if (this.isMobile) {
        this.laughSound.playsInline = true;
        this.laughSound.setAttribute('webkit-playsinline', 'true');
        this.laughSound.setAttribute('playsinline', 'true');
      }

      // 오디오 이벤트 리스너
      this.bgMusic.addEventListener('canplaythrough', () => {
        console.log('배경음악 로딩 완료');
      });

      this.bgMusic.addEventListener('loadeddata', () => {
        console.log('배경음악 데이터 로딩 완료');
      });

      this.bgMusic.addEventListener('error', (e) => {
        console.error('배경음악 로딩 오류:', e);
        this.handleAudioError();
      });

      // 웃음 소리 이벤트 리스너
      this.laughSound.addEventListener('canplaythrough', () => {
        console.log('웃음 소리 로딩 완료');
      });

      this.laughSound.addEventListener('error', (e) => {
        console.error('웃음 소리 로딩 오류:', e);
      });

      // iOS에서 중단된 오디오 재시작
      this.bgMusic.addEventListener('pause', () => {
        if (!this.bgMusic.ended && this.isMobile) {
          console.log('음악이 일시정지됨, 재시도...');
          setTimeout(() => {
            if (this.bgMusic.paused) {
              this.bgMusic.play().catch(e => console.log('재시작 실패:', e));
            }
          }, 100);
        }
      });

      // 첫 번째 사용자 상호작용 후 재생 시작
      this.startMusicOnInteraction();
    } catch (error) {
      console.error('음악 설정 실패:', error);
      this.handleAudioError();
    }
  }

  // 오디오 컨텍스트 초기화 (Web Audio API)
  initAudioContext() {
    try {
      // 오디오 컨텍스트 생성 (모바일 브라우저 호환성)
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      if (window.AudioContext) {
        this.audioContext = new AudioContext();
        console.log('오디오 컨텍스트 생성됨');
      }
    } catch (error) {
      console.log('오디오 컨텍스트 생성 실패:', error);
    }
  }

  // 오디오 오류 처리
  handleAudioError() {
    const musicHint = document.getElementById('music-hint');
    if (musicHint) {
      musicHint.innerHTML = '<span>🔇 배경음악을 불러올 수 없습니다</span>';
      setTimeout(() => {
        if (musicHint) musicHint.style.display = 'none';
      }, 3000);
    }
  }

  startMusicOnInteraction() {
    let musicStarted = false;
    
    const startMusic = async (eventType) => {
      if (musicStarted) return;
      
      console.log(`음악 시작 시도 (${eventType})`);
      
      try {
        // 오디오 컨텍스트가 suspended 상태라면 resume
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log('오디오 컨텍스트 재시작됨');
        }
        
        if (this.bgMusic && this.bgMusic.paused) {
          // 모바일에서 확실한 재생을 위해 볼륨 확인
          if (this.bgMusic.volume === 0) {
            this.bgMusic.volume = 0.3;
          }
          
          // iOS에서 먼저 load 시도
          if (this.isMobile && this.bgMusic.readyState < 2) {
            this.bgMusic.load();
            await new Promise(resolve => {
              this.bgMusic.addEventListener('canplay', resolve, { once: true });
              setTimeout(resolve, 1000); // 타임아웃
            });
          }
          
          await this.bgMusic.play();
          musicStarted = true;
          console.log('배경음악 재생 성공');
          
          // 음악 힌트 숨기기
          const musicHint = document.getElementById('music-hint');
          if (musicHint) {
            musicHint.style.display = 'none';
          }
          
          // 성공시 이벤트 리스너 제거
          this.removeAudioEventListeners();
        }
      } catch (error) {
        console.error(`음악 재생 실패 (${eventType}):`, error);
        
        // 재시도 로직
        if (!musicStarted && error.name === 'NotAllowedError') {
          const musicHint = document.getElementById('music-hint');
          if (musicHint) {
            musicHint.innerHTML = '<span>🎵 화면을 한 번 더 터치하면 음악이 재생됩니다</span>';
            musicHint.style.display = 'block';
          }
          
          // 3초 후 다시 시도
          setTimeout(() => {
            if (!musicStarted && this.bgMusic) {
              this.bgMusic.play().then(() => {
                musicStarted = true;
                console.log('배경음악 재시도 성공');
                if (musicHint) musicHint.style.display = 'none';
                this.removeAudioEventListeners();
              }).catch(e => console.log('재시도 실패:', e));
            }
          }, 3000);
        }
      }
    };

    // 이벤트 리스너 제거 함수
    this.removeAudioEventListeners = () => {
      document.removeEventListener('keydown', this.keydownHandler);
      document.removeEventListener('click', this.clickHandler);
      document.removeEventListener('touchstart', this.touchstartHandler);
      document.removeEventListener('touchend', this.touchendHandler);
      
      // 조이스틱 이벤트에도 음악 시작 추가
      const joystickBase = document.getElementById('joystick-base');
      const jumpButton = document.getElementById('jump-button');
      if (joystickBase) {
        joystickBase.removeEventListener('touchstart', this.joystickMusicHandler);
      }
      if (jumpButton) {
        jumpButton.removeEventListener('touchstart', this.jumpMusicHandler);
      }
    };

    // 이벤트 핸들러 함수들
    this.keydownHandler = () => startMusic('keydown');
    this.clickHandler = () => startMusic('click');
    this.touchstartHandler = () => startMusic('touchstart');
    this.touchendHandler = () => startMusic('touchend');
    this.joystickMusicHandler = () => startMusic('joystick');
    this.jumpMusicHandler = () => startMusic('jump');

    // 모든 상호작용 이벤트에 리스너 추가
    document.addEventListener('keydown', this.keydownHandler, { once: false });
    document.addEventListener('click', this.clickHandler, { once: false });
    document.addEventListener('touchstart', this.touchstartHandler, { once: false });
    document.addEventListener('touchend', this.touchendHandler, { once: false });
    
    // 조이스틱과 점프 버튼에도 음악 시작 이벤트 추가
    setTimeout(() => {
      const joystickBase = document.getElementById('joystick-base');
      const jumpButton = document.getElementById('jump-button');
      if (joystickBase) {
        joystickBase.addEventListener('touchstart', this.joystickMusicHandler, { once: false });
      }
      if (jumpButton) {
        jumpButton.addEventListener('touchstart', this.jumpMusicHandler, { once: false });
      }
    }, 500);
  }

  createPlayer() {
    const loader = new GLTFLoader();
    
    // 모델 로딩 타임아웃 설정 (15초)
    const loadingTimeout = setTimeout(() => {
      console.warn("모델 로딩 타임아웃 - 폴백 모델 사용");
      this.createFallbackPlayer();
    }, 15000);

    // 우선 폴백 플레이어를 빠르게 생성하여 게임 플레이 가능하게 함
    this.createFallbackPlayer();
    
    // 백그라운드에서 실제 모델 로딩 시도 (성공하면 교체)
    loader.load(
      "/models/Animation_Walking_withSkin.glb",
      (gltf) => {
        clearTimeout(loadingTimeout);
        
        // 기존 폴백 모델 제거
        if (this.player) {
          this.scene.remove(this.player);
        }
        
        this.player = gltf.scene;
        this.player.position.set(0, 0, 0);
        this.player.scale.set(1, 1, 1);

        // 애니메이션 설정
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.player);
          this.walkAction = this.mixer.clipAction(gltf.animations[0]);
          this.walkAction.setLoop(THREE.LoopRepeat);
          console.log("✅ 고품질 모델 로드 완료 - 애니메이션:", gltf.animations.length, "개");
        }

        this.scene.add(this.player);
        console.log("🎭 실제 모델로 교체 완료");
        
        // 로딩 UI 숨기기
        this.hideLoadingProgress();
      },
      (progress) => {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        console.log(`📦 모델 로딩 중: ${percentage}% (${Math.round(progress.loaded/1024/1024*100)/100}MB/${Math.round(progress.total/1024/1024*100)/100}MB)`);
        
        // 20% 이상 로딩되면 사용자에게 진행 상황 알림
        if (percentage >= 20) {
          this.showLoadingProgress(percentage, progress.loaded, progress.total);
        }
      },
      (error) => {
        clearTimeout(loadingTimeout);
        console.error("❌ 모델 로딩 실패:", error);
        console.log("🎲 폴백 모델로 게임 계속 진행");
        
        // 폴백 모델이 없다면 생성
        if (!this.player) {
          this.createFallbackPlayer();
        }
        
        // 로딩 UI 숨기기
        this.hideLoadingProgress();
      }
    );
  }

  createFallbackPlayer() {
    console.log("🎲 폴백 모드: 기본 캐릭터 생성");
    
    // 기존 플레이어가 있다면 제거
    if (this.player) {
      this.scene.remove(this.player);
    }
    
    // 더 캐릭터 같은 모양으로 개선된 폴백 모델
    const playerGroup = new THREE.Group();
    
    // 몸통 (직사각형)
    const bodyGeometry = new THREE.BoxGeometry(0.6, 1.2, 0.4);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    playerGroup.add(body);
    
    // 머리 (구)
    const headGeometry = new THREE.SphereGeometry(0.35, 8, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    playerGroup.add(head);
    
    // 다리 (2개)
    const legGeometry = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, -0.4, 0);
    playerGroup.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, -0.4, 0);
    playerGroup.add(rightLeg);
    
    // 팔 (2개)
    const armGeometry = new THREE.BoxGeometry(0.15, 0.8, 0.15);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.45, 0.4, 0);
    playerGroup.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.45, 0.4, 0);
    playerGroup.add(rightArm);
    
    // 그림자 활성화
    playerGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    this.player = playerGroup;
    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
    
    console.log("✨ 개선된 폴백 캐릭터 생성 완료");
  }

  updatePlayerMovement() {
    if (!this.player) return;

    let isMoving = false;
    let moveX = 0;
    let moveZ = 0;

    // 키 입력에 따른 방향 벡터 계산
    if (this.keys.ArrowUp) {
      moveZ -= 1;
      isMoving = true;
    }
    if (this.keys.ArrowDown) {
      moveZ += 1;
      isMoving = true;
    }
    if (this.keys.ArrowLeft) {
      moveX -= 1;
      isMoving = true;
    }
    if (this.keys.ArrowRight) {
      moveX += 1;
      isMoving = true;
    }

    // 벡터 정규화로 대각선 이동 속도 일정화
    if (isMoving) {
      const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (magnitude > 0) {
        moveX = (moveX / magnitude) * this.moveSpeed;
        moveZ = (moveZ / magnitude) * this.moveSpeed;
        
        // 실제 이동 적용
        this.player.position.x += moveX;
        this.player.position.z += moveZ;
        
        // 이동 방향에 따른 회전 (부드러운 회전)
        const targetRotation = Math.atan2(moveX, moveZ);
        this.player.rotation.y = targetRotation;
      }
    }

    // 점수 계산 (플레이어가 앞으로 이동할 때)
    this.updateScore();

    // 다리 위에 있는지 체크
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
    this.gameStats.isPlaying = false; // 점수 계산 중지
    this.gameStats.falls++; // 낙하 횟수 증가
    
    console.log("💀 플레이어가 다리에서 벗어났습니다!");
    
    // 비명 소리 재생
    if (this.screamSound) {
      this.screamSound.currentTime = 0;
      this.screamSound.play().catch(() => {
        console.log('비명 소리 재생 실패');
      });
    }
    
    // 최종 UI 업데이트
    this.updateGameStatsUI();
    
    // 최종 점수 전송 (게임 오버)
    this.sendFinalScoreToFlutter();
      
    // Flutter로 낙하 이벤트 전송
    this.sendGameEventToFlutter('fall');
    
    // 1초 후 게임 오버 화면 표시 (추락 애니메이션 시간 확보)
    setTimeout(() => {
      this.showGameOver();
    }, 1000);
  }

  respawnPlayer() {
    if (!this.player) return;
    
    // 시작 위치로 리스폰
    this.player.position.set(0, 0, 0);
    this.player.rotation.set(0, 0, 0);
    this.isFalling = false;
    this.jumpVelocity = 0;
    this.isJumping = false;
    
    // 점수 시스템 재시작
    this.gameStats.isPlaying = true;
    this.resetScore();
    
    // UI 초기화
    this.updateGameStatsUI();
    
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
    if (this.isJumping || !this.player || this.isFalling) return;

    this.isJumping = true;
    this.jumpVelocity = this.jumpHeight;
    this.gameStats.jumps++; // 점프 횟수 증가
    
    // UI 업데이트
    this.updateGameStatsUI();
    
    console.log("점프!");
    
    // Flutter로 점프 이벤트 전송
    this.sendGameEventToFlutter('jump');
    
    // 점프 웃음 소리 재생
    this.playLaughSound();
  }

  // 점프 웃음 소리 재생
  playLaughSound() {
    if (this.laughSound) {
      try {
        // 이전 재생을 중단하고 처음부터 재생
        this.laughSound.currentTime = 0;
        
        // 클론을 사용하여 동시 재생 지원 (빠른 연속 점프)
        const laughClone = this.laughSound.cloneNode();
        laughClone.volume = this.laughSound.volume;
        
        laughClone.play().then(() => {
          console.log('점프 웃음 소리 재생');
        }).catch((error) => {
          console.log('웃음 소리 재생 실패:', error);
          
          // 클론 재생이 실패하면 원본으로 시도
          this.laughSound.play().catch(e => {
            console.log('원본 웃음 소리도 재생 실패:', e);
          });
        });
      } catch (error) {
        console.error('웃음 소리 재생 오류:', error);
      }
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

    // 착지 확인
    if (this.player.position.y <= this.groundY) {
      const playerX = this.player.position.x;
      const playerZ = this.player.position.z;
      
      // 다리 범위 내에 착지한 경우
      if (playerX >= -this.bridgeWidth && 
          playerX <= this.bridgeWidth &&
          playerZ >= -35 && 
          playerZ <= 15) {
        
        this.player.position.y = this.groundY;
        this.player.rotation.x = 0;
        this.player.rotation.z = 0;
        this.isJumping = false;
        this.isFalling = false;
        this.jumpVelocity = 0;
      }
    }

    // 너무 깊이 떨어지면 리스폰
    if (this.player.position.y < -20) {
      this.respawnPlayer();
    }
  }

  setupEventListeners() {
    // 키보드 입력
    window.addEventListener("keydown", (event) => {
      if (this.keys.hasOwnProperty(event.code)) {
        event.preventDefault();
        this.keys[event.code] = true;
      }
      if (event.code === "Space") {
        event.preventDefault();
        this.jump();
      }
      
      // ESC 키로 게임 오버 화면 제어
      if (event.code === "Escape") {
        event.preventDefault();
        if (this.gameOverElements.overlay && this.gameOverElements.overlay.classList.contains('show')) {
          this.continueGame(); // ESC 키로 게임 계속하기
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      if (this.keys.hasOwnProperty(event.code)) {
        event.preventDefault();
        this.keys[event.code] = false;
      }
    });

    // 화면 크기 변경
    window.addEventListener("resize", () => {
      if (this.camera && this.renderer) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });

    // 조이스틱 이벤트 (모바일)
    if (this.isMobile) {
      this.setupJoystickEvents();
    }
  }

  // 로딩 진행률 UI 설정
  setupLoadingProgressUI() {
    this.loadingElements = {
      container: document.getElementById('model-loading'),
      progressFill: document.getElementById('progress-fill'),
      details: document.getElementById('loading-details')
    };
  }

  // 로딩 진행상황 표시
  showLoadingProgress(percentage, loaded, total) {
    if (!this.loadingElements.container) return;

    // 로딩 UI 표시
    this.loadingElements.container.style.display = 'block';
    
    // 진행률 바 업데이트
    if (this.loadingElements.progressFill) {
      this.loadingElements.progressFill.style.width = `${percentage}%`;
    }
    
    // 상세 정보 업데이트
    if (this.loadingElements.details) {
      const loadedMB = Math.round(loaded / 1024 / 1024 * 100) / 100;
      const totalMB = Math.round(total / 1024 / 1024 * 100) / 100;
      this.loadingElements.details.textContent = `${percentage}% (${loadedMB}MB/${totalMB}MB)`;
    }
  }

  // 로딩 UI 숨기기
  hideLoadingProgress() {
    if (this.loadingElements.container) {
      this.loadingElements.container.style.display = 'none';
    }
  }

  // 게임 오버 UI 설정
  setupGameOverUI() {
    this.gameOverElements = {
      overlay: document.getElementById('game-over'),
      finalScore: document.getElementById('final-score'),
      finalDistance: document.getElementById('final-distance'),
      finalJumps: document.getElementById('final-jumps'),
      finalTime: document.getElementById('final-time'),
      restartButton: document.getElementById('restart-button'),
      continueButton: document.getElementById('continue-button')
    };

    // 다시하기 버튼 이벤트
    if (this.gameOverElements.restartButton) {
      this.gameOverElements.restartButton.addEventListener('click', () => {
        this.restartFromGameOver();
      });
    }

    // 계속하기 버튼 이벤트 (현재 위치에서 다시 시작)
    if (this.gameOverElements.continueButton) {
      this.gameOverElements.continueButton.addEventListener('click', () => {
        this.continueGame();
      });
    }
  }

  // 게임 오버 화면 표시
  showGameOver() {
    if (!this.gameOverElements.overlay) return;

    // 최종 통계 업데이트
    this.updateFinalStats();

    // 게임 오버 화면 표시
    this.gameOverElements.overlay.classList.add('show');
    
    console.log("💀 게임 오버 화면 표시됨");
  }

  // 게임 오버 화면 숨기기
  hideGameOver() {
    if (this.gameOverElements.overlay) {
      this.gameOverElements.overlay.classList.remove('show');
    }
  }

  // 최종 통계 업데이트
  updateFinalStats() {
    const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);

    if (this.gameOverElements.finalScore) {
      this.gameOverElements.finalScore.textContent = `${this.gameStats.score}점`;
    }
    
    if (this.gameOverElements.finalDistance) {
      this.gameOverElements.finalDistance.textContent = `${this.scoreData.maxDistance.toFixed(1)}m`;
    }
    
    if (this.gameOverElements.finalJumps) {
      this.gameOverElements.finalJumps.textContent = `${this.gameStats.jumps}회`;
    }
    
    if (this.gameOverElements.finalTime) {
      this.gameOverElements.finalTime.textContent = `${playTime}초`;
    }
  }

  // 게임 완전 재시작 (새로 추가된 메서드)
  restartFromGameOver() {
    console.log("🔄 게임 오버에서 재시작");
    
    // 게임 오버 화면 숨기기
    this.hideGameOver();
    
    // 플레이어 위치 초기화
    if (this.player) {
      this.player.position.set(0, this.groundY, 0);
      this.player.rotation.set(0, 0, 0);
    }
    
    // 게임 상태 완전 초기화
    this.isFalling = false;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.gameStats.score = 0;
    this.gameStats.jumps = 0;
    this.gameStats.falls = 0;
    this.gameStats.isPlaying = true;
    this.gameStartTime = Date.now();
    
    // 점수 시스템 초기화
    this.resetScore();
    
    // UI 업데이트
    this.updateGameStatsUI();
    
    console.log("✨ 게임 재시작 완료");
  }

  // 현재 위치에서 계속하기
  continueGame() {
    console.log("▶️ 게임 계속하기");
    
    // 게임 오버 화면 숨기기
    this.hideGameOver();
    
    // 시작 위치로 리스폰 (기존 respawnPlayer와 동일)
    this.respawnPlayer();
    
    console.log("🎮 게임 계속하기 완료");
  }

  // 성능 모니터 설정
  setupPerformanceMonitor() {
    // 더블탭으로 성능 모니터 토글 (개발용)
    let tapCount = 0;
    let tapTimer = null;
    
    const handleDoubleTap = () => {
      tapCount++;
      
      if (tapCount === 1) {
        tapTimer = setTimeout(() => {
          tapCount = 0;
        }, 300);
      } else if (tapCount === 2) {
        clearTimeout(tapTimer);
        tapCount = 0;
        this.togglePerformanceMonitor();
      }
    };

    // 상단 좌측 코너 터치로 성능 모니터 토글
    const debugArea = document.getElementById('score');
    if (debugArea) {
      debugArea.addEventListener('click', handleDoubleTap);
      debugArea.style.pointerEvents = 'auto';
      debugArea.style.cursor = 'pointer';
    }

    // 키보드 단축키 (개발용)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        this.togglePerformanceMonitor();
      }
    });
  }

  // 성능 모니터 토글
  togglePerformanceMonitor() {
    const monitor = document.getElementById('performance-monitor');
    const debugInfo = document.getElementById('mobile-debug');
    if (!monitor) return;

    this.performanceMonitor.enabled = !this.performanceMonitor.enabled;
    
    if (this.performanceMonitor.enabled) {
      monitor.classList.remove('hidden');
      debugInfo?.classList.remove('hidden');
      console.log('성능 모니터 및 모바일 디버그 활성화');
    } else {
      monitor.classList.add('hidden');
      debugInfo?.classList.add('hidden');
      console.log('성능 모니터 및 모바일 디버그 비활성화');
    }
  }

  // 성능 정보 업데이트
  updatePerformanceMonitor() {
    if (!this.performanceMonitor.enabled) return;

    const currentTime = performance.now();
    this.performanceMonitor.frameCount++;

    // FPS 계산 (1초마다)
    if (currentTime - this.performanceMonitor.lastTime >= 1000) {
      this.performanceMonitor.fps = this.performanceMonitor.frameCount;
      this.performanceMonitor.frameCount = 0;
      this.performanceMonitor.lastTime = currentTime;

      // UI 업데이트
      this.updatePerformanceUI();
    }
  }

  // 성능 UI 업데이트
  updatePerformanceUI() {
    const fpsValue = document.getElementById('fps-value');
    const memoryValue = document.getElementById('memory-value');
    const renderInfo = document.getElementById('render-info');
    const mobileStatus = document.getElementById('mobile-status');

    if (fpsValue) {
      const fps = this.performanceMonitor.fps;
      fpsValue.textContent = fps;
      
      // FPS 색상 변경
      fpsValue.className = '';
      if (fps < 20) {
        fpsValue.classList.add('perf-critical');
      } else if (fps < 40) {
        fpsValue.classList.add('perf-warning');
      }
    }

    if (memoryValue) {
      const memory = this.checkMemoryUsage();
      if (memory) {
        memoryValue.textContent = memory.used;
        
        // 메모리 사용량에 따른 색상 변경
        const usedMB = parseInt(memory.used);
        memoryValue.className = '';
        if (usedMB > 100) {
          memoryValue.classList.add('perf-critical');
        } else if (usedMB > 50) {
          memoryValue.classList.add('perf-warning');
        }
      }
    }

    if (renderInfo && this.renderer) {
      const info = this.renderer.info;
      const triangles = info.render.triangles || 0;
      renderInfo.textContent = `${triangles}T`;
      
      // 렌더링 부하에 따른 색상 변경
      renderInfo.className = '';
      if (triangles > 10000) {
        renderInfo.classList.add('perf-critical');
      } else if (triangles > 5000) {
        renderInfo.classList.add('perf-warning');
      }
    }

    // 모바일 상태 표시
    if (mobileStatus) {
      mobileStatus.textContent = this.isMobile ? '✓' : '✗';
      mobileStatus.className = this.isMobile ? 'perf-value' : 'perf-critical';
    }
    
    // 모바일 디버그 정보 업데이트
    this.updateMobileDebugInfo();
  }

  // 모바일 디버그 정보 업데이트
  updateMobileDebugInfo() {
    const debugDetails = document.getElementById('debug-details');
    if (!debugDetails) return;

    // 현재 감지 상태 다시 확인
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasOrientationChange = 'orientation' in window;
    const bodyClassCheck = document.body.classList.contains('mobile-device');
    
    // 조이스틱 상태
    const joystickVisible = !document.getElementById('mobile-controls').classList.contains('hidden');
    const joystickActive = this.joystick ? this.joystick.active : false;

    debugDetails.innerHTML = `
      <div class="debug-item">
        <span class="debug-label">터치 지원:</span>
        <span class="debug-value ${hasTouch}">${hasTouch ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">작은 화면:</span>
        <span class="debug-value ${isSmallScreen}">${isSmallScreen ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">터치 기기:</span>
        <span class="debug-value ${isTouchDevice}">${isTouchDevice ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">UserAgent:</span>
        <span class="debug-value ${userAgentMobile}">${userAgentMobile ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">방향 변경:</span>
        <span class="debug-value ${hasOrientationChange}">${hasOrientationChange ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">CSS 클래스:</span>
        <span class="debug-value ${bodyClassCheck}">${bodyClassCheck ? '✓' : '✗'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">최종 결과:</span>
        <span class="debug-value ${this.isMobile}">${this.isMobile ? '모바일' : '데스크톱'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">조이스틱:</span>
        <span class="debug-value ${joystickVisible}">${joystickVisible ? '표시됨' : '숨김'}</span>
      </div>
      <div class="debug-item">
        <span class="debug-label">활성 상태:</span>
        <span class="debug-value ${joystickActive}">${joystickActive ? '활성' : '비활성'}</span>
      </div>
    `;
  }

  // 조이스틱 이벤트 설정 (최적화됨)
  setupJoystickEvents() {
    // DOM 요소가 로드될 때까지 기다림 (최대 5초)
    let attemptCount = 0;
    const maxAttempts = 50;
    
    const setupWhenReady = () => {
      attemptCount++;
      
      const joystickBase = document.getElementById('joystick-base');
      const joystickStick = document.getElementById('joystick-stick');
      const jumpButton = document.getElementById('jump-button');

      if (!joystickBase || !joystickStick || !jumpButton) {
        if (attemptCount < maxAttempts) {
          setTimeout(setupWhenReady, 100);
          return;
        } else {
          console.error('조이스틱 DOM 요소를 찾을 수 없습니다');
          return;
        }
      }

      console.log('조이스틱 이벤트 바인딩 시작');
      this.bindJoystickEvents(joystickBase, joystickStick, jumpButton);
    };

    setupWhenReady();
  }

  // 조이스틱 이벤트 바인딩 (웹 표준 베스트 프랙티스 적용)
  bindJoystickEvents(joystickBase, joystickStick, jumpButton) {
    // 조이스틱 터치 ID 추적 (MDN 권장 방식)
    this.joystickTouchId = null;
    this.activeTouch = null;

    // 조이스틱 터치 시작 (터치 식별자 추적 강화)
    const handleJoystickStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 이미 활성화된 조이스틱이 있으면 무시
      if (this.joystick.active) {
        return;
      }
      
      // 터치 이벤트에서 첫 번째 터치 선택
      const touch = e.touches ? e.touches[0] : e;
      const rect = joystickBase.getBoundingClientRect();
      
      // 터치 식별자 저장 (웹 표준 권장)
      this.joystickTouchId = touch.identifier !== undefined ? touch.identifier : 'mouse';
      this.activeTouch = touch;
      
      this.joystick.active = true;
      this.joystick.centerX = rect.left + rect.width / 2;
      this.joystick.centerY = rect.top + rect.height / 2;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;
      
      console.log('조이스틱 활성화 - 터치 ID:', this.joystickTouchId);
      
      this.updateJoystickPosition();
      this.updateMovementFromJoystick();
    };

    // 조이스틱 터치 이동 (터치 식별자 정확 추적)
    const handleJoystickMove = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      e.stopPropagation();
      
      // 정확한 터치 식별자로 해당 터치 찾기
      let targetTouch = null;
      if (e.touches && this.joystickTouchId !== 'mouse') {
        // 터치 이벤트에서 정확한 식별자로 매칭
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          if (touch.identifier === this.joystickTouchId) {
            targetTouch = touch;
            break;
          }
        }
        
        // 해당 터치가 없으면 무시 (다른 손가락의 터치)
        if (!targetTouch) {
          return;
        }
      } else {
        // 마우스 이벤트 또는 터치 식별자가 mouse인 경우
        targetTouch = e.touches ? e.touches[0] : e;
      }
      
      // 조이스틱 위치 업데이트
      this.joystick.currentX = targetTouch.clientX;
      this.joystick.currentY = targetTouch.clientY;
      
      this.updateJoystickPosition();
      this.updateMovementFromJoystick();
    };

    // 조이스틱 터치 종료 (터치 식별자 정확 추적)
    const handleJoystickEnd = (e) => {
      // 터치 종료시 정확한 식별자로 해당 터치 확인
      if (e.changedTouches && this.joystickTouchId !== 'mouse') {
        let isJoystickTouch = false;
        
        // 종료된 터치들 중에서 조이스틱 터치 찾기
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            isJoystickTouch = true;
            break;
          }
        }
        
        // 조이스틱 터치가 아니면 무시
        if (!isJoystickTouch) {
          return;
        }
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      console.log('조이스틱 비활성화 - 터치 ID:', this.joystickTouchId);
      
      // 조이스틱 상태 초기화
      this.joystick.active = false;
      this.joystickTouchId = null;
      this.activeTouch = null;
      
      // 조이스틱 시각적 중앙 복귀
      joystickStick.style.transform = 'translate(0px, 0px)';
      
      // 모든 이동 키 상태 초기화
      this.resetKeys();
    };

    // 점프 버튼
    const handleJump = (e) => {
      e.preventDefault();
      this.jump();
    };

    // 터치 이벤트 바인딩 (최적화됨)
    try {
      // 조이스틱 베이스에 터치 시작 이벤트
      joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
      
      // 전역 터치 이동/종료 이벤트 (단일 리스너로 통합)
      document.addEventListener('touchmove', handleJoystickMove, { passive: false });
      document.addEventListener('touchend', handleJoystickEnd, { passive: false });
      document.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
      
      // 점프 버튼
      jumpButton.addEventListener('touchstart', handleJump, { passive: false });
      jumpButton.addEventListener('click', handleJump);

      // 마우스 이벤트 (데스크톱 테스트용)
      if (!this.isMobile) {
        joystickBase.addEventListener('mousedown', handleJoystickStart);
        document.addEventListener('mousemove', handleJoystickMove);
        document.addEventListener('mouseup', handleJoystickEnd);
      }

      console.log('조이스틱 이벤트 바인딩 완료');
      
    } catch (error) {
      console.error('조이스틱 이벤트 바인딩 실패:', error);
    }
  }

  // 조이스틱 시각적 위치 업데이트
  updateJoystickPosition() {
    try {
      const joystickStick = document.getElementById('joystick-stick');
      if (!joystickStick || !this.joystick.active) return;

      const deltaX = this.joystick.currentX - this.joystick.centerX;
      const deltaY = this.joystick.currentY - this.joystick.centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 최대 거리 제한
      const limitedDistance = Math.min(distance, this.joystick.maxDistance);
      const angle = Math.atan2(deltaY, deltaX);
      
      const limitedX = Math.cos(angle) * limitedDistance;
      const limitedY = Math.sin(angle) * limitedDistance;

      joystickStick.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
    } catch (error) {
      console.error('조이스틱 위치 업데이트 실패:', error);
    }
  }

  // 조이스틱 입력을 이동으로 변환 (성능 최적화)
  updateMovementFromJoystick() {
    if (!this.joystick.active) return;

    const deltaX = this.joystick.currentX - this.joystick.centerX;
    const deltaY = this.joystick.currentY - this.joystick.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 적응형 데드존 (화면 크기에 비례)
    const deadzone = Math.min(window.innerWidth, window.innerHeight) * 0.03; // 화면 대각선의 3%
    
    if (distance < deadzone) {
      this.resetKeys();
      return;
    }

    // 각도 계산 (라디안을 도수로 변환)
    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    // 모든 방향 초기화
    this.resetKeys();

    // 8방향 입력 처리
    if (angle >= 337.5 || angle < 22.5) {
      this.keys.ArrowRight = true;
    } else if (angle >= 22.5 && angle < 67.5) {
      this.keys.ArrowRight = true;
      this.keys.ArrowDown = true;
    } else if (angle >= 67.5 && angle < 112.5) {
      this.keys.ArrowDown = true;
    } else if (angle >= 112.5 && angle < 157.5) {
      this.keys.ArrowLeft = true;
      this.keys.ArrowDown = true;
    } else if (angle >= 157.5 && angle < 202.5) {
      this.keys.ArrowLeft = true;
    } else if (angle >= 202.5 && angle < 247.5) {
      this.keys.ArrowLeft = true;
      this.keys.ArrowUp = true;
    } else if (angle >= 247.5 && angle < 292.5) {
      this.keys.ArrowUp = true;
    } else if (angle >= 292.5 && angle < 337.5) {
      this.keys.ArrowRight = true;
      this.keys.ArrowUp = true;
    }
  }

  // 모든 키 상태 초기화
  resetKeys() {
    this.keys.ArrowUp = false;
    this.keys.ArrowDown = false;
    this.keys.ArrowLeft = false;
    this.keys.ArrowRight = false;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();
    
    // 성능 모니터 업데이트
    this.updatePerformanceMonitor();
    
    // 모바일에서는 프레임 제한 (30fps)
    if (this.isMobile) {
      this.frameCounter = (this.frameCounter || 0) + 1;
      if (this.frameCounter % 2 !== 0) {
        return; // 매 두 번째 프레임만 렌더링
      }
    }

    // 애니메이션 믹서 업데이트
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // 플레이어 이동 업데이트
    this.updatePlayerMovement();

    // 점프 업데이트
    this.updateJump();

    // 모바일에서 필요할 때만 그림자 업데이트
    if (this.isMobile && this.directionalLight && this.directionalLight.shadow) {
      this.directionalLight.shadow.needsUpdate = this.player && this.player.position.y > 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // 메모리 관리 및 리소스 정리
  dispose() {
    console.log('게임 리소스 정리 시작');
    
    try {
      // 애니메이션 프레임 정리
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      
      // Three.js 객체 정리
      this.disposeThreeJSObjects();
      
      // 오디오 리소스 정리
      this.disposeAudioResources();
      
      // 이벤트 리스너 정리
      this.removeEventListeners();
      
      console.log('게임 리소스 정리 완료');
    } catch (error) {
      console.error('리소스 정리 중 오류:', error);
    }
  }
  
  // Three.js 객체 메모리 정리
  disposeThreeJSObjects() {
    // Scene 객체들 정리
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
        if (child.texture) {
          child.texture.dispose();
        }
      });
      
      this.scene.clear();
    }
    
    // Renderer 정리
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement = null;
    }
    
    // 기타 객체 정리
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    
    // 참조 제거
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.player = null;
    this.mixer = null;
    this.walkAction = null;
    this.directionalLight = null;
    this.bridge = null;
  }
  
  // 오디오 리소스 정리
  disposeAudioResources() {
    const audioElements = [this.bgMusic, this.screamSound, this.laughSound];
    
    audioElements.forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      }
    });
    
    // 오디오 컨텍스트 정리
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // 참조 제거
    this.bgMusic = null;
    this.screamSound = null;
    this.laughSound = null;
  }
  
  // 이벤트 리스너 정리
  removeEventListeners() {
    // 키보드 이벤트 제거
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    window.removeEventListener('resize', this.resizeHandler);
    
    // 터치 이벤트 제거
    if (this.isMobile) {
      document.removeEventListener('touchmove', this.touchMoveHandler);
      document.removeEventListener('touchend', this.touchEndHandler);
      document.removeEventListener('touchcancel', this.touchEndHandler);
    }
    
    // 오디오 관련 이벤트 제거
    if (this.removeAudioEventListeners) {
      this.removeAudioEventListeners();
    }
  }
  
  // 메모리 사용량 체크 (디버깅용)
  checkMemoryUsage() {
    if (performance.memory) {
      const memory = performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB'
      };
    }
    return null;
  }

  // Flutter 통신 메서드들
  
  /// Flutter에서 오는 메시지 처리
  handleFlutterMessage(data) {
    console.log('게임에서 Flutter 메시지 처리:', data);
    
    try {
      if (data.type === 'GAME_CONTROL') {
        this.handleGameControl(data.command, data.params);
      } else if (data.type === 'SETTINGS_UPDATE') {
        this.handleSettingsUpdate(data.settings);
      }
    } catch (error) {
      console.error('Flutter 메시지 처리 오류:', error);
      if (this.isFlutterEnvironment) {
        FlutterBridge.sendError('MESSAGE_HANDLE_ERROR', error.message, { originalData: data });
      }
    }
  }

  /// 게임 제어 명령 처리
  handleGameControl(command, params = {}) {
    console.log('게임 제어 명령:', command, params);
    
    switch (command) {
      case 'RESTART':
        this.restartGame();
        break;
      case 'PAUSE':
        this.pauseGame();
        break;
      case 'RESUME':
        this.resumeGame();
        break;
      case 'MUTE_AUDIO':
        this.muteAudio(params.mute || true);
        break;
      case 'SET_VOLUME':
        this.setVolume(params.volume || 0.5);
        break;
      default:
        console.warn('알 수 없는 게임 제어 명령:', command);
    }
  }

  /// 설정 업데이트 처리
  handleSettingsUpdate(settings) {
    console.log('게임 설정 업데이트:', settings);
    
    if (settings.audioEnabled !== undefined) {
      this.muteAudio(!settings.audioEnabled);
    }
    
    if (settings.volume !== undefined) {
      this.setVolume(settings.volume);
    }
    
    if (settings.performanceMode !== undefined) {
      this.setPerformanceMode(settings.performanceMode);
    }
  }

  /// 게임 재시작
  restartGame() {
    console.log('게임 재시작');
    
    // 플레이어 위치 초기화
    if (this.player) {
      this.player.position.set(0, this.groundY, 0);
      this.player.rotation.y = 0;
    }
    
    // 게임 상태 초기화
    this.isFalling = false;
    this.isJumping = false;
    this.jumpVelocity = 0;
    this.gameStats.score = 0;
    this.gameStats.jumps = 0;
    this.gameStats.falls = 0;
    this.gameStats.isPlaying = true;
    this.gameStartTime = Date.now();
    
    if (this.isFlutterEnvironment) {
      FlutterBridge.sendGameStatus(FlutterBridge.GAME_STATUS.RESTART);
      FlutterBridge.sendScore(0);
    }
  }

  /// 게임 일시정지
  pauseGame() {
    console.log('게임 일시정지');
    this.gameStats.isPlaying = false;
    
    if (this.isFlutterEnvironment) {
      FlutterBridge.sendGameStatus(FlutterBridge.GAME_STATUS.PAUSED);
    }
  }

  /// 게임 재개
  resumeGame() {
    console.log('게임 재개');
    this.gameStats.isPlaying = true;
    
    if (this.isFlutterEnvironment) {
      FlutterBridge.sendGameStatus(FlutterBridge.GAME_STATUS.PLAYING);
    }
  }

  /// 오디오 음소거
  muteAudio(mute) {
    if (this.bgMusic) {
      this.bgMusic.muted = mute;
    }
    if (this.screamSound) {
      this.screamSound.muted = mute;
    }
    console.log('오디오 음소거:', mute);
  }

  /// 볼륨 설정
  setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    if (this.bgMusic) {
      this.bgMusic.volume = vol;
    }
    if (this.screamSound) {
      this.screamSound.volume = vol;
    }
    console.log('볼륨 설정:', vol);
  }

  /// 성능 모드 설정
  setPerformanceMode(mode) {
    console.log('성능 모드 설정:', mode);
    
    switch (mode) {
      case 'high':
        // 고품질 설정
        if (this.renderer) {
          this.renderer.shadowMap.enabled = true;
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        break;
      case 'medium':
        // 중간 품질 설정
        if (this.renderer) {
          this.renderer.shadowMap.enabled = true;
          this.renderer.setPixelRatio(1);
        }
        break;
      case 'low':
        // 저품질 설정
        if (this.renderer) {
          this.renderer.shadowMap.enabled = false;
          this.renderer.setPixelRatio(1);
        }
        break;
    }
  }

  /// Flutter로 게임 이벤트 전송
  sendGameEventToFlutter(eventType, data = {}) {
    if (!this.isFlutterEnvironment) return;
    
    try {
      switch (eventType) {
        case 'jump':
          this.gameStats.jumps++;
          FlutterBridge.sendPlayerAction(FlutterBridge.PLAYER_ACTIONS.JUMP, {
            position: this.player ? this.player.position : null,
            jumps: this.gameStats.jumps
          });
          break;
          
        case 'fall':
          this.gameStats.falls++;
          FlutterBridge.sendPlayerAction(FlutterBridge.PLAYER_ACTIONS.FALL, {
            position: this.player ? this.player.position : null,
            falls: this.gameStats.falls
          });
          break;
          
        case 'score':
          this.gameStats.score = data.score || this.gameStats.score;
          FlutterBridge.sendScore(this.gameStats.score);
          break;
          
        case 'statistics':
          this.gameStats.playTime = Date.now() - this.gameStartTime;
          FlutterBridge.sendStatistics({
            ...this.gameStats,
            fps: this.performanceMonitor.fps
          });
          break;
      }
    } catch (error) {
      console.error('Flutter 이벤트 전송 오류:', error);
      FlutterBridge.sendError('EVENT_SEND_ERROR', error.message, { eventType, data });
    }
  }

  /**
   * 거리 기반 점수 계산 및 업데이트
   */
  updateScore() {
    if (!this.player || !this.gameStats.isPlaying) return;

    // 플레이어의 현재 Z 위치를 기준으로 거리 계산
    // Z축이 음수 방향으로 갈수록 앞으로 이동하는 것으로 간주
    const currentDistance = Math.abs(this.player.position.z - this.scoreData.startPosition);
    
    // 최대 거리 업데이트 (뒤로 가도 점수는 감소하지 않음)
    if (currentDistance > this.scoreData.maxDistance) {
      this.scoreData.maxDistance = currentDistance;
      
      // 거리 기반 점수 계산 (거리 * 배율)
      const newScore = Math.floor(this.scoreData.maxDistance * this.scoreData.scoreMultiplier);
      
      // 점수가 실제로 증가했을 때만 업데이트
      if (newScore > this.gameStats.score) {
        this.gameStats.score = newScore;
        this.gameStats.bestDistance = this.scoreData.maxDistance;
        
        // DOM 업데이트 (실시간)
        this.updateGameStatsUI();
        
        console.log(`🏆 점수 업데이트: ${this.gameStats.score}점 (거리: ${this.scoreData.maxDistance.toFixed(2)})`);
      }
    }
  }

  /**
   * 게임 통계 UI 실시간 업데이트 (DOM 조작)
   */
  updateGameStatsUI() {
    try {
      const playTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
      
      // DOM 요소 업데이트
      const scoreElement = document.getElementById('score-value');
      const distanceElement = document.getElementById('distance-value');
      const jumpsElement = document.getElementById('jumps-value');
      const timeElement = document.getElementById('time-value');
      const deathsElement = document.getElementById('deaths-value');
      const deathsStat = document.getElementById('deaths-stat');
      
      if (scoreElement) scoreElement.textContent = `${this.gameStats.score}점`;
      if (distanceElement) distanceElement.textContent = `${this.scoreData.maxDistance.toFixed(1)}`;
      if (jumpsElement) jumpsElement.textContent = `${this.gameStats.jumps}회`;
      if (timeElement) timeElement.textContent = `${playTime}초`;
      
      // 사망 횟수는 0보다 클 때만 표시
      if (this.gameStats.falls > 0) {
        if (deathsElement) deathsElement.textContent = `${this.gameStats.falls}회`;
        if (deathsStat) deathsStat.style.display = 'flex';
      }
      
    } catch (error) {
      console.error('게임 통계 UI 업데이트 오류:', error);
    }
  }

  /**
   * 게임 시작 시 점수 초기화
   */
  resetScore() {
    this.gameStats.score = 0;
    this.gameStats.bestDistance = 0;
    this.scoreData.startPosition = this.player ? this.player.position.z : 0;
    this.scoreData.maxDistance = 0;
    this.scoreData.lastScoreUpdate = 0;
    this.gameStartTime = Date.now();
    
    console.log('🔄 점수 시스템 초기화됨');
  }

  /**
   * 게임 오버 시 최종 점수 전송
   */
  sendFinalScoreToFlutter() {
    const finalStats = {
      finalScore: this.gameStats.score,
      bestDistance: this.scoreData.maxDistance,
      jumps: this.gameStats.jumps,
      falls: this.gameStats.falls,
      playTime: Math.floor((Date.now() - this.gameStartTime) / 1000),
      sessionId: Date.now()
    };

    if (this.isFlutterEnvironment) {
      try {
        FlutterBridge.sendGameEvent('GAME_OVER', finalStats);
        console.log('🎮 최종 점수 Flutter 전송:', finalStats);
      } catch (error) {
        console.error('Flutter 최종 점수 전송 오류:', error);
      }
    }

    return finalStats;
  }

}

// 페이지 종료 시 자동 정리
window.addEventListener('beforeunload', () => {
  if (window.currentGame && typeof window.currentGame.dispose === 'function') {
    window.currentGame.dispose();
  }
});

export default FreeMovementGame;
