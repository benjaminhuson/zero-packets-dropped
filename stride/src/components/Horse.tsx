// Cancara, the AI buddy. Uses the supplied horse artwork.
type Props = { size?: number; className?: string; title?: string };

export function Horse({ size = 56, className, title = 'Cancara, your AI buddy' }: Props) {
  return (
    <img
      className={`horse-img${className ? ` ${className}` : ''}`}
      src="/cancara.png"
      width={size}
      height={size}
      alt={title}
      draggable={false}
    />
  );
}
