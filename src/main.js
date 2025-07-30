import "./style.css";
import FreeMovementGame from "./game/StackGame.js";
import { FlutterBridge } from "./flutter/FlutterBridge.js";

// MDN 권장 방식의 모바일 감지 함수
function detectMobile() {
  // 1차: 터치 이벤트 지원 확인 (가장 확실한 방법)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 2차: 미디어 쿼리 기반 감지
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  
  // 3차: UserAgent 보조 확인 (폴백용)
  const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // 4차: 화면 방향 변경 이벤트 지원 (모바일 특성)
  const hasOrientationChange = 'orientation' in window;
  
  // 결합 로직: 터치 지원 + (작은 화면 OR 터치 디바이스 OR UserAgent OR 방향 변경)
  const isMobile = hasTouch && (isSmallScreen || isTouchDevice || userAgentMobile || hasOrientationChange);
  
  console.log('모바일 감지 상세 정보:', {
    hasTouch,
    isSmallScreen,
    isTouchDevice,
    userAgentMobile,
    hasOrientationChange,
    결과: isMobile
  });
  
  return isMobile;
}

// 모바일 최적화 설정
function setupMobileOptimizations() {
  const isMobile = detectMobile();
  
  // body에 모바일 클래스 추가 (CSS와 연동)
  if (isMobile) {
    document.body.classList.add('mobile-device');
  }
  
  // 폴백 안전장치: 768px 이하에서는 강제로 모바일 모드
  const isSmallScreen = window.innerWidth <= 768;
  if (isSmallScreen && !isMobile) {
    console.log('폴백 안전장치 활성화: 작은 화면에서 모바일 모드 강제 적용');
    document.body.classList.add('mobile-device');
    return true; // 강제로 모바일로 인식
  }
  
  // 모바일 브라우저에서 스크롤 방지
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  
  // 확대/축소 방지 (모바일에서만)
  if (isMobile) {
    document.addEventListener('touchmove', (e) => {
      if (e.scale !== 1) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // 더블탭 확대 방지
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }
  
  // iOS Safari에서 상단/하단 바 숨김
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 500);
    });
  }
  
  return isMobile;
}

// DOM이 로드된 후 게임 초기화
window.addEventListener("DOMContentLoaded", () => {
  try {
    // 모바일 최적화 적용 및 모바일 상태 반환
    const isMobileDetected = setupMobileOptimizations();
    
    console.log('DOM 로드 완료 - 환경 정보:', {
      userAgent: navigator.userAgent,
      isMobile: isMobileDetected,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      touchSupport: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints,
      hasPointerEvents: 'onpointerdown' in window,
      mediaQuery: window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)').matches
    });
    
    // 조이스틱 DOM 요소 존재 확인
    setTimeout(() => {
      const mobileControls = document.getElementById('mobile-controls');
      const joystickBase = document.getElementById('joystick-base');
      const jumpButton = document.getElementById('jump-button');
      
      console.log('조이스틱 DOM 요소 확인:', {
        mobileControls: !!mobileControls,
        joystickBase: !!joystickBase,
        jumpButton: !!jumpButton,
        mobileControlsStyle: mobileControls ? window.getComputedStyle(mobileControls).display : 'N/A',
        joystickBaseStyle: joystickBase ? window.getComputedStyle(joystickBase).display : 'N/A'
      });
    }, 500);
    
    // Flutter 환경 확인 및 브리지 초기화
    const isFlutterEnvironment = FlutterBridge.isFlutterEnvironment();
    console.log('Flutter 환경 감지:', isFlutterEnvironment);
    console.log('Flutter 채널 상태:', FlutterBridge.getChannelStatus());
    
    if (isFlutterEnvironment) {
      // Flutter 메시지 리스너 설정
      FlutterBridge.onFlutterMessage((data) => {
        console.log('Flutter 메시지 수신:', data);
        if (window.currentGame) {
          window.currentGame.handleFlutterMessage(data);
        }
      });
      
      // 게임 준비 상태 알림
      FlutterBridge.notifyGameReady({
        gameType: 'stepping-stone',
        version: '1.0.0',
        features: ['webgl', '3d', 'audio', 'mobile-controls']
      });
    }
    
    // 게임 시작 (전역 참조 저장)
    const game = new FreeMovementGame(isFlutterEnvironment);
    window.currentGame = game;
    
    // 전역 에러 처리
    window.addEventListener('error', (event) => {
      console.error('게임 실행 중 오류:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('처리되지 않은 Promise 거부:', event.reason);
    });
    
    console.log('게임이 성공적으로 시작되었습니다');
  } catch (error) {
    console.error('게임 시작 실패:', error);
    
    // 에러 발생시 사용자에게 알림
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      z-index: 9999;
    `;
    errorDiv.innerHTML = `
      <h3>게임 시작 오류</h3>
      <p>브라우저를 새로고침해 주세요.</p>
      <button onclick="location.reload()">새로고침</button>
    `;
    document.body.appendChild(errorDiv);
  }
});
