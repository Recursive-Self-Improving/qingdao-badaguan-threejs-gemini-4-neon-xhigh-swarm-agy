import './style.css';
import { SceneApp } from './engine/SceneApp';

function bootstrap(): void {
  const canvas = document.getElementById(
    'scene-canvas'
  ) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Missing #scene-canvas element');
  }
  new SceneApp(canvas);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
