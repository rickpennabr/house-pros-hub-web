'use client';

/**
 * Apple Theme Demo Component
 * Demonstrates various Apple-style effects available in the theme
 */
export default function AppleThemeDemo() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Apple Theme Examples</h1>
      
      {/* Glass Card Example */}
      <div className="apple-card p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Glass Card</h2>
        <p className="text-gray-600 dark:text-gray-300">
          This card uses the apple-card class with glassmorphism effect.
        </p>
      </div>

      {/* Glass Container Example */}
      <div className="apple-container p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Glass Container</h2>
        <p className="text-gray-600 dark:text-gray-300">
          This container uses the apple-container class with backdrop blur.
        </p>
      </div>

      {/* Button Examples */}
      <div className="space-x-4">
        <button className="apple-button">Apple Button</button>
        <button className="apple-button apple-hover-scale">Hover Scale</button>
        <button className="apple-button apple-hover-lift">Hover Lift</button>
      </div>

      {/* Shadow Examples */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="apple-glass apple-rounded-lg apple-shadow-sm p-4">
          <p className="text-sm font-medium">Small Shadow</p>
        </div>
        <div className="apple-glass apple-rounded-lg apple-shadow-md p-4">
          <p className="text-sm font-medium">Medium Shadow</p>
        </div>
        <div className="apple-glass apple-rounded-lg apple-shadow-lg p-4">
          <p className="text-sm font-medium">Large Shadow</p>
        </div>
        <div className="apple-glass apple-rounded-lg apple-shadow-xl p-4">
          <p className="text-sm font-medium">XL Shadow</p>
        </div>
      </div>

      {/* Input Example */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Apple Input</label>
        <input 
          type="text" 
          placeholder="Type something..." 
          className="apple-input w-full max-w-md"
        />
      </div>

      {/* Hover Effects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="apple-card p-6 apple-hover-lift cursor-pointer">
          <h3 className="font-semibold mb-2">Hover to Lift</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This card lifts up on hover
          </p>
        </div>
        <div className="apple-card p-6 apple-hover-scale cursor-pointer">
          <h3 className="font-semibold mb-2">Hover to Scale</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This card scales up on hover
          </p>
        </div>
      </div>

      {/* Rounded Corners Examples */}
      <div className="flex flex-wrap gap-4">
        <div className="apple-glass apple-rounded p-4">
          <p className="text-sm">Rounded (12px)</p>
        </div>
        <div className="apple-glass apple-rounded-lg p-4">
          <p className="text-sm">Rounded LG (20px)</p>
        </div>
        <div className="apple-glass apple-rounded-xl p-4">
          <p className="text-sm">Rounded XL (24px)</p>
        </div>
        <div className="apple-glass apple-rounded-full px-6 py-4">
          <p className="text-sm">Rounded Full</p>
        </div>
      </div>
    </div>
  );
}

