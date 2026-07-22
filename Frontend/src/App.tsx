import React from "react";
import ScreenManager from "./ScreenManager";
import { WorklistProvider, WorklistShade } from "./worklist/worklist";

const App: React.FC = () => {
  return (
    <WorklistProvider>
      <div style={{ width: "100%", minHeight: "100vh", overflowY: "auto" }}>
        <ScreenManager />
      </div>
      <WorklistShade />
    </WorklistProvider>
  );
};

export default App;
