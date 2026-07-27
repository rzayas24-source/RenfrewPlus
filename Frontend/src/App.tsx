import React from "react";
import ScreenManager from "./ScreenManager";
import { AppConfigProvider } from "./config/appConfig";
import { WorklistProvider, WorklistShade } from "./worklist/worklist";

const App: React.FC = () => {
  return (
    <AppConfigProvider>
      <WorklistProvider>
        <div style={{ width: "100%", minHeight: "100vh", overflowY: "auto" }}>
          <ScreenManager />
        </div>
        <WorklistShade />
      </WorklistProvider>
    </AppConfigProvider>
  );
};

export default App;
