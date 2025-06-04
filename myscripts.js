// ================== 常數定義 ==================
const FIELD_TYPES = {
U_FIELD: 0,
V_FIELD: 1,
S_FIELD: 2
};//ui 串接config
const SCENE_TYPES = {
TANK: 0,
VORTEX_SHEDDING: 1,
PAINT: 2,
HIGH_RES_VORTEX: 3
};//串接config
// ================== Canvas 設定 ==================
class CanvasManager {
constructor() {
this.canvas = document.getElementById("myCanvas");
this.context = this.canvas.getContext("2d");
this.cavassetup();
this.coordination();
}
cavassetup() {
this.canvas.width = window.innerWidth - 20;
this.canvas.height = window.innerHeight - 100;
this.canvas.focus();
}
coordination() {
this.simHeight = 1.1;
this.cScale = this.canvas.height / this.simHeight;
this.simWidth = this.canvas.width / this.cScale;
}
// 座標轉換函數
convertX(x) {
return x * this.cScale;
}
convertY(y) {
return this.canvas.height - y * this.cScale;
}
clear() {
this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
}// 清除畫布
setColor(r, g, b) {
const color = `rgb(${Math.floor(255*r)}, ${Math.floor(255*g)}, ${Math.floor(255*b)})`;
this.context.fillStyle = color;
this.context.strokeStyle = color;
}// 設定顏色([r,g,b]>>canvas可讀
getImageData() {
return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
}// 獲取畫布圖像數據>>檢測用
putImageData(imageData) {
this.context.putImageData(imageData, 0, 0);
}// 將圖像數據放回畫布
}
// ================== 工具函數 ==================
class MathUtils {
static getSciColor(val, minVal, maxVal) {
val = Math.min(Math.max(val, minVal), maxVal - 0.0001);
const d = maxVal - minVal;
val = d == 0.0 ? 0.5 : (val - minVal) / d;
const m = 0.25;
const num = Math.floor(val / m);
const s = (val - num * m) / m;
let r, g, b;
switch (num) {
case 0: r = 1.0; g = s; b = 0.0; break;
case 1: r = 1.0-s; g = 1.0; b = 0.0; break;
case 2: r = 0.0; g = 1.0; b = s; break;
case 3: r = 0.0; g = 1.0 - s; b = 1.0; break;
}
return [255*r, 255*g, 255*b, 255];
}// p >> rgb
static clamp(value, min, max) {
return Math.max(Math.min(value, max), min);
}// clamp限制
}
// ================== 流體模擬核心 ==================
class Fluid {
constructor(D, Col, Row, h) {
this.D = D;
this.Col = Col + 2;
this.Row = Row + 2;
this.num = this.Col * this.Row;
this.h = h;
this.initializeArrays();
}
initializeArrays() {
this.u = new Float32Array(this.num);
this.v = new Float32Array(this.num);
this.u2 = new Float32Array(this.num);
this.v2 = new Float32Array(this.num);
this.p = new Float32Array(this.num);
this.s = new Float32Array(this.num);
this.m = new Float32Array(this.num);
this.m2 = new Float32Array(this.num);
this.m.fill(1.0);
}
Gravityforce(dt, G) {
const n = this.Row;
for (let i = 1; i < this.Col; i++) {
for (let j = 1; j < this.Row-1; j++) {
if (this.s[i*n + j] != 0.0 && this.s[i*n + j-1] != 0.0) {
this.v[i*n + j] += G * dt;
}
}
}
}
solveIncompressibableflow(iterator, dt) {
const n = this.Row;
const cp = this.D * this.h / dt;
for (let iter = 0; iter < iterator; iter++) {
for (let i = 1; i < this.Col-1; i++) {
for (let j = 1; j < this.Row-1; j++) {
if (this.s[i*n + j] == 0.0) continue;
const sx0 = this.s[(i-1)*n + j];
const sx1 = this.s[(i+1)*n + j];
const sy0 = this.s[i*n + j-1];
const sy1 = this.s[i*n + j+1];
const s = sx0 + sx1 + sy0 + sy1;
if (s == 0.0) continue;
const div = this.u[(i+1)*n + j] - this.u[i*n + j] +
this.v[i*n + j+1] - this.v[i*n + j];
let p = -div / s;
p *= scene.overRelaxation;
this.p[i*n + j] += cp * p;
this.u[i*n + j] -= sx0 * p;
this.u[(i+1)*n + j] += sx1 * p;
this.v[i*n + j] -= sy0 * p;
this.v[i*n + j+1] += sy1 * p;
}
}
}
}
extrapolate() {
const n = this.Row;
for (let i = 0; i < this.Col; i++) {
this.u[i*n + 0] = this.u[i*n + 1];
this.u[i*n + this.Row-1] = this.u[i*n + this.Row-2];
}
for (let j = 0; j < this.Row; j++) {
this.v[0*n + j] = this.v[1*n + j];
this.v[(this.Col-1)*n + j] = this.v[(this.Col-2)*n + j];
}
}
avgField(x, y, field) {
const n = this.Row;
const h = this.h;
const h1 = 1.0 / h;
const h2 = 0.5 * h;
x = MathUtils.clamp(x, h, this.Col * h);
y = MathUtils.clamp(y, h, this.Row * h);
let dx = 0.0, dy = 0.0, f;
switch (field) {
case FIELD_TYPES.U_FIELD: f = this.u; dy = h2; break;
case FIELD_TYPES.V_FIELD: f = this.v; dx = h2; break;
case FIELD_TYPES.S_FIELD: f = this.m; dx = h2; dy = h2; break;
}
const x0 = Math.min(Math.floor((x-dx)*h1), this.Col-1);
const tx = ((x-dx) - x0*h) * h1;
const x1 = Math.min(x0 + 1, this.Col-1);
const y0 = Math.min(Math.floor((y-dy)*h1), this.Row-1);
const ty = ((y-dy) - y0*h) * h1;
const y1 = Math.min(y0 + 1, this.Row-1);
const sx = 1.0 - tx;
const sy = 1.0 - ty;
return sx*sy * f[x0*n + y0] +
tx*sy * f[x1*n + y0] +
tx*ty * f[x1*n + y1] +
sx*ty * f[x0*n + y1];
}
vAdvect(dt) {
this.u2.set(this.u);
this.v2.set(this.v);
const n = this.Row;
const h = this.h;
const h2 = 0.5 * h;
for (let i = 1; i < this.Col; i++) {
for (let j = 1; j < this.Row; j++) {
// u
if (this.s[i*n + j] != 0.0 && this.s[(i-1)*n + j] != 0.0 && j < this.Row - 1) {
let x = i*h;
let y = j*h + h2;
const u = this.u[i*n + j];
const v = this.avgField(x, y, FIELD_TYPES.V_FIELD);
x = x - dt*u;
y = y - dt*v;
const u2 = this.avgField(x, y, FIELD_TYPES.U_FIELD);
this.u2[i*n + j] = u2;
}
// v
if (this.s[i*n + j] != 0.0 && this.s[i*n + j-1] != 0.0 && i < this.Col - 1) {
let x = i*h + h2;
let y = j*h;
const u = this.avgField(x, y, FIELD_TYPES.U_FIELD);
const v = this.v[i*n + j];
x = x - dt*u;
y = y - dt*v;
const v2 = this.avgField(x, y, FIELD_TYPES.V_FIELD);
this.v2[i*n + j] = v2;
}
}
}
this.u.set(this.u2);
this.v.set(this.v2);
}
smokeAdvect(dt) {
this.m2.set(this.m);
const n = this.Row;
const h = this.h;
const h2 = 0.5 * h;
for (let i = 1; i < this.Col-1; i++) {
for (let j = 1; j < this.Row-1; j++) {
if (this.s[i*n + j] != 0.0) {
const u = (this.u[i*n + j] + this.u[(i+1)*n + j]) * 0.5;
const v = (this.v[i*n + j] + this.v[i*n + j+1]) * 0.5;
const x = i*h + h2 - dt*u;
const y = j*h + h2 - dt*v;
this.m2[i*n + j] = this.avgField(x, y, FIELD_TYPES.S_FIELD);
}
}
}
this.m.set(this.m2);
}
simulate(dt, G, iterator) {
this.Gravityforce(dt, G);
this.p.fill(0.0);
this.solveIncompressibableflow(iterator, dt);
this.extrapolate();
this.vAdvect(dt);
this.smokeAdvect(dt);
}
}
// ================== 場景管理(各類config=
class SceneManager {
constructor() {
this.config = {
G: -9.81,
dt: 1.0 / 120.0,
iterator: 100,
frameNr: 0,
overRelaxation: 1.0,
obstacleX: 0.0,
obstacleY: 0.0,
r_obstacicle: 0.15,
paused: false,
sceneNr: 0,
showObstacle: false,
showSL: false,
showV: false,
showPressure: false,
showSmoke: true,
fluid: null
};
}
//畫布configs
setupScene(sceneNr = 0) {
this.config.sceneNr = sceneNr;
this.config.r_obstacicle = 0.15;
this.config.overRelaxation = 1;
this.config.dt = 1.0 / 60.0;
this.config.iterator = 40;
const sceneConfigs = {
[SCENE_TYPES.TANK]: { res: 50 },
[SCENE_TYPES.VORTEX_SHEDDING]: { res: 100 },
[SCENE_TYPES.PAINT]: { res: 100 },
[SCENE_TYPES.HIGH_RES_VORTEX]: { res: 200 }
};
const res = sceneConfigs[sceneNr]?.res || 100;
this.createFluid(res);
this.configureScene(sceneNr);
this.updateUI();
}
//fluid物件實例
createFluid(res) {
const domainHeight = 1.0;
const domainWidth = domainHeight / canvasManager.simHeight * canvasManager.simWidth;
const h = domainHeight / res;
const Col = Math.floor(domainWidth / h);
const Row = Math.floor(domainHeight / h);
const D = 1000.0;
this.config.fluid = new Fluid(D, Col, Row, h);
}
//場景設定
configureScene(sceneNr) {
const sceneSetups = {
[SCENE_TYPES.TANK]: () => this.setupTankScene(),
[SCENE_TYPES.VORTEX_SHEDDING]: () => this.setupVortexScene(false),
[SCENE_TYPES.PAINT]: () => this.setupPaintScene(),
[SCENE_TYPES.HIGH_RES_VORTEX]: () => this.setupVortexScene(true)
};
sceneSetups[sceneNr]?.();
}
setupTankScene() {
const f = this.config.fluid;
const n = f.Row;
for (let i = 0; i < f.Col; i++) {
for (let j = 0; j < f.Row; j++) {
let s = 1.0; // fluid
if (i == 0 || i == f.Col-1 || j == 0) {
s = 0.0; // solid
}
f.s[i*n + j] = s;
}
}
Object.assign(this.config, {
G: -9.81,
showPressure: true,
showSmoke: false,
showSL: false,
showV: false
});
}
//場景config
setupVortexScene(highRes = false) {
const f = this.config.fluid;
const n = f.Row;
const inVel = 2.0;
for (let i = 0; i < f.Col; i++) {
for (let j = 0; j < f.Row; j++) {
let s = 1.0; // fluid
if (i == 0 || j == 0 || j == f.Row-1) {
s = 0.0; // solid
}
f.s[i*n + j] = s;
if (i == 1) {
f.u[i*n + j] = inVel;
}
}
}
//障礙物config
this.setupPipe(f, n);
obstacleManager.setobstacle(0.4, 0.5, true);
Object.assign(this.config, {
G: 0.0,
showPressure: highRes,
showSmoke: true,
showSL: false,
showV: false,
dt: highRes ? 1.0 / 120.0 : 1.0 / 60.0,
iterator: highRes ? 100 : 40
});
}
//障礙物實例
setupPipe(f, n) {
const pipeH = 0.1 * f.Row;
const minJ = Math.floor(0.5 * f.Row - 0.5*pipeH);
const maxJ = Math.floor(0.5 * f.Row + 0.5*pipeH);
for (let j = minJ; j < maxJ; j++) {
f.m[j] = 0.0;
}
}//畫布實例
setupPaintScene() {
Object.assign(this.config, {
G: 0.0,
overRelaxation: 2.5,
showPressure: false,
showSmoke: true,
showSL: false,
showV: false,
r_obstacicle: 0.1
});
}
//ui 介面串接
updateUI() {
const checkboxes = [
{ id: "streamButton", value: this.config.showSL },
{ id: "velocityButton", value: this.config.showV },
{ id: "pressureButton", value: this.config.showPressure },
{ id: "smokeButton", value: this.config.showSmoke },
{ id: "overrelaxButton", value: this.config.overRelaxation > 1.0 }
];
checkboxes.forEach(({ id, value }) => {
const element = document.getElementById(id);
if (element) element.checked = value;
});
}
}
// ================== 障礙物物理 ==================
class ObstacleManager {
setSquareObstacle(xIndex, yIndex, size) {
const f = scene.config.fluid;
const n = f.Row;
for (let i = xIndex; i < xIndex + size; i++) {
for (let j = yIndex; j < yIndex + size; j++) {
if (i >= 0 && i < f.Col && j >= 0 && j < f.Row) {
f.s[i * n + j] = 0.0; // 固體
f.u[i * n + j] = 0.0; // 障礙物區速度清零
f.v[i * n + j] = 0.0;
}
}
}
}
setobstacle(x, y, reset) {
let vx = 0.0, vy = 0.0;
if (!reset) {
vx = (x - scene.config.obstacleX) / scene.config.dt;
vy = (y - scene.config.obstacleY) / scene.config.dt;
}
scene.config.obstacleX = x;
scene.config.obstacleY = y;
const r = scene.config.r_obstacicle;
const f = scene.config.fluid;
const n = f.Row;
for (let i = 1; i < f.Col-2; i++) {
for (let j = 1; j < f.Row-2; j++) {
f.s[i*n + j] = 1.0;
const dx = (i + 0.5) * f.h - x;
const dy = (j + 0.5) * f.h - y;
if (dx * dx + dy * dy < r * r) {
f.s[i*n + j] = 0.0;
if (scene.config.sceneNr == SCENE_TYPES.PAINT) {
f.m[i*n + j] = 0.5 + 0.5 * Math.sin(0.1 * scene.config.frameNr);
} else {
f.m[i*n + j] = 1.0;
}
f.u[i*n + j] = vx;
f.u[(i+1)*n + j] = vx;
f.v[i*n + j] = vy;
f.v[i*n + j+1] = vy;
}
}
}
scene.config.showObstacle = true;
}//障礙物碰撞
}
// ================== 渲染管理 (參考環境設定)===========
class Renderer {
constructor(canvasManager) {
this.canvasManager = canvasManager;
}
draw() {
this.canvasManager.clear();
const f = scene.config.fluid;
const n = f.Row;
const h = f.h;
const cellScale = 1.1;
const { minP, maxP } = this.calculatePressureRange(f);
this.renderFluidField(f, n, h, cellScale, minP, maxP);
if (scene.config.showV) this.renderVelocities(f, n, h);
if (scene.config.showSL) this.renderStreamlines(f);
if (scene.config.showObstacle) this.renderObstacle(f);
if (scene.config.showPressure) this.renderPressureInfo(minP, maxP);
}
calculatePressureRange(f) {
let minP = f.p[0], maxP = f.p[0];
for (let i = 0; i < f.num; i++) {
minP = Math.min(minP, f.p[i]);
maxP = Math.max(maxP, f.p[i]);
}
return { minP, maxP };
}// 渲染流體壓力場
renderFluidField(f, n, h, cellScale, minP, maxP) {
const id = this.canvasManager.getImageData();
let color = [255, 255, 255, 255];
for (let i = 0; i < f.Col; i++) {
for (let j = 0; j < f.Row; j++) {
color = this.getPixelColor(f, i, j, n, minP, maxP);
this.fillPixelBlock(id, i, j, h, cellScale, color);
}
}
this.canvasManager.putImageData(id);
}// 獲取像素顏色
getPixelColor(f, i, j, n, minP, maxP) {
let color = [255, 255, 255, 255];
if (scene.config.showPressure) {
const p = f.p[i*n + j];
const s = f.m[i*n + j];
color = MathUtils.getSciColor(p, minP, maxP);// 獲壓力顏色
if (scene.config.showSmoke) {//煙霧場景
color[0] = Math.max(0.0, color[0] - 255*s);
color[1] = Math.max(0.0, color[1] - 255*s);
color[2] = Math.max(0.0, color[2] - 255*s);
}// 如果是煙霧場景且是流體
} else if (scene.config.showSmoke) {
const s = f.m[i*n + j];
if (scene.config.sceneNr == SCENE_TYPES.PAINT) {
color = MathUtils.getSciColor(s, 0.0, 1.0);
} else {
color[0] = color[1] = color[2] = 255*s;
}//邊界
} else if (f.s[i*n + j] == 0.0) {
color = [0, 0, 0, 255];
}
return color;
}
fillPixelBlock(id, i, j, h, cellScale, color) {
const x = Math.floor(this.canvasManager.convertX(i * h));
const y = Math.floor(this.canvasManager.convertY((j+1) * h));
const cx = Math.floor(this.canvasManager.cScale * cellScale * h) + 1;
const cy = Math.floor(this.canvasManager.cScale * cellScale * h) + 1;
const [r, g, b] = color;
for (let yi = y; yi < y + cy; yi++) {
let p = 4 * (yi * this.canvasManager.canvas.width + x);
for (let xi = 0; xi < cx; xi++) {
id.data[p++] = r;
id.data[p++] = g;
id.data[p++] = b;
id.data[p++] = 255;
}
}
}
renderVelocities(f, n, h) {
this.canvasManager.context.strokeStyle = "#000000";
const scale = 0.02;
for (let i = 0; i < f.Col; i++) {
for (let j = 0; j < f.Row; j++) {
const u = f.u[i*n + j];
const v = f.v[i*n + j];
// u component
this.canvasManager.context.beginPath();
const x0 = this.canvasManager.convertX(i * h);
const x1 = this.canvasManager.convertX(i * h + u * scale);
const y = this.canvasManager.convertY((j + 0.5) * h);
this.canvasManager.context.moveTo(x0, y);
this.canvasManager.context.lineTo(x1, y);
this.canvasManager.context.stroke();
// v component
const x = this.canvasManager.convertX((i + 0.5) * h);
const y0 = this.canvasManager.convertY(j * h);
const y1 = this.canvasManager.convertY(j * h + v * scale);
this.canvasManager.context.beginPath();
this.canvasManager.context.moveTo(x, y0);
this.canvasManager.context.lineTo(x, y1);
this.canvasManager.context.stroke();
}
}
}
renderStreamlines(f) {
const segLen = f.h * 0.2;
const numSegs = 15;
this.canvasManager.context.strokeStyle = "#000000";
for (let i = 1; i < f.Col - 1; i += 5) {
for (let j = 1; j < f.Row - 1; j += 5) {
let x = (i + 0.5) * f.h;
let y = (j + 0.5) * f.h;
this.canvasManager.context.beginPath();
this.canvasManager.context.moveTo(this.canvasManager.convertX(x), this.canvasManager.convertY(y));
for (let n = 0; n < numSegs; n++) {
const u = f.avgField(x, y, FIELD_TYPES.U_FIELD);
const v = f.avgField(x, y, FIELD_TYPES.V_FIELD);
x += u * 0.01;
y += v * 0.01;
if (x > f.Col * f.h) break;
this.canvasManager.context.lineTo(this.canvasManager.convertX(x), this.canvasManager.convertY(y));
}
this.canvasManager.context.stroke();
}
}
}
renderObstacle(f) {
const r = scene.config.r_obstacicle + f.h;
const ctx = this.canvasManager.context;
ctx.fillStyle = scene.config.showPressure ? "#000000" : "#DDDDDD";
ctx.beginPath();
ctx.arc(
this.canvasManager.convertX(scene.config.obstacleX),
this.canvasManager.convertY(scene.config.obstacleY),
this.canvasManager.cScale * r,
0.0, 2.0 * Math.PI
);
ctx.closePath();
ctx.fill();
ctx.lineWidth = 3.0;
ctx.strokeStyle = "#000000";
ctx.beginPath();
ctx.arc(
this.canvasManager.convertX(scene.config.obstacleX),
this.canvasManager.convertY(scene.config.obstacleY),
this.canvasManager.cScale * r,
0.0, 2.0 * Math.PI
);
ctx.closePath();
ctx.stroke();
ctx.lineWidth = 1.0;
}
renderPressureInfo(minP, maxP) {
const s = "pressure: " + minP.toFixed(0) + " - " + maxP.toFixed(0) + " N/m";
this.canvasManager.context.fillStyle = "#000000";
this.canvasManager.context.font = "16px Arial";
this.canvasManager.context.fillText(s, 10, 35);
}
}
// ================== 使用用者交互管理=======
class InteractionManager {
constructor(canvasManager, obstacleManager) {
this.canvasManager = canvasManager;
this.obstacleManager = obstacleManager;
this.mouseDown = false;
this.setupEventListeners();
}
setupEventListeners() {
const canvas = this.canvasManager.canvas;
// 滑鼠事件
canvas.addEventListener('mousedown', (event) => {
this.startDrag(event.x, event.y);
});
canvas.addEventListener('mouseup', () => {
this.endDrag();
});
canvas.addEventListener('mousemove', (event) => {
this.drag(event.x, event.y);
});
// 觸控事件
canvas.addEventListener('touchstart', (event) => {
this.startDrag(event.touches[0].clientX, event.touches[0].clientY);
});
canvas.addEventListener('touchend', () => {
this.endDrag();
});
canvas.addEventListener('touchmove', (event) => {
event.preventDefault();
event.stopImmediatePropagation();
this.drag(event.touches[0].clientX, event.touches[0].clientY);
}, { passive: false });
// 鍵盤事件
document.addEventListener('keydown', (event) => {
this.handleKeyPress(event.key);
});
}// eventlistener實例
startDrag(x, y) {
const bounds = this.canvasManager.canvas.getBoundingClientRect();
const mx = x - bounds.left - this.canvasManager.canvas.clientLeft;
const my = y - bounds.top - this.canvasManager.canvas.clientTop;
this.mouseDown = true;
const simX = mx / this.canvasManager.cScale;
const simY = (this.canvasManager.canvas.height - my) / this.canvasManager.cScale;
this.obstacleManager.setobstacle(simX, simY, true);
}// 開始拖曳
drag(x, y) {
if (this.mouseDown) {
const bounds = this.canvasManager.canvas.getBoundingClientRect();
const mx = x - bounds.left - this.canvasManager.canvas.clientLeft;
const my = y - bounds.top - this.canvasManager.canvas.clientTop;
const simX = mx / this.canvasManager.cScale;
const simY = (this.canvasManager.canvas.height - my) / this.canvasManager.cScale;
this.obstacleManager.setobstacle(simX, simY, false);
}
}// 結束拖曳
endDrag() {
this.mouseDown = false;
}// 處理鍵盤事件
handleKeyPress(key) {
switch(key) {
case 'p':
scene.config.paused = !scene.config.paused;
break;
case 'm':
scene.config.paused = false;
simulator.simulate();
scene.config.paused = true;
break;
}
}
}
// ================== 模擬控制config=============
class SimulationController {
constructor(sceneManager) {
this.sceneManager = sceneManager;
}
simulate() {
if (!this.sceneManager.config.paused) {
this.sceneManager.config.fluid.simulate(
this.sceneManager.config.dt,
this.sceneManager.config.G,
this.sceneManager.config.iterator
);
this.sceneManager.config.frameNr++;
}
}
}
// ================== 主應用程式config=============
class FluidSimulationApp {
constructor() {
this.canvasManager = new CanvasManager();
this.sceneManager = new SceneManager();
this.obstacleManager = new ObstacleManager();
this.renderer = new Renderer(this.canvasManager);
this.interactionManager = new InteractionManager(this.canvasManager, this.obstacleManager);
this.simulationController = new SimulationController(this.sceneManager);
}
initialize(sceneNumber = 1) {
this.sceneManager.setupScene(sceneNumber);
this.startAnimationLoop();
}
update() {
this.simulationController.simulate();
this.renderer.draw();
requestAnimationFrame(() => this.update());
}
startAnimationLoop() {
this.update();
}
}
// ================== 全域變數和初始化 ==================
let canvasManager, scene, obstacleManager, renderer, interactionManager, simulator, app;
var canvas, c, cScale, simHeight, simWidth;
var U_FIELD = FIELD_TYPES.U_FIELD;
var V_FIELD = FIELD_TYPES.V_FIELD;
var S_FIELD = FIELD_TYPES.S_FIELD;
var cnt = 0;
// 保持原有的函數介面
function cX(x) {
return canvasManager.convertX(x);
}
function cY(y) {
return canvasManager.convertY(y);
}
function setColor(r, g, b) {
canvasManager.setColor(r, g, b);
}
function getSciColor(val, minVal, maxVal) {
return MathUtils.getSciColor(val, minVal, maxVal);
}
function setupScene(sceneNr = 0) {
scene.setupScene(sceneNr);
}
function setSquareObstacle(xIndex, yIndex, size) {
obstacleManager.setSquareObstacle(xIndex, yIndex, size);
}
function setobstacle(x, y, reset) {
obstacleManager.setobstacle(x, y, reset);
}
function draw() {
renderer.draw();
}
function simulate() {
simulator.simulate();
}
// 主程式入口
async function main() {
// 初始化所有管理器(實現物件
    canvasManager = new CanvasManager();
    scene = new SceneManager();
    obstacleManager = new ObstacleManager();
    renderer = new Renderer(canvasManager);
    interactionManager = new InteractionManager(canvasManager, obstacleManager);
    simulator = new SimulationController(scene);
// 設定全域變數以保持相容性
    canvas = canvasManager.canvas;
    c = canvasManager.context;
    cScale = canvasManager.cScale;
    simHeight = canvasManager.simHeight;
    simWidth = canvasManager.simWidth;
// 初始化場景並開始動畫循環
    setupScene(1);
    function update() {
        simulate();
        draw();
        requestAnimationFrame(update);
    }
update();
}
// __init__ =='main'
main();