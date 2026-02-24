import { CameraView } from './components/CameraView';
import { Controls } from './components/Controls';
import { OverlayCanvas } from './components/OverlayCanvas';
import { useAppStore } from './state/store';
import './App.css';

function App() {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const setSessionRunning = useAppStore((state) => state.setSessionRunning);
  const showSkeleton = useAppStore((state) => state.showSkeleton);

  return (
    <main className="app-shell">
      <h1>AI Garage Band</h1>
      <Controls onToggleSession={() => setSessionRunning(!isSessionRunning)} />
      <CameraView isRunning={isSessionRunning}>
        {(video) =>
          showSkeleton ? (
            <OverlayCanvas
              video={video}
              onDraw={(ctx, width, height) => {
                ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, width, height);
              }}
            />
          ) : null
        }
      </CameraView>
      <p className="status-text">Session: {isSessionRunning ? 'Running' : 'Stopped'}</p>
    </main>
  );
}

export default App;
