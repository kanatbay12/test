import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; // Импорт загрузчика
import { TransformControls } from "three/addons/controls/TransformControls.js";

// 1. Начальная настройка
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(4, 5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// 2. Элементы управления
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true; // Плавное движение
orbitControls.minDistance = 2; // Уменьшим, чтобы можно было подлететь ближе
orbitControls.maxDistance = 20;
orbitControls.target.set(0, 1, 0); // Камера смотрит на центр модели

// 3. Освещение
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Добавляем сетку-пол для наглядности
const grid = new THREE.GridHelper(50, 50, 0x444444, 0x444444);
scene.add(grid);

// Элементы управления для перемещения объектов
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);

// Отключаем OrbitControls, когда используем TransformControls
transformControls.addEventListener("dragging-changed", function (event) {
  orbitControls.enabled = !event.value;
});

let carBody; // Объявим переменную для модели
let selectedSensor = null;

// 4. Загрузка модели кузова
const loader = new GLTFLoader();

loader.load(
  "models/car.glb", // Укажите путь к вашей модели
  function (gltf) {
    carBody = gltf.scene; // Модель находится в свойстве scene
    // Опционально: масштабирование и позиционирование модели
    carBody.scale.set(1, 1, 1);
    carBody.rotation.set(0, 0, 0);
    carBody.position.y = 0;
    scene.add(carBody);

    // После загрузки модели добавляем датчики
    addSensorPoints(); // Вызываем функцию добавления датчиков внутри загрузчика
  },
  undefined,
  function (error) {
    console.error("Ошибка загрузки модели", error);
  }
);

// 5. Точки-датчики (функция)
const sensorMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // Синий
const sensorHoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // Оранжевый

const sensorPoints = [
  { pos: new THREE.Vector3(3.5, 1, 0), name: "Датчик кислорода (лямбда-зонд)" },
  {
    pos: new THREE.Vector3(-2, 2.5, 1),
    name: "Датчик массового расхода воздуха",
  },
  { pos: new THREE.Vector3(0, 0.8, -1.2), name: "Датчик положения коленвала" },
  { pos: new THREE.Vector3(3, 1, 1.2), name: "Датчик детонации" },
];

const sensorMeshes = [];

function addSensorPoints() {
  sensorPoints.forEach((point) => {
    const sensorGeom = new THREE.SphereGeometry(0.1, 16, 16);
    const sensorMesh = new THREE.Mesh(sensorGeom, sensorMaterial.clone());
    sensorMesh.position.copy(point.pos);
    sensorMesh.userData.name = point.name; // Сохраняем имя для подсказки
    if (carBody) {
      carBody.add(sensorMesh);
      sensorMeshes.push(sensorMesh);
    }
  });
}

// 6. Интерактивность (отслеживание мыши)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Создаем элемент для всплывающей подсказки
const tooltip = document.createElement("div");
tooltip.style.position = "absolute";
tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
tooltip.style.color = "white";
tooltip.style.padding = "5px 10px";
tooltip.style.borderRadius = "3px";
tooltip.style.display = "none";
tooltip.style.pointerEvents = "none"; // Чтобы не мешала кликам
container.appendChild(tooltip);

// Получаем доступ к элементам панели управления
const controlsPanel = document.getElementById("controls-panel");
const sensorNameEl = document.getElementById("sensor-name");
const coordXInput = document.getElementById("coord-x");
const coordYInput = document.getElementById("coord-y");
const coordZInput = document.getElementById("coord-z");
const logCoordsBtn = document.getElementById("log-coords-btn");

function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  tooltip.style.left = `${event.clientX - rect.left + 15}px`;
  tooltip.style.top = `${event.clientY - rect.top}px`;
}
window.addEventListener("pointermove", onPointerMove);

function onPointerDown(event) {
  // Выполняем рейкастинг только по клику
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(sensorMeshes);

  if (intersects.length > 0) {
    // Если уже что-то выбрано, снимаем подсветку
    if (selectedSensor) {
      selectedSensor.material = sensorMaterial;
    }

    selectedSensor = intersects[0].object;
    selectedSensor.material = sensorHoverMaterial; // Подсвечиваем выбранный

    // Прикрепляем TransformControls к выбранному датчику
    transformControls.attach(selectedSensor);
    updateControlsPanel();
    controlsPanel.classList.remove("hidden");
  } else {
    // Если клик был по пустому месту и gizmo не используется
    if (!transformControls.dragging) {
      if (selectedSensor) {
        selectedSensor.material = sensorMaterial; // Снимаем подсветку
      }
      selectedSensor = null;
      transformControls.detach();
      controlsPanel.classList.add("hidden");
    }
  }
}
window.addEventListener("pointerdown", onPointerDown);

// Обновление полей в панели при перемещении
transformControls.addEventListener("objectChange", () => {
  if (selectedSensor) {
    updateControlsPanel();
  }
});

function updateControlsPanel() {
  if (!selectedSensor) return;
  sensorNameEl.textContent = selectedSensor.userData.name;
  coordXInput.value = selectedSensor.position.x.toFixed(2);
  coordYInput.value = selectedSensor.position.y.toFixed(2);
  coordZInput.value = selectedSensor.position.z.toFixed(2);
}

logCoordsBtn.addEventListener("click", () => {
  if (!selectedSensor) return;
  const pos = selectedSensor.position;
  const coordsString = `new THREE.Vector3(${pos.x.toFixed(3)}, ${pos.y.toFixed(
    3
  )}, ${pos.z.toFixed(3)})`;
  // Копируем в буфер обмена и выводим в консоль
  navigator.clipboard.writeText(coordsString);
  console.log("Скопировано в буфер обмена:", coordsString);
  alert("Координаты скопированы в буфер обмена!");
});

// 7. Цикл анимации
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update(); // Обновляем контроллер камеры

  // Логика для всплывающей подсказки (tooltip)
  if (!selectedSensor) {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(sensorMeshes);
    if (intersects.length > 0) {
      const hovered = intersects[0].object;
      tooltip.style.display = "block";
      tooltip.textContent = hovered.userData.name;
    } else {
      tooltip.style.display = "none";
    }
  }

  renderer.render(scene, camera);
}

// 8. Адаптивность
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

animate();
