import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

class FreeMovementGame {
  constructor() {
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

    // 조이스틱 관련
    this.joystick = {
      active: false,
      centerX: 0,
      centerY: 0,
      currentX: 0,
      currentY: 0,
      maxDistance: 50
    };

    // 모바일 감지
    this.isMobile = this.detectMobile();

    this.init();
    this.setupEventListeners();
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

  // 모바일 감지
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
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

  // 렌더러 설정
  setupRenderer(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !this.isMobile,
      alpha: false,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance'
    });
    
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 그림자 설정
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  }

  // Fallback 게임 생성
  createFallbackGame(canvas) {
    console.log("Fallback 모드로 실행");
    // 기본 2D 캔버스로 간단한 게임 구현 가능
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

    // 키보드 입력 처리
    if (this.keys.ArrowUp) {
      this.player.position.z -= this.moveSpeed;
      isMoving = true;
      this.player.rotation.y = Math.PI;
    }
    if (this.keys.ArrowDown) {
      this.player.position.z += this.moveSpeed;
      isMoving = true;
      this.player.rotation.y = 0;
    }
    if (this.keys.ArrowLeft) {
      this.player.position.x -= this.moveSpeed;
      isMoving = true;
      this.player.rotation.y = -Math.PI / 2;
    }
    if (this.keys.ArrowRight) {
      this.player.position.x += this.moveSpeed;
      isMoving = true;
      this.player.rotation.y = Math.PI / 2;
    }

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
    console.log("플레이어가 다리에서 벗어났습니다!");
    
    // 비명 소리 재생
    if (this.screamSound) {
      this.screamSound.currentTime = 0;
      this.screamSound.play().catch(() => {
        console.log('비명 소리 재생 실패');
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
    this.isJumping = false;
    
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
    console.log("점프!");
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

  // 조이스틱 이벤트 설정
  setupJoystickEvents() {
    // DOM 요소가 로드될 때까지 기다림
    const setupWhenReady = () => {
      const joystickBase = document.getElementById('joystick-base');
      const joystickStick = document.getElementById('joystick-stick');
      const jumpButton = document.getElementById('jump-button');

      if (!joystickBase || !joystickStick || !jumpButton) {
        // DOM이 아직 준비되지 않은 경우 100ms 후 재시도
        setTimeout(setupWhenReady, 100);
        return;
      }

      this.bindJoystickEvents(joystickBase, joystickStick, jumpButton);
    };

    setupWhenReady();
  }

  // 조이스틱 이벤트 바인딩
  bindJoystickEvents(joystickBase, joystickStick, jumpButton) {

    // 조이스틱 터치 시작
    const handleJoystickStart = (e) => {
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const rect = joystickBase.getBoundingClientRect();
      
      this.joystick.active = true;
      this.joystick.centerX = rect.left + rect.width / 2;
      this.joystick.centerY = rect.top + rect.height / 2;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;
      
      this.updateJoystickPosition();
    };

    // 조이스틱 터치 이동
    const handleJoystickMove = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      
      const touch = e.touches ? e.touches[0] : e;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;
      
      this.updateJoystickPosition();
      this.updateMovementFromJoystick();
    };

    // 조이스틱 터치 종료
    const handleJoystickEnd = (e) => {
      e.preventDefault();
      this.joystick.active = false;
      
      // 조이스틱 중앙으로 복귀
      joystickStick.style.transform = 'translate(0px, 0px)';
      
      // 모든 이동 정지
      this.keys.ArrowUp = false;
      this.keys.ArrowDown = false;
      this.keys.ArrowLeft = false;
      this.keys.ArrowRight = false;
    };

    // 점프 버튼
    const handleJump = (e) => {
      e.preventDefault();
      this.jump();
    };

    // 터치 이벤트 바인딩 (에러 처리 포함)
    try {
      joystickBase.addEventListener('touchstart', handleJoystickStart, { passive: false });
      window.addEventListener('touchmove', handleJoystickMove, { passive: false });
      window.addEventListener('touchend', handleJoystickEnd, { passive: false });
      window.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
      
      jumpButton.addEventListener('touchstart', handleJump, { passive: false });
      jumpButton.addEventListener('click', handleJump);

      // 마우스 이벤트 (데스크톱 테스트용)
      if (!this.isMobile) {
        joystickBase.addEventListener('mousedown', handleJoystickStart);
        window.addEventListener('mousemove', handleJoystickMove);
        window.addEventListener('mouseup', handleJoystickEnd);
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

  // 조이스틱 입력을 이동으로 변환
  updateMovementFromJoystick() {
    if (!this.joystick.active) return;

    const deltaX = this.joystick.currentX - this.joystick.centerX;
    const deltaY = this.joystick.currentY - this.joystick.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 데드존 (최소 움직임 거리)
    if (distance < 15) {
      this.keys.ArrowUp = false;
      this.keys.ArrowDown = false;
      this.keys.ArrowLeft = false;
      this.keys.ArrowRight = false;
      return;
    }

    // 각도 계산 (8방향)
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const normalizedAngle = ((angle + 360) % 360);

    // 모든 방향 초기화
    this.keys.ArrowUp = false;
    this.keys.ArrowDown = false;
    this.keys.ArrowLeft = false;
    this.keys.ArrowRight = false;

    // 8방향 입력 처리
    if (normalizedAngle >= 315 || normalizedAngle < 45) {
      this.keys.ArrowRight = true; // 오른쪽
    } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
      this.keys.ArrowDown = true; // 아래쪽
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      this.keys.ArrowLeft = true; // 왼쪽
    } else if (normalizedAngle >= 225 && normalizedAngle < 315) {
      this.keys.ArrowUp = true; // 위쪽
    }
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

}

export default FreeMovementGame;
