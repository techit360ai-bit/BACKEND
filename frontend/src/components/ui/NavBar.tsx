const NavBar = () => {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-linear-to-r from-sky-50 to-violet-50 dark:from-slate-900/50 dark:to-purple-900/50 backdrop-blur sticky top-0 z-40">
      <span className="font-semibold bg-linear-to-r from-violet-600 to-cyan-600 dark:from-violet-400 dark:to-cyan-400 bg-clip-text text-transparent">
        TechIT Forge
      </span>
    </nav>
  );
};

export default NavBar;
