'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Book,
  Shield,
  LayoutDashboard,
  Cpu,
  Menu,
  X,
  ChevronRight,
  Home,
  FileText,
} from 'lucide-react';

const sidebarItems = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Introduction',
        href: '/docs/introduction',
        icon: <Home className="w-4 h-4" />,
      },
      {
        label: 'Architecture',
        href: '/docs/architecture',
        icon: <Cpu className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'Guides',
    items: [
      {
        label: 'User Guide',
        href: '/docs/user-guide',
        icon: <Shield className="w-4 h-4" />,
      },
      {
        label: 'Admin Guide',
        href: '/docs/admin-guide',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Container */}
      <AnimatePresence>
        {(isOpen || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`
              fixed lg:sticky top-[4rem] left-0 h-[calc(100vh-4rem)]
              w-72 bg-white/80 backdrop-blur-md border-r border-border
              overflow-y-auto z-40 lg:block
              ${isOpen ? 'block' : 'hidden'}
            `}
          >
            <div className="p-6 space-y-8">
              {sidebarItems.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 font-heading px-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`
                            group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                            ${
                              isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                            }
                          `}
                        >
                          <span className={`${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                            {item.icon}
                          </span>
                          {item.label}
                          {isActive && (
                            <motion.div
                              layoutId="active-pill"
                              className="ml-auto"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                            >
                              <ChevronRight className="w-4 h-4 text-primary" />
                            </motion.div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              <div className="pt-8 mt-8 border-t border-border">
                 <Link
                    href="/chat"
                    className="flex items-center justify-center w-full px-4 py-3 bg-primary text-white rounded-xl font-heading text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
                  >
                    Launch App
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
