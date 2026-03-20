import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-1 flex-col lg:pl-[260px]">
                <Topbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

                <main className="flex-1 px-5 py-6 pt-[calc(64px+1.5rem)] lg:px-7 xl:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
