// En-tête d'écran : clair, titre sobre, sur-intitulé optionnel — jamais de
// texte décoratif qui n'apporte rien (voir cahier §1 ter).

export default function ScreenHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <header className="top">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
    </header>
  );
}
