import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';
import { PageTransition } from '../../lib/motion';
import { AdBanner, AdGutters } from '../ads/SiteAds';
import CookieConsent from '../legal/CookieConsent';
import PolicyAcceptanceGate from '../legal/PolicyAcceptanceGate';
import SiteUpdatesNotice from '../app/SiteUpdatesNotice';
import LanguageSync from '../app/LanguageSync';

const classes = {
  shell: 'appShell',
  main: 'container',
  ad: 'mt-8',
} as const;

const Layout = () => {
  const { pathname } = useLocation();

  return (
    <div className={classes.shell}>
      <LanguageSync />
      <Nav />
      <main className={classes.main}>
        <PolicyAcceptanceGate>
          <PageTransition transitionKey={pathname}>
            <Outlet />
          </PageTransition>
          {/* Inside the gate: never beside the screen that asks to accept a policy. */}
          <AdGutters />
          <AdBanner className={classes.ad} />
        </PolicyAcceptanceGate>
      </main>
      <Footer />
      <SiteUpdatesNotice />
      <CookieConsent />
    </div>
  );
};

export default Layout;
