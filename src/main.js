import "./style.css";
import FreeMovementGame from "./game/StackGame.js";

// DOM이 로드된 후 게임 초기화
window.addEventListener("DOMContentLoaded", () => {
  // 게임 시작!
  const game = new FreeMovementGame();
});
