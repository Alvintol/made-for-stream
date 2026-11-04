import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';
import { PageTransition } from '../../lib/motion';
import { AdBanner, AdGutters } from '../ads/SiteAds';
import CookieConsent from '../legal/CookieConsent';
import PolicyAcceptanceGate from '../legal/PolicyAcceptanceGate';
import SiteUpdatesNotice from '../app/SiteUpdatesNotice';
import GuideTour from '../guide/GuideTour';
import GuideWelcome from '../guide/GuideWelcome';
import LanguageSync from '../app/LanguageSync';
import PageErrorBoundary from '../app/PageErrorBoundary';
import { useT } from '../../lib/i18n/i18n';
const classes = {
  shell: 'appShell',
  main: 'container',
  ad: 'mt-8',
  loading: 'text-sm text-zinc-600',
} as const;

const Layout = () => {
  const { pathname } = useLocation();
  const t = useT();
  return (
    <div className={classes.shell}>
      <LanguageSync />
      <Nav />
      <main className={classes.main}>
        <PolicyAcceptanceGate>
          <PageTransition transitionKey={pathname}>
            <PageErrorBoundary resetKey={pathname}>
              <Suspense fallback={<div className={classes.loading}>{t('common.loading')}</div>}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          </PageTransition>
          <GuideWelcome />
          {/* Inside the gate: never beside the screen that asks to accept a policy. */}
          <AdGutters />
          <AdBanner className={classes.ad} />
        </PolicyAcceptanceGate>
      </main>
      <Footer />
      <SiteUpdatesNotice />
      <GuideTour />
      <CookieConsent />
    </div>
  );
};

export default Layout;
