import { useState } from "react";
import App from "../../js/app.js";

export function TeamBadge({ teamName, className = "" }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const club = App.clubs.getClubByTeamName(teamName);
  const primary = club.CorPrimaria || "#64748b";
  const secondary = club.CorSecundaria || "#ffffff";
  const logo = String(club.LogoUrl || "").trim();
  const hasLogo =
    logo &&
    !App.clubs.isPlaceholder(teamName) &&
    !App.clubs.isDuplicateLogoUrl(teamName, logo) &&
    !App.clubs.isLogoUnavailable(logo) &&
    !logoFailed;
  const style = {
    "--club-primary": primary,
    "--club-secondary": secondary,
  };

  if (!hasLogo) {
    return (
      <span
        className={["club-badge", "fallback", className].join(" ")}
        style={style}
      >
        <span>{App.clubs.getInitials(teamName)}</span>
      </span>
    );
  }

  return (
    <span
      className={[
        "club-badge",
        "has-logo",
        logoLoaded ? "logo-loaded" : "",
        className,
      ].join(" ")}
      style={style}
    >
      <span className="logo-fallback">{App.clubs.getInitials(teamName)}</span>
      <img
        src={logo}
        alt={teamName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          App.clubs.handleLogoLoad(event.currentTarget);
          setLogoLoaded(true);
        }}
        onError={(event) => {
          App.clubs.handleLogoError(event.currentTarget);
          setLogoFailed(true);
        }}
      />
    </span>
  );
}

export function Matchup({ home, away, className = "" }) {
  return (
    <span className={["matchup", className].filter(Boolean).join(" ")}>
      <span className="matchup-side home">
        <span className="matchup-name">{home}</span>
        <TeamBadge teamName={home} className="small" />
      </span>
      <strong className="matchup-x">x</strong>
      <span className="matchup-side away">
        <TeamBadge teamName={away} className="small" />
        <span className="matchup-name">{away}</span>
      </span>
    </span>
  );
}

export function TeamIdentity({ teamName, className = "" }) {
  return (
    <span className={["team-identity", className].filter(Boolean).join(" ")}>
      <TeamBadge teamName={teamName} />
      <span className="team-identity-name">{teamName}</span>
    </span>
  );
}
