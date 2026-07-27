import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAppConfig, saveAppConfig } from "../api/appConfig_api";

export type AppConfig = {
  workflow_root?: string;
  db_path?: string;
  emails_folder?: string;
  snapshots_folder?: string;
  flywire_storage_root?: string;
  trn_folder?: string;
  era_folder?: string;
  html_folder?: string;
  tooling?: {
    poppler_bins?: string[];
    fonts?: {
      regular?: string;
      alternate?: string;
    };
  };
  ui?: {
    navigation?: {
      attachments?: {
        label?: string;
        meta?: string;
      };
      itemstoreview?: {
        label?: string;
        meta?: string;
      };
      site_review?: {
        label?: string;
        meta?: string;
      };
    };
    itemstoreview?: {
      sidebarCopy?: string;
      heroKicker?: string;
      heroSubtitle?: string;
      statusPill?: string;
      statusTitle?: string;
      statusText?: string;
      sidebarCardLabel?: string;
      sidebarCardMeta?: string;
    };
    siteReview?: {
      sidebarCopy?: string;
      heroKicker?: string;
      views?: {
        approved?: {
          label?: string;
          detail?: string;
        };
        rejected?: {
          label?: string;
          detail?: string;
        };
        complete?: {
          label?: string;
          detail?: string;
        };
      };
      heroSubtitle?: {
        approved?: string;
        rejected?: string;
        complete?: string;
      };
      heroStatusTitle?: {
        approved?: string;
        rejected?: string;
        complete?: string;
      };
      heroStatusText?: {
        approved?: string;
        rejected?: string;
        complete?: string;
      };
      sectionTitle?: {
        approved?: string;
        rejected?: string;
        complete?: string;
      };
      sectionMeta?: {
        approved?: string;
        rejected?: string;
        complete?: string;
      };
    };
  };
};

type AppConfigContextValue = {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  saveConfig: (next: AppConfig) => Promise<AppConfig>;
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshConfig = async () => {
    setLoading(true);
    try {
      const nextConfig = await getAppConfig();
      setConfig(nextConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshConfig();
  }, []);

  const value = useMemo<AppConfigContextValue>(
    () => ({
      config,
      loading,
      error,
      refreshConfig,
      saveConfig: async (next: AppConfig) => {
        const saved = await saveAppConfig(next);
        setConfig(saved);
        setError(null);
        return saved;
      },
    }),
    [config, error, loading]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfigContext() {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfigContext must be used within an AppConfigProvider");
  }

  return context;
}

export function useAppConfig() {
  return useAppConfigContext().config;
}
