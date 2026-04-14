import "./WelcomeScreen.css";

interface WelcomeScreenProps {
  onOpenFile: () => void;
}

export function WelcomeScreen({ onOpenFile }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <h1 className="welcome__title">Code One</h1>
      <p className="welcome__subtitle">Agent-Aware Hybrid IDE</p>
      <div className="welcome__actions">
        <button className="welcome__btn" onClick={onOpenFile}>
          Open File
          <span className="welcome__shortcut">Ctrl+O</span>
        </button>
      </div>
    </div>
  );
}
