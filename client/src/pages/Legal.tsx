import { Link } from "wouter";
import { Home as HomeIcon } from "lucide-react";

/* Page Mentions légales (/legal) */
export default function Legal() {
  return (
    <LegalShell
      title="Mentions légales"
      description="Informations légales relatives au site Panic Word."
    >
      <Section title="1. Éditeur du site">
        <p>
          Le site <strong>Panic Word</strong> est édité par :
        </p>
        <ul>
          <li>
            <strong>Nom / Raison sociale : [VOTRE NOM OU SOCIÉTÉ À COMPLÉTER]</strong>
          </li>
          <li>Adresse : [ADRESSE À COMPLÉTER]</li>
          <li>Email : [EMAIL À COMPLÉTER]</li>
        </ul>
      </Section>

      <Section title="2. Hébergement">
        <p>
          Le site est hébergé par :
        </p>
        <ul>
          <li>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
          <li>
            Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
          </li>
        </ul>
        <p>
          Le développement et la maintenance du site sont assurés à l'aide de la
          plateforme Manus (manus.im).
        </p>
      </Section>

      <Section title="3. Propriété intellectuelle">
        <p>
          L'ensemble du contenu du site Panic Word (textes, graphismes, logo,
          codes source, banques de mots) est la propriété de son éditeur ou fait
          l'objet d'une licence d'utilisation. Toute reproduction, représentation
          ou utilisation totale ou partielle sans autorisation préalable est
          interdite.
        </p>
      </Section>

      <Section title="4. Responsabilité">
        <p>
          Panic Word est un jeu de réflexion fourni « tel quel ». L'éditeur
          s'efforce d'assurer la disponibilité du site mais ne peut garantir un
          accès ininterrompu. Les scores sont calculés localement et les salles
          multijoueur sont conservées temporairement en mémoire serveur : ils
          peuvent être perdus en cas de redémarrage ou de maintenance.
        </p>
      </Section>

      <Section title="5. Loi applicable">
        <p>
          Les présentes mentions légales sont régies par la législation en
          vigueur. En cas de litige, les tribunaux compétents seront seuls
          habilités à statuer.
        </p>
      </Section>
    </LegalShell>
  );
}

/* Page Politique de confidentialité (/privacy) */
export function Privacy() {
  return (
    <LegalShell
      title="Politique de confidentialité"
      description="La manière dont Panic Word collecte et traite vos données."
    >
      <Section title="1. Principe : aucune donnée personnelle collectée">
        <p>
          Panic Word ne demande ni compte, ni adresse email, ni aucun
          identifiant personnel. Aucune inscription n'est requise pour jouer.
        </p>
      </Section>

      <Section title="2. Stockage local (votre appareil)">
        <p>
          Vos préférences (langue, thème, durée du chrono, intensité sonore,
          mode de saisie) et vos meilleurs scores sont enregistrés
          <strong> uniquement sur votre appareil</strong>, via le stockage local
          du navigateur (localStorage). Ils ne sont jamais transmis à nos
          serveurs et sont supprimés si vous effacez les données de votre
          navigateur.
        </p>
      </Section>

      <Section title="3. Mode multijoueur">
        <p>
          Lors d'une partie multijoueur, un pseudo et un code de salle à 4
          lettres sont générés temporairement. Les scores sont conservés en
          mémoire serveur le temps de la partie, puis définitivement effacés.
          Aucune donnée de partie n'est conservée au-delà de son exécution.
        </p>
      </Section>

      <Section title="4. Service Worker et mode hors-ligne">
        <p>
          Le site utilise un service worker pour mettre en cache les fichiers du
          jeu (banques de mots, interface) afin de fonctionner hors ligne. Ce
          cache est stocké localement sur votre appareil.
        </p>
      </Section>

      <Section title="5. Analyses d'audience (optionnelles)">
        <p>
          Des mesures d'audience anonymisées et sans cookies peuvent être
          utilisées pour mesurer la fréquentation du site. Elles ne permettent
          pas de vous identifier.
        </p>
      </Section>

      <Section title="6. Publicité (lorsqu'elle sera activée)">
        <p>
          Si de la publicité (par exemple via Google AdSense) est activée à
          l'avenir, des cookies publicitaires pourront être déposés par le
          prestataire. Un bandeau de consentement et une politique de cookies
          dédiée seront alors publiés, conformément au RGPD.
        </p>
      </Section>

      <Section title="7. Vos droits">
        <p>
          Conformément au RGPD, vous disposez d'un droit d'accès, de
          rectification et de suppression de vos données. Comme le site ne
          collecte aucune donnée personnelle, ce droit s'exerce simplement en
          effaçant les données locales de votre navigateur. Pour toute question :
          [EMAIL DE CONTACT À COMPLÉTER].
        </p>
      </Section>
    </LegalShell>
  );
}

/* Page Contact (/contact) */
export function Contact() {
  return (
    <LegalShell
      title="Contact"
      description="Une question, un bug, une idée ? Écrivez-nous."
    >
      <Section title="Nous écrire">
        <p>
          Pour toute question, signalement de bug, suggestion ou demande
          commerciale, contactez-nous par email :
        </p>
        <p className="text-center text-lg font-semibold text-foreground">
          <a href="mailto:[EMAIL À COMPLÉTER]">[EMAIL À COMPLÉTER]</a>
        </p>
      </Section>

      <Section title="Délais de réponse">
        <p>
          Nous nous efforçons de répondre à toute demande dans un délai de
          7 jours ouvrés.
        </p>
      </Section>

      <Section title="Bug du jeu">
        <p>
          Si vous rencontrez un problème en jeu (chrono bloqué, son en boucle,
          mot invalide…), merci d'indiquer la langue choisie, la difficulté et
          ce que vous faisiez au moment du problème.
        </p>
      </Section>
    </LegalShell>
  );
}

/* ---------- composants internes ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_a]:hover:text-foreground">
        {children}
      </div>
    </section>
  );
}

function LegalShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-10">
        <Link
          href="/"
          className="mb-4 inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <HomeIcon className="h-3.5 w-3.5" />
          Accueil
        </Link>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>
        <div className="flex-1">{children}</div>
        <footer className="mt-8 flex items-center justify-center gap-4 border-t border-border/40 pt-4 text-xs text-muted-foreground">
          <Link href="/legal" className="hover:text-foreground">
            Mentions légales
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-foreground">
            Confidentialité
          </Link>
          <span aria-hidden>·</span>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </footer>
      </div>
    </main>
  );
}
