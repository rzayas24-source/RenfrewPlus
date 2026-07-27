import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppConfig } from "../config/appConfig";
import type { AppConfig } from "../config/appConfig";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  GAZEBO_MENU_ID,
  getMenuOptions,
  loadMenuSelection,
  saveMenuSelection,
  resolveMenuSelection,
  type MenuSelectionEntry,
} from "../navigation/menuConfig";

export type AdminNavItem = {
  label: string;
  onClick: () => void;
  glyph?: string;
};

export type AdminRibbonItem = {
  title: string;
  meta: string;
  onClick: () => void;
};

type AdminShellProps = {
  children: ReactNode;
  sidebarCopy: string;
  sidebarTopCard?: ReactNode;
  sidebarMiddleCard?: ReactNode;
  sidebarAction?: ReactNode;
  sidebarCardLabel?: string;
  sidebarCardValue?: string;
  sidebarCardValueStyle?: CSSProperties;
  sidebarCardMeta?: string;
  backLabel?: string;
  hideBackButton?: boolean;
  backButtonFirst?: boolean;
  hideSidebarBackMenu?: boolean;
  hideSidebarBackStyles?: boolean;
  useGlobalMenuFallback?: boolean;
  onBack: () => void;
  ribbonItems?: AdminRibbonItem[];
  ribbonTitle?: string;
};

type FavoriteScreen = {
  path: string;
  label: string;
  meta: string;
};

const MAX_FAVORITES = 8;
const LEGACY_GAZEBO_STORAGE_KEY = "gazebo:favorites";

const RIBBON_PASTELS: CSSProperties[] = [
  {
    background: "rgba(242, 248, 255, 0.98)",
    border: "1px solid rgba(158, 187, 221, 0.30)",
  },
  {
    background: "rgba(255, 239, 246, 0.98)",
    border: "1px solid rgba(221, 170, 195, 0.28)",
  },
  {
    background: "rgba(245, 246, 248, 0.98)",
    border: "1px solid rgba(181, 191, 204, 0.30)",
  },
  {
    background: "rgba(244, 250, 244, 0.98)",
    border: "1px solid rgba(171, 205, 182, 0.28)",
  },
  {
    background: "rgba(252, 247, 240, 0.98)",
    border: "1px solid rgba(220, 193, 163, 0.28)",
  },
];

const SCREEN_REGISTRY: Record<string, FavoriteScreen> = {
  "/": { path: "/", label: "Main", meta: "Main workspace" },
  "/home": { path: "/home", label: "Main", meta: "Main workspace" },
  "/admin": { path: "/admin", label: "Admin", meta: "Admin console" },
  "/admin/config": { path: "/admin/config", label: "Config", meta: "App config editor" },
  "/admin/tables": { path: "/admin/tables", label: "Tables", meta: "Database browser" },
  "/admin/users": { path: "/admin/users", label: "Users", meta: "Access control" },
  "/admin/menus": { path: "/admin/menus", label: "Menu Builder", meta: "Sidebar navigation" },
  "/calendar": { path: "/calendar", label: "Calendar", meta: "Posting day manager" },
  "/cash": { path: "/cash", label: "Cash", meta: "Cash workspace" },
  "/collections": { path: "/collections", label: "Collections", meta: "Collections workspace" },
  "/era-convert": { path: "/era-convert", label: "ERA Convert", meta: "ERA workflow" },
  "/html-convert": { path: "/html-convert", label: "HTML Convert", meta: "HTML workflow" },
  "/otherday": { path: "/otherday", label: "Other Day Check", meta: "Missing rows" },
  "/duplicatecheck": { path: "/duplicatecheck", label: "Duplicate Check", meta: "Duplicate scan" },
  "/tools": { path: "/tools", label: "Tools", meta: "Utility hub" },
  "/import": { path: "/import", label: "Import", meta: "Inbound files" },
  "/eft-upload": { path: "/eft-upload", label: "EFT Upload", meta: "EFT upload" },
  "/835-upload": { path: "/835-upload", label: "835 Upload", meta: "835 upload" },
  "/lockbox-import": { path: "/lockbox-import", label: "Lockbox Import", meta: "Lockbox import" },
  "/banking": { path: "/banking", label: "Banking", meta: "Bank-side review" },
  "/835-match": { path: "/835-match", label: "835 Match", meta: "Match review" },
  "/site-review": { path: "/site-review", label: "Site Review", meta: "Site review" },
  "/email-downloader": { path: "/email-downloader", label: "Email Downloader", meta: "Email review" },
  "/snapshot-generator": { path: "/snapshot-generator", label: "Snapshot Generator", meta: "Snapshot review" },
  "/worklist-editor": { path: "/worklist-editor", label: "Daily Worklist", meta: "Worklist editor" },
  "/attachments": { path: "/attachments", label: "Attachments", meta: "Attachments queue" },
  "/balancecheck": { path: "/balancecheck", label: "Balance Check", meta: "Balance review" },
  "/balsheet": { path: "/balsheet", label: "Balance Sheet", meta: "Balance sheet" },
  "/balsheet/view": { path: "/balsheet/view", label: "Balance Sheet", meta: "Balance sheet" },
  "/keyproof": { path: "/keyproof", label: "Keyproof", meta: "Keyproof review" },
  "/itemization": { path: "/itemization", label: "Itemization", meta: "Itemization" },
  "/itemstoreview": { path: "/itemstoreview", label: "Items to Review", meta: "Items to Review workspace" },
  "/statements": { path: "/statements", label: "Statements", meta: "Statements" },
  "/request": { path: "/request", label: "Request", meta: "Request queue" },
  "/research": { path: "/research", label: "Research", meta: "Research tools" },
  "/finance": { path: "/finance", label: "Finance", meta: "Finance tools" },
  "/business": { path: "/business", label: "Business", meta: "Business tools" },
  "/sites": { path: "/sites", label: "Sites", meta: "Sites browser" },
  "/aux-posting": { path: "/aux-posting", label: "Aux Posting", meta: "Aux posting" },
  "/check-search": { path: "/check-search", label: "Check Search", meta: "Check search" },
  "/view-images": { path: "/view-images", label: "View Images", meta: "Image viewer" },
};

function compareNavLabels(left: string, right: string) {
  const priority = (value: string) => {
    if (value === "Back") return 0;
    if (value === "Previous") return 1;
    return 2;
  };

  const priorityDiff = priority(left) - priority(right);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (left === "Back" && right !== "Back") {
    return -1;
  }

  if (right === "Back" && left !== "Back") {
    return 1;
  }

  if (left === "Previous" && right !== "Previous") {
    return -1;
  }

  if (right === "Previous" && left !== "Previous") {
    return 1;
  }

  return left.localeCompare(right);
}

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function formatScreenLabel(pathname: string) {
  const normalized = normalizePath(pathname);
  if (normalized === "/") return "Main";

  return normalized
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ")
    )
    .join(" ");
}

function loadLegacyGazeboSelection() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_GAZEBO_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizePath(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, MAX_FAVORITES)
      .map((value) => ({ id: value }));
  } catch {
    return [];
  }
}

function resolveScreen(pathname: string, config?: AppConfig | null): FavoriteScreen {
  const normalized = normalizePath(pathname);
  const labels = {
    attachments: config?.ui?.navigation?.attachments?.label ?? "Attachments",
    itemstoreview: config?.ui?.navigation?.itemstoreview?.label ?? "Items to Review",
    siteReview: config?.ui?.navigation?.site_review?.label ?? "Site Review",
  };
  if (normalized === "/attachments") {
    return {
      path: "/attachments",
      label: labels.attachments,
      meta: config?.ui?.navigation?.attachments?.meta ?? "Attachments queue",
    };
  }

  if (normalized === "/itemstoreview") {
    return {
      path: "/itemstoreview",
      label: labels.itemstoreview,
      meta: config?.ui?.navigation?.itemstoreview?.meta ?? "Items to Review workspace",
    };
  }

  if (normalized === "/site-review") {
    return {
      path: "/site-review",
      label: labels.siteReview,
      meta: config?.ui?.navigation?.site_review?.meta ?? "Site review",
    };
  }

  return SCREEN_REGISTRY[normalized] ?? {
    path: normalized,
    label: formatScreenLabel(normalized),
    meta: "Saved screen",
  };
}

export function AdminShell({
  children,
  sidebarCopy,
  sidebarTopCard,
  sidebarMiddleCard,
  sidebarAction,
  ribbonItems,
  sidebarCardLabel,
  sidebarCardValue,
  sidebarCardValueStyle,
  sidebarCardMeta,
  backLabel,
  hideBackButton,
  backButtonFirst,
  hideSidebarBackMenu,
  hideSidebarBackStyles,
  useGlobalMenuFallback = true,
  onBack,
  ribbonTitle = "Favorites",
}: AdminShellProps) {
  void backLabel;
  void onBack;
  void hideBackButton;
  const location = useLocation();
  const navigate = useNavigate();
  const appConfig = useAppConfig();
  const currentScreen = useMemo(() => resolveScreen(location.pathname, appConfig ?? undefined), [location.pathname, appConfig]);
  const [isRibbonOpen, setIsRibbonOpen] = useState(false);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const [gazeboSelection, setGazeboSelection] = useState<MenuSelectionEntry[]>([]);
  const [isGazeboLoaded, setIsGazeboLoaded] = useState(false);
  const [menuSelection, setMenuSelection] = useState<MenuSelectionEntry[]>([]);
  const isFavorite = gazeboSelection.some((item) => item.id === currentScreen.path);
  const globalMenuSelection = useMemo(
    () =>
      getMenuOptions(appConfig ?? undefined)
        .filter((option) => option.kind !== "menu")
        .map((option) => ({ id: option.id })),
    [appConfig]
  );
  const effectiveMenuSelection =
    menuSelection.length > 0 || useGlobalMenuFallback === false ? menuSelection : globalMenuSelection;
  const favoriteScreens = useMemo(
    () => gazeboSelection.map((item) => resolveScreen(item.id, appConfig)).slice(0, MAX_FAVORITES),
    [appConfig, gazeboSelection]
  );
  const navItems = useMemo(
    () => {
      const resolvedItems = effectiveMenuSelection
        .map((entry) => {
          const resolved = resolveMenuSelection(entry.id, entry, appConfig ?? undefined);
          if (!resolved) {
            return null;
          }

          if ((hideSidebarBackMenu && resolved.isBackAction) || (hideSidebarBackStyles && resolved.isBackStyle)) {
            return null;
          }

          return {
            label: resolved.label,
            onClick: () => {
              if (resolved.isBackAction) {
                navigate(-1);
                return;
              }

              navigate(resolved.path ?? "/");
            },
            glyph: resolved.isBackStyle ? "<" : ">",
            isBackStyle: resolved.isBackStyle,
          };
        })
        .filter((item): item is { label: string; onClick: () => void; glyph: string; isBackStyle: boolean } => Boolean(item));

      return resolvedItems.sort((left, right) => compareNavLabels(left.label, right.label));
    },
    [appConfig, effectiveMenuSelection, hideSidebarBackMenu, hideSidebarBackStyles, navigate]
  );
  const priorityNavItems = navItems.slice(0, 2);
  const remainingNavItems = navItems.slice(2);
  useEffect(() => {
    let active = true;

    const syncMenu = async () => {
      const [nextSelection, nextGazeboSelection] = await Promise.all([
        loadMenuSelection(currentScreen.path).catch(() => [] as MenuSelectionEntry[]),
        loadMenuSelection(GAZEBO_MENU_ID).catch(() => [] as MenuSelectionEntry[]),
      ]);

      let resolvedGazeboSelection = nextGazeboSelection.slice(0, MAX_FAVORITES);
      if (resolvedGazeboSelection.length === 0) {
        const legacyGazeboSelection = loadLegacyGazeboSelection();
        if (legacyGazeboSelection.length > 0) {
          try {
            resolvedGazeboSelection = (await saveMenuSelection(GAZEBO_MENU_ID, legacyGazeboSelection)).slice(
              0,
              MAX_FAVORITES
            );
            window.localStorage.removeItem(LEGACY_GAZEBO_STORAGE_KEY);
          } catch {
            resolvedGazeboSelection = legacyGazeboSelection;
          }
        }
      }

      if (active) {
        setMenuSelection(nextSelection);
        setGazeboSelection(resolvedGazeboSelection);
        setIsGazeboLoaded(true);
      }
    };

    void syncMenu();
    window.addEventListener("renfrew:menu-config-updated", syncMenu as EventListener);

    return () => {
      active = false;
      window.removeEventListener("renfrew:menu-config-updated", syncMenu as EventListener);
    };
  }, [currentScreen.path]);

  useEffect(() => {
    if (!favoriteNotice) return undefined;
    const timer = window.setTimeout(() => setFavoriteNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [favoriteNotice]);

  const toggleFavorite = async () => {
    if (!isGazeboLoaded) {
      return;
    }

    const previousSelection = gazeboSelection;
    const exists = previousSelection.some((item) => item.id === currentScreen.path);
    const nextSelection = exists
      ? previousSelection.filter((item) => item.id !== currentScreen.path)
      : previousSelection.length >= MAX_FAVORITES
        ? null
        : [...previousSelection, { id: currentScreen.path }];

    if (!nextSelection) {
      setFavoriteNotice("You can only have 8 items starred.");
      return;
    }

    setFavoriteNotice(null);
    setGazeboSelection(nextSelection);

    try {
      const savedSelection = await saveMenuSelection(GAZEBO_MENU_ID, nextSelection);
      setGazeboSelection(savedSelection.slice(0, MAX_FAVORITES));
    } catch {
      setGazeboSelection(previousSelection);
      setFavoriteNotice("Could not save the gazebo menu.");
    }
  };

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <WorklistBrandButton style={styles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </WorklistBrandButton>
          <button
            type="button"
            onClick={() => setIsRibbonOpen((current) => !current)}
            style={styles.brandWomenMark}
            aria-label={isRibbonOpen ? "Close gazebo menu" : "Open gazebo menu"}
            aria-expanded={isRibbonOpen}
            title={isRibbonOpen ? "Close gazebo menu" : "Open gazebo menu"}
          >
            <img src="/renfrew-gazebo.png" alt="" style={styles.brandWomenImage} />
          </button>
        </div>

        {backButtonFirst && (
          <nav style={styles.navStack} aria-label="Admin navigation">
            {priorityNavItems.map((item) => (
              <button
                key={item.label}
                className="sidebar-nav-button"
                style={{
                  ...styles.navButton,
                  ...(item.isBackStyle ? styles.navButtonBack : null),
                }}
                type="button"
                onClick={item.onClick}
              >
                <span style={styles.navButtonLabel}>{item.label}</span>
                <span
                  className="sidebar-nav-button__glyph"
                  style={{
                    ...styles.navButtonGlyph,
                    ...(item.isBackStyle ? styles.navButtonBackGlyph : null),
                  }}
                >
                  {item.glyph ?? ">"}
                </span>
              </button>
            ))}
          </nav>
        )}

        {sidebarCopy && <p style={styles.sidebarCopy}>{sidebarCopy}</p>}

        {sidebarTopCard && <div style={styles.sidebarTopCard}>{sidebarTopCard}</div>}

        {!backButtonFirst && (
          <nav style={styles.navStack} aria-label="Admin navigation">
            {priorityNavItems.map((item) => (
              <button
                key={item.label}
                className="sidebar-nav-button"
                style={{
                  ...styles.navButton,
                  ...(item.isBackStyle ? styles.navButtonBack : null),
                }}
                type="button"
                onClick={item.onClick}
              >
                <span style={styles.navButtonLabel}>{item.label}</span>
                <span
                  className="sidebar-nav-button__glyph"
                  style={{
                    ...styles.navButtonGlyph,
                    ...(item.isBackStyle ? styles.navButtonBackGlyph : null),
                  }}
                >
                  {item.glyph ?? ">"}
                </span>
              </button>
            ))}
          </nav>
        )}

        {sidebarMiddleCard && <div style={styles.sidebarCard}>{sidebarMiddleCard}</div>}

        {sidebarAction && <div style={styles.sidebarAction}>{sidebarAction}</div>}

        {ribbonItems && ribbonItems.length > 0 && (
          <div style={styles.sidebarRibbon}>
            {ribbonItems.map((item) => (
              <button key={item.title} type="button" onClick={item.onClick} style={styles.sidebarRibbonButton}>
                <div style={styles.sidebarRibbonTitle}>{item.title}</div>
                <div style={styles.sidebarRibbonMeta}>{item.meta}</div>
              </button>
            ))}
          </div>
        )}

        {remainingNavItems.length > 0 && (
          <nav style={styles.navStack} aria-label="Admin navigation more">
            {remainingNavItems.map((item) => (
              <button
                key={item.label}
                className="sidebar-nav-button"
                style={{
                  ...styles.navButton,
                  ...(item.isBackStyle ? styles.navButtonBack : null),
                }}
                type="button"
                onClick={item.onClick}
              >
                <span style={styles.navButtonLabel}>{item.label}</span>
                <span
                  className="sidebar-nav-button__glyph"
                  style={{
                    ...styles.navButtonGlyph,
                    ...(item.isBackStyle ? styles.navButtonBackGlyph : null),
                  }}
                >
                  {item.glyph ?? ">"}
                </span>
              </button>
            ))}
          </nav>
        )}

        {(sidebarCardLabel || sidebarCardValue || sidebarCardMeta) && (
          <div style={styles.sidebarCard}>
            {sidebarCardLabel && <div style={styles.sidebarCardLabel}>{sidebarCardLabel}</div>}
            {sidebarCardValue && (
              <div style={{ ...styles.sidebarCardValue, ...sidebarCardValueStyle }}>{sidebarCardValue}</div>
            )}
            {sidebarCardMeta && <div style={styles.sidebarCardMeta}>{sidebarCardMeta}</div>}
          </div>
        )}
        <div style={styles.sidebarFooter}>
          <button
            type="button"
            onClick={toggleFavorite}
            style={{
              ...styles.favoriteToggle,
              ...(isFavorite ? styles.favoriteToggleActive : null),
            }}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            disabled={!isGazeboLoaded}
          >
            <span style={{ ...styles.favoriteGlyph, ...(isFavorite ? styles.favoriteGlyphActive : null) }}>
              {isFavorite ? String.fromCharCode(9733) : String.fromCharCode(9734)}
            </span>
          </button>

          {favoriteNotice && <div style={styles.favoriteNotice}>{favoriteNotice}</div>}
        </div>
      </aside>

      <section
        style={{
          ...styles.ribbonShell,
          ...(isRibbonOpen ? styles.ribbonShellOpen : styles.ribbonShellClosed),
        }}
        aria-hidden={!isRibbonOpen}
      >
        <div style={styles.ribbonHeader}>
          <div>
            <div style={styles.ribbonKicker}>{ribbonTitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsRibbonOpen(false)}
            style={styles.ribbonCloseButton}
            aria-label="Close gazebo menu"
          >
            X
          </button>
        </div>

        <div style={styles.ribbonBody}>
          {favoriteScreens.length > 0 ? (
            favoriteScreens.map((item, index) => (
              <button
                key={item.path}
                type="button"
                style={{
                  ...styles.ribbonButton,
                  ...RIBBON_PASTELS[index % RIBBON_PASTELS.length],
                }}
                onClick={() => navigate(item.path)}
              >
                <div style={styles.ribbonButtonTitle}>{item.label}</div>
                <div style={styles.ribbonButtonMeta}>{item.meta}</div>
              </button>
            ))
          ) : (
            <div style={styles.ribbonEmptyState}>Star up to 8 screens to pin them here.</div>
          )}
        </div>
      </section>

      <section style={styles.content}>{children}</section>
    </main>
  );
}

export const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "16px 16px 16px 282px",
    display: "block",
    position: "relative",
    overflow: "visible",
    color: "#16304d",
  },
  glowBlue: {
    position: "absolute",
    top: "-120px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.45) 0%, rgba(146, 198, 255, 0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowPink: {
    position: "absolute",
    right: "-100px",
    top: "110px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.42) 0%, rgba(255, 186, 213, 0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  sidebar: {
    position: "fixed",
    top: "16px",
    left: "16px",
    width: "248px",
    height: "calc(100vh - 32px)",
    zIndex: 3,
    padding: "16px 14px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.76)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-start",
    paddingBottom: "12px",
    marginBottom: "14px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 12px 22px rgba(95, 128, 172, 0.08)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandMarkImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    objectPosition: "center",
  },
  brandWomenMark: {
    width: "116px",
    height: "60px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    padding: "4px",
    flexShrink: 0,
    cursor: "pointer",
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
  },
  sidebarCopy: {
    margin: "0 0 14px",
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#516579",
  },
  sidebarTopCard: {
    marginBottom: "12px",
    marginTop: "0",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarAction: {
    marginBottom: "12px",
  },
  sidebarRibbon: {
    display: "grid",
    gap: "10px",
    marginBottom: "12px",
  },
  sidebarRibbonButton: {
    width: "100%",
    textAlign: "left",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(245,248,252,0.95) 100%)",
    padding: "14px",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "4px",
  },
  sidebarRibbonTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  sidebarRibbonMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
  sidebarFooter: {
    marginTop: "auto",
    display: "grid",
    gap: "8px",
    paddingTop: "12px",
  },
  favoriteToggle: {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    border: "0",
    background: "transparent",
    color: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "none",
  },
  favoriteGlyph: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
    color: "#6d7f93",
    flexShrink: 0,
  },
  favoriteGlyphActive: {
    color: "#6d7f93",
  },
  favoriteNotice: {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "12px",
    border: "1px solid rgba(216, 182, 92, 0.24)",
    background: "rgba(255, 248, 227, 0.96)",
    color: "#8b6a1a",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  navStack: {
    display: "grid",
    gap: "10px",
  },
  navButton: {
    height: "46px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#16304d",
    textAlign: "left",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.01em",
  },
  navButtonBack: {
    background:
      "linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(222,233,244,0.96) 56%, rgba(200,214,231,0.96) 100%)",
    border: "1px solid rgba(126, 146, 170, 0.24)",
    color: "#27415d",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.10)",
  },
  navButtonLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  navButtonBackGlyph: {
    background: "rgba(255,255,255,0.74)",
    color: "#5f7fa2",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
  },
  sidebarCard: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarCardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardValue: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardMeta: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5d7187",
  },
  ribbonShell: {
    position: "fixed",
    top: "18px",
    left: "286px",
    width: "min(520px, calc(100vw - 304px))",
    height: "92px",
    zIndex: 2,
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(246, 250, 255, 0.98) 0%, rgba(255, 244, 248, 0.97) 100%)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 28px 64px rgba(52, 84, 120, 0.14)",
    display: "flex",
    flexDirection: "column",
    padding: "12px 12px 14px",
    gap: "8px",
    transformOrigin: "left center",
    transition: "transform 320ms ease, opacity 240ms ease",
    overflow: "hidden",
  },
  ribbonShellOpen: {
    transform: "translateX(0)",
    opacity: 1,
    pointerEvents: "auto",
  },
  ribbonShellClosed: {
    transform: "translateX(-102%)",
    opacity: 0,
    pointerEvents: "none",
  },
  ribbonHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  ribbonKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: 0,
  },
  ribbonCloseButton: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.94)",
    color: "#315b88",
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  ribbonBody: {
    display: "flex",
    flexWrap: "nowrap",
    gap: "10px",
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "2px",
  },
  ribbonButton: {
    minHeight: "54px",
    minWidth: "132px",
    borderRadius: "999px",
    border: "1px solid rgba(168, 182, 204, 0.18)",
    padding: "12px 14px",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "2px",
    alignContent: "center",
    justifyItems: "center",
  },
  ribbonButtonTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
    textAlign: "center",
  },
  ribbonButtonMeta: {
    fontSize: "10px",
    lineHeight: 1.35,
    color: "#65788e",
    textAlign: "center",
  },
  ribbonEmptyState: {
    borderRadius: "999px",
    border: "1px dashed rgba(171, 186, 207, 0.55)",
    background: "rgba(255,255,255,0.72)",
    color: "#597085",
    padding: "12px 14px",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
};





