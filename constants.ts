export const INITIAL_HTML = `
<div class="container">
  <div class="orbit">
    <div class="planet"></div>
    <div class="planet"></div>
    <div class="planet"></div>
  </div>
  <div class="core"></div>
</div>
`;

export const INITIAL_CSS = `
body {
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
}

.container {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.core {
  width: 50px;
  height: 50px;
  background: radial-gradient(circle, #fff, #4f46e5);
  border-radius: 50%;
  box-shadow: 0 0 20px #4f46e5;
  z-index: 10;
}

.orbit {
  position: absolute;
  width: 200px;
  height: 200px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  animation: spin 4s linear infinite;
}

.planet {
  position: absolute;
  top: -10px;
  left: 50%;
  width: 20px;
  height: 20px;
  background: #a78bfa;
  border-radius: 50%;
  box-shadow: 0 0 15px #a78bfa;
}

.planet:nth-child(2) {
  top: 50%;
  left: 100%;
  transform: translate(-50%, -50%);
  background: #34d399;
  box-shadow: 0 0 15px #34d399;
}

.planet:nth-child(3) {
  top: 50%;
  left: 0;
  transform: translate(-50%, -50%);
  background: #f472b6;
  box-shadow: 0 0 15px #f472b6;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;