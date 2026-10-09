import { useEffect, useRef, useState } from "react";

const PARTICLE_COUNT = 2600;

function createPositions(count, organized, THREE) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    new THREE.Color("#8c72ff"),
    new THREE.Color("#48f2ff"),
    new THREE.Color("#ff3ac8"),
    new THREE.Color("#caff35"),
  ];

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    let x;
    let y;
    if (organized) {
      const card = index % 4;
      const local = Math.floor(index / 4);
      const columns = 27;
      const rows = 21;
      const col = local % columns;
      const row = Math.floor(local / columns) % rows;
      const cardX = [-3.55, -1.15, 1.25, 3.65][card];
      const cardY = card % 2 ? .05 : .24;
      const perimeter = row === 0 || row === rows - 1 || col === 0 || col === columns - 1;
      const fragment = local % 5 === 0;
      x = cardX + (col / (columns - 1)) * 1.9 - .95;
      y = cardY + (row / (rows - 1)) * 1.38 - .69;
      if (perimeter) {
        x += (card % 2 ? .035 : -.035);
      } else if (fragment) {
        x += Math.sin(local) * .045;
        y += Math.cos(local * .6) * .035;
      }
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      x = Math.cos(angle) * radius * 5.6;
      y = Math.sin(angle) * radius * 3.5;
      if (index % 9 < 4) {
        const line = index % 9;
        x = (Math.random() - .5) * 1.7 + (index % 3) * 2.1 - 2.1;
        y = (line - 1.5) * .13 + (Math.random() - .5) * .05;
      }
    }
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = (Math.random() - .5) * (organized ? .07 : 1.3);
    const color = palette[organized ? index % 4 : Math.floor(Math.random() * 3)];
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }
  return { positions, colors };
}

export default function ParticleField() {
  const mountRef = useRef(null);
  const [effectsEnabled, setEffectsEnabled] = useState(() => window.innerWidth >= 760
    && (!navigator.hardwareConcurrency || navigator.hardwareConcurrency > 4)
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMode = () => {
      setEffectsEnabled(window.innerWidth >= 760
        && (!navigator.hardwareConcurrency || navigator.hardwareConcurrency > 4)
        && !motionQuery.matches);
    };
    window.addEventListener("resize", updateMode);
    motionQuery.addEventListener("change", updateMode);
    return () => {
      window.removeEventListener("resize", updateMode);
      motionQuery.removeEventListener("change", updateMode);
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    if (!effectsEnabled || !window.WebGLRenderingContext) {
      mount.classList.add("particle-fallback");
      return undefined;
    }
    let disposed = false;
    let teardown = () => {};
    const initialize = async () => {
      let renderer;
      let animationFrame = 0;
      try {
        const THREE = await import("three");
        if (disposed) return;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(43, 1, .1, 100);
        camera.position.z = 8.7;
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);
        mount.classList.remove("particle-fallback");

        const geometry = new THREE.BufferGeometry();
        const initial = createPositions(PARTICLE_COUNT, false, THREE);
        const target = createPositions(PARTICLE_COUNT, true, THREE);
        const positions = initial.positions.slice();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("color", new THREE.BufferAttribute(initial.colors.slice(), 3).setUsage(THREE.DynamicDrawUsage));
        const material = new THREE.PointsMaterial({
          size: 2.05,
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          opacity: .76,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        let collapse = 0;
        let collapseTarget = 0;
        const pointer = new THREE.Vector2(99, 99);
        let pointerX = 99;
        let pointerY = 99;
        const onPointer = (event) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointerY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };
        const onCollapse = () => { collapseTarget = 1; };
        const onScroll = () => {
          const hero = mount.closest(".hero-visual");
          const rect = hero?.getBoundingClientRect();
          if (rect && rect.bottom < window.innerHeight * .75) collapseTarget = 1;
        };
        const onVisibility = () => {
          if (document.hidden) cancelAnimationFrame(animationFrame);
          else if (!disposed) animationFrame = requestAnimationFrame(render);
        };
        const resize = () => {
          const width = Math.max(1, mount.clientWidth);
          const height = Math.max(1, mount.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          points.scale.set(Math.max(.76, width / 810), Math.max(.78, height / 470), 1);
        };
        function render() {
          if (disposed || document.hidden) return;
          collapse += (collapseTarget - collapse) * .018;
          pointer.set(pointerX, pointerY);
          const pointer3D = new THREE.Vector3(pointer.x, pointer.y, .5).unproject(camera);
          const direction = pointer3D.sub(camera.position).normalize();
          const distance = -camera.position.z / direction.z;
          const worldPointer = camera.position.clone().add(direction.multiplyScalar(distance));
          const values = geometry.attributes.position.array;
          const colorValues = geometry.attributes.color.array;
          const positionsTarget = target.positions;
          const colorsTarget = target.colors;
          for (let index = 0; index < PARTICLE_COUNT; index += 1) {
            const offset = index * 3;
            const targetX = initial.positions[offset] + (positionsTarget[offset] - initial.positions[offset]) * collapse;
            const targetY = initial.positions[offset + 1] + (positionsTarget[offset + 1] - initial.positions[offset + 1]) * collapse;
            const dx = values[offset] - worldPointer.x;
            const dy = values[offset + 1] - worldPointer.y;
            const distanceToPointer = dx * dx + dy * dy;
            const force = distanceToPointer < 1.2 ? (1.2 - distanceToPointer) * .014 : 0;
            values[offset] += (targetX - values[offset]) * .026 + dx * force;
            values[offset + 1] += (targetY - values[offset + 1]) * .026 + dy * force;
            values[offset + 2] += (positionsTarget[offset + 2] - values[offset + 2]) * .018;
            colorValues[offset] += (colorsTarget[offset] - colorValues[offset]) * .022 * collapse;
            colorValues[offset + 1] += (colorsTarget[offset + 1] - colorValues[offset + 1]) * .022 * collapse;
            colorValues[offset + 2] += (colorsTarget[offset + 2] - colorValues[offset + 2]) * .022 * collapse;
          }
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.color.needsUpdate = true;
          points.rotation.z = Math.sin(performance.now() * .00012) * .007 * (1 - collapse);
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        }
        const observer = new ResizeObserver(resize);
        observer.observe(mount);
        resize();
        render();
        window.addEventListener("pointermove", onPointer, { passive: true });
        window.addEventListener("gcd:organize", onCollapse);
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);

        teardown = () => {
          cancelAnimationFrame(animationFrame);
          observer.disconnect();
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("gcd:organize", onCollapse);
          window.removeEventListener("scroll", onScroll);
          document.removeEventListener("visibilitychange", onVisibility);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        renderer?.dispose();
        if (!disposed) mount.classList.add("particle-fallback");
      }
    };
    void initialize();
    return () => {
      disposed = true;
      teardown();
    };
  }, [effectsEnabled]);

  return <div className="particle-field particle-fallback" ref={mountRef} aria-hidden="true"><div className="particle-fallback-glow" /></div>;
}
