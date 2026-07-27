import axios from "axios";
import type { AppConfig } from "../config/appConfig";
import { API_BASE } from "../config/apiBase";

export type MenuOption = {
  id: string;
  label: string;
  meta: string;
  path?: string;
  kind?: "back" | "screen" | "menu";
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
export const GAZEBO_MENU_ID = "gazebo";
export const MENU_BUTTON_OPTION: MenuOption = {
  id: FIXED_MENU_ID,
  label: "Menu",
  meta: "Open the menu builder.",
  kind: "screen",
  path: "/admin/menus",
};

export const GAZEBO_MENU_OPTION: MenuOption = {
  id: GAZEBO_MENU_ID,
  label: "Gazebo",
  meta: "Pinned screens for the gazebo ribbon.",
  kind: "menu",
};

export const ALL_MENU_OPTIONS: MenuOption[] = [
  { id: BACK_MENU_ID, label: "Previous", meta: "Return to the previous screen.", kind: "back", path: "/" },
  GAZEBO_MENU_OPTION,
  { id: "/", label: "Main", meta: "Main workspace.", kind: "screen", path: "/" },
  { id: "/admin", label: "Admin", meta: "Admin console.", kind: "screen", path: "/admin" },
  { id: "/admin/config", label: "Config", meta: "App config editor.", kind: "screen", path: "/admin/config" },
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
  { id: "/worklist-editor", label: "Daily Worklist", meta: "Worklist editor.", kind: "screen", path: "/worklist-editor" },
  { id: "/attachments", label: "Pending", meta: "Pending queue.", kind: "screen", path: "/attachments" },
  { id: "/balancecheck", label: "Balance Check", meta: "Balance review.", kind: "screen", path: "/balancecheck" },
  { id: "/balsheet", label: "Balance Sheet", meta: "Balance sheet.", kind: "screen", path: "/balsheet" },
  { id: "/keyproof", label: "Keyproof", meta: "Keyproof review.", kind: "screen", path: "/keyproof" },
  { id: "/itemization", label: "Itemization", meta: "Itemization.", kind: "screen", path: "/itemization" },
  { id: "/batches", label: "Batches", meta: "Batch workspace.", kind: "screen", path: "/batches" },
  { id: "/statements", label: "Statements", meta: "Statements.", kind: "screen", path: "/statements" },
  { id: "/request", label: "Request", meta: "Request queue.", kind: "screen", path: "/request" },
  { id: "/research", label: "Research", meta: "Research tools.", kind: "screen", path: "/research" },
  { id: "/finance", label: "Finance", meta: "Finance tools.", kind: "screen", path: "/finance" },
  { id: "/business", label: "Business", meta: "Business tools.", kind: "screen", path: "/business" },
  { id: "/sites", label: "Sites", meta: "Sites browser.", kind: "screen", path: "/sites" },
];

function getLabelOverrides(config?: AppConfig) {
  return {
    attachments: config?.ui?.navigation?.attachments?.label ?? "Pending",
    batches: config?.ui?.navigation?.batches?.label ?? "Batches",
    siteReview: config?.ui?.navigation?.site_review?.label ?? "Site Review",
    attachmentsMeta: config?.ui?.navigation?.attachments?.meta ?? "Pending queue",
    batchesMeta: config?.ui?.navigation?.batches?.meta ?? "Batch workspace",
    siteReviewMeta: config?.ui?.navigation?.site_review?.meta ?? "Site review",
  };
}

export function getMenuOptions(config?: AppConfig) {
  const labels = getLabelOverrides(config);
  return ALL_MENU_OPTIONS.map((option) => {
    if (option.id === "/attachments") {
      return { ...option, label: labels.attachments, meta: labels.attachmentsMeta };
    }
    if (option.id === "/batches") {
      return { ...option, label: labels.batches, meta: labels.batchesMeta };
    }
    if (option.id === "/site-review") {
      return { ...option, label: labels.siteReview, meta: labels.siteReviewMeta };
    }
    return option;
  });
}

export type MenuRow = {
  id: number;
  menu_key: string;
  item_id: string;
  position: number;
  back?: boolean | number;
  darken?: boolean | number;
  enabled?: boolean | number;
  created_at?: string;
  updated_at?: string;
};

function normalizeSelectionEntry(value: Partial<MenuSelectionEntry> & { id?: string }): MenuSelectionEntry | null {
  if (typeof value.id !== "string") {
    return null;
  }

  const entry: MenuSelectionEntry = { id: value.id };
  if (value.back === true) {
    entry.back = true;
  }
  if (value.darken === true) {
    entry.darken = true;
  }
  return entry;
}

function normalizeSelectionEntries(values: Array<Partial<MenuSelectionEntry> & { id?: string }> = []) {
  return values
    .map(normalizeSelectionEntry)
    .filter((item): item is MenuSelectionEntry => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
}

function rowToSelectionEntry(row: MenuRow) {
  if (row.enabled === false || row.enabled === 0) {
    return null;
  }

  return normalizeSelectionEntry({
    id: row.item_id,
    back: row.back === true || row.back === 1,
    darken: row.darken === true || row.darken === 1,
  });
}

function selectionToPayload(selection: MenuSelectionEntry[]) {
  return selection.map((entry) => ({
    id: entry.id,
    back: entry.back === true,
    darken: entry.darken === true,
    enabled: true,
  }));
}

export async function loadMenuSelection(menuId: string) {
  const response = await axios.get<MenuRow[]>(`${API_BASE}/menu/${encodeURIComponent(menuId)}`);
  return normalizeSelectionEntries(response.data.map((row) => rowToSelectionEntry(row)).filter(Boolean) as MenuSelectionEntry[]);
}

export async function loadAllMenuSelections() {
  const response = await axios.get<MenuRow[]>(`${API_BASE}/menu`);
  return response.data.reduce<Record<string, MenuSelectionEntry[]>>((accumulator, row) => {
    const selection = rowToSelectionEntry(row);
    if (!selection) {
      return accumulator;
    }

    const bucket = accumulator[row.menu_key] ?? [];
    if (!bucket.some((item) => item.id === selection.id)) {
      bucket.push(selection);
    }
    accumulator[row.menu_key] = bucket;
    return accumulator;
  }, {});
}

export async function saveMenuSelection(menuId: string, selection: MenuSelectionEntry[]) {
  const response = await axios.put<MenuRow[]>(`${API_BASE}/menu/${encodeURIComponent(menuId)}`, {
    selection: selectionToPayload(selection),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("renfrew:menu-config-updated"));
  }
  return normalizeSelectionEntries(response.data.map((row) => rowToSelectionEntry(row)).filter(Boolean) as MenuSelectionEntry[]);
}

export async function clearMenuSelection(menuId: string) {
  await axios.delete(`${API_BASE}/menu/${encodeURIComponent(menuId)}`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("renfrew:menu-config-updated"));
  }
}

export async function clearAllMenuSelections() {
  await axios.delete(`${API_BASE}/menu`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("renfrew:menu-config-updated"));
  }
}

export function getMenuOption(optionId: string, config?: AppConfig) {
  return getMenuOptions(config).find((item) => item.id === optionId);
}

export function resolveMenuSelection(optionId: string, entry?: MenuSelectionEntry, config?: AppConfig): ResolvedMenuSelection | null {
  const option = getMenuOption(optionId, config);
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
