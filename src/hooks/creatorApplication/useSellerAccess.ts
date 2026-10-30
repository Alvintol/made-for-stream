import { useMemo } from "react";
import { useT, type Translate } from "../../lib/i18n/i18n";
import { useAuth } from "../../providers/AuthProvider";
import { useMyAdminAccess } from "../admin/useMyAdminAccess";
import { useMyProfile } from "../profile/useMyProfile";
import { useMySellerApplication } from "./useMySellerApplication";
import { useProfilePlatformAccounts } from "../profile/useProfilePlatformAccounts";
import type { SellerApplicationRow } from "./useMySellerApplication";

type SellerAccess = {
  isLoading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  isCreatorApproved: boolean;
  canAccessCreatorRoutes: boolean;
  canAccessAdminRoutes: boolean;
  profileReady: boolean;
  hasLinkedCreatorPlatform: boolean;
  sellerApplication: SellerApplicationRow | null;
  creatorStatusLabel: string;
  canStartApplication: boolean;
  canEditApplication: boolean;
  canSubmitApplication: boolean;
  error: Error | null;
};

const toError = (value: unknown): Error | null =>
  value instanceof Error
    ? value
    : value && typeof value === "object" && "message" in value
      ? new Error(String((value as { message: unknown }).message))
      : null;

const getCreatorStatusLabel = (
  sellerApplication: SellerApplicationRow | null,
  t: Translate
): string =>
  !sellerApplication
    ? t("apply.status.none")
    : sellerApplication.status === "approved"
      ? t("creatorStatus.approved")
      : sellerApplication.status === "under_review"
        ? t("apply.status.under_review")
        : sellerApplication.status === "submitted"
          ? t("apply.status.submitted")
          : sellerApplication.status === "needs_changes"
            ? t("creatorStatus.needs_changes")
            : sellerApplication.status === "rejected"
              ? t("creatorStatus.rejected")
              : sellerApplication.status === "suspended"
                ? t("apply.status.suspended")
                : t("apply.status.draft");

export const useSellerAccess = (): SellerAccess => {
  const t = useT();
  const { user, loading: isAuthLoading } = useAuth();

  const {
    data: profile = null,
    isLoading: isProfileLoading,
    error: profileError,
  } = useMyProfile();

  const {
    data: platformAccounts = [],
    isLoading: isPlatformAccountsLoading,
    error: platformAccountsError,
  } = useProfilePlatformAccounts();

  const {
    data: sellerApplicationData = null,
    isLoading: isSellerApplicationLoading,
    error: sellerApplicationError,
  } = useMySellerApplication();

  const {
    data: isAdmin = false,
    isLoading: isAdminLoading,
    error: adminError,
  } = useMyAdminAccess();

  const sellerApplication = sellerApplicationData ?? null;

  return useMemo(() => {
    const isSignedIn = Boolean(user?.id);

    const profileReady =
      Boolean(profile?.handle?.trim()) && Boolean(profile?.display_name?.trim());

    const hasLinkedCreatorPlatform = platformAccounts.some(
      (platformAccount) =>
        platformAccount.platform === "twitch" ||
        platformAccount.platform === "youtube"
    );

    const isCreatorApproved = sellerApplication?.status === "approved";

    const canEditApplication =
      !sellerApplication ||
      sellerApplication.status === "draft" ||
      sellerApplication.status === "needs_changes";

    const canStartApplication = profileReady;

    const canSubmitApplication =
      profileReady &&
      hasLinkedCreatorPlatform &&
      sellerApplication !== null &&
      (sellerApplication.status === "draft" ||
        sellerApplication.status === "needs_changes");

    const creatorStatusLabel = getCreatorStatusLabel(sellerApplication, t);

    const error =
      toError(profileError) ||
      toError(platformAccountsError) ||
      toError(sellerApplicationError) ||
      toError(adminError);

    const isLoading =
      isAuthLoading ||
      isProfileLoading ||
      isPlatformAccountsLoading ||
      isSellerApplicationLoading ||
      isAdminLoading;

    return {
      isLoading,
      isSignedIn,
      isAdmin,
      isCreatorApproved,
      canAccessCreatorRoutes: isCreatorApproved,
      canAccessAdminRoutes: isAdmin,
      profileReady,
      hasLinkedCreatorPlatform,
      sellerApplication,
      creatorStatusLabel,
      canStartApplication,
      canEditApplication,
      canSubmitApplication,
      error,
    };
  }, [
    t,
    user?.id,
    profile,
    platformAccounts,
    sellerApplication,
    isAdmin,
    isAuthLoading,
    isProfileLoading,
    isPlatformAccountsLoading,
    isSellerApplicationLoading,
    isAdminLoading,
    profileError,
    platformAccountsError,
    sellerApplicationError,
    adminError,
  ]);
};