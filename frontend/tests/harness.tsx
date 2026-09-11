import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderFullView } from '../src/views/BuilderFullView';
import '../src/index.css';

function Harness() {
  const [credits, setCredits] = useState(0);
  useEffect(() => { (window as any).__setCredits = setCredits; }, []);
  return <><output id="test-credits" hidden>{credits}</output><BuilderFullView theme="light" initialPrompt="Mad Mochi — matcha i sakura" onBack={() => {}} credits={credits} setCredits={setCredits}/></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
