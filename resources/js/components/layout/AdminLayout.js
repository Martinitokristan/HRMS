import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cn } from '../../lib/utils';

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar 
                isOpen={sidebarOpen} 
                onClose={() => setSidebarOpen(false)} 
                isCollapsed={isCollapsed}
                toggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            <div className={cn(
                "flex flex-1 flex-col transition-all duration-300",
                isCollapsed ? "lg:pl-[80px]" : "lg:pl-[260px]"
            )}>
                <Topbar 
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
                    isCollapsed={isCollapsed}
                />

                <main className="flex-1 px-5 py-6 pt-[calc(64px+1.5rem)] lg:px-7 xl:px-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
