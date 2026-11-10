// Cancara, the digital buddy. Uses the supplied horse artwork.
type Props = { size?: number; className?: string; title?: string };

export function Horse({ size = 56, className, title = 'Cancara, your digital buddy' }: Props) {
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
