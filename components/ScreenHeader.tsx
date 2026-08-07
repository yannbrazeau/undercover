// En-tête d'écran : bandeau vert, sur-intitulé laiton, titre Georgia.

export default function ScreenHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="top">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}
