import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  GLOBAL_MENU_ID,
  getDefaultMenuSelection,
  loadMenuSelection,
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

const FAVORITES_STORAGE_KEY = "gazebo:favorites";
const MAX_FAVORITES = 8;

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
  "/approved": { path: "/approved", label: "Approved", meta: "Approved items" },
  "/worklist-editor": { path: "/worklist-editor", label: "Daily Worklist", meta: "Worklist editor" },
  "/attachments": { path: "/attachments", label: "Pending", meta: "Pending queue" },
  "/balancecheck": { path: "/balancecheck", label: "Balance Check", meta: "Balance review" },
  "/balsheet": { path: "/balsheet", label: "Balance Sheet", meta: "Balance sheet" },
  "/balsheet/view": { path: "/balsheet/view", label: "Balance Sheet", meta: "Balance sheet" },
  "/completionlabel": { path: "/completionlabel", label: "Completion Label", meta: "Completion label" },
  "/keyproof": { path: "/keyproof", label: "Keyproof", meta: "Keyproof review" },
  "/itemization": { path: "/itemization", label: "Itemization", meta: "Itemization" },
  "/nextloader": { path: "/nextloader", label: "Next Loader", meta: "Next item loader" },
  "/site": { path: "/site", label: "Site", meta: "Site workspace" },
  "/statements": { path: "/statements", label: "Statements", meta: "Statements" },
  "/request": { path: "/request", label: "Request", meta: "Request queue" },
  "/research": { path: "/research", label: "Research", meta: "Research tools" },
  "/finance": { path: "/finance", label: "Finance", meta: "Finance tools" },
  "/business": { path: "/business", label: "Business", meta: "Business tools" },
  "/queue": { path: "/queue", label: "Queue", meta: "Queue view" },
  "/rejectlist": { path: "/rejectlist", label: "Reject List", meta: "Reject list" },
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

function resolveScreen(pathname: string): FavoriteScreen {
  const normalized = normalizePath(pathname);
  return (
    SCREEN_REGISTRY[normalized] ?? {
      path: normalized,
      label: formatScreenLabel(normalized),
      meta: "Saved screen",
    }
  );
}

function loadFavoritePaths() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizePath(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function AdminShell({
  children,
  sidebarCopy,
  sidebarTopCard,
  sidebarMiddleCard,
  sidebarAction,
  sidebarCardLabel,
  sidebarCardValue,
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
  void backButtonFirst;
  const location = useLocation();
  const navigate = useNavigate();
  const currentScreen = useMemo(() => resolveScreen(location.pathname), [location.pathname]);
  const currentScreenDefaults = useMemo(() => getDefaultMenuSelection(currentScreen.path), [currentScreen.path]);
  const [isRibbonOpen, setIsRibbonOpen] = useState(false);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const [favoritePaths, setFavoritePaths] = useState<string[]>(() => loadFavoritePaths());
  const [menuSelection, setMenuSelection] = useState<MenuSelectionEntry[]>(() =>
    loadMenuSelection(
      currentScreen.path,
      useGlobalMenuFallback ? loadMenuSelection(GLOBAL_MENU_ID, currentScreenDefaults) : currentScreenDefaults
    )
  );
  const isFavorite = favoritePaths.includes(currentScreen.path);
  const favoriteScreens = useMemo(
    () => favoritePaths.map((path) => resolveScreen(path)).slice(0, MAX_FAVORITES),
    [favoritePaths]
  );
  const navItems = useMemo(
    () => {
      const resolvedItems = menuSelection
        .map((entry) => {
          const resolved = resolveMenuSelection(entry.id, entry);
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
    [hideSidebarBackMenu, hideSidebarBackStyles, menuSelection, navigate]
  );
  const priorityNavItems = navItems.slice(0, 2);
  const remainingNavItems = navItems.slice(2);
  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritePaths));
  }, [favoritePaths]);

  useEffect(() => {
    const syncMenu = () =>
      setMenuSelection(
        loadMenuSelection(
          currentScreen.path,
          useGlobalMenuFallback ? loadMenuSelection(GLOBAL_MENU_ID, currentScreenDefaults) : currentScreenDefaults
        )
      );
    syncMenu();
    window.addEventListener("renfrew:menu-config-updated", syncMenu as EventListener);
    window.addEventListener("storage", syncMenu);

    return () => {
      window.removeEventListener("renfrew:menu-config-updated", syncMenu as EventListener);
      window.removeEventListener("storage", syncMenu);
    };
  }, [currentScreen.path, currentScreenDefaults, useGlobalMenuFallback]);

  useEffect(() => {
    if (!favoriteNotice) return undefined;
    const timer = window.setTimeout(() => setFavoriteNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [favoriteNotice]);

  const toggleFavorite = () => {
    setFavoritePaths((current) => {
      const exists = current.includes(currentScreen.path);
      if (exists) {
        return current.filter((path) => path !== currentScreen.path);
      }

      if (current.length >= MAX_FAVORITES) {
        setFavoriteNotice("You can only have 8 items starred.");
        return current;
      }

      setFavoriteNotice(null);
      return [...current, currentScreen.path];
    });
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

        {sidebarCopy && <p style={styles.sidebarCopy}>{sidebarCopy}</p>}

        {sidebarTopCard && <div style={styles.sidebarTopCard}>{sidebarTopCard}</div>}

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

        {sidebarMiddleCard && <div style={styles.sidebarCard}>{sidebarMiddleCard}</div>}

        {sidebarAction && <div style={styles.sidebarAction}>{sidebarAction}</div>}

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
            {sidebarCardValue && <div style={styles.sidebarCardValue}>{sidebarCardValue}</div>}
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





