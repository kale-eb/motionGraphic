export const INITIAL_HTML = `
<div class="scene">
  <h1 class="title">MotionGen</h1>
  <p class="subtitle">Create Amazing Animations</p>
  <div class="shape shape-1"></div>
  <div class="shape shape-2"></div>
  <div class="shape shape-3"></div>
</div>
`;

export const INITIAL_CSS = `
body {
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.scene {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.title {
  font-size: 4rem;
  font-weight: bold;
  color: white;
  margin: 0;
  opacity: 0;
  transform: translateY(30px);
  animation: fadeInUp 1s ease-out 1 forwards;
}

.subtitle {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 1rem 0 0 0;
  opacity: 0;
  animation: fadeIn 1s ease-out 1.2s 1 forwards;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
}

.shape-1 {
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.2);
  top: 20%;
  left: 20%;
  animation: scaleIn 0.8s ease-out 2s 1 forwards;
}

.shape-2 {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.15);
  bottom: 30%;
  right: 25%;
  animation: scaleIn 0.8s ease-out 2.5s 1 forwards;
}

.shape-3 {
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.1);
  top: 60%;
  left: 15%;
  animation: scaleIn 0.8s ease-out 3s 1 forwards;
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
  from {
    transform: scale(0);
  }
}
`;