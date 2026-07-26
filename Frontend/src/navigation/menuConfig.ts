export type MenuOption = {
  id: string;
  label: string;
  meta: string;
  path?: string;
  kind?: "back" | "screen";
};

export type MenuSelectionEntry = {
  id: string;
  back?: boolean;
  darken?: boolean;
};

export type ResolvedMenuSelection = {
  id: string;
  label: string;
  isBackAction: boolean;
  isBackStyle: boolean;
  path: string | null;
};

export const MENU_CONFIG_STORAGE_KEY = "renfrew:menu-config";
export const GLOBAL_MENU_ID = "__global__";
export const ADMIN_MENU_ID = GLOBAL_MENU_ID;
export const FIXED_MENU_ID = "__menu__";
export const BACK_MENU_ID = "__back__";
export const MENU_BUTTON_OPTION: MenuOption = {
  id: FIXED_MENU_ID,
  label: "Menu",
  meta: "Open the menu builder.",
  kind: "screen",
  path: "/admin/menus",
};

export const ALL_MENU_OPTIONS: MenuOption[] = [
  { id: BACK_MENU_ID, label: "Previous", meta: "Return to the previous screen.", kind: "back", path: "/" },
  { id: "/", label: "Main", meta: "Main workspace.", kind: "screen", path: "/" },
  { id: "/admin", label: "Admin", meta: "Admin console.", kind: "screen", path: "/admin" },
  { id: "/admin/tables", label: "Tables", meta: "Database browser.", kind: "screen", path: "/admin/tables" },
  { id: "/admin/users", label: "Users", meta: "Access control.", kind: "screen", path: "/admin/users" },
  { id: "/admin/menus", label: "Menu Builder", meta: "Define sidebar navigation.", kind: "screen", path: "/admin/menus" },
  { id: "/calendar", label: "Calendar", meta: "Posting day manager.", kind: "screen", path: "/calendar" },
  { id: "/cash", label: "Cash", meta: "Cash workspace.", kind: "screen", path: "/cash" },
  { id: "/collections", label: "Collections", meta: "Collections workspace.", kind: "screen", path: "/collections" },
  { id: "/era-convert", label: "ERA Convert", meta: "ERA workflow.", kind: "screen", path: "/era-convert" },
  { id: "/html-convert", label: "HTML Convert", meta: "HTML workflow.", kind: "screen", path: "/html-convert" },
  { id: "/otherday", label: "Other Day Check", meta: "Missing rows.", kind: "screen", path: "/otherday" },
  { id: "/duplicatecheck", label: "Duplicate Check", meta: "Duplicate scan.", kind: "screen", path: "/duplicatecheck" },
  { id: "/tools", label: "Tools", meta: "Utility hub.", kind: "screen", path: "/tools" },
  { id: "/import", label: "Import", meta: "Inbound files.", kind: "screen", path: "/import" },
  { id: "/eft-upload", label: "EFT Upload", meta: "EFT upload.", kind: "screen", path: "/eft-upload" },
  { id: "/835-upload", label: "835 Upload", meta: "835 upload.", kind: "screen", path: "/835-upload" },
  { id: "/lockbox-import", label: "Lockbox Import", meta: "Lockbox import.", kind: "screen", path: "/lockbox-import" },
  { id: "/banking", label: "Banking", meta: "Bank-side review.", kind: "screen", path: "/banking" },
  { id: "/835-match", label: "835 Match", meta: "Match review.", kind: "screen", path: "/835-match" },
  { id: "/site-review", label: "Site Review", meta: "Site review.", kind: "screen", path: "/site-review" },
  { id: "/email-downloader", label: "Email Downloader", meta: "Email review.", kind: "screen", path: "/email-downloader" },
  { id: "/snapshot-generator", label: "Snapshot Generator", meta: "Snapshot review.", kind: "screen", path: "/snapshot-generator" },
  { id: "/approved", label: "Approved", meta: "Approved items.", kind: "screen", path: "/approved" },
  { id: "/worklist-editor", label: "Daily Worklist", meta: "Worklist editor.", kind: "screen", path: "/worklist-editor" },
  { id: "/attachments", label: "Pending", meta: "Pending queue.", kind: "screen", path: "/attachments" },
  { id: "/balancecheck", label: "Balance Check", meta: "Balance review.", kind: "screen", path: "/balancecheck" },
  { id: "/balsheet", label: "Balance Sheet", meta: "Balance sheet.", kind: "screen", path: "/balsheet" },
  { id: "/completionlabel", label: "Completion Label", meta: "Completion label.", kind: "screen", path: "/completionlabel" },
  { id: "/keyproof", label: "Keyproof", meta: "Keyproof review.", kind: "screen", path: "/keyproof" },
  { id: "/itemization", label: "Itemization", meta: "Itemization.", kind: "screen", path: "/itemization" },
  { id: "/nextloader", label: "Next Loader", meta: "Next item loader.", kind: "screen", path: "/nextloader" },
  { id: "/site", label: "Site", meta: "Site workspace.", kind: "screen", path: "/site" },
  { id: "/statements", label: "Statements", meta: "Statements.", kind: "screen", path: "/statements" },
  { id: "/request", label: "Request", meta: "Request queue.", kind: "screen", path: "/request" },
  { id: "/research", label: "Research", meta: "Research tools.", kind: "screen", path: "/research" },
  { id: "/finance", label: "Finance", meta: "Finance tools.", kind: "screen", path: "/finance" },
  { id: "/business", label: "Business", meta: "Business tools.", kind: "screen", path: "/business" },
  { id: "/queue", label: "Queue", meta: "Queue view.", kind: "screen", path: "/queue" },
  { id: "/rejectlist", label: "Reject List", meta: "Reject list.", kind: "screen", path: "/rejectlist" },
  { id: "/sites", label: "Sites", meta: "Sites browser.", kind: "screen", path: "/sites" },
];

type StoredMenuSelectionEntry = {
  id: string;
  mode?: "regular" | "back" | "darken";
  back?: boolean;
  darken?: boolean;
};

type MenuConfig = Record<string, Array<string | StoredMenuSelectionEntry>>;

const DEFAULT_MENU_SELECTIONS: Record<string, string[]> = {
};

function loadConfig(): MenuConfig {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(MENU_CONFIG_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
        if (!Array.isArray(value)) {
          return [key, []];
        }

        const entries = value.filter(
          (item): item is string | StoredMenuSelectionEntry =>
            typeof item === "string" || (Boolean(item) && typeof item === "object" && typeof (item as StoredMenuSelectionEntry).id === "string")
        );

        return [key, entries];
      })
    );
  } catch {
    return {};
  }
}

function saveConfig(config: MenuConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MENU_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function normalizeSelectionEntry(value: string | MenuSelectionEntry | StoredMenuSelectionEntry): MenuSelectionEntry | null {
  if (typeof value === "string") {
    return { id: value };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value.id !== "string") {
    return null;
  }

  const storedValue = value as StoredMenuSelectionEntry;
  const back = value.back === true || storedValue.mode === "back";
  const darken = value.darken === true || storedValue.mode === "darken";

  const entry: MenuSelectionEntry = { id: value.id };
  if (back) {
    entry.back = true;
  }
  if (darken) {
    entry.darken = true;
  }
  return entry;
}

export function loadMenuSelection(menuId: string, fallback: Array<string | MenuSelectionEntry> = []) {
  const config = loadConfig();
  const saved = config[menuId];
  const rawSelection = saved && saved.length > 0 ? saved : fallback;
  const normalized = rawSelection
    .map(normalizeSelectionEntry)
    .filter((item): item is MenuSelectionEntry => Boolean(item));

  return normalized.filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
}

export function getDefaultMenuSelection(menuId: string) {
  return DEFAULT_MENU_SELECTIONS[menuId] ?? [];
}

export function saveMenuSelection(menuId: string, selection: MenuSelectionEntry[]) {
  const config = loadConfig();
  config[menuId] = selection
    .map(normalizeSelectionEntry)
    .filter((item): item is MenuSelectionEntry => Boolean(item))
    .filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
  saveConfig(config);
  window.dispatchEvent(new Event("renfrew:menu-config-updated"));
}

export function clearAllMenuSelections() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(MENU_CONFIG_STORAGE_KEY);
  window.dispatchEvent(new Event("renfrew:menu-config-updated"));
}

export function getMenuOption(optionId: string) {
  return ALL_MENU_OPTIONS.find((item) => item.id === optionId);
}

export function resolveMenuSelection(optionId: string, entry?: MenuSelectionEntry): ResolvedMenuSelection | null {
  const option = getMenuOption(optionId);
  if (!option || option.id === FIXED_MENU_ID) {
    return null;
  }

  const isBackAction = option.id === BACK_MENU_ID;
  const isBackStyle = isBackAction || entry?.back === true || entry?.darken === true;

  return {
    id: option.id,
    label: isBackAction ? "Previous" : entry?.back === true ? "Back" : option.label,
    isBackAction,
    isBackStyle,
    path: isBackAction ? null : option.path ?? "/",
  };
}
