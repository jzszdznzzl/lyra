interface AvatarProps {
  name: string;
  url: string | null;
  size?: number;
}

export function Avatar({ name, url, size = 38 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (url) {
    return <img src={url} alt={name} style={style} className="rounded-full object-cover" />;
  }

  return (
    <span
      aria-label={name}
      style={style}
      className="grid place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-extrabold text-white"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
