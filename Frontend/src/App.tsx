import React from "react";
import ScreenManager from "./ScreenManager";
import { AppConfigProvider } from "./config/appConfig";
import { AuthProvider } from "./auth/auth";
import { WorklistProvider, WorklistShade } from "./worklist/worklist";

const App: React.FC = () => {
  return (
    <AppConfigProvider>
      <AuthProvider>
        <WorklistProvider>
          <div style={{ width: "100%", minHeight: "100vh", overflowY: "auto" }}>
            <ScreenManager />
          </div>
          <WorklistShade />
        </WorklistProvider>
      </AuthProvider>
    </AppConfigProvider>
  );
};

export default App;
