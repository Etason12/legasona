const SalesPagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <span className="text-xs font-bold text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button 
          disabled={page === 1}
          onClick={() => onPageChange(p => Math.max(1, p - 1))} 
          className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          Previous
        </button>
        <button 
          disabled={page === totalPages}
          onClick={() => onPageChange(p => p + 1)} 
          className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default SalesPagination
