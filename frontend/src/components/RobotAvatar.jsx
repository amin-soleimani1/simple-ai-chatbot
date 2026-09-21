export default function RobotAvatar() {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="ربات در حال استراحت"
      className="robot-avatar"
    >
      <circle cx="32" cy="32" r="30" className="robot-avatar__backdrop" />
      <circle cx="32" cy="32" r="30.25" className="robot-avatar__outer-halo" />
      <circle cx="32" cy="32" r="29.25" className="robot-avatar__ring" />
      <circle cx="32" cy="32" r="28.1" className="robot-avatar__ring-highlight" transform="rotate(-112 32 32)" />
      <g className="robot-avatar__head">
        <rect x="12" y="17" width="40" height="30" rx="11" className="robot-avatar__shell" />
        <path d="M22 18.5h20" className="robot-avatar__shell-highlight" />
        <rect x="17" y="25" width="30" height="14" rx="6" className="robot-avatar__visor" />
        <g className="robot-avatar__left-eye"><path d="M22.5 32h5.5" /></g>
        <g className="robot-avatar__right-eye"><path d="M36 32h5.5" /></g>
      </g>
    </svg>
  );
}
