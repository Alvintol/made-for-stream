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
import About from "./pages/About";
import Home from "./pages/Home";
import Live from "./pages/Live";
import Market from "./pages/Market";
import NotFound from "./pages/NotFound";
import ProfileSettings from "./pages/ProfileSettings";
import AccountDetailsSettings from "./pages/AccountDetailsSettings";
import PreferencesSettings from "./pages/PreferencesSettings";
import SettingsLayout from "./components/settings/SettingsLayout";
import SignIn from "./pages/SignIn";
import AdminCreatorApplications from "./pages/admin/AdminCreatorApplications";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminListingRevisions from "./pages/admin/AdminListingRevisions";
import AdminListings from "./pages/admin/AdminListings";
import AdminModerationReportDetails from "./pages/admin/AdminModerationReportDetails";
import AdminModerationReports from "./pages/admin/AdminModerationReports";
import AdminPaymentIssues from "./pages/admin/AdminPaymentIssues";
import AdminRequestDetails from "./pages/admin/AdminRequestDetails";
import AdminRequests from "./pages/admin/AdminRequests";
import BuyerRequestDetails from "./pages/buyer/BuyerRequestDetails";
import BuyerRequests from "./pages/buyer/BuyerRequests";
import ApplyCreator from "./pages/creator/ApplyCreator";
import CreatorDashboard from "./pages/creator/CreatorDashboard";
import CreatorProfile from "./pages/creator/CreatorProfile";
import CreatorRequestDetails from "./pages/creator/CreatorRequestDetails";
import CreatorRequests from "./pages/creator/CreatorRequests";
import Creators from "./pages/creator/Creators";
import CreateListing from "./pages/listings/CreateListing";
import CreatorListingDetails from "./pages/listings/CreatorListingDetails";
import CreatorListingRevisions from "./pages/listings/CreatorListingRevisions";
import CreatorListings from "./pages/listings/CreatorListings";
import EditListing from "./pages/listings/EditListing";
import Listing from "./pages/listings/Listing";
import RequestListing from "./pages/listings/RequestListing";
import CommunityGuidelines from "./pages/legal/CommunityGuidelines";
import CookiePolicy from "./pages/legal/CookiePolicy";
import ServiceProviderRegister from "./pages/legal/ServiceProviderRegister";
import CopyrightPolicy from "./pages/legal/CopyrightPolicy";
import CreatorTerms from "./pages/legal/CreatorTerms";
import FeeSchedule from "./pages/legal/FeeSchedule";
import Legal from "./pages/legal/Legal";
import Privacy from "./pages/legal/Privacy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import Terms from "./pages/legal/Terms";
import MessageDetails from "./pages/messages/MessageDetails";
import MessagesInbox from "./pages/messages/MessagesInbox";
import MyReports from "./pages/reports/MyReports";
import PaymentReturn from './pages/payments/PaymentReturn';
import ListingRequestPaymentCheckout from './pages/payments/ListingRequestPaymentCheckout';

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