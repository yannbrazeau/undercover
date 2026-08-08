// En-tête d'écran : la photo du chantier donne son identité à l'application.
// Sur Budget, elle est nette (hero) ; sur les six autres écrans, un halo
// flouté sous le titre (head). Jamais de bandeau sombre, jamais de texte
// décoratif qui n'apporte rien (cahier §1 ter).

export default function ScreenHeader({
  eyebrow,
  title,
  hero,
}: {
  eyebrow?: string;
  title: string;
  hero?: boolean;
}) {
  if (hero) {
    return (
      <div className="hero">
        <div className="pic" role="img" aria-label="La maison de Bouchemaine" />
        <div className="veil" />
        <div className="heroTxt">
          {eyebrow && <p className="eb">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
      </div>
    );
  }

  return (
    <header className="head">
      <div className="glow" />
      <div className="headTxt">
        {eyebrow && <p className="sub">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
    </header>
  );
}
