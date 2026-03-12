"use client";

/**
 * 3D audio-reactive orb visual, ported from audio-orb.
 * Renders a metallic sphere that deforms and reacts to input (mic) and output (TTS) audio.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { AudioAnalyser } from "@/lib/audio-analyser";
import { sphereVS } from "@/lib/audio-orb-shaders";

export function AudioOrbVisual({
  inputNode,
  outputNode,
  breathingMode = false,
  transparentBackground = false,
  disablePostprocessing = false,
  className = "",
}: {
  inputNode: GainNode;
  outputNode: GainNode;
  /** When true, orb breathes/moves gently without reacting to audio (e.g. while LLM is thinking) */
  breathingMode?: boolean;
  /** When true, renderer background is transparent. */
  transparentBackground?: boolean;
  /** Disable bloom/composer passes (useful for tiny transparent embeds). */
  disablePostprocessing?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !inputNode || !outputNode) return;

    const inputAnalyser = breathingMode ? null : new AudioAnalyser(inputNode);
    const outputAnalyser = breathingMode ? null : new AudioAnalyser(outputNode);

    const scene = new THREE.Scene();
    const sceneBgColor = new THREE.Color("#0a0a0a");
    if (!transparentBackground) {
      // Default dark background for full-canvas orb experiences.
      scene.background = sceneBgColor;
    }

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.2);

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    });
    if (transparentBackground) {
      renderer.setClearColor(0x000000, 0);
    } else {
      renderer.setClearColor(sceneBgColor, 1);
    }
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio / 1);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Always use dark mode orb styling for consistent look in both themes
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x000010,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x000010,
      emissiveIntensity: 1.5,
    });

    sphereMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.inputData = { value: new THREE.Vector4() };
      shader.uniforms.outputData = { value: new THREE.Vector4() };
      (sphereMaterial as THREE.MeshStandardMaterial & { userData: { shader?: { uniforms: Record<string, { value: unknown }> } } }).userData.shader = shader;
      shader.vertexShader = sphereVS;
    };

    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 10),
      sphereMaterial
    );
    scene.add(sphere);
    sphere.visible = false;

    new EXRLoader().load("/piz_compressed.exr", (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const exrCubeRenderTarget = pmremGenerator.fromEquirectangular(texture);
      sphereMaterial.envMap = exrCubeRenderTarget.texture;
      sphereMaterial.envMapIntensity = 1;
      sphere.visible = true;
    });

    // Transparent embeds should avoid postprocessing to prevent dark backdrops.
    const usePostprocessing = !transparentBackground && !disablePostprocessing;
    const renderPass = usePostprocessing ? new RenderPass(scene, camera) : null;
    const bloomPass = usePostprocessing
      ? new UnrealBloomPass(
          new THREE.Vector2(container.clientWidth, container.clientHeight),
          5,
          0.5,
          0
        )
      : null;
    const fxaaPass = usePostprocessing ? new ShaderPass(FXAAShader) : null;

    const composer = usePostprocessing ? new EffectComposer(renderer) : null;
    if (composer && renderPass && bloomPass) {
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
    }

    let prevTime = performance.now();
    const rotation = new THREE.Vector3(0, 0, 0);

    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const dPR = renderer.getPixelRatio();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
      if (fxaaPass) {
        fxaaPass.material.uniforms["resolution"].value.set(
          1 / (w * dPR),
          1 / (h * dPR)
        );
      }
    }

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    onResize();

    let rafId: number;
    const startTime = performance.now();
    function animate() {
      rafId = requestAnimationFrame(animate);

      const t = performance.now();
      const dt = (t - prevTime) / (1000 / 60);
      prevTime = t;
      const elapsed = (t - startTime) / 1000;

      if (!breathingMode && inputAnalyser && outputAnalyser) {
        inputAnalyser.update();
        outputAnalyser.update();
      }

      const userData = (sphereMaterial as THREE.MeshStandardMaterial & { userData: { shader?: { uniforms: Record<string, { value: unknown }> } } }).userData;
      if (userData.shader) {
        const uniforms = userData.shader!.uniforms as {
          time: { value: number };
          inputData: { value: THREE.Vector4 };
          outputData: { value: THREE.Vector4 };
        };

        if (breathingMode) {
          // Gentle breathing: scale pulse + slow camera drift
          const breath = 0.08 * Math.sin(elapsed * 1.2) + 0.04 * Math.sin(elapsed * 0.7);
          sphere.scale.setScalar(1 + breath);

          const drift = 0.002;
          rotation.x += dt * drift * (1 + 0.6 * Math.sin(elapsed * 0.5));
          rotation.z += dt * drift * (1 + 0.5 * Math.sin(elapsed * 0.6));
          rotation.y += dt * drift * (1 + 0.4 * Math.sin(elapsed * 0.4));

          const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
          const quaternion = new THREE.Quaternion().setFromEuler(euler);
          const vector = new THREE.Vector3(0, 0, 2.2);
          vector.applyQuaternion(quaternion);
          camera.position.copy(vector);
          camera.lookAt(sphere.position);

          const deform = 0.15 + 0.1 * Math.sin(elapsed * 0.8);
          uniforms.time.value += dt * 0.08;
          uniforms.inputData.value.set(deform * 0.4, 0.02, 3, 0);
          uniforms.outputData.value.set(deform * 0.5, 0.02, 3, 0);
        } else {
          sphere.scale.setScalar(
            1 + (0.2 * outputAnalyser!.data[1]) / 255
          );

          const f = 0.001;
          rotation.x += (dt * f * 0.5 * outputAnalyser!.data[1]) / 255;
          rotation.z += (dt * f * 0.5 * inputAnalyser!.data[1]) / 255;
          rotation.y += (dt * f * 0.25 * inputAnalyser!.data[2]) / 255;
          rotation.y += (dt * f * 0.25 * outputAnalyser!.data[2]) / 255;

          const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
          const quaternion = new THREE.Quaternion().setFromEuler(euler);
          const vector = new THREE.Vector3(0, 0, 2.2);
          vector.applyQuaternion(quaternion);
          camera.position.copy(vector);
          camera.lookAt(sphere.position);

          uniforms.time.value += (dt * 0.1 * outputAnalyser!.data[0]) / 255;
          uniforms.inputData.value.set(
            (1 * inputAnalyser!.data[0]) / 255,
            (0.1 * inputAnalyser!.data[1]) / 255,
            (10 * inputAnalyser!.data[2]) / 255,
            0
          );
          uniforms.outputData.value.set(
            (2 * outputAnalyser!.data[0]) / 255,
            (0.1 * outputAnalyser!.data[1]) / 255,
            (10 * outputAnalyser!.data[2]) / 255,
            0
          );
        }
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [inputNode, outputNode, breathingMode, transparentBackground, disablePostprocessing]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
    />
  );
}
