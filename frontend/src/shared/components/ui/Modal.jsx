import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
    return (<AnimatePresence>
      {open &&
            <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={onClose}/>
          <motion.div className={`relative bg-white w-full ${maxWidth} rounded-t-4xl sm:rounded-4xl shadow-lift p-6 sm:p-7 max-h-[90vh] overflow-y-auto no-scrollbar`} initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.98 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
            <div className="flex items-center justify-between mb-4">
              {title && <h3 className="text-lg font-bold text-charcoal">{title}</h3>}
              <button onClick={onClose} className="ml-auto w-9 h-9 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.05] transition-colors" aria-label="Close">
                <XIcon size={18}/>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>}
    </AnimatePresence>);
}
