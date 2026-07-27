import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppConfig } from "../config/appConfig";
import { AdminShell } from "../components/AdminShell";
import {
  GAZEBO_MENU_OPTION,
  clearAllMenuSelections,
  getMenuOption,
  getMenuOptions,
  loadAllMenuSelections,
  saveMenuSelection,
  type MenuSelectionEntry,
} from "../navigation/menuConfig";
import { styles as adminStyles } from "./adminscreen";

function compareMenuLabels(left: string, right: string) {
  const priority = (value: string) => {
    if (value === "Back") return 0;
    if (value === "Previous") return 1;
    return 2;
  };

  const priorityDiff = priority(left) - priority(right);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return left.localeCompare(right);
}

function createSelectionEntry(optionId: string, current?: MenuSelectionEntry) {
  return {
    id: optionId,
    ...(current?.back ? { back: true } : {}),
    ...(current?.darken ? { darken: true } : {}),
  };
}

export default function AdminMenuScreen() {
  const navigate = useNavigate();
  const appConfig = useAppConfig();
  const [menuId, setMenuId] = useState<string>("/admin");
  const [selectedEntries, setSelectedEntries] = useState<MenuSelectionEntry[]>([]);
  const [menuSelections, setMenuSelections] = useState<Record<string, MenuSelectionEntry[]>>({});
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const menuOptions = useMemo(() => getMenuOptions(appConfig ?? undefined), [appConfig]);
  const menuTargets = useMemo(
    () => [GAZEBO_MENU_OPTION, ...menuOptions.filter((option) => option.kind === "screen")].sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
    [menuOptions]
  );
  const menuChoiceOptions = useMemo(
    () => menuOptions.filter((option) => option.kind !== "menu").sort((left, right) => left.label.localeCompare(right.label)),
    [menuOptions]
  );

  useEffect(() => {
    let active = true;

    const loadMenus = async () => {
      setLoadingMenus(true);
      try {
        const nextMenuSelections = await loadAllMenuSelections();
        if (!active) {
          return;
        }

        setMenuSelections(nextMenuSelections);
        setSelectedEntries(nextMenuSelections[menuId] ?? []);
        setIsDirty(false);
      } finally {
        if (active) {
          setLoadingMenus(false);
        }
      }
    };

    void loadMenus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedEntries(menuSelections[menuId] ?? []);
    setIsDirty(false);
  }, [menuId, menuSelections]);

  const selectedOptions = useMemo(
    () =>
      selectedEntries
        .map((entry) => ({ entry, option: getMenuOption(entry.id, appConfig ?? undefined) }))
        .filter(
          (item): item is { entry: MenuSelectionEntry; option: NonNullable<ReturnType<typeof getMenuOption>> } =>
            Boolean(item.option)
        ),
    [appConfig, selectedEntries]
  );

  const selectedMenu = getMenuOption(menuId, appConfig ?? undefined);
  const menuTargetSummaries = useMemo(
    () =>
      menuTargets.map((option) => {
        const effectiveSelection = menuSelections[option.id] ?? [];
        const labels = effectiveSelection
          .map((entry) => getMenuOption(entry.id, appConfig ?? undefined))
          .filter((item): item is NonNullable<ReturnType<typeof getMenuOption>> => Boolean(item))
          .map((item) => item.label);

        return {
          option,
          labels,
        };
      }),
    [appConfig, menuSelections, menuTargets]
  );

  const toggleOption = (optionId: string) => {
    setSelectedEntries((current) => {
      const exists = current.some((item) => item.id === optionId);
      const next = exists ? current.filter((item) => item.id !== optionId) : [...current, { id: optionId }];
      setIsDirty(true);
      return next;
    });
  };

  const setRegular = (optionId: string) => {
    setSelectedEntries((current) => current.map((item) => (item.id === optionId ? { id: item.id } : item)));
    setIsDirty(true);
  };

  const toggleDarken = (optionId: string) => {
    setSelectedEntries((current) =>
      current.map((item) => {
        if (item.id !== optionId) return item;
        const next = createSelectionEntry(item.id, item);
        if (next.darken) delete next.darken;
        else next.darken = true;
        return next;
      })
    );
    setIsDirty(true);
  };

  const toggleBack = (optionId: string) => {
    setSelectedEntries((current) =>
      current.map((item) => {
        if (item.id !== optionId) return item;
        const next = createSelectionEntry(item.id, item);
        if (next.back) delete next.back;
        else next.back = true;
        return next;
      })
    );
    setIsDirty(true);
  };

  const clearMenu = () => {
    setSelectedEntries([]);
    setIsDirty(true);
  };

  const clearEverything = async () => {
    await clearAllMenuSelections();
    setMenuSelections({});
    setSelectedEntries([]);
    setIsDirty(false);
  };

  const applyChanges = async () => {
    const savedSelection = await saveMenuSelection(menuId, selectedEntries);
    setMenuSelections((current) => ({ ...current, [menuId]: savedSelection }));
    setSelectedEntries(savedSelection);
    setIsDirty(false);
  };

  return (
    <AdminShell
      sidebarCopy="Set the sidebar menu for the screen you are editing. This reads and writes the shared database menu."
      onBack={() => navigate("/admin")}
      hideBackButton
    >
      <section style={menuStyles.page}>
        <section style={menuStyles.heroActionsSticky}>
          <button type="button" style={adminStyles.primaryButton} onClick={applyChanges} disabled={!isDirty}>
            {loadingMenus ? "Loading..." : isDirty ? "Apply changes" : "Saved"}
          </button>
          <button type="button" style={adminStyles.secondaryButton} onClick={clearMenu}>
            Clear menu
          </button>
          <button type="button" style={adminStyles.secondaryButton} onClick={clearEverything}>
            Clear all menus
          </button>
        </section>

        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Menu screen</div>
            <p style={adminStyles.subtitle}>Choose a screen on the left, then define its left menu on the right.</p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Navigation map</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Multi-select menus</div>
              <div style={adminStyles.heroStatusText}>
                Pick a screen, then choose which screens should appear in its sidebar menu and how each one should look.
              </div>
            </div>
          </div>
        </section>

        <section style={menuStyles.builderGrid}>
          <article style={menuStyles.panel}>
            <div style={adminStyles.sectionKicker}>Screens</div>
            <h2 style={adminStyles.sectionTitle}>Screen to edit</h2>
            <div style={adminStyles.sectionMeta}>Select the screen whose menu you want to define.</div>

            <div style={menuStyles.targetList}>
              {menuTargetSummaries.map(({ option, labels }) => {
                const active = option.id === menuId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMenuId(option.id)}
                    style={{
                      ...menuStyles.targetButton,
                      ...(active ? menuStyles.targetButtonActive : null),
                    }}
                    >
                      <div style={menuStyles.targetButtonLabel}>{option.label}</div>
                      <div style={menuStyles.targetButtonMeta}>{option.meta}</div>
                      <div style={menuStyles.targetButtonPills}>
                        {labels.length > 0 ? (
                          labels.slice(0, 4).map((label) => (
                            <span key={label} style={menuStyles.targetButtonPill}>
                              {label}
                            </span>
                          ))
                        ) : (
                          <span style={menuStyles.targetButtonEmpty}>No buttons assigned</span>
                        )}
                        {labels.length > 4 && <span style={menuStyles.targetButtonMore}>+{labels.length - 4} more</span>}
                      </div>
                    </button>
                  );
              })}
            </div>
          </article>

          <article style={menuStyles.panel}>
            <div style={menuStyles.panelHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Menu items</div>
                <h2 style={adminStyles.sectionTitle}>{selectedMenu?.label ?? "Menu"}</h2>
              </div>
              <div style={adminStyles.sectionMeta}>{isDirty ? "Unsaved changes" : `${selectedOptions.length} selected`}</div>
            </div>

            <div style={menuStyles.optionListScroll}>
              {menuChoiceOptions.map((option) => {
                const activeEntry = selectedEntries.find((item) => item.id === option.id);
                const active = Boolean(activeEntry);
                const isBackStyle = activeEntry?.back === true || activeEntry?.darken === true;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(option.id)}
                    style={{
                      ...menuStyles.optionButton,
                      ...(active ? menuStyles.optionButtonActive : null),
                      ...(isBackStyle ? menuStyles.optionButtonBack : null),
                    }}
                    aria-label={`${option.label}${active ? " selected" : ""}`}
                  >
                    <span style={{ ...menuStyles.optionCheck, ...(active ? menuStyles.optionCheckActive : null) }}>
                      {active ? String.fromCharCode(10003) : ""}
                    </span>
                    <div style={menuStyles.optionButtonCopy}>
                      <span style={menuStyles.optionButtonTitle}>{activeEntry?.back ? "Back" : option.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={menuStyles.selectedPreview}>
              <div style={menuStyles.selectedPreviewTitle}>Selected menu items</div>
              <div style={menuStyles.selectedList}>
                {selectedOptions.length > 0 ? (
                  selectedOptions
                    .sort((left, right) => compareMenuLabels(left.option.label, right.option.label))
                    .map(({ entry, option }) => {
                      const isRegular = !entry.back && !entry.darken;
                      return (
                        <div key={option.id} style={menuStyles.selectedRow}>
                          <div style={menuStyles.selectedRowLeft}>
                            <div style={menuStyles.selectedRowTitle}>{entry.back ? "Back" : option.label}</div>
                          </div>
                          <div style={menuStyles.choiceStrip} role="group" aria-label={`${option.label} display mode`}>
                            <button
                              type="button"
                              style={{
                                ...menuStyles.choiceButton,
                                ...menuStyles.choiceButtonLeft,
                                ...(isRegular ? menuStyles.choiceButtonActive : null),
                              }}
                              onClick={() => setRegular(option.id)}
                            >
                              {isRegular ? `${String.fromCharCode(10003)} Regular` : "Regular"}
                            </button>
                            <button
                              type="button"
                              style={{
                                ...menuStyles.choiceButton,
                                ...(entry.darken ? menuStyles.choiceButtonActive : null),
                              }}
                              onClick={() => toggleDarken(option.id)}
                            >
                              {entry.darken ? `${String.fromCharCode(10003)} Darken` : "Darken"}
                            </button>
                            <button
                              type="button"
                              style={{
                                ...menuStyles.choiceButton,
                                ...menuStyles.choiceButtonRight,
                                ...(entry.back ? menuStyles.choiceButtonActive : null),
                              }}
                              onClick={() => toggleBack(option.id)}
                            >
                              {entry.back ? `${String.fromCharCode(10003)} Back` : "Back"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <span style={menuStyles.emptyHint}>No items selected yet.</span>
                )}
              </div>
            </div>
          </article>
        </section>
      </section>
    </AdminShell>
  );
}

const menuStyles: Record<string, CSSProperties> = {
  heroActionsSticky: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    padding: "12px 16px",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.90)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 16px 28px rgba(52, 84, 120, 0.10)",
  },
  page: {
    position: "relative",
    display: "grid",
    gap: "18px",
    paddingTop: "88px",
  },
  builderGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.15fr)",
    gap: "16px",
    alignItems: "start",
  },
  panel: {
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "12px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  targetList: {
    display: "grid",
    gap: "10px",
    maxHeight: "68vh",
    overflow: "auto",
    paddingRight: "2px",
  },
  targetButton: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(249,252,255,0.98) 0%, rgba(242,246,251,0.96) 100%)",
    padding: "14px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: "4px",
  },
  targetButtonActive: {
    borderColor: "rgba(130, 163, 211, 0.45)",
    boxShadow: "0 12px 24px rgba(126, 154, 190, 0.16)",
    background: "linear-gradient(145deg, rgba(231, 243, 255, 0.98) 0%, rgba(250, 252, 255, 0.96) 100%)",
  },
  targetButtonLabel: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#17324f",
  },
  targetButtonMeta: {
    fontSize: "12px",
    color: "#5b6f84",
    lineHeight: 1.4,
  },
  targetButtonPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "2px",
  },
  targetButtonPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(229, 239, 250, 0.95)",
    border: "1px solid rgba(161, 185, 214, 0.28)",
    color: "#2f4f73",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  targetButtonEmpty: {
    color: "#8798ab",
    fontSize: "11px",
    fontStyle: "italic",
  },
  targetButtonMore: {
    color: "#6e8298",
    fontSize: "11px",
    fontWeight: 700,
    alignSelf: "center",
  },
  optionListScroll: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "8px",
    maxHeight: "44vh",
    overflowY: "auto",
    paddingRight: "2px",
    alignItems: "start",
  },
  optionButton: {
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.9)",
    padding: "9px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "10px",
    minHeight: "42px",
    textAlign: "left",
  },
  optionButtonActive: {
    borderColor: "rgba(112, 163, 217, 0.45)",
    background: "linear-gradient(145deg, rgba(237, 246, 255, 0.98) 0%, rgba(255, 246, 250, 0.96) 100%)",
    boxShadow: "0 12px 24px rgba(126, 154, 190, 0.14)",
  },
  optionButtonBack: {
    background: "linear-gradient(145deg, rgba(247, 250, 252, 0.98) 0%, rgba(224, 233, 243, 0.96) 100%)",
  },
  optionButtonCopy: {
    minWidth: 0,
    display: "grid",
    gap: "0",
    flex: 1,
  },
  optionButtonTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
    lineHeight: 1.15,
    textAlign: "left",
  },
  optionCheck: {
    width: "20px",
    height: "20px",
    borderRadius: "6px",
    display: "grid",
    placeItems: "center",
    background: "rgba(237, 244, 251, 0.98)",
    border: "1px solid rgba(161, 185, 214, 0.32)",
    color: "#35506d",
    fontWeight: 900,
    fontSize: "12px",
    flexShrink: 0,
  },
  optionCheckActive: {
    background: "linear-gradient(145deg, rgba(222, 234, 246, 0.98) 0%, rgba(255, 244, 248, 0.96) 100%)",
  },
  selectedPreview: {
    marginTop: "4px",
    paddingTop: "14px",
    borderTop: "1px solid rgba(140, 160, 184, 0.16)",
    display: "grid",
    gap: "8px",
  },
  selectedPreviewTitle: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 800,
    color: "#6d7f93",
  },
  selectedList: {
    display: "grid",
    gap: "10px",
  },
  selectedRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    background: "rgba(236, 244, 252, 0.95)",
  },
  selectedRowLeft: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
  },
  selectedRowTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  choiceStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    borderRadius: "999px",
    overflow: "hidden",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    background: "rgba(255,255,255,0.88)",
    flexShrink: 0,
  },
  choiceButton: {
    minHeight: "30px",
    padding: "0 12px",
    border: "0",
    borderLeft: "1px solid rgba(169, 188, 210, 0.22)",
    borderRadius: "0",
    background: "transparent",
    color: "#4c6076",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  choiceButtonLeft: {
    borderLeft: "0",
  },
  choiceButtonRight: {
    borderRadius: "0 999px 999px 0",
  },
  choiceButtonActive: {
    background: "linear-gradient(135deg, rgba(223, 235, 248, 0.98) 0%, rgba(204, 220, 238, 0.98) 100%)",
    color: "#17324f",
  },
  emptyHint: {
    color: "#5b6f84",
    fontSize: "13px",
  },
};
