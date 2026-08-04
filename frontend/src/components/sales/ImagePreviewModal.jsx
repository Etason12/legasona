import { X } from 'lucide-react'

const ImagePreviewModal = ({ src, onClose }) => {
  if (!src) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 p-2 bg-white dark:bg-neutral-800 rounded-full text-slate-900 dark:text-white transition-colors"><X size={22} /></button>
        <img src={src} alt="Receipt" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700" />
      </div>
    </div>
  )
}

export default ImagePreviewModal
