import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../nav/Sidebar';
import { TopHeader } from '../nav/TopHeader';
import { MobileBottomNav } from '../nav/MobileBottomNav';
export function AppLayout() {
    return (<div className="min-h-screen w-full bg-cream flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>);
}
