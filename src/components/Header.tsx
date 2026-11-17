import React from "react";

interface HeaderProps {
  onNewProduct: () => void;
  hasResult: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewProduct, hasResult }) => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#studio-top"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection("studio-top");
          }}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          KlipCart
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => scrollToSection("studio-top")}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Upload Studio
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("video-stage")}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Video Stage
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("strategist-copy")}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Strategist Copy
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("workflow-guide")}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Workflow Guide
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewProduct}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hasResult ? "New Product" : "Upload Screenshot"}
          </button>
        </div>
      </div>
    </header>
  );
};
