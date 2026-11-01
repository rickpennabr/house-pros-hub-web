export const DOCUMENT_FORM_LAYOUT = {
  pageContainer: 'w-full md:max-w-4xl md:mx-auto',
  shell: 'bg-gray-100 md:bg-gray-200/80 rounded-xl p-4 md:p-6 shadow-sm',
  sheet: 'bg-white rounded-lg shadow-md overflow-hidden',
  contentPaddingX: 'px-4 md:px-8',
  header: 'grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-4 md:px-8 pt-6 pb-4 md:pb-6 border-b-2',
  tintBlock: 'rounded-none md:mx-4 md:rounded-lg p-4 md:p-5 mb-6 mt-4 md:mt-6',
  lineItemsSection: 'px-4 md:px-8 overflow-x-auto overflow-y-visible mb-6',
  totalsSection: 'px-4 md:px-8 mb-6 flex flex-col md:flex-row md:gap-8',
  actionBar:
    'sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3',
} as const;

