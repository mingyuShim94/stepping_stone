import "./style.css";
import FreeMovementGame from "./game/StackGame.js";

// 모바일 최적화 설정
function setupMobileOptimizations() {
  // 모바일 브라우저에서 스크롤 방지
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  
  // 확대/축소 방지
  document.addEventListener('touchmove', (e) => {
    if (e.scale !== 1) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // 더블탭 확대 방지
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
  
  // iOS Safari에서 상단/하단 바 숨김
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 500);
    });
  }
}

// DOM이 로드된 후 게임 초기화
window.addEventListener("DOMContentLoaded", () => {
  try {
    // 모바일 최적화 적용
    setupMobileOptimizations();
    
    // 모바일 환경 디버깅 정보 출력
    const isMobileDetected = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0);
    
    console.log('DOM 로드 완료 - 환경 정보:', {
      userAgent: navigator.userAgent,
      isMobile: isMobileDetected,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      touchSupport: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints,
      hasPointerEvents: 'onpointerdown' in window
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
    
    // 게임 시작
    const game = new FreeMovementGame();
    
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
