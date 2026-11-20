import * as THREE from 'three';
import {
  getLandmarkAt,
  getWalkableHeight,
  isOnPier,
  type LandmarkInfo,
} from '../world/terrainMath';
import type { Collider, Viewpoint } from '../world/types';

export type ControlMode = 'walk' | 'fly';

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: 'ginkgo_avenue',
    key: '1',
    name: '居庸關銀杏大道',
    subtitle: '金色銀杏拱廊綿延深秋長街，遠望公主樓紅瓦藍牆',
    position: [-35.0, 10.55, -24.0],
    lookAt: [10.0, 11.4, -28.5],
  },
  {
    id: 'princess_house',
    key: '2',
    name: '公主樓庭院',
    subtitle: '透過白色木柵門望向童話般的藍牆紅瓦丹麥洋樓',
    position: [-0.6, 10.9, -31.8],
    lookAt: [-1.0, 14.2, -49.0],
  },
  {
    id: 'butterfly_house',
    key: '3',
    name: '蝴蝶樓街角',
    subtitle: '嘉峪關路丹楓與蘑菇石牆掩映下的明黃洋樓',
    position: [-22.0, 8.45, 22.4],
    lookAt: [-1.5, 11.2, 1.5],
  },
  {
    id: 'huashilou_cape',
    key: '4',
    name: '花石樓臨海礁石',
    subtitle: '站在海灣金沙邊仰望屹立花崗岩岬角的花石樓城堡',
    position: [-4.5, 2.75, 63.0],
    lookAt: [33.5, 14.0, 56.0],
  },
  {
    id: 'breakwater_pier',
    key: '5',
    name: '第二海水浴場防波堤',
    subtitle: '佇立弧形石築長堤回望月牙金沙、花石樓與紅瓦綠樹',
    position: [-42.2, 3.45, 62.2],
    lookAt: [12.0, 7.5, 83.0],
  },
  {
    id: 'aerial_panorama',
    key: '6',
    name: '紅瓦綠樹鳥瞰',
    subtitle: '凌空俯瞰八大關秋色洋樓群與黃海匯泉灣全貌',
    position: [-58.0, 44.0, 78.0],
    lookAt: [6.0, 8.5, -10.0],
  },
];

interface FlightState {
  active: boolean;
  elapsed: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  endQuat: THREE.Quaternion;
  targetMode: ControlMode;
}

export interface PlayerControllerCallbacks {
  onModeChange?: (mode: ControlMode) => void;
  onViewpointChange?: (index: number) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onLandmarkChange?: (landmark: LandmarkInfo) => void;
}

const EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.55;
const BOUNDS = {
  minX: -85,
  maxX: 85,
  minZ: -80,
  maxZ: 108,
  minFlyY: 2.0,
  maxFlyY: 85.0,
};

export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly callbacks: PlayerControllerCallbacks;

  private colliders: Collider[] = [];
  private mode: ControlMode = 'walk';
  private activeViewpointIndex = 0;

  private yaw = 0;
  private pitch = 0;
  private targetFov = 58;

  private readonly keys = new Set<string>();
  private isDragging = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;

  private readonly velocity = new THREE.Vector3();
  private walkBobPhase = 0;
  private lastLandmarkId = '';

  private readonly flight: FlightState = {
    active: false,
    elapsed: 0,
    duration: 1.35,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    endQuat: new THREE.Quaternion(),
    targetMode: 'walk',
  };

  // Scratch objects to avoid per-frame allocations
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpMove = new THREE.Vector3();
  private readonly tmpMatrix = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpUp = new THREE.Vector3(0, 1, 0);

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    callbacks: PlayerControllerCallbacks = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.callbacks = callbacks;

    this.camera.rotation.order = 'YXZ';
    this.targetFov = camera.fov;

    this.bindEvents();
    this.goToViewpoint(0, true);
  }

  public setColliders(colliders: Collider[]): void {
    this.colliders = colliders;
  }

  public getMode(): ControlMode {
    return this.mode;
  }

  public setMode(nextMode: ControlMode): void {
    if (this.mode === nextMode) return;
    this.mode = nextMode;
    this.flight.active = false;
    if (nextMode === 'walk') {
      // Gently pull down to walkable ground if player was flying high
      const groundY = getWalkableHeight(
        this.camera.position.x,
        this.camera.position.z
      );
      if (groundY >= 0.35 || isOnPier(this.camera.position.x, this.camera.position.z)) {
        this.camera.position.y = Math.min(
          this.camera.position.y,
          groundY + EYE_HEIGHT + 6
        );
      } else {
        // If over deep sea, return smoothly to pier viewpoint
        this.goToViewpoint(4, false);
        return;
      }
    }
    this.callbacks.onModeChange?.(this.mode);
  }

  public toggleMode(): ControlMode {
    this.setMode(this.mode === 'walk' ? 'fly' : 'walk');
    return this.mode;
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public getActiveViewpointIndex(): number {
    return this.activeViewpointIndex;
  }

  public isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  public requestPointerLock(): void {
    if (document.pointerLockElement === this.domElement) return;
    try {
      this.domElement.requestPointerLock?.();
    } catch {
      // Ignore in environments that disallow pointer lock
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
  }

  public setCameraPose(
    pos: [number, number, number],
    lookAt: [number, number, number]
  ): void {
    this.flight.active = false;
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.lookAtPoint(lookAt[0], lookAt[1], lookAt[2]);
    this.syncLandmark(true);
  }

  public goToViewpoint(indexOrId: number | string, immediate = false): void {
    let idx = -1;
    if (typeof indexOrId === 'number') {
      if (indexOrId >= 0 && indexOrId < VIEWPOINTS.length) {
        idx = indexOrId;
      } else if (indexOrId === VIEWPOINTS.length) {
        idx = VIEWPOINTS.length - 1;
      }
    } else {
      idx = VIEWPOINTS.findIndex(
        (v) => v.id === indexOrId || v.key === indexOrId
      );
    }
    if (idx < 0) return;

    const vp = VIEWPOINTS[idx];
    this.activeViewpointIndex = idx;
    this.callbacks.onViewpointChange?.(idx);

    const groundAtDest = getWalkableHeight(vp.position[0], vp.position[2]);
    const isAerial = vp.position[1] > groundAtDest + 4.5;
    const desiredMode: ControlMode = isAerial ? 'fly' : 'walk';

    const targetPos = new THREE.Vector3(
      vp.position[0],
      isAerial ? vp.position[1] : Math.max(vp.position[1], groundAtDest + EYE_HEIGHT),
      vp.position[2]
    );

    // Compute exact orientation quaternion looking from targetPos -> vp.lookAt
    this.tmpMatrix.lookAt(
      targetPos,
      new THREE.Vector3(vp.lookAt[0], vp.lookAt[1], vp.lookAt[2]),
      this.tmpUp
    );
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
      this.tmpMatrix
    );

    if (immediate) {
      this.flight.active = false;
      this.camera.position.copy(targetPos);
      this.applyQuaternionToAngles(targetQuat);
      if (this.mode !== desiredMode) {
        this.mode = desiredMode;
        this.callbacks.onModeChange?.(this.mode);
      }
      this.velocity.set(0, 0, 0);
      this.syncLandmark(true);
      return;
    }

    this.flight.active = true;
    this.flight.elapsed = 0;
    this.flight.duration = 1.35;
    this.flight.startPos.copy(this.camera.position);
    this.flight.endPos.copy(targetPos);
    this.flight.startQuat.copy(this.camera.quaternion);
    this.flight.endQuat.copy(targetQuat);
    this.flight.targetMode = desiredMode;
    this.velocity.set(0, 0, 0);

    if (this.mode !== desiredMode) {
      this.mode = desiredMode;
      this.callbacks.onModeChange?.(this.mode);
    }
  }

  private lookAtPoint(tx: number, ty: number, tz: number): void {
    this.tmpMatrix.lookAt(
      this.camera.position,
      new THREE.Vector3(tx, ty, tz),
      this.tmpUp
    );
    this.tmpQuat.setFromRotationMatrix(this.tmpMatrix);
    this.applyQuaternionToAngles(this.tmpQuat);
  }

  private applyQuaternionToAngles(q: THREE.Quaternion): void {
    this.tmpEuler.setFromQuaternion(q, 'YXZ');
    this.yaw = this.tmpEuler.y;
    this.pitch = THREE.MathUtils.clamp(this.tmpEuler.x, -1.42, 1.42);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private cancelFlightOnInput(): void {
    if (this.flight.active) {
      this.flight.active = false;
      this.applyQuaternionToAngles(this.camera.quaternion);
    }
  }

  public update(dt: number): void {
    const safeDt = Math.min(dt, 0.05);

    // Smooth FOV zoom damping
    if (Math.abs(this.camera.fov - this.targetFov) > 0.02) {
      this.camera.fov +=
        (this.targetFov - this.camera.fov) * (1 - Math.exp(-safeDt * 10));
      this.camera.updateProjectionMatrix();
    }

    // Active scripted viewpoint flight
    if (this.flight.active) {
      this.flight.elapsed += safeDt;
      const rawT = Math.min(1, this.flight.elapsed / this.flight.duration);
      // Cubic ease-in-out
      const t =
        rawT < 0.5
          ? 4 * rawT * rawT * rawT
          : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      this.camera.position.lerpVectors(
        this.flight.startPos,
        this.flight.endPos,
        t
      );
      this.camera.quaternion.slerpQuaternions(
        this.flight.startQuat,
        this.flight.endQuat,
        t
      );
      this.applyQuaternionToAngles(this.camera.quaternion);

      if (rawT >= 1) {
        this.flight.active = false;
        this.camera.position.copy(this.flight.endPos);
        this.applyQuaternionToAngles(this.flight.endQuat);
      }
      this.syncLandmark(false);
      return;
    }

    // Apply current yaw & pitch
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Compute input movement vector
    const forwardInput =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafeInput =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const verticalInput =
      (this.keys.has('Space') || this.keys.has('KeyE') ? 1 : 0) -
      (this.keys.has('KeyC') || this.keys.has('KeyQ') ? 1 : 0);

    const sprint =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (this.mode === 'walk') {
      const speed = sprint ? 11.5 : 5.6;

      this.tmpForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.tmpRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.tmpMove
        .set(0, 0, 0)
        .addScaledVector(this.tmpForward, forwardInput)
        .addScaledVector(this.tmpRight, strafeInput);

      if (this.tmpMove.lengthSq() > 1e-4) {
        this.tmpMove.normalize().multiplyScalar(speed);
      }

      const damp = 1 - Math.exp(-safeDt * 12);
      this.velocity.x += (this.tmpMove.x - this.velocity.x) * damp;
      this.velocity.z += (this.tmpMove.z - this.velocity.z) * damp;
      this.velocity.y = 0;

      const prevX = this.camera.position.x;
      const prevZ = this.camera.position.z;
      let nextX = THREE.MathUtils.clamp(
        prevX + this.velocity.x * safeDt,
        BOUNDS.minX,
        BOUNDS.maxX
      );
      let nextZ = THREE.MathUtils.clamp(
        prevZ + this.velocity.z * safeDt,
        BOUNDS.minZ,
        BOUNDS.maxZ
      );

      // Keep player out of deep ocean in walk mode (allow sliding along beach/pier edge)
      const destWalkH = getWalkableHeight(nextX, nextZ);
      const destValidWater = isOnPier(nextX, nextZ) || destWalkH >= 0.35;
      if (!destValidWater) {
        const tryXValid =
          isOnPier(nextX, prevZ) || getWalkableHeight(nextX, prevZ) >= 0.35;
        const tryZValid =
          isOnPier(prevX, nextZ) || getWalkableHeight(prevX, nextZ) >= 0.35;
        if (tryXValid) {
          nextZ = prevZ;
        } else if (tryZValid) {
          nextX = prevX;
        } else {
          nextX = prevX;
          nextZ = prevZ;
        }
      }

      // Resolve world colliders cleanly with sliding
      const feetY = getWalkableHeight(nextX, nextZ);
      const resolved = this.resolveCollisions(nextX, nextZ, feetY);
      nextX = THREE.MathUtils.clamp(resolved.x, BOUNDS.minX, BOUNDS.maxX);
      nextZ = THREE.MathUtils.clamp(resolved.z, BOUNDS.minZ, BOUNDS.maxZ);

      // Re-check ocean safety after collider push-out
      if (!isOnPier(nextX, nextZ) && getWalkableHeight(nextX, nextZ) < 0.35) {
        nextX = prevX;
        nextZ = prevZ;
      }

      this.camera.position.x = nextX;
      this.camera.position.z = nextZ;

      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizSpeed > 0.35) {
        this.walkBobPhase += safeDt * (sprint ? 10.5 : 7.2);
      }
      const bob =
        horizSpeed > 0.35
          ? Math.sin(this.walkBobPhase) *
            Math.min(0.045, horizSpeed * 0.0065)
          : 0;

      const targetY = getWalkableHeight(nextX, nextZ) + EYE_HEIGHT + bob;
      const heightLerp = 1 - Math.exp(-safeDt * 14);
      this.camera.position.y += (targetY - this.camera.position.y) * heightLerp;
    } else {
      // Fly mode: full 3D soaring over Badaguan
      const speed = sprint ? 32.0 : 15.0;

      this.camera.getWorldDirection(this.tmpForward);
      this.tmpRight.crossVectors(this.tmpForward, this.tmpUp).normalize();

      this.tmpMove
        .set(0, 0, 0)
        .addScaledVector(this.tmpForward, forwardInput)
        .addScaledVector(this.tmpRight, strafeInput);
      this.tmpMove.y += verticalInput;

      if (this.tmpMove.lengthSq() > 1e-4) {
        this.tmpMove.normalize().multiplyScalar(speed);
      }

      const damp = 1 - Math.exp(-safeDt * 8.5);
      this.velocity.lerp(this.tmpMove, damp);

      this.camera.position.addScaledVector(this.velocity, safeDt);
      this.camera.position.x = THREE.MathUtils.clamp(
        this.camera.position.x,
        BOUNDS.minX - 20,
        BOUNDS.maxX + 20
      );
      this.camera.position.z = THREE.MathUtils.clamp(
        this.camera.position.z,
        BOUNDS.minZ - 20,
        BOUNDS.maxZ + 20
      );

      const floorY = Math.max(
        BOUNDS.minFlyY,
        getWalkableHeight(this.camera.position.x, this.camera.position.z) + 1.25
      );
      this.camera.position.y = THREE.MathUtils.clamp(
        this.camera.position.y,
        floorY,
        BOUNDS.maxFlyY
      );
    }

    this.syncLandmark(false);
  }

  private resolveCollisions(
    x: number,
    z: number,
    feetY: number
  ): { x: number; z: number } {
    let cx = x;
    let cz = z;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.colliders.length; i++) {
        const col = this.colliders[i];
        if (col.maxY !== undefined && feetY > col.maxY) continue;

        if (col.type === 'box') {
          const nearestX = Math.max(col.minX, Math.min(cx, col.maxX));
          const nearestZ = Math.max(col.minZ, Math.min(cz, col.maxZ));
          const dx = cx - nearestX;
          const dz = cz - nearestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              const overlap = PLAYER_RADIUS - dist;
              cx += (dx / dist) * overlap;
              cz += (dz / dist) * overlap;
            } else {
              // Inside box: push out through nearest face
              const penLeft = Math.abs(cx - col.minX);
              const penRight = Math.abs(col.maxX - cx);
              const penTop = Math.abs(cz - col.minZ);
              const penBottom = Math.abs(col.maxZ - cz);
              const minPen = Math.min(penLeft, penRight, penTop, penBottom);
              if (minPen === penLeft) cx = col.minX - PLAYER_RADIUS;
              else if (minPen === penRight) cx = col.maxX + PLAYER_RADIUS;
              else if (minPen === penTop) cz = col.minZ - PLAYER_RADIUS;
              else cz = col.maxZ + PLAYER_RADIUS;
            }
          }
        } else {
          const dx = cx - col.x;
          const dz = cz - col.z;
          const minDist = col.radius + PLAYER_RADIUS;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            if (dist > 1e-5) {
              const overlap = minDist - dist;
              cx += (dx / dist) * overlap;
              cz += (dz / dist) * overlap;
            } else {
              cx += minDist;
            }
          }
        }
      }
    }

    return { x: cx, z: cz };
  }

  private syncLandmark(force: boolean): void {
    const info = getLandmarkAt(this.camera.position.x, this.camera.position.z);
    if (force || info.id !== this.lastLandmarkId) {
      this.lastLandmarkId = info.id;
      this.callbacks.onLandmarkChange?.(info);
    }
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (
      e.code === 'KeyW' ||
      e.code === 'KeyA' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Space' ||
      e.code === 'KeyE' ||
      e.code === 'KeyQ' ||
      e.code === 'KeyC'
    ) {
      this.cancelFlightOnInput();
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }
    }

    this.keys.add(e.code);

    if (e.repeat) return;

    if (e.code === 'KeyV') {
      this.toggleMode();
    } else if (e.code >= 'Digit1' && e.code <= 'Digit6') {
      const idx = Number(e.code.slice(5)) - 1;
      this.goToViewpoint(idx, false);
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onWindowBlur = (): void => {
    this.keys.clear();
    this.isDragging = false;
    this.activePointerId = null;
    this.domElement.classList.remove('dragging');
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.button !== 2) return;
    if (this.pointerLocked) return;
    this.cancelFlightOnInput();
    this.isDragging = true;
    this.activePointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.domElement.classList.add('dragging');
    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events may not carry capturable pointerId
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.pointerLocked) return;
    if (!this.isDragging) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const sensitivity = 0.0036;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sensitivity,
      -1.42,
      1.42
    );
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) {
      return;
    }
    this.isDragging = false;
    this.activePointerId = null;
    this.domElement.classList.remove('dragging');
    try {
      this.domElement.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
  };

  private readonly onMouseMoveFallback = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.cancelFlightOnInput();
    const sensitivity = 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - e.movementY * sensitivity,
      -1.42,
      1.42
    );
  };

  private readonly onDoubleClick = (): void => {
    if (this.pointerLocked) {
      this.exitPointerLock();
    } else {
      this.requestPointerLock();
    }
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.domElement;
    if (this.pointerLocked) {
      this.isDragging = false;
      this.domElement.classList.remove('dragging');
    }
    this.callbacks.onPointerLockChange?.(this.pointerLocked);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.targetFov = THREE.MathUtils.clamp(
      this.targetFov + Math.sign(e.deltaY) * 2.4,
      36,
      74
    );
  };

  private readonly onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMoveFallback);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('dblclick', this.onDoubleClick);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMoveFallback);

    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('dblclick', this.onDoubleClick);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }
}
