import { ReactNode } from 'react';
import Navbar from './Navbar';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  fullscreen?: boolean;
}

export default function Layout({ children, hideFooter = false, fullscreen = false }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {/* Fullscreen pages (chat) provide their own mobile top bar. */}
      {!fullscreen && <MobileHeader />}
      <main className={`flex-1 ${fullscreen ? 'md:pt-16' : 'pt-14 pb-20 md:pt-20 md:pb-0'}`}>
        {children}
      </main>
      {!hideFooter && !fullscreen && <Footer />}
      {!fullscreen && <BottomNav />}
    </div>
  );
}
