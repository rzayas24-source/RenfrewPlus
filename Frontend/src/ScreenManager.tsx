// src/ScreenManager.tsx
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "./auth/auth";
import AttachmentReviewScreen from "./Screens/attachmentreview";
import BalanceCheck from "./Screens/balancecheck";
import Balsheet from "./Screens/balsheet";
import IntroScreen from "./Screens/introscreen";
import Itemization from "./Screens/itemization";
import Keyproof from "./Screens/keyproof";
import CalendarScreen from "./Screens/calendarscreen";
import CashScreen from "./Screens/cashscreen";
import FinanceScreen from "./Screens/financescreen";
import CollectionsScreen from "./Screens/collectionsscreen";
import JaneDoeScreen from "./Screens/janedoescreen";
import ERAConvertScreen from "./Screens/eraconvertscreen";
import HTMLConvertScreen from "./Screens/htmlconvertscreen";
import ImportScreen from "./Screens/importscreen";
import EmailDownloaderScreen from "./Screens/emaildownloaderscreen";
import EFTUploadScreen from "./Screens/eft_uploadscreen";
import Upload835Screen from "./Screens/835uploadscreen";
import LockboxImportScreen from "./Screens/lockbox_importscreen";
import ToolsScreen from "./Screens/toolsscreen";
import OtherDayScreen from "./Screens/otherdayscreen";
import DuplicateCheckScreen from "./Screens/duplicatecheckscreen";
import BankingScreen from "./Screens/bankingscreen";
import Match835Screen from "./Screens/835matchscreen";
import SiteReviewScreen from "./Screens/sitereviewscreen";
import SnapshotGeneratorScreen from "./Screens/snapshotgeneratorscreen";
import MainScreen from "./Screens/mainscreen";
import SignInScreen from "./Screens/signinscreen";
import AdminScreen from "./Screens/adminscreen";
import DevNoteScreen from "./Screens/devnotescreen";
import AdminRolesScreen from "./Screens/adminrolescreen";
import AdminMenuScreen from "./Screens/adminmenusscreen";
import AdminTableScreen from "./Screens/admintablescreen";
import CrashLogScreen from "./Screens/crashlogscreen";
import AdminUserScreen from "./Screens/adminuserscreen";
import AdminConfigScreen from "./Screens/adminconfigscreen";
import ProfileScreen from "./Screens/profilescreen";
import HipaaScreen from "./Screens/hipaascreen";
import DependenciesScreen from "./Screens/dependenciesscreen";
import AuditorsScreen from "./Screens/auditorsscreen";
import SchemaScreen from "./Screens/schemascreen";
import SecurityScreen from "./Screens/securityscreen";
import PortabilityScreen from "./Screens/portabilityscreen";
import WorklistEditorScreen from "./Screens/worklisteditor";
import MiscEditorScreen from "./Screens/miscbuilder";
import MiscScreen from "./Screens/miscscreen";
import BusinessScreen from "./Screens/businessscreen";
import DiscrepancyScreen from "./Screens/discrepancyscreen";
import SitesScreen from "./Screens/sitescreen";
import SectionPlaceholderScreen from "./Screens/sectionplaceholderscreen";
import ViewImagesScreen from "./Screens/viewimagesscreen";
import { getItemization, getKeyproof } from "./api/keyproof_api";

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readKeyproofTotal(keyproof: unknown) {
  const payload = keyproof as
    | {
        form?: Record<string, unknown>;
      }
    | null
    | undefined;

  const form = payload?.form ?? {};
  return ["cash", "check", "creditCard", "foreignCheck", "wireTransfer", "misc"].reduce(
    (total, field) => total + parseAmount(form[field]),
    0
  );
}

function readItemizationTotal(itemization: unknown) {
  const payload = itemization as
    | {
        items?: Array<{ amount?: number | string }>;
      }
    | null
    | undefined;

  const items = Array.isArray(payload?.items) ? payload?.items : [];
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function buildReviewParams(attachmentId: string | null, day: string | null, site?: string | null) {
  const params = new URLSearchParams();

  if (attachmentId) {
    params.set("attachmentId", attachmentId);
  }

  if (day) {
    params.set("day", day);
  }

  if (site) {
    params.set("site", site);
  }

  return params;
}

function BalanceCheckScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attachmentId = searchParams.get("attachmentId");
  const day = searchParams.get("day");
  const site = searchParams.get("site");
  const [keyproofTotal, setKeyproofTotal] = useState(0);
  const [itemizationTotal, setItemizationTotal] = useState(0);
  const flowParams = buildReviewParams(attachmentId, day, site);
  const itemizationParams = buildReviewParams(attachmentId, day, site);

  useEffect(() => {
    let active = true;

    const loadTotals = async () => {
      if (!attachmentId) {
        setKeyproofTotal(0);
        setItemizationTotal(0);
        return;
      }

      try {
        const [keyproofResponse, itemizationResponse] = await Promise.all([
          getKeyproof(Number(attachmentId)),
          getItemization(Number(attachmentId)),
        ]);

        if (!active) {
          return;
        }

        setKeyproofTotal(readKeyproofTotal(keyproofResponse.data.payload));
        setItemizationTotal(readItemizationTotal(itemizationResponse.data.payload));
      } catch {
        if (active) {
          setKeyproofTotal(0);
          setItemizationTotal(0);
        }
      }
    };

    void loadTotals();

    return () => {
      active = false;
    };
  }, [attachmentId]);

  if (attachmentId) {
    itemizationParams.set("requiredTotal", keyproofTotal.toFixed(2));
  }

  const returnToQueue = day ? `/attachments?day=${encodeURIComponent(day)}` : "/attachments";

  return (
    <main style={balanceStyles.page}>
      <BalanceCheck
        keyproofTotal={keyproofTotal}
        itemizationTotal={itemizationTotal}
        onEditKeyproof={() => navigate(`/keyproof?${flowParams.toString()}`)}
        onEditItemization={() => navigate(`/itemization?${itemizationParams.toString()}`)}
        onAccept={() => navigate(returnToQueue)}
      />
    </main>
  );
}

function RequireAuth() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  return <Outlet />;
}

function PublicOnly() {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function ScreenManager() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/signin" element={<SignInScreen />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/" element={<MainScreen />} />
          <Route path="/home" element={<MainScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="/admin/dev-notes" element={<DevNoteScreen />} />
          <Route path="/admin/config" element={<AdminConfigScreen />} />
          <Route path="/admin/hipaa" element={<HipaaScreen />} />
          <Route path="/admin/security" element={<SecurityScreen />} />
          <Route path="/admin/portability" element={<PortabilityScreen />} />
          <Route path="/admin/dependencies" element={<DependenciesScreen />} />
          <Route path="/admin/schema" element={<SchemaScreen />} />
          <Route path="/admin/auditors" element={<AuditorsScreen />} />
          <Route path="/admin/roles" element={<AdminRolesScreen />} />
          <Route path="/admin/menus" element={<AdminMenuScreen />} />
          <Route path="/admin/tables" element={<AdminTableScreen />} />
          <Route path="/admin/crashlogs" element={<CrashLogScreen />} />
          <Route path="/admin/users" element={<AdminUserScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/cash" element={<CashScreen />} />
          <Route path="/finance" element={<FinanceScreen />} />
          <Route path="/aux-posting" element={<SectionPlaceholderScreen title="Aux Posting" description="Aux Posting tools will live here." />} />
          <Route path="/collections" element={<CollectionsScreen />} />
          <Route path="/jane-doe" element={<JaneDoeScreen />} />
          <Route path="/check-search" element={<SectionPlaceholderScreen title="Check Search" description="Check Search tools will live here." />} />
          <Route path="/view-images" element={<ViewImagesScreen />} />
          <Route path="/era-convert" element={<ERAConvertScreen />} />
          <Route path="/html-convert" element={<HTMLConvertScreen />} />
          <Route path="/otherday" element={<OtherDayScreen />} />
          <Route path="/duplicatecheck" element={<DuplicateCheckScreen />} />
          <Route path="/tools" element={<ToolsScreen />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/eft-upload" element={<EFTUploadScreen />} />
          <Route path="/835-upload" element={<Upload835Screen />} />
          <Route path="/lockbox-import" element={<LockboxImportScreen />} />
          <Route path="/banking" element={<BankingScreen />} />
          <Route path="/835-match" element={<Match835Screen />} />
          <Route path="/site-review" element={<SiteReviewScreen />} />
          <Route path="/email-downloader" element={<EmailDownloaderScreen />} />
          <Route path="/snapshot-generator" element={<SnapshotGeneratorScreen />} />
          <Route path="/worklist-editor" element={<WorklistEditorScreen />} />
          <Route path="/attachments" element={<AttachmentReviewScreen />} />
          <Route path="/balancecheck" element={<BalanceCheckScreen />} />
          <Route path="/balsheet" element={<Balsheet />} />
          <Route path="/balsheet/view" element={<Balsheet />} />
          <Route path="/keyproof" element={<Keyproof />} />
          <Route path="/itemization" element={<Itemization />} />
          <Route path="/misc" element={<MiscScreen />} />
          <Route path="/misc-editor" element={<MiscEditorScreen />} />
          <Route path="/itemstoreview" element={<IntroScreen />} />
          <Route path="/statements" element={<SectionPlaceholderScreen title="Statements" description="Statements tools will live here." />} />
          <Route path="/request" element={<SectionPlaceholderScreen title="Request" description="Request tools will live here." />} />
          <Route path="/research" element={<SectionPlaceholderScreen title="Research" description="Research tools will live here." />} />
          <Route path="/business" element={<BusinessScreen />} />
          <Route path="/discrepancy" element={<DiscrepancyScreen />} />
          <Route path="/sites" element={<SitesScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const balanceStyles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "28px",
    background: "#f6f7f9",
    color: "#1f2933",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  },
  card: {
    maxWidth: "760px",
    border: "1px solid #d9dee7",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "20px",
  },
  button: {
    marginTop: "18px",
    height: "40px",
    padding: "0 16px",
    border: "1px solid #c8d0dc",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#1f2933",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
