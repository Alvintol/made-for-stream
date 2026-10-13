import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import Footer from './Footer';
import { PageTransition } from '../../lib/motion';
import CookieConsent from '../legal/CookieConsent';
import PolicyAcceptanceGate from '../legal/PolicyAcceptanceGate';
import SiteUpdatesNotice from '../app/SiteUpdatesNotice';

const classes = {
  shell: 'appShell',
  main: 'container',
} as const;

const Layout = () => {
  const { pathname } = useLocation();

  return (
    <div className={classes.shell}>
      <Nav />
      <main className={classes.main}>
        <PolicyAcceptanceGate>
          <PageTransition transitionKey={pathname}>
            <Outlet />
          </PageTransition>
        </PolicyAcceptanceGate>
      </main>
      <Footer />
      <SiteUpdatesNotice />
      <CookieConsent />
    </div>
  );
};

export default Layout;
