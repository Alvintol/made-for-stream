import { lazy } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Layout from "./components/layout/Layout";
import ProfileSetupRedirect from "./components/auth/ProfileSetupRedirect";
import RequireAdminAccess from "./components/auth/RequireAdminAccess";
import RequireAuth from "./components/auth/RequireAuth";
import RequireCreatorAccess from "./components/auth/RequireCreatorAccess";
import ScrollToTop from "./components/layout/ScrollToTop";
import NotFound from "./pages/NotFound";

// Each page downloads when it is first opened, so a first visit only pays for
// the page it lands on. Layout shows the loading state and handles a failure.
// Playbook: docs/support/site/page-loading.md.
const About = lazy(() => import("./pages/About"));
const Home = lazy(() => import("./pages/Home"));
const Live = lazy(() => import("./pages/Live"));
const Market = lazy(() => import("./pages/Market"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const AccountDetailsSettings = lazy(() => import("./pages/AccountDetailsSettings"));
const PreferencesSettings = lazy(() => import("./pages/PreferencesSettings"));
const SettingsLayout = lazy(() => import("./components/settings/SettingsLayout"));
const SignIn = lazy(() => import("./pages/SignIn"));
const AdminCreatorApplications = lazy(() => import("./pages/admin/AdminCreatorApplications"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminListingRevisions = lazy(() => import("./pages/admin/AdminListingRevisions"));
const AdminListings = lazy(() => import("./pages/admin/AdminListings"));
const AdminModerationReportDetails = lazy(() => import("./pages/admin/AdminModerationReportDetails"));
const AdminModerationReports = lazy(() => import("./pages/admin/AdminModerationReports"));
const AdminPaymentIssues = lazy(() => import("./pages/admin/AdminPaymentIssues"));
const AdminRequestDetails = lazy(() => import("./pages/admin/AdminRequestDetails"));
const AdminRequests = lazy(() => import("./pages/admin/AdminRequests"));
const AdminStorage = lazy(() => import("./pages/admin/AdminStorage"));
const AdminTaxReporting = lazy(() => import("./pages/admin/AdminTaxReporting"));
const AdminSales = lazy(() => import("./pages/admin/AdminSales"));
const BuyerRequestDetails = lazy(() => import("./pages/buyer/BuyerRequestDetails"));
const BuyerRequests = lazy(() => import("./pages/buyer/BuyerRequests"));
const Downloads = lazy(() => import("./pages/buyer/Downloads"));
const ApplyCreator = lazy(() => import("./pages/creator/ApplyCreator"));
const CreatorDashboard = lazy(() => import("./pages/creator/CreatorDashboard"));
const CreatorProfile = lazy(() => import("./pages/creator/CreatorProfile"));
const CreatorRequestDetails = lazy(() => import("./pages/creator/CreatorRequestDetails"));
const CreatorRequests = lazy(() => import("./pages/creator/CreatorRequests"));
const Creators = lazy(() => import("./pages/creator/Creators"));
const CreateListing = lazy(() => import("./pages/listings/CreateListing"));
const CreatorListingDetails = lazy(() => import("./pages/listings/CreatorListingDetails"));
const CreatorListingRevisions = lazy(() => import("./pages/listings/CreatorListingRevisions"));
const CreatorListings = lazy(() => import("./pages/listings/CreatorListings"));
const EditListing = lazy(() => import("./pages/listings/EditListing"));
const Listing = lazy(() => import("./pages/listings/Listing"));
const RequestListing = lazy(() => import("./pages/listings/RequestListing"));
const CommunityGuidelines = lazy(() => import("./pages/legal/CommunityGuidelines"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const ServiceProviderRegister = lazy(() => import("./pages/legal/ServiceProviderRegister"));
const CopyrightPolicy = lazy(() => import("./pages/legal/CopyrightPolicy"));
const CreatorTerms = lazy(() => import("./pages/legal/CreatorTerms"));
const FeeSchedule = lazy(() => import("./pages/legal/FeeSchedule"));
const Legal = lazy(() => import("./pages/legal/Legal"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const SiteUpdates = lazy(() => import("./pages/SiteUpdates"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const MessageDetails = lazy(() => import("./pages/messages/MessageDetails"));
const MessagesInbox = lazy(() => import("./pages/messages/MessagesInbox"));
const MyReports = lazy(() => import("./pages/reports/MyReports"));
const PaymentReturn = lazy(() => import("./pages/payments/PaymentReturn"));
const PaymentInvoice = lazy(() => import("./pages/payments/PaymentInvoice"));
const CreatorSales = lazy(() => import("./pages/creator/CreatorSales"));
const ListingRequestPaymentCheckout = lazy(() => import("./pages/payments/ListingRequestPaymentCheckout"));

const App = () => {
  return (
    <>
      <ScrollToTop />
      <ProfileSetupRedirect />

      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/about" element={<About />} />
          <Route path="/live" element={<Live />} />
          <Route path="/market" element={<Market />} />
          <Route path="/free" element={<Market forceFree />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/listing/:id" element={<Listing />} />
          <Route
            path="/creator/:handle"
            element={<CreatorProfile />}
          />
          <Route path="/legal" element={<Legal />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/updates" element={<SiteUpdates />} />
          <Route
            path="/terms/creator"
            element={<CreatorTerms />}
          />
          {/*
            Published policies. Terms and Privacy still carry a
            [BUSINESS_NUMBER] placeholder while the registration is pending.
          */}
          <Route path="/policies/refunds" element={<RefundPolicy />} />
          <Route path="/policies/copyright" element={<CopyrightPolicy />} />
          <Route path="/policies/fees" element={<FeeSchedule />} />
          <Route path="/policies/cookies" element={<CookiePolicy />} />
          <Route
            path="/policies/service-providers"
            element={<ServiceProviderRegister />}
          />
          <Route
            path="/policies/community"
            element={<CommunityGuidelines />}
          />

          <Route element={<RequireAuth />}>
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="personal" element={<AccountDetailsSettings />} />
              <Route path="preferences" element={<PreferencesSettings />} />
              <Route path="reports" element={<MyReports />} />
            </Route>
            <Route
              path="/apply/creator"
              element={<ApplyCreator />}
            />
            <Route
              path="/listing/:id/request"
              element={<RequestListing />}
            />

            <Route
              path="/requests"
              element={<BuyerRequests view="active" />}
            />
            <Route
              path="/requests/completed"
              element={<BuyerRequests view="completed" />}
            />
            <Route
              path="/requests/archived"
              element={<BuyerRequests view="archived" />}
            />
            <Route
              path="/requests/:id"
              element={<BuyerRequestDetails />}
            />

            <Route
              path="/messages"
              element={<MessagesInbox />}
            />
            <Route
              path="/messages/:id"
              element={<MessageDetails />}
            />

            <Route
              path="/payments/checkout/:paymentId"
              element={
                <ListingRequestPaymentCheckout />
              }
            />

            <Route
              path="/payments/return"
              element={
                <PaymentReturn />
              }
            />

            <Route
              path="/payments/invoice/:paymentId"
              element={
                <PaymentInvoice />
              }
            />

            <Route path="/downloads" element={<Downloads />} />
          </Route>

          <Route element={<RequireAdminAccess />}>
            <Route
              path="/admin"
              element={
                <Navigate
                  replace
                  to="/admin/dashboard"
                />
              }
            />
            <Route
              path="/admin/dashboard"
              element={<AdminDashboard />}
            />
            <Route
              path="/admin/creator-applications"
              element={<AdminCreatorApplications />}
            />
            <Route
              path="/admin/listings"
              element={<AdminListings />}
            />
            <Route
              path="/admin/listing-revisions/:id"
              element={<AdminListingRevisions />}
            />
            <Route
              path="/admin/requests"
              element={<AdminRequests />}
            />
            <Route
              path="/admin/requests/:id"
              element={<AdminRequestDetails />}
            />
            <Route
              path="/admin/reports"
              element={<AdminModerationReports />}
            />
            <Route
              path="/admin/reports/:id"
              element={<AdminModerationReportDetails />}
            />
            <Route
              path="/admin/payment-issues"
              element={<AdminPaymentIssues />}
            />
            <Route
              path="/admin/storage"
              element={<AdminStorage />}
            />
            <Route
              path="/admin/tax-reporting"
              element={<AdminTaxReporting />}
            />
            <Route
              path="/admin/sales"
              element={<AdminSales />}
            />
          </Route>

          <Route element={<RequireCreatorAccess />}>
            <Route
              path="/creator/dashboard"
              element={<CreatorDashboard />}
            />
            <Route
              path="/creator/listings"
              element={<CreatorListings />}
            />
            <Route
              path="/creator/listings/new"
              element={<CreateListing />}
            />
            <Route
              path="/creator/listings/:id"
              element={<CreatorListingDetails />}
            />
            <Route
              path="/creator/listings/:id/revisions"
              element={<CreatorListingRevisions />}
            />
            <Route
              path="/creator/listings/:id/edit"
              element={<EditListing />}
            />
            <Route
              path="/creator/earnings"
              element={<CreatorSales />}
            />
            {/* The old address, which emails still link to. */}
            <Route path="/creator/sales" element={<Navigate to="/creator/earnings" replace />} />
            <Route
              path="/creator/requests"
              element={<CreatorRequests view="active" />}
            />
            <Route
              path="/creator/requests/completed"
              element={<CreatorRequests view="completed" />}
            />
            <Route
              path="/creator/requests/archived"
              element={<CreatorRequests view="archived" />}
            />
            <Route
              path="/creator/requests/:id"
              element={<CreatorRequestDetails />}
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;