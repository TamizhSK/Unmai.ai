'use client';

const socialButtons = [
  {
    label: 'Google',
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
      >
        <path
          d="M21.6 12.23c0-.74-.06-1.28-.19-1.84H12v3.34h5.54c-.11.83-.71 2.07-2.05 2.9l-.02.12 2.99 2.32.21.02c1.94-1.79 3.03-4.42 3.03-6.86Z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.15-2.45c-.84.55-1.96.93-3.47.93-2.65 0-4.9-1.79-5.7-4.27l-.12.01-3.08 2.39-.04.1C4.79 19.98 8.14 22 12 22Z"
          fill="#34A853"
        />
        <path
          d="M6.3 13.77c-.21-.66-.33-1.36-.33-2.08 0-.72.12-1.42.32-2.08l-.01-.14L3.15 7.03l-.1.05C2.35 8.6 2 10.25 2 11.87s.35 3.27 1.05 4.79l3.25-2.89Z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.5c1.87 0 3.13.8 3.85 1.47l2.81-2.74C16.94 2.79 14.7 2 12 2 8.14 2 4.79 4.02 3.05 7.07l3.24 2.52C7.1 7.3 9.35 5.5 12 5.5Z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    label: 'X',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M18.244 3H21l-6.347 7.252L22 21h-5.801l-4.143-5.438L7.1 21H3.334l6.717-7.672L2 3h5.88l3.776 4.987L18.244 3Zm-1.015 16.11h1.566L6.85 4.78H5.17l12.059 14.33Z" />
      </svg>
    ),
  },
];

export function LoginShowcase() {
  return (
    <div className="min-h-screen w-full bg-[#0f1215] text-white flex items-center justify-center py-10 px-4">
      <div className="flex w-full max-w-5xl rounded-[32px] bg-[#12171b] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="w-full max-w-md px-10 py-12 flex flex-col">
          <div className="mb-10">
            <div className="h-16 w-16 rounded-full bg-[#9fff1c] flex items-center justify-center shadow-[0_0_45px_rgba(159,255,28,0.6)]">
              <div className="h-9 w-9 rounded-full border-2 border-black flex items-center justify-center">
                <div className="h-4 w-5 bg-black rounded-t-[6px]" />
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-8">
            <h1 className="text-[32px] font-semibold">Welcome back!</h1>
            <p className="text-sm text-[#9ca3af]">Welcome back! Please enter your details.</p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            {socialButtons.map((button) => (
              <button
                key={button.label}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1d242b] px-4 py-3 text-sm font-medium text-[#e2e8f0] transition hover:bg-[#272f37]"
              >
                {button.icon}
                <span>{button.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-4 text-xs uppercase tracking-wider text-[#6b7280]">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#1f2933] to-transparent" />
              <span>or</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#1f2933] to-transparent" />
            </div>
          </div>

          <form className="space-y-5">
            <label className="block space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#adb5bd]">
                <span>Email</span>
                <span className="text-[#94a3b8]">*</span>
              </div>
              <input
                type="email"
                defaultValue="hello@examplegmail.com"
                className="w-full rounded-xl bg-[#1d242b] border border-transparent focus:border-[#9fff1c]/60 focus:outline-none px-4 py-3 text-sm text-[#f1f5f9] placeholder:text-[#6b7280] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              />
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#adb5bd]">
                <span>Password</span>
                <span className="text-[#94a3b8]">*</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  defaultValue="••••••••"
                  className="w-full rounded-xl bg-[#1d242b] border border-transparent focus:border-[#9fff1c]/60 focus:outline-none px-4 py-3 text-sm text-[#f1f5f9] placeholder:text-[#6b7280] pr-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                />
                <div className="absolute inset-y-0 right-3 flex items-center text-[#6b7280]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      fill="currentColor"
                      d="M12 5c-7.633 0-11 7-11 7s3.367 7 11 7 11-7 11-7-3.367-7-11-7Zm0 11c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4Zm0-6.5A2.5 2.5 0 0 0 9.5 12 2.5 2.5 0 0 0 12 14.5 2.5 2.5 0 0 0 14.5 12 2.5 2.5 0 0 0 12 9.5Z"
                    />
                  </svg>
                </div>
              </div>
            </label>

            <div className="flex items-center justify-between text-xs text-[#9ca3af]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="relative inline-flex h-4 w-4 items-center justify-center">
                  <input type="checkbox" defaultChecked className="peer h-4 w-4 rounded border border-[#3a424b] bg-[#1d242b] accent-[#9fff1c]" />
                  <span className="pointer-events-none absolute inset-0 rounded border border-[#3a424b] peer-focus-visible:ring-2 peer-focus-visible:ring-[#9fff1c]/40" />
                </span>
                <span>Remember for 30 days</span>
              </label>
              <button type="button" className="text-[#d1d5db] hover:text-white transition">Forgot password</button>
            </div>

            <button
              type="button"
              className="w-full rounded-xl bg-[#9fff1c] py-3 text-sm font-semibold text-black shadow-[0_15px_35px_rgba(159,255,28,0.35)] transition hover:scale-[1.01]"
            >
              Login
            </button>
          </form>

          <div className="mt-8 text-sm text-[#9ca3af]">
            Don&apos;t have an account?{' '}
            <button type="button" className="font-semibold text-[#9fff1c] hover:underline">Sign Up</button>
          </div>
        </div>

        <div className="hidden lg:block flex-1 bg-[#f6f7f0] relative">
          <div className="absolute inset-8 rounded-[28px] overflow-hidden shadow-[inset_0_2px_12px_rgba(0,0,0,0.08)]">
            <img
              src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
              alt="Landscape illustration"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
