import './App.css';
import { Controls } from './components/Controls';
import { useAppStore } from './state/store';

function App() {
  const isSessionRunning = useAppStore((state) => state.isSessionRunning);
  const setSessionRunning = useAppStore((state) => state.setSessionRunning);

  return (
    <main className="app-shell">
      <h1>AI Garage Band</h1>
      <Controls onToggleSession={() => setSessionRunning(!isSessionRunning)} />
      <p className="status-text">Session: {isSessionRunning ? 'Running' : 'Stopped'}</p>
    </main>
  );
}

export default App;
