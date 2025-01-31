import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import styled from "styled-components";

const LoadingContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #000000 0%, #0a0a2a 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  color: #ffffff;
`;

const ProgressBar = styled.div`
  width: 300px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin: 20px 0;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ width: number }>`
  width: ${(props) => props.width}%;
  height: 100%;
  background: linear-gradient(90deg, #4a9eff 0%, #00e5ff 100%);
  transition: width 0.3s ease;
`;

const LoadingText = styled.div`
  font-size: 1.5em;
  margin-bottom: 10px;
  font-family: "Arial", sans-serif;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const StatusText = styled.div`
  font-size: 1em;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 10px;
`;

const TipText = styled.div`
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 30px;
  max-width: 400px;
  text-align: center;
  font-style: italic;
`;

const tips = [
  "Use WASD keys to control your ship's movement",
  "Press SPACE to ascend and SHIFT to descend",
  "Right-click to activate boost mode",
  "Press V to toggle between first and third person views",
  "Use Q and E to roll your ship",
  "Hold C for free look mode",
  "Press ESC to release mouse control",
];

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export const LoadingScreen = ({ onLoadingComplete }: LoadingScreenProps) => {
  const { progress, item, loaded, total } = useProgress();
  const [tip, setTip] = useState("");

  useEffect(() => {
    // Change tip every 3 seconds
    const interval = setInterval(() => {
      setTip(tips[Math.floor(Math.random() * tips.length)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // Add a small delay before completing to ensure everything is ready
      const timeout = setTimeout(() => {
        onLoadingComplete();
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [progress, onLoadingComplete]);

  return (
    <LoadingContainer>
      <LoadingText>Loading Space Combat</LoadingText>
      <ProgressBar>
        <ProgressFill width={progress} />
      </ProgressBar>
      <StatusText>
        {progress.toFixed(1)}% - Loading {item} ({loaded}/{total})
      </StatusText>
      <TipText>{tip}</TipText>
    </LoadingContainer>
  );
};
