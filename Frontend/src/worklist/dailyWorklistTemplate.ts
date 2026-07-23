export type DailyWorklistActionType = "none" | "url" | "copy" | "copy_details";

export type DailyWorklistTemplateItem = {
  id: string;
  title: string;
  details: string;
  category: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  actionType: DailyWorklistActionType;
  actionLabel: string;
  actionValue: string;
};

const WORKLIST_CATEGORY = "worklist";

function makeId(title: string) {
  return `daily-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || Date.now()}`;
}

function normalizeRecurrence(_value: unknown): DailyWorklistTemplateItem["recurrence"] {
  return "none";
}

function normalizeActionType(value: unknown): DailyWorklistActionType {
  return value === "url" || value === "copy" || value === "copy_details" ? value : "none";
}

const LEGACY_DAILY_WORKLIST_TEMPLATE_KEY = "renfrew:daily-worklist-template";

export function normalizeDailyWorklistItem(item: Partial<DailyWorklistTemplateItem>): DailyWorklistTemplateItem {
  const title = String(item.title || "").trim();
  const details = String(item.details || "").trim();
  const actionType = normalizeActionType(item.actionType);
  const actionValue = String(item.actionValue || "").trim();
  const actionLabel =
    String(item.actionLabel || "").trim() ||
    (actionType === "copy_details" ? "Copy details" : actionType === "copy" ? "Copy" : actionType === "url" ? "Open" : "");

  return {
    id: String(item.id || makeId(title)),
    title,
    details,
    category: WORKLIST_CATEGORY,
    recurrence: normalizeRecurrence(item.recurrence),
    actionType,
    actionLabel,
    actionValue,
  };
}

export function loadLegacyDailyWorklistTemplate() {
  if (typeof window === "undefined") {
    return [] as DailyWorklistTemplateItem[];
  }

  const saved = window.localStorage.getItem(LEGACY_DAILY_WORKLIST_TEMPLATE_KEY);
  if (!saved) {
    return [] as DailyWorklistTemplateItem[];
  }

  try {
    const parsed = JSON.parse(saved) as Partial<DailyWorklistTemplateItem>[];
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeDailyWorklistItem(item)).filter((item) => item.title.length > 0)
      : [];
  } catch {
    return [];
  }
}

export const DEFAULT_DAILY_WORKLIST_TEMPLATE: DailyWorklistTemplateItem[] = [
  {
    id: "workflow-root",
    title: "Workflow root",
    details: "C:\\Renfrew\\Workflow",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow",
  },
  {
    id: "copy-nd-folder",
    title: "Copy ND Folder",
    details: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
  },
  {
    id: "balsheet-view",
    title: "Balance Sheet View",
    details: "http://localhost:5173/balsheet/view",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "url",
    actionLabel: "Open view",
    actionValue: "http://localhost:5173/balsheet/view",
  },
  {
    id: "import-bank",
    title: "Import Bank",
    details: "Open the banking import flow.",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "tools",
    title: "Tools",
    details: "http://localhost:5173/tools",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "url",
    actionLabel: "Open tools",
    actionValue: "http://localhost:5173/tools",
  },
  {
    id: "convert-era",
    title: "Convert ERA",
    details: "Run the ERA conversion pass.",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "convert-html",
    title: "Convert HTML",
    details: "Run the HTML conversion pass.",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "duplicate-check",
    title: "Duplicate Check",
    details: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
  },
  {
    id: "other-days-check",
    title: "Other-days Check",
    details: "Review work across other days.",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "sftp-login",
    title: "SFTP Login",
    details: "https://sftpcloud.netsmartcloud.com/WebInterface/login.html",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "url",
    actionLabel: "Open login",
    actionValue: "https://sftpcloud.netsmartcloud.com/WebInterface/login.html",
  },
  {
    id: "835-live",
    title: "835 Live",
    details: "Live 835 processing step.",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "archive-old",
    title: "Archive Old",
    details: "C:\\Renfrew\\Workflow\\2.ERA\\Renamed",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow\\2.ERA\\Renamed",
  },
  {
    id: "netsmart-home",
    title: "NetSmart Home",
    details: "https://renfrewnx.netsmartcloud.com/#/home",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "url",
    actionLabel: "Open home",
    actionValue: "https://renfrewnx.netsmartcloud.com/#/home",
  },
  {
    id: "open-form",
    title: "Open Form",
    details: "835 Health Care Claim Payment/Advice",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "load",
    title: "Load",
    details: "#show posting date in format mm.dd.yy-#",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "compile-835",
    title: "Compile 835",
    details: "(PR)",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "post-835",
    title: "Post 835",
    details: "#show posting date in format mm/dd/yy#",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "verify-eob",
    title: "Verify EOB",
    details: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
  },
  {
    id: "verify-total-amount-paid",
    title: "Verify Total Amount Paid",
    details: "",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "verify-no-group-pmts",
    title: "Verify No Group Pmts",
    details: "Update Totals Tab",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "download-eobs-eft",
    title: "Download EOBs - EFT",
    details: "",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "download-eobs-wf",
    title: "Download EOBs - WF",
    details: "",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "download-site-deposits",
    title: "Download Site Deposits",
    details: "",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  },
  {
    id: "prepare-nd-folder",
    title: "Prepare ND Folder",
    details: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "copy",
    actionLabel: "Copy path",
    actionValue: "C:\\Renfrew\\Workflow\\3.HTML\\Renamed",
  },
  {
    id: "calendar",
    title: "Calendar",
    details: "Advance Post Day",
    category: WORKLIST_CATEGORY,
    recurrence: "daily",
    actionType: "url",
    actionLabel: "Open calendar",
    actionValue: "http://localhost:5173/calendar",
  },
];
