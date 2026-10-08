import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMyProfile } from '../../hooks/profile/useMyProfile';
import { useAccountDetails } from '../../hooks/settings/useAccountDetails';
import { useAuth } from '../../providers/AuthProvider';


// Paths that should never redirect into themselves
const shouldSkipRedirect = (pathname: string): boolean =>
  pathname === "/settings/profile" ||
  pathname === "/signin" ||
  pathname.startsWith("/auth");

const ACCOUNT_DETAILS_PATH = "/settings/personal";

// Pages someone can still read before adding their account details: the
// form itself, sign-in (to sign out), and the documents that explain why
// the details are asked for.
const isOpenWithoutAccountDetails = (pathname: string): boolean =>
  pathname === ACCOUNT_DETAILS_PATH ||
  pathname === "/signin" ||
  pathname.startsWith("/auth") ||
  pathname === "/legal" ||
  pathname === "/privacy" ||
  pathname === "/terms" ||
  pathname.startsWith("/terms/") ||
  pathname.startsWith("/policies/");

// Sends a signed-in person with no account details to the form that asks
// for them, from any page, until they are saved (the database refuses
// listings, commission requests and payments without them anyway:
// 20261008_150). After that, redirects first-time users into Profile
// Settings once their profile exists.
const ProfileSetupRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const accountDetails = useAccountDetails();
  // Only a finished, successful read counts: a failed one must not lock
  // anyone out of the site.
  const needsAccountDetails = accountDetails.isSuccess && !accountDetails.data;
  const accountDetailsPending = accountDetails.isLoading;

  useEffect(() => {
    if (loading || !user || accountDetailsPending) return;

    if (needsAccountDetails) {
      if (!isOpenWithoutAccountDetails(location.pathname)) {
        navigate(ACCOUNT_DETAILS_PATH, { replace: true });
      }
      return;
    }

    if (isLoading || !profile) return;
    if (profile.profile_setup_seen) return;
    if (shouldSkipRedirect(location.pathname)) return;

    navigate("/settings/profile", { replace: true });
  }, [
    loading,
    isLoading,
    user,
    profile,
    needsAccountDetails,
    accountDetailsPending,
    location.pathname,
    navigate,
  ]);

  return null;
};

export default ProfileSetupRedirect;