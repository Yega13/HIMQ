import { ReactNode } from 'react';
import Navbar from './Navbar';
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
      <main className={`flex-1 ${fullscreen ? 'md:pt-16' : 'pb-20 md:pb-0 md:pt-20'}`}>
        {children}
      </main>
      {!hideFooter && !fullscreen && <Footer />}
      {!fullscreen && <BottomNav />}
    </div>
  );
}
